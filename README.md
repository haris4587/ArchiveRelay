# ArchiveRelay

**Preserve the page. Prove the preservation.** ArchiveRelay is a GenLayer bounty board for preserving public web pages. Sponsors fund GEN rewards for a specific original page and list the text, images, and context that must survive. Archivists submit public HTTPS archive links. An Intelligent Contract independently fetches source and capture, judges preservation fidelity with validator consensus, and awards the first qualifying submission.

## Status

Contract and frontend implemented. The app displays only finalized chain data. Set `VITE_CONTRACT_ADDRESS` to a verified Studionet deployment to activate writes and reads. No sample bounty is represented as onchain activity.

## Contract flow

1. `create_bounty(...)` is payable. The sponsor sends the exact GEN reward, commits a brief and deadline (one hour to 30 days), and the contract fetches the original page. A SHA-256 digest of the UTF-8 HTML response is stored by strict equivalence. Unavailable or oversized source pages cannot be funded.
2. `submit_archive(id, archive_url)` accepts a separate public HTTPS URL before the deadline. The contract refetches the source and checks its committed digest. If it has disappeared or changed, it records **INCONCLUSIVE**. It separately fetches the archive; unavailable or oversized captures also produce **INCONCLUSIVE**. Otherwise the leader and validators independently judge preservation of text, essential image evidence, and surrounding context. The payout decision field must match between independently derived outcomes.
3. **QUALIFIED** atomically closes the bounty to later entries and emits the exact reward transfer to the archivist on finalization. **REJECTED** and **INCONCLUSIVE** are recorded with a short reason. Sixteen total attempts and three per archivist are permitted; a link cannot be reused for a bounty.
4. After the deadline, anyone may call `refund_expired(id)` for an open bounty. It closes the bounty and emits the exact reward transfer back to the sponsor. A settled bounty cannot pay twice.

All limits, balances, deadlines, unique links, status transitions, and payout destinations are deterministic. The LLM only interprets preservation fidelity. Page content is untrusted prompt data. The contract never accepts a submitted description as proof of a live archive.

### Evidence limitations

The source fingerprint uses raw UTF-8 response bytes, so dynamic pages can become inconclusive after seemingly irrelevant HTML changes. The judgment sees a bounded HTML extract (50 KB per page); pages above 120 KB are inconclusive/unavailable. An image tag alone is not pixel proof; when HTML does not establish essential image survival, evaluators must return inconclusive. Archives behind bot blocks, login walls, scripts, or unsupported content types may not be assessable. URL checks block obvious local/IP hosts, while the GenVM web sandbox and any redirect policy remain part of deployment security; only use trusted public archive hosts until that behavior is verified in a real network run. GEN transfers are emitted on finalization; inspect the resulting child/external transfer in the network explorer.

## Run locally

```bash
npm ci
cp .env.example .env.local
npm run dev
npm run build
python -m pip install genlayer-test genvm-linter
genvm-lint contracts/archive_relay.py
pytest tests -q
```

The website uses `genlayer-js@2.0.0-rc.1`, the v2 API in current GenLayer documentation. It reads with `LATEST_FINAL`, estimates the fee for wallet-backed writes, waits for finalization, and checks the execution result. Wallet writes require an EIP-1193 provider connected to Studionet. The website does not ask for a private key. The Studio built-in account can deploy and exercise the contract inside Studio without connecting a browser wallet to the website.

## Deploy and verify in Studio

1. Open [GenLayer Studio](https://studio.genlayer.com), select **Studionet** and a funded built-in account (faucet in the account selector).
2. Load `contracts/archive_relay.py`, deploy with no constructor arguments, and wait for a successful finalized result. Save the contract address and deploy transaction link.
3. From the contract write panel, create a small funded bounty against a stable, public HTML page. Set the payable value separately from transaction fees. Confirm the source digest and reward through `get_bounty(0)` after finalization.
4. Submit a genuine public archive URL; inspect its recorded outcome with `get_attempt(0)` and the final state. Try a changed/unavailable URL for inconclusive behavior. For payout and refund paths, use distinct bounties and inspect emitted transfer settlement.
5. Set the contract address as `VITE_CONTRACT_ADDRESS` in `.env.local` for local testing and as a GitHub Actions repository variable for Pages. Rebuild or rerun the site workflow. Do not publish a purported live contract address before step 2 confirms it.

## Website

The responsive React app has a preservation board, funded bounty form, archive submission panel, outcome history, source and archive links, wallet connection, and transaction finalization status. It deliberately shows an empty real board before deployment. GitHub Pages workflow publishes on `main` when Pages is configured to use **GitHub Actions**; the repository variable `VITE_CONTRACT_ADDRESS` injects the verified contract address at build time.

## Reference documentation

- [Networks and Studionet RPC](https://docs.genlayer.com/developers/networks)
- [Web access](https://docs.genlayer.com/developers/intelligent-contracts/features/web-access)
- [Equivalence principle and independent validation](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle)
- [Value transfers](https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers)
- [Writing and finalization](https://docs.genlayer.com/developers/decentralized-applications/writing-data)
- [Finalized reads](https://docs.genlayer.com/developers/decentralized-applications/reading-data)
