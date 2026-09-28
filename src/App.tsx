import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Archive, Check, CheckCircle2, Clock3, Copy, ExternalLink, FileText, Globe2, Image as ImageIcon, Link2, LockKeyhole, Menu, Plus, RefreshCw, Search, ShieldCheck, Wallet, X } from 'lucide-react';
import { CONTRACT, EXPLORER, connectWallet, fromWei, loadBoard, toWei, write, type Attempt, type Bounty } from './genlayer';

type ListedBounty = Bounty & { id: number };
const short = (s: string) => s ? `${s.slice(0, 6)}…${s.slice(-4)}` : '—';
const date = (s: number) => new Date(s * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const validUrl = (s: string) => { try { const u = new URL(s); return u.protocol === 'https:' && !!u.hostname.includes('.'); } catch { return false; } };
const initial = { title: '', source_url: '', required_text: '', required_images: '', required_context: '', deadline: '', reward: '' };

export default function App() {
  const [account, setAccount] = useState('');
  const [bounties, setBounties] = useState<ListedBounty[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hash, setHash] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<'create' | 'submit' | null>(null);
  const [selected, setSelected] = useState<ListedBounty | null>(null);
  const [form, setForm] = useState(initial);
  const [archiveUrl, setArchiveUrl] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All bounties');
  const [mobileMenu, setMobileMenu] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { const board = await loadBoard(); setBounties(board.bounties); setAttempts(board.attempts); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const live = /^0x[a-fA-F0-9]{40}$/.test(CONTRACT);
  const open = bounties.filter(b => b.status === 'OPEN' && b.deadline >= Date.now() / 1000).length;
  const total = bounties.reduce((sum, b) => sum + (b.status === 'OPEN' ? Number(BigInt(b.reward)) / 1e18 : 0), 0);
  const awarded = bounties.filter(b => b.status === 'AWARDED').length;
  const displayed = useMemo(() => bounties.filter(b => {
    const matches = `${b.title} ${b.source_url} ${b.required_text}`.toLowerCase().includes(query.toLowerCase());
    return matches && (filter === 'All bounties' || (filter === 'Open' && b.status === 'OPEN' && b.deadline >= Date.now() / 1000) || (filter === 'Awarded' && b.status === 'AWARDED') || (filter === 'Expired' && (b.status === 'REFUNDED' || b.status === 'OPEN' && b.deadline < Date.now() / 1000)));
  }), [bounties, filter, query]);

  async function ensureAccount() { if (account) return account; const a = await connectWallet(); setAccount(a); return a; }
  async function act(functionName: string, args: (string | number | bigint)[], value?: bigint) {
    setBusy(true); setError(''); setNotice(''); setHash('');
    try {
      const a = await ensureAccount();
      const result = await write(a, functionName, args, value, h => setHash(h));
      setNotice(`Finalized successfully · ${short(result)}`);
      setModal(null); setForm(initial); setArchiveUrl(''); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!validUrl(form.source_url)) { setError('Enter a public HTTPS source URL'); return; }
    const deadline = Math.floor(new Date(form.deadline).getTime() / 1000);
    if (!Number.isFinite(deadline) || deadline <= Date.now() / 1000 + 3600) { setError('Choose a deadline at least one hour ahead'); return; }
    try { await act('create_bounty', [form.title.trim(), form.source_url.trim(), form.required_text.trim(), form.required_images.trim(), form.required_context.trim(), deadline], toWei(form.reward)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }
  const openSubmit = (b: ListedBounty) => { setSelected(b); setModal('submit'); setError(''); setHash(''); };
  const selectedAttempts = selected ? attempts.filter(a => a.bounty_id === selected.id) : [];

  return <div className="site">
    <header className="header"><div className="shell nav">
      <a href="#home" className="brand" aria-label="ArchiveRelay home"><span className="brand-mark"><Archive size={21} strokeWidth={2.5}/></span><span>archive<span className="brand-accent">relay</span><span className="brand-dot">.</span></span></a>
      <nav className={mobileMenu ? 'nav-links open' : 'nav-links'} aria-label="Main navigation"><a href="#bounties" onClick={() => setMobileMenu(false)}>Explore bounties</a><a href="#how" onClick={() => setMobileMenu(false)}>How it works</a><a href="#about" onClick={() => setMobileMenu(false)}>About</a></nav>
      <div className="nav-actions"><span className="network"><i/> Studionet</span><button className="wallet-button" onClick={() => void ensureAccount().catch(e => setError(e.message))}><Wallet size={16}/>{account ? short(account) : 'Connect wallet'}</button><button className="menu-button" aria-label="Toggle menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={22}/></button></div>
    </div></header>

    <main id="home">
      <section className="hero"><div className="shell hero-grid"><div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-line"/> THE OPEN WEB IS WORTH KEEPING</div>
        <h1>Some pages<br/>deserve to <em>last.</em></h1>
        <p className="hero-lead">Fund the preservation of public web pages. Archivists submit a capture. GenLayer judges what survived and rewards the first faithful archive.</p>
        <div className="hero-ctas"><a href="#bounties" className="button primary">Explore bounties <ArrowRight size={17}/></a><button className="button ghost" onClick={() => { setError(''); setModal('create'); }}>Create a bounty <Plus size={17}/></button></div>
        <div className="hero-proof"><div className="avatars"><span>A</span><span>R</span><span>✳</span></div><div><strong>Preservation with proof</strong><small>Public evidence · Consensus judgment · Onchain rewards</small></div></div>
      </div><div className="hero-art" aria-label="Illustration of web pages preserved through an archive relay"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-grid"/><div className="floating-tag top-tag"><span className="tag-icon"><Globe2 size={17}/></span><span>ORIGINAL PAGE <b>Captured</b></span><Check size={15}/></div><div className="page-card"><div className="page-bar"><i/><i/><i/><span>public-web.example/story</span></div><div className="page-content"><span className="page-label">THE PUBLIC RECORD</span><div className="page-headline">The stories<br/>we can't afford<br/>to <em>lose.</em></div><div className="page-image"><div className="sun"/><div className="mountain m1"/><div className="mountain m2"/></div><div className="page-lines"><span/><span/><span/></div></div><div className="page-footer"><LockKeyhole size={13}/> CONTENT FINGERPRINT STORED</div></div><div className="floating-tag bottom-tag"><span className="tag-icon success"><ShieldCheck size={18}/></span><span>ARCHIVE VERIFIED <b>Faithfully preserved</b></span><CheckCircle2 size={16}/></div><div className="art-caption">A permanent record of what matters <span>↗</span></div></div></div></section>

      <section className="stats"><div className="shell stat-grid"><div><strong>{open.toString().padStart(2, '0')}</strong><span>Open bounties</span></div><div><strong>{total.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong><span>GEN available</span></div><div><strong>{awarded.toString().padStart(2, '0')}</strong><span>Archives rewarded</span></div><div className="stat-note"><span className="stat-symbol">✳</span><p>Good preservation keeps<br/>the whole story in reach.</p></div></div></section>

      <section className="bounties-section" id="bounties"><div className="shell"><div className="section-top"><div><div className="eyebrow dark"><span className="eyebrow-line"/> THE PRESERVATION BOARD</div><h2>Pages waiting to be <em>saved.</em></h2><p>Find a page worth preserving and submit a public archive that meets its brief.</p></div><button className="button dark-button" onClick={() => { setError(''); setModal('create'); }}>Post a bounty <Plus size={17}/></button></div>
        <div className="toolbar"><div className="tabs" role="tablist">{['All bounties', 'Open', 'Awarded', 'Expired'].map(t => <button key={t} role="tab" aria-selected={filter === t} className={filter === t ? 'active' : ''} onClick={() => setFilter(t)}>{t}</button>)}</div><div className="search"><Search size={17}/><input aria-label="Search bounties" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search bounties"/></div><button className="refresh" title="Refresh finalized state" onClick={() => void refresh()} disabled={loading}><RefreshCw size={18} className={loading ? 'spin' : ''}/></button></div>
        {!live && <div className="deployment-banner"><LockKeyhole size={19}/><div><strong>Deployment in progress</strong><span>The board will read finalized Studionet state once the contract address is published. No sample bounties are shown as live activity.</span></div></div>}
        {error && <div className="error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss"><X size={16}/></button></div>}
        {notice && <div className="notice"><CheckCircle2 size={17}/>{notice}</div>}
        {hash && <div className="pending"><Clock3 size={17}/> Transaction submitted. Waiting for GenLayer finalization: <code>{short(hash)}</code> <a href={`${EXPLORER}/transactions/${hash}`} target="_blank" rel="noreferrer">Explorer <ArrowUpRight size={14}/></a></div>}
        {loading ? <div className="empty"><RefreshCw className="spin" size={26}/><h3>Reading finalized state…</h3></div> : displayed.length ? <div className="cards">{displayed.map(b => <article className="bounty-card" key={b.id}><div className="card-top"><span className="card-id">BOUNTY / {String(b.id + 1).padStart(3, '0')}</span><span className={`status ${b.status.toLowerCase()}`}>{b.status === 'OPEN' && b.deadline < Date.now() / 1000 ? 'Expired' : b.status}</span></div><div className="card-icon"><FileText size={23}/></div><h3>{b.title}</h3><a href={b.source_url} target="_blank" rel="noreferrer" className="source-link"><Link2 size={14}/>{new URL(b.source_url).hostname}<ArrowUpRight size={13}/></a><p className="card-desc">{b.required_text}</p><div className="card-meta"><div><span>REWARD</span><strong>{fromWei(b.reward)} <small>GEN</small></strong></div><div><span>DEADLINE</span><strong className="date-value">{date(b.deadline)}</strong></div></div><button className="card-action" onClick={() => openSubmit(b)}>View bounty <ArrowRight size={17}/></button></article>)}</div> : <div className="empty"><Archive size={29}/><h3>{query || filter !== 'All bounties' ? 'No matching bounties' : 'The first page is yours to save.'}</h3><p>{query || filter !== 'All bounties' ? 'Try another search or filter.' : 'Post a preservation brief and put a reward behind the public record.'}</p>{!query && filter === 'All bounties' && <button className="button primary" onClick={() => setModal('create')}>Create the first bounty <ArrowRight size={16}/></button>}</div>}
      </div></section>

      <section className="how" id="how"><div className="shell"><div className="eyebrow"><span className="eyebrow-line"/> A SIMPLE RELAY</div><div className="how-heading"><h2>Keep the meaning.<br/><em>Keep the evidence.</em></h2><p>A preservation bounty is a clear brief, a public capture, and a consensus decision you can inspect.</p></div><div className="steps"><div><span className="step-num">01 / COMMIT</span><div className="step-icon"><FileText size={25}/></div><h3>Define what matters</h3><p>A sponsor sets the page, essential text, images, context, deadline, and funded GEN reward. The original page is fingerprinted onchain.</p></div><div><span className="step-num">02 / ARCHIVE</span><div className="step-icon"><Archive size={25}/></div><h3>Preserve the page</h3><p>Archivists create a public capture and submit its URL. Different layouts are welcome when the required meaning survives.</p></div><div><span className="step-num">03 / VERIFY</span><div className="step-icon"><ShieldCheck size={25}/></div><h3>Reward fidelity</h3><p>GenLayer validators independently assess the source and archive. The first qualifying submission receives the reward; expired unclaimed funds return to the sponsor.</p></div></div></div></section>
      <section className="bottom-cta" id="about"><div className="shell cta-grid"><div><div className="eyebrow dark"><span className="eyebrow-line"/> BUILT FOR THE OPEN WEB</div><h2>Don't let a link be<br/>the <em>end</em> of the story.</h2></div><div><p>ArchiveRelay makes preserving a page an open, funded task. Every decision lives with the bounty, including explicit inconclusive results when evidence is unavailable or the source changes.</p><a className="button dark-button" href="#bounties">Explore the board <ArrowRight size={17}/></a></div></div></section>
    </main>
    <footer><div className="shell footer-inner"><a href="#home" className="brand"><span className="brand-mark"><Archive size={18}/></span><span>archive<span className="brand-accent">relay</span><span className="brand-dot">.</span></span></a><span>Preserve the page. Prove the preservation.</span><div><a href="https://github.com/haris4587/ArchiveRelay" target="_blank" rel="noreferrer">GitHub <ExternalLink size={13}/></a><a href="https://docs.genlayer.com" target="_blank" rel="noreferrer">GenLayer <ExternalLink size={13}/></a></div></div></footer>

    {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) setModal(null); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><div className="eyebrow dark"><span className="eyebrow-line"/> {modal === 'create' ? 'NEW PRESERVATION TASK' : `BOUNTY / ${String((selected?.id ?? 0) + 1).padStart(3, '0')}`}</div><h2 id="modal-title">{modal === 'create' ? 'Create a bounty' : selected?.title}</h2></div><button onClick={() => { if (!busy) setModal(null); }} aria-label="Close"><X size={22}/></button></div>
      {modal === 'create' ? <form onSubmit={e => void create(e)} className="modal-form"><p>Set a precise preservation brief. The original source is fetched and fingerprinted when you publish.</p><label>Page title<input required minLength={3} maxLength={90} placeholder="A public page worth preserving" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label><label>Original page URL<input required type="url" placeholder="https://example.org/article" value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })}/></label><label>Required text<textarea required minLength={10} maxLength={1000} placeholder="Exact quotes, headlines, paragraphs, or details that must survive" value={form.required_text} onChange={e => setForm({ ...form, required_text: e.target.value })}/></label><label>Required images <small>(describe essential images, if any)</small><textarea maxLength={600} placeholder="Subject, captions, or image references that must survive" value={form.required_images} onChange={e => setForm({ ...form, required_images: e.target.value })}/></label><label>Required context<textarea required minLength={10} maxLength={600} placeholder="Author, date, attribution, surrounding meaning" value={form.required_context} onChange={e => setForm({ ...form, required_context: e.target.value })}/></label><div className="form-row"><label>Deadline<input required type="datetime-local" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}/></label><label>Reward · GEN<input required inputMode="decimal" placeholder="1.0" value={form.reward} onChange={e => setForm({ ...form, reward: e.target.value })}/></label></div><div className="form-note"><LockKeyhole size={16}/> The reward is held by the contract. Fees are separate from the GEN reward.</div>{error && <div className="error" role="alert">{error}</div>}{hash && <div className="pending">Submitted {short(hash)} · waiting for finalization</div>}<button className="button primary form-submit" disabled={busy || !live}>{busy ? 'Waiting for finalization…' : live ? 'Fund and publish bounty' : 'Awaiting deployment'} <ArrowRight size={17}/></button></form> : selected && <div className="detail"><div className="detail-reward"><span>FUNDED REWARD</span><strong>{fromWei(selected.reward)} GEN</strong><span className={`status ${selected.status.toLowerCase()}`}>{selected.status}</span></div><div className="detail-grid"><div><span>ORIGINAL PAGE</span><a href={selected.source_url} target="_blank" rel="noreferrer">Open source <ExternalLink size={14}/></a></div><div><span>DEADLINE</span><strong>{date(selected.deadline)}</strong></div><div><span>SPONSOR</span><strong title={selected.sponsor}>{short(selected.sponsor)}</strong></div><div><span>SOURCE FINGERPRINT</span><strong title={selected.source_digest}>{short(selected.source_digest)}</strong></div></div><div className="requirements"><h3>What must survive</h3><div><FileText size={17}/><p><b>Text</b>{selected.required_text}</p></div><div><ImageIcon size={17}/><p><b>Images</b>{selected.required_images || 'No specific image required.'}</p></div><div><Globe2 size={17}/><p><b>Context</b>{selected.required_context}</p></div></div>{selected.winning_url && <p className="winning"><CheckCircle2 size={17}/> Winning archive: <a href={selected.winning_url} target="_blank" rel="noreferrer">Open capture <ExternalLink size={14}/></a></p>}<div className="attempts"><h3>Submission record <small>{selectedAttempts.length}</small></h3>{selectedAttempts.length ? selectedAttempts.map((a, i) => <div className="attempt" key={i}><span className={`outcome ${a.outcome.toLowerCase()}`}>{a.outcome}</span><a href={a.archive_url} target="_blank" rel="noreferrer">{new URL(a.archive_url).hostname} <ArrowUpRight size={13}/></a><small>{a.reason}</small></div>) : <p>No archives submitted yet.</p>}</div>{selected.status === 'OPEN' && selected.deadline >= Date.now() / 1000 && <div className="submit-area"><label>Public archive URL<input type="url" placeholder="https://web.archive.org/web/..." value={archiveUrl} onChange={e => setArchiveUrl(e.target.value)}/></label><p>Submissions are limited to 16 per bounty and 3 per archivist. Missing or changed evidence is recorded as inconclusive.</p>{error && <div className="error" role="alert">{error}</div>}{hash && <div className="pending">Submitted {short(hash)} · waiting for finalization</div>}<button className="button primary form-submit" disabled={busy || !validUrl(archiveUrl)} onClick={() => void act('submit_archive', [selected.id, archiveUrl])}>{busy ? 'Judging and finalizing…' : 'Submit archive'} <ArrowRight size={17}/></button></div>}{selected.status === 'OPEN' && selected.deadline < Date.now() / 1000 && <button className="button primary form-submit" disabled={busy} onClick={() => void act('refund_expired', [selected.id])}>{busy ? 'Finalizing refund…' : 'Return unused reward'} <ArrowRight size={17}/></button>}<button className="copy" onClick={() => void navigator.clipboard.writeText(`${location.origin}/?bounty=${selected.id}`)}><Copy size={14}/> Copy bounty link</button></div>}
    </div></div>}
  </div>;
}
