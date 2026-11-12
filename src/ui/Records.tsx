import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { api } from '../data';
import { shareCsv, sharePdf } from '../lib/export';
import { dateTime, formatRef, peso, peso2, waitText } from '../lib/format';
import { LATE_MS, activeFilterCount, applyFilters, dayLabel, groupByDay, isPending, periodLabel, staffNames, summarize, whenOf } from '../lib/records';
import { DEFAULT_FILTERS, type AmountBand, type Filters, type Period, type StatusFilter } from '../lib/types';
import { sendNtfy } from '../native/alerts';
import { Icon } from './icons';
import { PhotoViewer } from './PhotoViewer';
import { HoldButton, NavBar, OptionSheet, RecRow, Sheet, TopBar } from './components';
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
  const { records, today, go, alertTopic, toast, markPaid, t, settings } = useApp();
  const tl = settings.lang === 'tl';
  const wide = useWide();
  const [f, setF] = useState<Filters>({ ...DEFAULT_FILTERS, period: initialPeriod ?? 'today', status: initialStatus ?? 'all' });
  const [sheet, setSheet] = useState<'period' | 'filters' | 'closing' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);

  const q = useDeferredValue(f.q.trim());
  const searching = q.length > 0;
  const shown = useMemo(() => applyFilters(records, { ...f, q }), [records, today, f.period, f.from, f.to, f.amount, f.staff, f.status, q]);
  const pendingAll = useMemo(() => records.filter(isPending), [records]);
  const sum = useMemo(() => summarize(shown), [shown]);
  const labelEn = searching ? 'Search results' : periodLabel(f);
  const label = t(labelEn);
  const pendingView = f.status === 'pending';
  // Grouped by day, except search results, which are ordered by how well they match.
  const groups = useMemo(() => (searching ? [] : groupByDay(shown.slice(0, limit), Date.now(), pendingView)), [shown, today, limit, searching, pendingView]);
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

  const rowFor = (r: CashRecord) => (
    <RecRow
      key={r.id}
      r={r}
      selected={wide && sel?.id === r.id}
      q={searching ? q : undefined}
      onMarkPaid={() => markPaid(r)}
      onClick={() => (wide ? setSelected(r.id) : go({ name: 'detail', id: r.id }))}
    />
  );

  const list = (
    <>
      {searching ? (
        <div className="list">{shown.slice(0, limit).map(rowFor)}</div>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="daygroup" aria-label={t(dayLabel(g))}>
            <div className="dayhead">
              <span>{t(dayLabel(g))}</span>
              <span>
                {peso(g.total)} · {g.count}
              </span>
            </div>
            <div className="list">{g.records.map(rowFor)}</div>
          </section>
        ))
      )}
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

  const tab = (value: StatusFilter, text: string, badge?: number) => (
    <button className={f.status === value ? 'on' : ''} aria-pressed={f.status === value} onClick={() => setF({ ...f, status: value })}>
      {text}
      {badge ? <b>{badge}</b> : null}
    </button>
  );

  return (
    <>
      <main className="page wide has-nav">
        <div className="rhead">
          <h1 className="h1">{t('Records')}</h1>
          <button className="round tint" aria-label={t('Closing and export')} onClick={() => setSheet('closing')}>
            <Icon name="download" size={22} />
          </button>
        </div>

        <div className={wide ? 'split' : undefined}>
          <div className="side">
            <div className="searchbar">
              <label htmlFor="q" className="sr">
                {t('Search')}
              </label>
              <Icon name="search" size={20} />
              <input id="q" type="search" inputMode="search" autoComplete="off" placeholder={t('Last digits of ref, name, number, amount')} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
              {f.q && (
                <button className="clear" aria-label={t('Clear search')} onClick={() => setF({ ...f, q: '' })}>
                  <Icon name="close" size={20} />
                </button>
              )}
              <button className="filterbtn" aria-label={t('Filters')} onClick={() => setSheet('filters')}>
                <Icon name="filter" size={20} />
                {filters > 0 && <em>{filters}</em>}
              </button>
            </div>

            {searching && (
              <div className="searchnote" role="status">
                <Icon name="search" size={18} /> {t('Searching all dates')} · {shown.length} {shown.length === 1 ? t('result') : t('results')}
                {shown.length > 1 ? ` · ${t('best matches first')}` : ''}
              </div>
            )}

            {pendingView ? (
              <section className="waitcard" aria-label={t('Pending')}>
                <small>{t('Pending')}</small>
                <b>{peso2(sum.pendingTotal)}</b>
                <span>
                  {t('{n} pending', { n: sum.pendingCount })}
                  {sum.oldestPending != null && ` · ${t('oldest waiting {time}', { time: waitText(Date.now() - sum.oldestPending, tl) })}`}
                </span>
              </section>
            ) : (
              <section className="summary" aria-label={t('Closing')}>
                <small>
                  {t('Paid')} · {label}
                </small>
                <div className="line">
                  <b className="t">{peso(sum.total)}</b>
                  <span className="pills">
                    <i>{sum.count} {sum.count === 1 ? t('cash-out') : t('cash-outs')}</i>
                    <i>
                      {t('Fees')} {peso(sum.fees)}
                    </i>
                  </span>
                </div>
                {sum.pendingCount > 0 && (
                  <button className="pendstrip" onClick={() => setF({ ...f, status: 'pending' })}>
                    <Icon name="clock" size={20} />
                    <span>
                      {t('{n} pending', { n: sum.pendingCount })} · {peso(sum.pendingTotal)}
                    </span>
                    <Icon name="right" size={18} />
                  </button>
                )}
              </section>
            )}

            <div className="status3 rtabs" role="group" aria-label={t('Status')}>
              {tab('all', t('All'))}
              {tab('pending', t('Pending'), pendingAll.length)}
              {tab('paid', t('Paid'))}
            </div>
            <div className="chips">
              <button className={`chip on${searching || pendingView ? ' dim' : ''}`} aria-haspopup="dialog" onClick={() => setSheet('period')}>
                {label} <Icon name="down" size={16} />
              </button>
              {f.amount !== 'any' && (
                <button className="chip" onClick={() => setF({ ...f, amount: 'any' })} aria-label={t('Clear amount filter')}>
                  {t(BANDS.find((b) => b.value === f.amount)!.label)} <Icon name="close" size={16} />
                </button>
              )}
              {f.staff !== 'all' && (
                <button className="chip" onClick={() => setF({ ...f, staff: 'all' })} aria-label={t('Clear staff filter')}>
                  {f.staff} <Icon name="close" size={16} />
                </button>
              )}
            </div>

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

      {sheet === 'closing' && (
        <Sheet title={`${t('Closing')} · ${label}`} onClose={() => setSheet(null)}>
          <div className="tiles">
            <div>
              <small>{t('Paid')}</small>
              <b>{peso(sum.total)}</b>
            </div>
            <div>
              <small>{t('Fees')}</small>
              <b>{peso2(sum.fees)}</b>
            </div>
            <div className="p">
              <small>{t('Pending')}</small>
              <b>{peso(sum.pendingTotal)}</b>
            </div>
          </div>
          <div className="sec">{t('Who saved')}</div>
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
          <div className="stack" style={{ marginTop: 18 }}>
            <button className="btn btn-primary" onClick={() => void sendSummary()}>
              {t('Send the summary')}
            </button>
            <div className="two">
              <button
                className="btn btn-ghost"
                disabled={!shown.length}
                onClick={() => {
                  setSheet(null);
                  void run(() => shareCsv(shown, f.period));
                }}
              >
                Excel
              </button>
              <button
                className="btn btn-ghost"
                disabled={!shown.length}
                onClick={() => {
                  setSheet(null);
                  void run(() => sharePdf(shown, f.period, `Cash-outs · ${labelEn}`));
                }}
              >
                PDF
              </button>
            </div>
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
  const [confirm, setConfirm] = useState<'edit' | 'delete' | null>(null);
  const [photo, setPhoto] = useState<string | null>(r.thumb ?? null);
  const [photoDone, setPhotoDone] = useState(false);
  const [zoom, setZoom] = useState(false);
  const mine = r.byUid === user.uid;

  // The sharper photo is kept apart from the record. Load it when the record is opened.
  useEffect(() => {
    let on = true;
    setPhoto(r.thumb ?? null);
    setPhotoDone(false);
    setConfirm(null);
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
        <button className="btn btn-ghost" onClick={() => setConfirm('edit')}>
          {t('Edit')}
        </button>
      )}
      {mine ? (
        <button className="btn btn-danger" onClick={() => setConfirm('delete')}>
          {t('Delete')}
        </button>
      ) : (
        <div className="muted small" style={{ textAlign: 'center' }}>
          {t('Only {name} can delete this record.', { name: r.by })}
        </div>
      )}

      {confirm === 'edit' && (
        <Sheet title={t('Edit this record?')} onClose={() => setConfirm(null)}>
          <div className="muted" style={{ marginTop: -6, marginBottom: 14, fontSize: 16, lineHeight: 1.4 }}>
            {t('Every change is saved in History, with your name and the time.')}
          </div>
          <div className="stack">
            <button
              className="btn btn-primary"
              onClick={() => {
                setConfirm(null);
                go({ name: 'edit', id: r.id });
              }}
            >
              {t('Edit')}
            </button>
            <button className="btn btn-text" onClick={() => setConfirm(null)}>
              {t('Cancel')}
            </button>
          </div>
        </Sheet>
      )}

      {confirm === 'delete' && (
        <Sheet title={t('Delete this record?')} onClose={() => setConfirm(null)}>
          <div className="card" style={{ boxShadow: 'none', background: 'var(--bg)', marginBottom: 12 }}>
            <div className="bigref" style={{ fontSize: 22 }}>
              {formatRef(r.ref)}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{peso2(r.amount)}</div>
            <div className="muted small">{[r.name, dateTime(r.savedAt)].filter(Boolean).join(' · ')}</div>
          </div>
          <div className="muted" style={{ marginBottom: 14, fontSize: 16, lineHeight: 1.4 }}>
            {t('This cannot be undone. Everyone will stop seeing it.')}
          </div>
          <div className="stack">
            <HoldButton
              label={t('Hold to delete')}
              holding={t('Keep holding…')}
              onDone={() => {
                api.deleteRecord(r.id);
                setConfirm(null);
                toast(t('Record deleted'));
                onDeleted?.();
              }}
            />
            <button className="btn btn-text" onClick={() => setConfirm(null)}>
              {t('Cancel')}
            </button>
          </div>
        </Sheet>
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
