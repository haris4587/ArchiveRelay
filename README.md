# ArchiveRelay

**Preserve the page. Prove the preservation.** ArchiveRelay is a GenLayer bounty board for preserving public web pages. Sponsors fund GEN rewards for a specific original page and list the text, images, and context that must survive. Archivists submit public HTTPS archive links. An Intelligent Contract independently fetches source and capture, judges preservation fidelity with validator consensus, and awards the first qualifying submission.

## Status

The [public ArchiveRelay app](https://archiverelay-haris4587.itzanza2.chatgpt.site) is live. The revised contract is deployed on Studionet at [`0x1E33Fd854F0Ed54A8CDAf52E1bEEadE7Fa39f9fE`](https://explorer-studio.genlayer.com/address/0x1E33Fd854F0Ed54A8CDAf52E1bEEadE7Fa39f9fE). Its deployed code was compared byte for byte with `contracts/archive_relay.py`, and deployment transaction `0x73ad612c3df83656b8e0b1ad1fb3dc0844aa25a14c0932ff5296b548185e052c` finalized. Finalized `bounty_count()` was 0 at verification on 29 September 2026. The funded pilot and reward settlement remain unverified. The app shows finalized chain data only and does not present the public pilot HTML files as onchain bounty activity.

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

The website uses `genlayer-js@1.1.8` for stable Studionet, reads with `LATEST_FINAL`, waits for finalization on wallet-backed writes, and checks the execution result. Wallet writes require an EIP-1193 provider connected to Studionet. The website does not ask for a private key. The Studio built-in account can deploy and exercise the contract inside Studio without connecting a browser wallet to the website. The SDK 2.0 release candidate was incompatible with the stable Studio RPC when tested here.

## Deploy and verify in Studio

1. Open [GenLayer Studio](https://studio.genlayer.com), select **Studionet** and a funded built-in account (faucet in the account selector).
2. The revision is already deployed at the address above. To deploy another instance, load `contracts/archive_relay.py` with no constructor arguments and wait for a successful finalized result.
3. From the contract write panel, create a small funded bounty against a stable, public HTML page. Set the payable value separately from transaction fees. Confirm the source digest and reward through `get_bounty(0)` after finalization.
4. Submit a genuine public archive URL; inspect its recorded outcome with `get_attempt(0)` and the final state. Try a changed/unavailable URL for inconclusive behavior. For payout and refund paths, use distinct bounties and inspect emitted transfer settlement.
5. The verified revision address is the app default. Set `VITE_CONTRACT_ADDRESS` to use a later verified instance and rebuild. Do not substitute the earlier `0x7e99e2D8CfFFDF3A38EB4E6F0247bEeF457f6a6C` instance: it predates the storage capture fix.

## Website

The responsive React app has a preservation board, funded bounty form, archive submission panel, outcome history, source and archive links, wallet connection, and transaction finalization status. It shows the real empty board until a bounty finalizes. The public build is hosted with Sites. GitHub Actions runs `npm ci` and `npm run build` on pushes and pull requests. `VITE_CONTRACT_ADDRESS` may override the verified default at build time.

### Public pilot evidence

`evidence/pilot-source.html` and `evidence/pilot-capture.html` are synthetic, project-controlled HTML fixtures with the same passage and attribution in different layouts. They support a transparent live test if validators can fetch raw GitHub content. They are not independent preservation by a third-party archive and no payout is claimed for them. A Studio simulation of creation did not yield a confirmed result; the live payable action was blocked by automatic approval review.

## Reference documentation

- [Networks and Studionet RPC](https://docs.genlayer.com/developers/networks)
- [Web access](https://docs.genlayer.com/developers/intelligent-contracts/features/web-access)
- [Equivalence principle and independent validation](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle)
- [Value transfers](https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers)
- [Writing and finalization](https://docs.genlayer.com/developers/decentralized-applications/writing-data)
- [Finalized reads](https://docs.genlayer.com/developers/decentralized-applications/reading-data)
