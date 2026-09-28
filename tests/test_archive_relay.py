"""Direct-mode contract behavior with public web and LLM responses mocked."""
from datetime import datetime, timezone

from gltest.direct import VMContext, create_address, deploy_contract


SOURCE = "https://example.org/story"
ARCHIVE = "https://web.archive.org/web/20260928/https://example.org/story"
PAGE = "<html><h1>Historic public record</h1><p>Preserve this passage and its author.</p></html>"
REWARD = 10**18


def setup():
    vm = VMContext()
    vm.warp("2026-09-28T00:00:00+00:00")
    vm.sender = create_address("sponsor")
    vm.value = REWARD
    vm.mock_web(r"example\.org/story", {"status": 200, "body": PAGE})
    with vm.activate():
        contract = deploy_contract("contracts/archive_relay.py", vm)
        deadline = int(datetime(2026, 9, 30, tzinfo=timezone.utc).timestamp())
        bounty_id = contract.create_bounty("Historic public record", SOURCE,
            "Preserve this passage", "", "Keep the author and original meaning", deadline)
        assert int(bounty_id) == 0
        assert int(contract.get_bounty(0).reward) == REWARD
        return vm, contract


def test_inconclusive_when_source_changes():
    vm, contract = setup()
    vm.sender = create_address("archivist")
    vm.value = 0
    vm.clear_mocks()
    vm.mock_web(r"example\.org/story", {"status": 200, "body": "<html>Changed</html>"})
    with vm.activate():
        result = contract.submit_archive(0, ARCHIVE)
        assert result == "INCONCLUSIVE"
        assert contract.get_bounty(0).status == "OPEN"
        assert contract.get_attempt(0).outcome == "INCONCLUSIVE"
        assert vm.run_validator() is True


def test_rejected_archive_and_duplicate_limit():
    vm, contract = setup()
    vm.sender = create_address("archivist")
    vm.value = 0
    vm.mock_web(r"web\.archive\.org", {"status": 200, "body": "<html>Missing passage</html>"})
    vm.mock_llm(r".*", '{"outcome":"REJECTED","reason":"Required passage is absent"}')
    with vm.activate():
        assert contract.submit_archive(0, ARCHIVE) == "REJECTED"
        assert contract.get_bounty(0).status == "OPEN"
        assert vm.run_validator() is True
        with vm.expect_revert("already submitted"):
            contract.submit_archive(0, ARCHIVE)


def test_refund_only_after_deadline():
    vm, contract = setup()
    vm.value = 0
    with vm.activate():
        with vm.expect_revert("Not refundable"):
            contract.refund_expired(0)
        vm.warp("2026-10-01T00:00:00+00:00")
        contract.refund_expired(0)
        assert contract.get_bounty(0).status == "REFUNDED"
        with vm.expect_revert("Not refundable"):
            contract.refund_expired(0)
