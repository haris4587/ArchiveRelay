"""Direct-mode behavior with explicit source, capture, LLM, and transfer mocks."""
from contextlib import contextmanager
from datetime import datetime, timezone
from hashlib import sha256

from gltest.direct import VMContext, create_address, deploy_contract


SOURCE = "https://example.org/story"
ARCHIVE = "https://web.archive.org/web/20260928/https://example.org/story"
PAGE = "<html><h1>Historic public record</h1><p>Preserve this passage and its author.</p></html>"
REWARD = 10**18


@contextmanager
def funded_bounty():
    vm = VMContext()
    vm.warp("2026-09-28T00:00:00+00:00")
    sponsor = create_address("sponsor")
    vm.sender = sponsor
    vm.value = REWARD
    vm.mock_web(r"^https://example\.org/story$", {"status": 200, "body": PAGE})
    with vm.activate():
        contract = deploy_contract("contracts/archive_relay.py", vm, sdk_version="v0.2.12")
        deadline = int(datetime(2026, 9, 30, tzinfo=timezone.utc).timestamp())
        bounty_id = contract.create_bounty(
            "Historic public record", SOURCE, "Preserve this passage", "",
            "Keep the author and original meaning", deadline
        )
        assert int(bounty_id) == 0
        bounty = contract.get_bounty(0)
        assert int(bounty.reward) == REWARD
        assert bounty.source_digest == sha256(PAGE.encode()).hexdigest()
        assert int(contract.bounty_count()) == 1
        yield vm, contract, sponsor


def test_inconclusive_when_source_changes():
    with funded_bounty() as (vm, contract, _):
        vm.sender = create_address("archivist")
        vm.value = 0
        vm.clear_mocks()
        vm.mock_web(r"^https://example\.org/story$", {"status": 200, "body": "<html>Changed</html>"})
        assert contract.submit_archive(0, ARCHIVE) == "INCONCLUSIVE"
        assert contract.get_bounty(0).status == "OPEN"
        assert contract.get_attempt(0).outcome == "INCONCLUSIVE"
        assert vm.run_validator() is True


def test_rejected_archive_and_duplicate_limit():
    with funded_bounty() as (vm, contract, _):
        vm.sender = create_address("archivist")
        vm.value = 0
        vm.mock_web(r"^https://web\.archive\.org/", {"status": 200, "body": "<html>Missing passage</html>"})
        vm.mock_llm(r".*", '{"outcome":"REJECTED","reason":"Required passage is absent"}')
        assert contract.submit_archive(0, ARCHIVE) == "REJECTED"
        assert contract.get_bounty(0).status == "OPEN"
        assert vm.run_validator() is True
        with vm.expect_revert("already submitted"):
            contract.submit_archive(0, ARCHIVE)


def test_refund_only_after_deadline():
    with funded_bounty() as (vm, contract, _):
        vm.value = 0
        with vm.expect_revert("Not refundable"):
            contract.refund_expired(0)
        vm.warp("2026-10-01T00:00:00+00:00")
        contract.refund_expired(0)
        assert contract.get_bounty(0).status == "REFUNDED"
        with vm.expect_revert("Not refundable"):
            contract.refund_expired(0)


def test_qualifying_archive_emits_exact_payout_once():
    with funded_bounty() as (vm, contract, _):
        archivist = create_address("archivist")
        payouts = []

        def capture_transfer(_, request):
            if "EthSend" in request:
                payouts.append(request["EthSend"])
                return {"ok": None}
            return None

        vm._gl_call_hook = capture_transfer
        vm.sender = archivist
        vm.value = 0
        vm.mock_web(r"^https://web\.archive\.org/", {
            "status": 200,
            "body": "<article><p>Preserve this passage and its author.</p><h1>Historic public record</h1></article>",
        })
        vm.mock_llm(r".*", '{"outcome":"QUALIFIED","reason":"Passage and attribution preserved"}')

        assert contract.submit_archive(0, ARCHIVE) == "QUALIFIED"
        assert vm.run_validator() is True
        bounty = contract.get_bounty(0)
        assert bounty.status == "AWARDED"
        assert bounty.winner == archivist
        assert bounty.winning_url == ARCHIVE
        assert int(bounty.submissions) == 1
        assert contract.get_attempt(0).outcome == "QUALIFIED"
        assert int(contract.attempt_count()) == 1
        assert len(payouts) == 1
        assert payouts[0]["address"] == archivist
        assert int(payouts[0]["value"]) == REWARD
        assert payouts[0]["calldata"] == b""
        with vm.expect_revert("closed"):
            contract.submit_archive(0, ARCHIVE + "?again=1")
        assert len(payouts) == 1
