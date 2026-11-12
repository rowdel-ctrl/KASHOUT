import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { api } from '../data';
import { shareCsv, sharePdf } from '../lib/export';
import { dateTime, peso, peso2 } from '../lib/format';
import { activeFilterCount, applyFilters, periodLabel, staffNames, summarize } from '../lib/records';
import { DEFAULT_FILTERS, type AmountBand, type Filters, type Period } from '../lib/types';
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

export function Records({ initialPeriod }: { initialPeriod?: Period }) {
  const { records, go, alertTopic, toast } = useApp();
  const wide = useWide();
  const [f, setF] = useState<Filters>({ ...DEFAULT_FILTERS, period: initialPeriod ?? 'today' });
  const [sheet, setSheet] = useState<'period' | 'filters' | 'export' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showWho, setShowWho] = useState(false);
  const [limit, setLimit] = useState(100);

  const q = useDeferredValue(f.q.trim());
  const searching = q.length > 0;
  const shown = useMemo(() => applyFilters(records, { ...f, q }), [records, f.period, f.from, f.to, f.amount, f.staff, q]);
  const sum = useMemo(() => summarize(shown), [shown]);
  const label = searching ? 'Search results' : periodLabel(f);
  const maxN = Math.max(1, ...sum.people.map((p) => p.n));
  const sel = wide ? (shown.find((r) => r.id === selected) ?? shown[0] ?? null) : null;
  const filters = activeFilterCount(f);

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      const m = String((e as Error)?.message ?? e).toLowerCase();
      if (!m.includes('cancel') && !m.includes('abort')) toast('Could not export. Please try again.', true);
    }
  }

  async function sendSummary() {
    if (!alertTopic) return toast('Alerts are not ready yet. Check your internet.', true);
    const ok = await sendNtfy(alertTopic, `Closing ${label}: ${sum.count} cash-outs, ${peso(sum.total)}`);
    toast(ok ? 'Summary sent' : 'Could not send. Check your internet.', !ok);
  }

  const list = (
    <>
      <div className="count">
        {shown.length} {shown.length === 1 ? 'result' : 'records'}
        {searching && shown.length > 0 && shown.length !== 1 ? ' · best matches first' : ''}
      </div>
      <div className="list">
        {shown.slice(0, limit).map((r) => (
          <RecRow
            key={r.id}
            r={r}
            selected={wide && sel?.id === r.id}
            q={searching ? q : undefined}
            onClick={() => (wide ? setSelected(r.id) : go({ name: 'detail', id: r.id }))}
          />
        ))}
      </div>
      {shown.length === 0 && (
        <div className="empty">
          {searching ? (
            <>
              No match for “{q}”.
              <br />
              Try the last 4 digits of the reference number.
            </>
          ) : (
            'No records for this choice.'
          )}
        </div>
      )}
      {shown.length > limit && (
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setLimit(limit + 100)}>
          Show more
        </button>
      )}
    </>
  );

  return (
    <>
      <main className="page wide has-nav">
        <h1 className="h1">Records</h1>

        <div className={wide ? 'split' : undefined}>
          <div className="side">
            <div className="searchrow">
              <div className="search">
                <label htmlFor="q" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
                  Search
                </label>
                <Icon name="search" size={20} />
                <input id="q" type="search" inputMode="search" autoComplete="off" placeholder="Last digits of ref, name, number, amount" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
                {f.q && (
                  <button className="clear" aria-label="Clear search" onClick={() => setF({ ...f, q: '' })}>
                    <Icon name="close" size={20} />
                  </button>
                )}
              </div>
              <button className="filterbtn" aria-label="Filters" onClick={() => setSheet('filters')}>
                <Icon name="filter" size={22} />
                {filters > 0 && <em>{filters}</em>}
              </button>
            </div>

            {searching && (
              <div className="searchnote" role="status">
                <Icon name="search" size={18} /> Searching all dates
              </div>
            )}
            <div className="chips">
              <button className={`chip on${searching ? ' dim' : ''}`} aria-haspopup="dialog" onClick={() => setSheet('period')}>
                {label} <Icon name="down" size={14} />
              </button>
              {f.amount !== 'any' && (
                <button className="chip" onClick={() => setF({ ...f, amount: 'any' })} aria-label="Clear amount filter">
                  {BANDS.find((b) => b.value === f.amount)!.label} <Icon name="close" size={14} />
                </button>
              )}
              {f.staff !== 'all' && (
                <button className="chip" onClick={() => setF({ ...f, staff: 'all' })} aria-label="Clear staff filter">
                  {f.staff} <Icon name="close" size={14} />
                </button>
              )}
            </div>

            <section className="closing" aria-label="Closing">
              <div className="top">
                <div>
                  <small>Closing · {label}</small>
                  <b className="t">{peso(sum.total)}</b>
                  <span className="sub">
                    {sum.count} cash-outs · Fees {peso2(sum.fees)}
                  </span>
                </div>
                <button className="round" style={{ background: 'var(--green-soft)', color: 'var(--green-text)', boxShadow: 'none' }} aria-expanded={showWho} aria-label="Who saved" onClick={() => setShowWho(!showWho)}>
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
                  {sum.people.length === 0 && <div className="muted small">No saves for this choice.</div>}
                </div>
              )}
              <div className="acts">
                <button onClick={sendSummary}>
                  <Icon name="send" size={18} /> Send
                </button>
                <button disabled={!shown.length} onClick={() => setSheet('export')}>
                  <Icon name="download" size={18} /> Export
                </button>
              </div>
            </section>

            {list}
          </div>

          {wide && (
            <div className="detail-wrap">
              {sel ? <RecordDetail r={sel} panel /> : <div className="detail-panel empty">Select a record to see its details.</div>}
            </div>
          )}
        </div>
      </main>
      <NavBar active="records" />

      {sheet === 'period' && (
        <OptionSheet
          title="Show records from"
          options={PERIODS}
          value={f.period}
          onPick={(v) => {
            setF({ ...f, period: v });
            if (v === 'custom') setSheet('filters');
          }}
          onClose={() => setSheet((s) => (s === 'period' ? null : s))}
        />
      )}

      {sheet === 'filters' && (
        <Sheet title="Filters" onClose={() => setSheet(null)}>
          <div className="sec" style={{ marginTop: 0 }}>
            Dates
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} role="radiogroup" aria-label="Dates">
            {PERIODS.map((p) => (
              <button key={p.value} role="radio" aria-checked={f.period === p.value} className={`opt${f.period === p.value ? ' on' : ''}`} onClick={() => setF({ ...f, period: p.value })}>
                {p.label}
                {f.period === p.value && <Icon name="check" size={22} />}
              </button>
            ))}
          </div>
          {f.period === 'custom' && (
            <div className="two">
              <div className="field">
                <label htmlFor="from">From</label>
                <input id="from" type="date" className="box" value={f.from} max={f.to || undefined} onChange={(e) => setF({ ...f, from: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="to">To</label>
                <input id="to" type="date" className="box" value={f.to} min={f.from || undefined} onChange={(e) => setF({ ...f, to: e.target.value })} />
              </div>
            </div>
          )}

          <div className="sec">Amount</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} role="radiogroup" aria-label="Amount">
            {BANDS.map((b) => (
              <button key={b.value} role="radio" aria-checked={f.amount === b.value} className={`opt${f.amount === b.value ? ' on' : ''}`} onClick={() => setF({ ...f, amount: b.value })}>
                {b.label}
                {f.amount === b.value && <Icon name="check" size={22} />}
              </button>
            ))}
          </div>

          <div className="sec">Staff</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} role="radiogroup" aria-label="Staff">
            {['all', ...staffNames(records)].map((n) => (
              <button key={n} role="radio" aria-checked={f.staff === n} className={`opt${f.staff === n ? ' on' : ''}`} onClick={() => setF({ ...f, staff: n })}>
                {n === 'all' ? 'Everyone' : n}
                {f.staff === n && <Icon name="check" size={22} />}
              </button>
            ))}
          </div>

          <div className="two" style={{ marginTop: 18 }}>
            <button className="btn btn-ghost" onClick={() => setF({ ...DEFAULT_FILTERS, q: f.q })}>
              Reset
            </button>
            <button className="btn btn-soft" style={{ height: 54 }} onClick={() => setSheet(null)}>
              Show {shown.length}
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'export' && (
        <Sheet title={`Export ${shown.length} records`} onClose={() => setSheet(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              className="opt"
              onClick={() => {
                setSheet(null);
                void run(() => shareCsv(shown, f.period));
              }}
            >
              <span>
                Excel <small>· CSV file</small>
              </span>
              <Icon name="share" size={20} />
            </button>
            <button
              className="opt"
              onClick={() => {
                setSheet(null);
                void run(() => sharePdf(shown, f.period, `Cash-outs · ${label}`));
              }}
            >
              <span>
                PDF <small>· to print or share</small>
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
  const { user, toast } = useApp();
  const [sure, setSure] = useState(false);
  const [photo, setPhoto] = useState<string | null>(r.thumb ?? null);
  const [zoom, setZoom] = useState(false);
  const mine = r.byUid === user.uid;

  // The sharper photo is kept apart from the record. Load it when the record is opened.
  useEffect(() => {
    let on = true;
    setPhoto(r.thumb ?? null);
    setSure(false);
    void api.getPhoto(r.id).then((p) => on && p && setPhoto(p));
    return () => {
      on = false;
    };
  }, [r.id, r.thumb]);

  const body = (
    <>
      <div className="heroamt">
        <small>Amount</small>
        <b>{peso2(r.amount)}</b>
        <span>Fee {peso2(r.fee)}</span>
      </div>
      <div>
        <div className="muted small">Reference number</div>
        <div className="bigref" style={{ fontSize: 26 }}>
          {r.ref}
        </div>
      </div>
      <div className="kvs">
        <div className="kv">
          <span>Customer</span>
          <b>{r.name || '—'}</b>
        </div>
        <div className="kv">
          <span>Number</span>
          <b>{r.number || '—'}</b>
        </div>
        <div className="kv">
          <span>Receipt date</span>
          <b>{r.txAt ? dateTime(r.txAt) : '—'}</b>
        </div>
        <div className="kv">
          <span>Saved by</span>
          <b>
            {r.by} · {dateTime(r.savedAt)}
          </b>
        </div>
      </div>
      {photo && (
        <>
          <button className="photobtn" aria-label="Enlarge the receipt photo" onClick={() => setZoom(true)}>
            <img src={photo} alt="Receipt photo" />
            <span>
              <Icon name="search" size={14} color="#fff" /> Tap to enlarge
            </span>
          </button>
          {zoom && <PhotoViewer src={photo} onClose={() => setZoom(false)} />}
        </>
      )}
      <div className="muted small" style={{ textAlign: 'center' }}>
        Deleted automatically after 1 year.
      </div>
      {mine ? (
        <button
          className="btn btn-danger"
          onClick={() => {
            if (!sure) return setSure(true);
            api.deleteRecord(r.id);
            toast('Record deleted');
            setSure(false);
            onDeleted?.();
          }}
        >
          <Icon name="trash" size={20} />
          {sure ? 'Tap again to delete' : 'Delete this record'}
        </button>
      ) : (
        <div className="muted small" style={{ textAlign: 'center' }}>
          Only {r.by} can delete this record.
        </div>
      )}
    </>
  );

  return panel ? <div className="detail-panel">{body}</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{body}</div>;
}

export function Detail({ id }: { id: string }) {
  const { records, back } = useApp();
  const r = records.find((x) => x.id === id);
  return (
    <main className="page">
      <TopBar title="Record details" />
      {r ? <RecordDetail r={r} onDeleted={back} /> : <div className="empty">This record is not here anymore.</div>}
    </main>
  );
}
