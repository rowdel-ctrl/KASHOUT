import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { api } from '../data';
import { sharePdf } from '../lib/export';
import { dateTime, formatRef, peso, peso2, shortDate, waitText } from '../lib/format';
import { LATE_MS, activeFilterCount, applyFilters, dayLabel, groupByDay, isPending, periodLabel, staffNames, summarize, whenOf } from '../lib/records';
import { WALLETS, sourceOf, walletColor } from '../lib/wallets';
import { DEFAULT_FILTERS, type AmountBand, type Filters, type Period, type StatusFilter } from '../lib/types';
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
  { value: 'month', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

const BANDS: { value: AmountBand; label: string }[] = [
  { value: 'any', label: 'Any amount' },
  { value: 'u1k', label: 'Under ₱1,000' },
  { value: 'b1k5k', label: '₱1,000 to ₱5,000' },
  { value: 'o5k', label: 'Over ₱5,000' },
];

/** Wallets to choose from: the usual ones, plus any other source found in the records. */
function walletOptions(records: CashRecord[]): string[] {
  const base = WALLETS.map((w) => w.name);
  const extra = [...new Set(records.map(sourceOf))].filter((n) => !base.includes(n));
  return [...base.slice(0, -1), ...extra, base[base.length - 1]];
}

/** The date fields of a custom range. */
function DateFields({ from, to, onChange }: { from: string; to: string; onChange: (v: { from: string; to: string }) => void }) {
  const { t } = useApp();
  return (
    <>
      <div className="two">
        <div className="field" style={{ marginTop: 0 }}>
          <label htmlFor="from">{t('From')}</label>
          <input id="from" type="date" className="box" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} />
        </div>
        <div className="field" style={{ marginTop: 0 }}>
          <label htmlFor="to">{t('To')}</label>
          <input id="to" type="date" className="box" value={to} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} />
        </div>
      </div>
      <div className="note" style={{ color: 'var(--muted)', fontWeight: 500 }}>{t('A day starts at 2:00 AM.')}</div>
    </>
  );
}

