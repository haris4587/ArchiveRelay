import { createClient, isSuccessful } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionHashVariant } from 'genlayer-js/types';

export const CONTRACT = (import.meta.env.VITE_CONTRACT_ADDRESS || '').trim() as `0x${string}`;
export const EXPLORER = 'https://explorer-studio.genlayer.com';
const readClient = createClient({ chain: studionet });

type Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
declare global { interface Window { ethereum?: Provider } }

export type Bounty = {
  sponsor: string; title: string; source_url: string; required_text: string; required_images: string;
  required_context: string; source_digest: string; deadline: number; reward: string;
  status: string; winner: string; winning_url: string; submissions: number;
};
export type Attempt = { bounty_id: number; archivist: string; archive_url: string; outcome: string; reason: string; submitted_at: number };

function record(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>;
  throw new Error('Unexpected contract response');
}
function bounty(raw: unknown): Bounty {
  const x = record(raw);
  return { sponsor: String(x.sponsor), title: String(x.title), source_url: String(x.source_url),
    required_text: String(x.required_text), required_images: String(x.required_images),
    required_context: String(x.required_context), source_digest: String(x.source_digest),
    deadline: Number(x.deadline), reward: String(x.reward), status: String(x.status),
    winner: String(x.winner), winning_url: String(x.winning_url), submissions: Number(x.submissions) };
}
function attempt(raw: unknown): Attempt {
  const x = record(raw);
  return { bounty_id: Number(x.bounty_id), archivist: String(x.archivist), archive_url: String(x.archive_url),
    outcome: String(x.outcome), reason: String(x.reason), submitted_at: Number(x.submitted_at) };
}
async function read(functionName: string, args: (string | number | bigint)[] = []) {
  return readClient.readContract({ address: CONTRACT, functionName, args, transactionHashVariant: TransactionHashVariant.LATEST_FINAL });
}
export async function loadBoard() {
  if (!/^0x[a-fA-F0-9]{40}$/.test(CONTRACT)) return { bounties: [] as (Bounty & { id: number })[], attempts: [] as Attempt[] };
  const [count, attemptCount] = await Promise.all([read('bounty_count'), read('attempt_count')]);
  const [allBounties, allAttempts] = await Promise.all([
    Promise.all(Array.from({ length: Math.min(Number(count), 100) }, (_, i) => read('get_bounty', [i]).then(x => ({ ...bounty(x), id: i })))),
    Promise.all(Array.from({ length: Math.min(Number(attemptCount), 1600) }, (_, i) => read('get_attempt', [i]).then(attempt))),
  ]);
  return { bounties: allBounties.reverse(), attempts: allAttempts.reverse() };
}
export async function connectWallet(): Promise<string> {
  if (!window.ethereum) throw new Error('Install an EIP-1193 wallet to sign writes. You can still browse without one.');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
  if (!accounts?.[0]) throw new Error('No wallet account selected');
  return accounts[0];
}
export async function write(account: string, functionName: string, args: (string | number | bigint)[], value?: bigint, onHash?: (hash: string) => void) {
  if (!window.ethereum) throw new Error('Wallet provider unavailable');
  if (!/^0x[a-fA-F0-9]{40}$/.test(CONTRACT)) throw new Error('Contract deployment is not configured yet');
  const client = createClient({ chain: studionet, account: account as `0x${string}`, provider: window.ethereum });
  await client.connect('studionet');
  const call = { address: CONTRACT, functionName, args, ...(value === undefined ? {} : { value }) };
  const estimate = await client.estimateTransactionFeesForWrite(call);
  const hash = await client.writeContract({ ...call, fees: { distribution: estimate.distribution, feeValue: estimate.feeValue } });
  onHash?.(hash);
  const transaction = await client.waitForFinalization({ hash });
  if (!isSuccessful(transaction)) throw new Error(`Transaction ${hash} failed: ${transaction.statusName} / ${transaction.txExecutionResultName}`);
  return hash;
}
export function toWei(gen: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(gen) || Number(gen) <= 0) throw new Error('Enter a positive GEN reward (up to 18 decimals)');
  const [whole, fraction = ''] = gen.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
}
export function fromWei(value: string): string {
  try { return (Number(BigInt(value)) / 1e18).toLocaleString('en-US', { maximumFractionDigits: 4 }); }
  catch { return '—'; }
}
