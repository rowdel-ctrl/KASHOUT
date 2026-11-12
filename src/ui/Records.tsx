import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { api } from '../data';
import { shareCsv, sharePdf } from '../lib/export';
import { dateTime, formatRef, peso, peso2, waitText } from '../lib/format';
import { LATE_MS, activeFilterCount, applyFilters, isPending, periodLabel, staffNames, summarize, whenOf } from '../lib/records';
import { DEFAULT_FILTERS, type AmountBand, type Filters, type Period, type StatusFilter } from '../lib/types';
import { sendNtfy } from '../native/alerts';
import { Icon } from './icons';
import { PhotoViewer } from './PhotoViewer';
import { NavBar, OptionSheet, RecRow, Sheet, TopBar } from './components';
import { useApp } from './context';
import { useWide } from './useWide';
import type { CashRecord } from '../lib/types';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

const BANDS: { value: AmountBand; label: string }[] = [
  { value: 'any', label: 'Any amount' },
  { value: 'u1k', label: 'Under ₱1,000' },
  { value: 'b1k5k', label: '₱1,000 to ₱5,000' },
  { value: 'o5k', label: 'Over ₱5,000' },
];

export function Records({ initialPeriod, initialStatus }: { initialPeriod?: Period; initialStatus?: StatusFilter }) {
  const { records, go, alertTopic, toast, markPaid, t, settings } = useApp();
  const tl = settings.lang === 'tl';
  const wide = useWide();
  const [f, setF] = useState<Filters>({ ...DEFAULT_FILTERS, period: initialPeriod ?? 'today', status: initialStatus ?? 'all' });
  const [sheet, setSheet] = useState<'period' | 'filters' | 'export' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showWho, setShowWho] = useState(false);
  const [limit, setLimit] = useState(100);

  const q = useDeferredValue(f.q.trim());
  const searching = q.length > 0;
  const shown = useMemo(() => applyFilters(records, { ...f, q }), [records, f.period, f.from, f.to, f.amount, f.staff, f.status, q]);
  const pendingAll = useMemo(() => records.filter(isPending), [records]);
  const sum = useMemo(() => summarize(shown), [shown]);
  const labelEn = searching ? 'Search results' : periodLabel(f);
  const label = t(labelEn);
  const maxN = Math.max(1, ...sum.people.map((p) => p.n));
  const sel = wide ? (shown.find((r) => r.id === selected) ?? shown[0] ?? null) : null;
  const filters = activeFilterCount(f);

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      const m = String((e as Error)?.message ?? e).toLowerCase();
      if (!m.includes('cancel') && !m.includes('abort')) toast(t('Could not export. Please try again.'), true);
    }
  }

  async function sendSummary() {
    if (!alertTopic) return toast(t('Alerts are not ready yet. Check your internet.'), true);
    const ok = await sendNtfy(alertTopic, `Closing ${labelEn}: ${sum.count} cash-outs, ${peso(sum.total)}`);
    toast(ok ? t('Summary sent') : t('Could not send. Check your internet.'), !ok);
  }

  const list = (
    <>
      <div className="count">
        {shown.length} {shown.length === 1 ? (searching ? t('result') : t('record')) : t('records')}
        {searching && shown.length > 0 && shown.length !== 1 ? ` · ${t('best matches first')}` : ''}
      </div>
      <div className="list">
        {shown.slice(0, limit).map((r) => (
          <RecRow
            key={r.id}
            r={r}
            selected={wide && sel?.id === r.id}
            q={searching ? q : undefined}
            onMarkPaid={() => markPaid(r)}
            onClick={() => (wide ? setSelected(r.id) : go({ name: 'detail', id: r.id }))}
          />
        ))}
      </div>
      {shown.length === 0 && (
        <div className="empty">
          {searching ? (
            <>
              {t('No match for “{q}”.', { q })}
              <br />
              {t('Try the last 4 digits of the reference number.')}
            </>
          ) : (
            t('No records for this choice.')
          )}
        </div>
      )}
      {shown.length > limit && (
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setLimit(limit + 100)}>
          {t('Show more')}
        </button>
      )}
    </>
  );

  return (
    <>
      <main className="page wide has-nav">
        <h1 className="h1">{t('Records')}</h1>

        <div className={wide ? 'split' : undefined}>
          <div className="side">
            <div className="searchrow">
              <div className="search">
                <label htmlFor="q" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
                  {t('Search')}
                </label>
                <Icon name="search" size={20} />
                <input id="q" type="search" inputMode="search" autoComplete="off" placeholder={t('Last digits of ref, name, number, amount')} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
                {f.q && (
                  <button className="clear" aria-label={t('Clear search')} onClick={() => setF({ ...f, q: '' })}>
                    <Icon name="close" size={20} />
                  </button>
                )}
              </div>
              <button className="filterbtn" aria-label={t('Filters')} onClick={() => setSheet('filters')}>
                <Icon name="filter" size={22} />
                {filters > 0 && <em>{filters}</em>}
              </button>
            </div>

            {searching && (
              <div className="searchnote" role="status">
                <Icon name="search" size={18} /> {t('Searching all dates')}
              </div>
            )}
            <div className="status3" role="group" aria-label={t('Status')}>
              <button className={f.status === 'all' ? 'on' : ''} aria-pressed={f.status === 'all'} onClick={() => setF({ ...f, status: 'all' })}>
                {t('All')}
              </button>
              <button className={`${f.status === 'pending' ? 'on p' : ''}`} aria-pressed={f.status === 'pending'} onClick={() => setF({ ...f, status: 'pending' })}>
                {t('Pending')} {pendingAll.length > 0 && <b>{pendingAll.length}</b>}
              </button>
              <button className={f.status === 'paid' ? 'on' : ''} aria-pressed={f.status === 'paid'} onClick={() => setF({ ...f, status: 'paid' })}>
                {t('Paid')}
              </button>
            </div>
            <div className="chips">
              <button className={`chip on${searching || f.status === 'pending' ? ' dim' : ''}`} aria-haspopup="dialog" onClick={() => setSheet('period')}>
                {label} <Icon name="down" size={14} />
              </button>
              {f.amount !== 'any' && (
                <button className="chip" onClick={() => setF({ ...f, amount: 'any' })} aria-label={t('Clear amount filter')}>
                  {t(BANDS.find((b) => b.value === f.amount)!.label)} <Icon name="close" size={14} />
                </button>
              )}
              {f.staff !== 'all' && (
                <button className="chip" onClick={() => setF({ ...f, staff: 'all' })} aria-label={t('Clear staff filter')}>
                  {f.staff} <Icon name="close" size={14} />
                </button>
              )}
            </div>

            {f.status === 'pending' ? (
              <section className="waitcard" aria-label={t('Pending')}>
                <small>{t('Pending')}</small>
                <b>{peso2(sum.pendingTotal)}</b>
                <span>
                  {t('{n} pending', { n: sum.pendingCount })}
                  {sum.oldestPending != null && ` · ${t('oldest waiting {time}', { time: waitText(Date.now() - sum.oldestPending, tl) })}`}
                </span>
                <div className="acts">
                  <button disabled={!shown.length} onClick={() => setSheet('export')}>
                    <Icon name="download" size={18} /> {t('Export')}
                  </button>
                </div>
              </section>
            ) : (
            <section className="closing" aria-label={t('Closing')}>
              <div className="top">
                <div>
                  <small>{t('Closing')} · {label} · {t('Paid')}</small>
                  <b className="t">{peso(sum.total)}</b>
                  <span className="sub">
                    {sum.count} {sum.count === 1 ? t('cash-out') : t('cash-outs')} · {t('Fees')} {peso2(sum.fees)}
                    {sum.pendingCount > 0 && ` · ${t('{n} pending', { n: sum.pendingCount })} ${peso(sum.pendingTotal)}`}
                  </span>
                </div>
                <button className="round" style={{ background: 'var(--green-soft)', color: 'var(--green-text)', boxShadow: 'none' }} aria-expanded={showWho} aria-label={t('Who saved')} onClick={() => setShowWho(!showWho)}>
                  <Icon name={showWho ? 'up' : 'person'} size={22} />
                </button>
              </div>
              {showWho && (
                <div style={{ marginTop: 8 }}>
                  {sum.people.map((p) => (
                    <div className="who" key={p.name}>
                      <div>
                        <b>{p.name}</b>
                        <span>
                          {p.n} · {peso(p.sum)}
                        </span>
                      </div>
                      <span className="track">
                        <i style={{ width: `${(p.n / maxN) * 100}%` }} />
                      </span>
                    </div>
                  ))}
                  {sum.people.length === 0 && <div className="muted small">{t('No saves for this choice.')}</div>}
                </div>
              )}
              <div className="acts">
                <button onClick={sendSummary}>
                  <Icon name="send" size={18} /> {t('Send')}
                </button>
                <button disabled={!shown.length} onClick={() => setSheet('export')}>
                  <Icon name="download" size={18} /> {t('Export')}
                </button>
              </div>
            </section>
            )}

            {list}
          </div>

          {wide && (
            <div className="detail-wrap">
              {sel ? <RecordDetail r={sel} panel /> : <div className="detail-panel empty">{t('Select a record to see its details.')}</div>}
            </div>
          )}
        </div>
      </main>
      <NavBar active="records" />

      {sheet === 'period' && (
        <OptionSheet
          title={t('Show records from')}
          options={PERIODS.map((o) => ({ ...o, label: t(o.label) }))}
          value={f.period}
          onPick={(v) => {
            setF({ ...f, period: v });
            if (v === 'custom') setSheet('filters');
          }}
          onClose={() => setSheet((s) => (s === 'period' ? null : s))}
        />
      )}

      {sheet === 'filters' && (
        <Sheet title={t('Filters')} onClose={() => setSheet(null)}>
          <div className="sec" style={{ marginTop: 0 }}>
            {t('Dates')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} role="radiogroup" aria-label={t('Dates')}>
            {PERIODS.map((p) => (
              <button key={p.value} role="radio" aria-checked={f.period === p.value} className={`opt${f.period === p.value ? ' on' : ''}`} onClick={() => setF({ ...f, period: p.value })}>
                {t(p.label)}
                {f.period === p.value && <Icon name="check" size={22} />}
              </button>
            ))}
          </div>
          {f.period === 'custom' && (
            <div className="two">
              <div className="field">
                <label htmlFor="from">{t('From')}</label>
                <input id="from" type="date" className="box" value={f.from} max={f.to || undefined} onChange={(e) => setF({ ...f, from: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="to">{t('To')}</label>
                <input id="to" type="date" className="box" value={f.to} min={f.from || undefined} onChange={(e) => setF({ ...f, to: e.target.value })} />
              </div>
            </div>
          )}

          <div className="sec">{t('Amount')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} role="radiogroup" aria-label={t('Amount')}>
            {BANDS.map((b) => (
              <button key={b.value} role="radio" aria-checked={f.amount === b.value} className={`opt${f.amount === b.value ? ' on' : ''}`} onClick={() => setF({ ...f, amount: b.value })}>
                {t(b.label)}
                {f.amount === b.value && <Icon name="check" size={22} />}
              </button>
            ))}
          </div>

          <div className="sec">{t('Staff')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} role="radiogroup" aria-label={t('Staff')}>
            {['all', ...staffNames(records)].map((n) => (
              <button key={n} role="radio" aria-checked={f.staff === n} className={`opt${f.staff === n ? ' on' : ''}`} onClick={() => setF({ ...f, staff: n })}>
                {n === 'all' ? t('Everyone') : n}
                {f.staff === n && <Icon name="check" size={22} />}
              </button>
            ))}
          </div>

          <div className="two" style={{ marginTop: 18 }}>
            <button className="btn btn-ghost" onClick={() => setF({ ...DEFAULT_FILTERS, q: f.q })}>
              {t('Reset')}
            </button>
            <button className="btn btn-soft" style={{ height: 54 }} onClick={() => setSheet(null)}>
              {t('Show {n}', { n: shown.length })}
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'export' && (
        <Sheet title={t('Export {n} records', { n: shown.length })} onClose={() => setSheet(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              className="opt"
              onClick={() => {
                setSheet(null);
                void run(() => shareCsv(shown, f.period));
              }}
            >
              <span>
                Excel <small>· {t('CSV file')}</small>
              </span>
              <Icon name="share" size={20} />
            </button>
            <button
              className="opt"
              onClick={() => {
                setSheet(null);
                void run(() => sharePdf(shown, f.period, `Cash-outs · ${labelEn}`));
              }}
            >
              <span>
                PDF <small>· {t('to print or share')}</small>
              </span>
              <Icon name="share" size={20} />
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

export function RecordDetail({ r, panel, onDeleted }: { r: CashRecord; panel?: boolean; onDeleted?: () => void }) {
  const { user, toast, markPaid, go, t, settings } = useApp();
  const tl = settings.lang === 'tl';
  const pending = isPending(r);
  const waited = (r.paidAt ?? Date.now()) - r.savedAt;
  const [sure, setSure] = useState(false);
  const [photo, setPhoto] = useState<string | null>(r.thumb ?? null);
  const [photoDone, setPhotoDone] = useState(false);
  const [zoom, setZoom] = useState(false);
  const mine = r.byUid === user.uid;

  // The sharper photo is kept apart from the record. Load it when the record is opened.
  useEffect(() => {
    let on = true;
    setPhoto(r.thumb ?? null);
    setPhotoDone(false);
    setSure(false);
    void api.getPhoto(r.id).then((p) => {
      if (!on) return;
      if (p) setPhoto(p);
      setPhotoDone(true);
    });
    return () => {
      on = false;
    };
  }, [r.id, r.thumb]);

  const body = (
    <>
      <div className={`heroamt${pending ? ' pend' : ''}`}>
        <div className="badge">
          <Icon name={pending ? 'clock' : 'check'} size={16} />
          {pending ? t('Pending') : t('Paid')}
        </div>
        <small>{t('Amount')}</small>
        <b>{peso2(r.amount)}</b>
        <span>{pending ? t('Fee {amount} (counts when paid)', { amount: peso2(r.fee) }) : t('Fee {amount} earned', { amount: peso2(r.fee) })}</span>
      </div>
      <div>
        <div className="muted small">{t('Reference number')}</div>
        <div className="bigref" style={{ fontSize: 26 }}>
          {formatRef(r.ref)}
        </div>
      </div>
      <div className="kvs">
        <div className="kv">
          <span>{t('Customer')}</span>
          <b>{r.name || '—'}</b>
        </div>
        <div className="kv">
          <span>{t('Number')}</span>
          <b>{r.number || '—'}</b>
        </div>
        <div className="kv">
          <span>{t('Receipt date')}</span>
          <b>{r.txAt ? dateTime(r.txAt) : '—'}</b>
        </div>
        <div className="kv">
          <span>{t('Saved by')}</span>
          <b>
            {r.by} · {dateTime(r.savedAt)}
          </b>
        </div>
        <div className="kv">
          <span>{t('Paid')}</span>
          <b style={pending ? { color: 'var(--warn-text)' } : undefined}>{pending ? t('No') : r.paidBy && r.paidAt ? `${r.paidBy} · ${dateTime(r.paidAt)}` : t('Yes')}</b>
        </div>
      </div>
      {r.history && r.history.length > 0 && (
        <button className="editedbadge" onClick={() => go({ name: 'history', id: r.id })}>
          {t('Edited · {n} {changes} · View history', { n: r.history.length, changes: r.history.length === 1 ? t('change') : t('changes') })}
        </button>
      )}
      {pending ? (
        <div className="paidnote" style={{ background: 'var(--warn-bg)', color: 'var(--warn-text)' }}>
          {t('Waiting {time}.', { time: waitText(waited, tl) })} {waited >= LATE_MS ? t('This has been waiting a long time.') : t('Mark it Paid when you give the cash.')}
        </div>
      ) : (
        r.paidAt && <div className="paidnote">{t('Waited {time}. Everyone was told it was paid.', { time: waitText(waited, tl) })}</div>
      )}
      {!photo && photoDone && <div className="muted small" style={{ textAlign: 'center' }}>{t('No photo was saved for this record.')}</div>}
      {photo && (
        <>
          <button className="photobtn" aria-label={t('Enlarge the receipt photo')} onClick={() => setZoom(true)}>
            <img src={photo} alt={t('Receipt photo')} />
            <span>
              <Icon name="search" size={14} color="#fff" /> {t('Tap to enlarge')}
            </span>
          </button>
          {zoom && <PhotoViewer src={photo} onClose={() => setZoom(false)} />}
        </>
      )}
      <div className="muted small" style={{ textAlign: 'center' }}>
        {t('Deleted automatically after 1 year.')}
      </div>
      {pending && (
        <button className="btn btn-primary" onClick={() => markPaid(r)}>
          {t('Mark as paid')}
        </button>
      )}
      {mine && (
        <button className="btn btn-ghost" onClick={() => go({ name: 'edit', id: r.id })}>
          {t('Edit')}
        </button>
      )}
      {mine ? (
        <button
          className="btn btn-danger"
          onClick={() => {
            if (!sure) return setSure(true);
            api.deleteRecord(r.id);
            toast(t('Record deleted'));
            setSure(false);
            onDeleted?.();
          }}
        >
          {sure ? t('Tap again to delete') : t('Delete')}
        </button>
      ) : (
        <div className="muted small" style={{ textAlign: 'center' }}>
          {t('Only {name} can delete this record.', { name: r.by })}
        </div>
      )}
    </>
  );

  return panel ? <div className="detail-panel">{body}</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{body}</div>;
}

export function Detail({ id }: { id: string }) {
  const { records, back, t } = useApp();
  const r = records.find((x) => x.id === id);
  return (
    <main className="page">
      <TopBar title={t('Record details')} />
      {r ? <RecordDetail r={r} onDeleted={back} /> : <div className="empty">{t('This record is not here anymore.')}</div>}
    </main>
  );
}