export function Records({ initialPeriod, initialStatus }: { initialPeriod?: Period; initialStatus?: StatusFilter }) {
  const { records, today, go, toast, t, settings } = useApp();
  const tl = settings.lang === 'tl';
  const wide = useWide();
  const [f, setF] = useState<Filters>({ ...DEFAULT_FILTERS, period: initialPeriod ?? 'today', status: initialStatus ?? 'all' });
  const [sheet, setSheet] = useState<'filters' | 'dates' | 'pdf' | null>(null);
  // The PDF has its own choices, so what is in the list does not have to match.
  const [pdf, setPdf] = useState<Filters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);

  const q = useDeferredValue(f.q.trim());
  const searching = q.length > 0;
  const shown = useMemo(() => applyFilters(records, { ...f, q }), [records, today, f.period, f.from, f.to, f.amount, f.staff, f.status, f.wallet, q]);
  const pendingAll = useMemo(() => records.filter(isPending), [records]);
  const sum = useMemo(() => summarize(shown), [shown]);
  const label = t(searching ? 'Search results' : periodLabel(f));
  const pendingView = f.status === 'pending';
  // Grouped by day, except search results, which are ordered by how well they match.
  const groups = useMemo(() => (searching ? [] : groupByDay(shown.slice(0, limit), Date.now(), pendingView)), [shown, today, limit, searching, pendingView]);
  const sel = wide ? (shown.find((r) => r.id === selected) ?? shown[0] ?? null) : null;
  const filters = activeFilterCount(f);
  const wallets = useMemo(() => walletOptions(records), [records]);
  const staff = useMemo(() => staffNames(records), [records]);

  const pdfList = useMemo(() => applyFilters(records, { ...pdf, q: '' }), [records, today, pdf]);
  const pdfSum = useMemo(() => summarize(pdfList), [pdfList]);
  const pdfAll = pdfSum.total + pdfSum.pendingTotal;

  async function makePdf() {
    try {
      await sharePdf(pdfList, pdf.period, `Cash-outs · ${periodLabel(pdf)}`);
      setSheet(null);
    } catch (e) {
      const m = String((e as Error)?.message ?? e).toLowerCase();
      if (!m.includes('cancel') && !m.includes('abort')) toast(t('Could not make the PDF. Please try again.'), true);
    }
  }

  const rowFor = (r: CashRecord) => (
    <RecRow
      key={r.id}
      r={r}
      selected={wide && sel?.id === r.id}
      q={searching ? q : undefined}
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
              <span>{peso(g.total)}</span>
            </div>
            <div className="list">{g.records.map(rowFor)}</div>
          </section>
        ))
      )}
      {shown.length === 0 && (
        <div className="emptybox">
          <div className="art">
            <Icon name="search" size={54} />
          </div>
          <b>{t('No records found')}</b>
          <span>
            {searching ? `${t('No match for “{q}”.', { q })} ${t('Try the last 4 digits of the reference number.')}` : t('No records for this choice.')}
          </span>
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
  const pickedRange = f.period === 'custom' && (f.from || f.to);
  const rangeLabel = f.from && f.to ? (f.from === f.to ? shortDate(new Date(`${f.from}T12:00:00`).getTime()) : `${shortDate(new Date(`${f.from}T12:00:00`).getTime())} – ${shortDate(new Date(`${f.to}T12:00:00`).getTime())}`) : t('Pick dates');

  return (
    <>
      <main className="page wide has-nav">
        <div className="rhead">
          <h1 className="h1">{t('Records')}</h1>
          <button
            className="round tint"
            aria-label={t('Download records')}
            onClick={() => {
              setPdf({ ...DEFAULT_FILTERS, period: f.period === 'custom' && !(f.from || f.to) ? 'month' : f.period, from: f.from, to: f.to, status: f.status, wallet: f.wallet, staff: f.staff });
              setSheet('pdf');
            }}
          >
            <Icon name="download" size={22} />
          </button>
        </div>

        <div className={wide ? 'split' : undefined}>
          <div className="side">
            <section className="rsum" aria-label={t('Summary')}>
              <div>
                <small>{t('Cash-out')}</small>
                <b className="t">{peso(pendingView ? sum.pendingTotal : sum.total)}</b>
              </div>
              <div>
                <small>{t('Charge')}</small>
                <b>{peso(sum.fees)}</b>
              </div>
            </section>

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
              <button className={`filterbtn${filters > 0 ? ' active' : ''}`} aria-label={t('Filters')} onClick={() => setSheet('filters')}>
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

            <div className="status3 rtabs" role="group" aria-label={t('Status')}>
              {tab('all', t('All'))}
              {tab('pending', t('Pending'), pendingAll.length)}
              {tab('paid', t('Paid'))}
            </div>

            <div className="hscroll" role="group" aria-label={t('Dates')}>
              {PERIODS.map((p) => (
                <button key={p.value} className={`chip${f.period === p.value && !searching && !pendingView ? ' on' : ''}${searching || pendingView ? ' dim' : ''}`} aria-pressed={f.period === p.value} onClick={() => setF({ ...f, period: p.value })}>
                  {t(p.label)}
                </button>
              ))}
              <button className={`chip${pickedRange && !searching && !pendingView ? ' on' : ''}${searching || pendingView ? ' dim' : ''}`} aria-haspopup="dialog" onClick={() => setSheet('dates')}>
                <Icon name="calendar" size={16} />
                {pickedRange ? rangeLabel : t('Pick dates')}
              </button>
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

      {sheet === 'dates' && (
        <Sheet title={t('Pick dates')} onClose={() => setSheet(null)}>
          <DateFields from={f.from} to={f.to} onChange={(v) => setF({ ...f, period: 'custom', from: v.from, to: v.to })} />
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setSheet(null)}>
            {t('Done')}
          </button>
        </Sheet>
      )}

      {sheet === 'filters' && (
        <Sheet title={t('Filters')} onClose={() => setSheet(null)}>
          <div className="sec" style={{ marginTop: 0 }}>
            {t('Where from')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }} role="radiogroup" aria-label={t('Where from')}>
            {['all', ...wallets].map((n) => (
              <button key={n} role="radio" aria-checked={f.wallet === n} className={`opt${f.wallet === n ? ' on' : ''}`} onClick={() => setF({ ...f, wallet: n })}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {n !== 'all' && <i className="dot" style={{ background: walletColor(n) }} />}
                  {n === 'all' ? t('All wallets') : n}
                </span>
                {f.wallet === n && <Icon name="check" size={22} />}
              </button>
            ))}
          </div>

          <div className="sec">{t('Amount')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }} role="radiogroup" aria-label={t('Amount')}>
            {BANDS.map((b) => (
              <button key={b.value} role="radio" aria-checked={f.amount === b.value} className={`opt${f.amount === b.value ? ' on' : ''}`} onClick={() => setF({ ...f, amount: b.value })}>
                {t(b.label)}
                {f.amount === b.value && <Icon name="check" size={22} />}
              </button>
            ))}
          </div>

          <div className="sec">{t('Staff')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }} role="radiogroup" aria-label={t('Staff')}>
            {['all', ...staff].map((n) => (
              <button key={n} role="radio" aria-checked={f.staff === n} className={`opt${f.staff === n ? ' on' : ''}`} onClick={() => setF({ ...f, staff: n })}>
                {n === 'all' ? t('Everyone') : n}
                {f.staff === n && <Icon name="check" size={22} />}
              </button>
            ))}
          </div>

          <div className="two" style={{ marginTop: 18 }}>
            <button className="btn btn-ghost" onClick={() => setF({ ...DEFAULT_FILTERS, period: f.period, from: f.from, to: f.to, status: f.status, q: f.q })}>
              {t('Reset')}
            </button>
            <button className="btn btn-primary" style={{ height: 54, fontSize: 16 }} onClick={() => setSheet(null)}>
              {t('Show {n}', { n: shown.length })}
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'pdf' && (
        <Sheet title={t('Download records')} onClose={() => setSheet(null)}>
          <div className="pdfsum">
            <div>
              <small>{t('{n} records', { n: pdfList.length })}</small>
              <b>{peso(pdfAll)}</b>
            </div>
            <div className="split2">
              <span>
                {t('Paid')} <b style={{ color: 'var(--green-text)' }}>{peso(pdfSum.total)}</b>
              </span>
              <span>
                {t('Pending')} <b style={{ color: 'var(--warn-text)' }}>{peso(pdfSum.pendingTotal)}</b>
              </span>
            </div>
          </div>

          <div className="lab">{t('Dates')}</div>
          <div className="seg3" role="group" aria-label={t('Dates')}>
            {(
              [
                ['today', 'Today'],
                ['week', '7 days'],
                ['month', '30 days'],
                ['custom', 'Pick'],
              ] as [Period, string][]
            ).map(([v, l]) => (
              <button key={v} className={pdf.period === v ? 'on' : ''} aria-pressed={pdf.period === v} onClick={() => setPdf({ ...pdf, period: v })}>
                {t(l)}
              </button>
            ))}
          </div>
          {pdf.period === 'custom' && (
            <div style={{ marginTop: 12 }}>
              <DateFields from={pdf.from} to={pdf.to} onChange={(v) => setPdf({ ...pdf, from: v.from, to: v.to })} />
            </div>
          )}

          <div className="lab">{t('Status')}</div>
          <div className="seg3" role="group" aria-label={t('Status')}>
            {(
              [
                ['all', 'All'],
                ['pending', 'Pending'],
                ['paid', 'Paid'],
              ] as [StatusFilter, string][]
            ).map(([v, l]) => (
              <button key={v} className={pdf.status === v ? 'on' : ''} aria-pressed={pdf.status === v} onClick={() => setPdf({ ...pdf, status: v })}>
                {t(l)}
              </button>
            ))}
          </div>

          <div className="lab">{t('Where from')}</div>
          <div className="hscroll">
            {['all', ...wallets].map((n) => (
              <button key={n} className={`chip${pdf.wallet === n ? ' on' : ''}`} aria-pressed={pdf.wallet === n} onClick={() => setPdf({ ...pdf, wallet: n })}>
                {n !== 'all' && <i className="dot" style={{ background: walletColor(n) }} />}
                {n === 'all' ? t('All') : n}
              </button>
            ))}
          </div>

          <div className="lab">{t('Staff')}</div>
          <div className="hscroll">
            {['all', ...staff].map((n) => (
              <button key={n} className={`chip${pdf.staff === n ? ' on' : ''}`} aria-pressed={pdf.staff === n} onClick={() => setPdf({ ...pdf, staff: n })}>
                {n === 'all' ? t('Everyone') : n}
              </button>
            ))}
          </div>

          <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={pdfList.length === 0} onClick={() => void makePdf()}>
            <Icon name="download" size={22} />
            {t('Download PDF')}
          </button>
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

  const source = sourceOf(r);
  const body = (
    <>
      <div className="dcard">
        <div className="row-between">
          <span className="dtags">
            <span className={`status${pending ? ' wait' : ''}`}>{pending ? t('Pending') : t('Paid')}</span>
            {r.history && r.history.length > 0 && (
              <button className="status edited" onClick={() => go({ name: 'history', id: r.id })} aria-label={t('View history')}>
                {t('Edited · {n}', { n: r.history.length })}
              </button>
            )}
          </span>
          <span className="tag wallet" style={{ height: 30, fontSize: 13 }}>
            <i className="dot" style={{ background: walletColor(source) }} />
            {source}
          </span>
        </div>
        <b className="damt">{peso2(r.amount)}</b>
        <span className="muted small">{pending ? t('Charge {amount} (counts when paid)', { amount: peso2(r.fee) }) : t('Charge {amount}', { amount: peso2(r.fee) })}</span>
      </div>

      {photo ? (
        <>
          <button className="photorow" aria-label={t('Enlarge the receipt photo')} onClick={() => setZoom(true)}>
            <img src={photo} alt={t('Receipt photo')} />
            <span>
              <b>{t('Receipt')}</b>
              <small>{t('Tap to enlarge')}</small>
            </span>
            <Icon name="right" size={18} color="var(--muted)" />
          </button>
          {zoom && <PhotoViewer src={photo} onClose={() => setZoom(false)} />}
        </>
      ) : (
        photoDone && <div className="nophoto">{t('No photo was saved for this record.')}</div>
      )}

      <div className="kvs">
        <div className="kv">
          <span>{t('Reference number')}</span>
          <b>{formatRef(r.ref)}</b>
        </div>
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
        {!pending && r.paidBy && r.paidAt && (
          <div className="kv">
            <span>{t('Paid')}</span>
            <b>
              {r.paidBy} · {dateTime(r.paidAt)}
            </b>
          </div>
        )}
        {pending && (
          <div className="kv">
            <span>{t('Waiting')}</span>
            <b style={{ color: waited >= LATE_MS ? 'var(--late)' : 'var(--warn-text)' }}>{waitText(waited, tl)}</b>
          </div>
        )}
      </div>

      {pending && (
        <button className="btn btn-primary" onClick={() => markPaid(r)}>
          {t('Mark as paid')}
        </button>
      )}
      {mine ? (
        <div className="two">
          <button className="btn btn-ghost" onClick={() => setConfirm('edit')}>
            {t('Edit')}
          </button>
          <button className="btn btn-danger" onClick={() => setConfirm('delete')}>
            {t('Delete')}
          </button>
        </div>
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
