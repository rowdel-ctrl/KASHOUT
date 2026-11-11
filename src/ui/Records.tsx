import { useMemo, useState } from 'react';
import { api } from '../data';
import { dateTime, isToday, isYesterday, peso, peso2 } from '../lib/format';
import { Icon } from './icons';
import { NavBar, RecRow, TopBar } from './components';
import { useApp } from './context';

type Filter = 'today' | 'yesterday' | 'all';

export function Records({ initial }: { initial?: Filter }) {
  const { records, go } = useApp();
  const [filter, setFilter] = useState<Filter>(initial ?? 'today');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(100);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return records.filter((r) => {
      if (filter === 'today' && !isToday(r.savedAt)) return false;
      if (filter === 'yesterday' && !isYesterday(r.savedAt)) return false;
      if (!term) return true;
      return [r.ref, r.name, r.number, String(r.amount), r.amount.toFixed(2), r.by].some((v) => v.toLowerCase().includes(term));
    });
  }, [records, filter, q]);

  const total = shown.reduce((s, r) => s + r.amount, 0);
  const chips: [Filter, string][] = [['today', 'Today'], ['yesterday', 'Yesterday'], ['all', 'All']];

  return (
    <>
      <main className="screen has-nav">
        <h1 className="h1">Records</h1>
        <div className="search">
          <label htmlFor="q" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
            Search
          </label>
          <Icon name="search" size={24} color="#4A5D52" />
          <input id="q" type="search" placeholder="Search ref, name, number or amount" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips">
          {chips.map(([k, label]) => (
            <button key={k} className={`chip${filter === k ? ' on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="count">
          {shown.length} records · {peso(total)}
        </div>
        <div className="list">
          {shown.slice(0, limit).map((r) => (
            <RecRow key={r.id} r={r} onClick={() => go({ name: 'detail', id: r.id })} />
          ))}
        </div>
        {shown.length === 0 && <div className="empty">Nothing found.</div>}
        {shown.length > limit && (
          <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => setLimit(limit + 100)}>
            Show more
          </button>
        )}
      </main>
      <NavBar active="records" />
    </>
  );
}

export function Detail({ id }: { id: string }) {
  const { records, back, toast } = useApp();
  const [sure, setSure] = useState(false);
  const r = records.find((x) => x.id === id);

  if (!r) {
    return (
      <main className="screen">
        <TopBar title="Record details" />
        <div className="empty">This record is not here anymore.</div>
      </main>
    );
  }

  return (
    <main className="screen">
      <TopBar title="Record details" />
      <div className="hero">
        <small>Amount</small>
        <b>{peso2(r.amount)}</b>
        <span>Fee {peso2(r.fee)}</span>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="muted" style={{ fontSize: 15 }}>
          Reference number
        </div>
        <div className="bigref">{r.ref}</div>
      </div>

      <div className="card tight" style={{ marginTop: 12 }}>
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

      {r.thumb && (
        <div className="card" style={{ marginTop: 12 }}>
          <img className="photo" src={r.thumb} alt="Small copy of the receipt photo" />
        </div>
      )}

      <p className="muted" style={{ textAlign: 'center', fontSize: 14, marginTop: 16 }}>
        Deleted automatically after 1 year.
      </p>
      <button
        className="btn btn-danger"
        onClick={() => {
          if (!sure) return setSure(true);
          api.deleteRecord(r.id);
          toast('Record deleted');
          back();
        }}
      >
        {sure ? 'Tap again to delete' : 'Delete this record'}
      </button>
    </main>
  );
}
