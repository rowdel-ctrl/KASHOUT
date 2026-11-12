import { peso, peso2, waitText } from '../lib/format';
import { LATE_MS, applyFilters, summarize } from '../lib/records';
import { DEFAULT_FILTERS } from '../lib/types';
import { Icon } from './icons';
import { NavBar, RecRow } from './components';
import { useApp } from './context';

export function Home() {
  const { user, records, syncLabel, go, tab, undo, undoSave } = useApp();
  // Paid today: cash that went out today. Pending records are counted apart.
  const day = summarize(applyFilters(records, { ...DEFAULT_FILTERS, period: 'today' }));
  const waiting = summarize(applyFilters(records, { ...DEFAULT_FILTERS, status: 'pending' }));
  const waited = waiting.oldestPending != null ? Date.now() - waiting.oldestPending : 0;
  const total = day.total;
  const fees = day.fees;
  const latest = records.slice(0, 5);

  return (
    <>
      <main className="page wide has-nav home">
        <div className="row-between">
          <div>
            <div className="muted">Hi, {user.name}</div>
            <h1 className="h1" style={{ fontSize: 28 }}>
              Kashawt
            </h1>
          </div>
          <div className={`pill${syncLabel.wait ? ' wait' : ''}`} role="status">
            <i />
            {syncLabel.text}
          </div>
        </div>

        <div className="home-grid">
          <div className="left">
            <button className="hero" onClick={() => go({ name: 'scan' })}>
              <span className="ring">
                <Icon name="camera" size={42} />
              </span>
              <b>Record a cash-out</b>
              <span>Take a photo or pick a screenshot</span>
            </button>
            {waiting.pendingCount > 0 && (
              <button className="pendingcard" onClick={() => tab({ name: 'records', status: 'pending' })}>
                <span className="ic">
                  <Icon name="clock" size={24} />
                </span>
                <span>
                  <b>{waiting.pendingCount} pending</b>
                  <span>
                    {peso2(waiting.pendingTotal)} · oldest waiting {waited >= LATE_MS ? <em>{waitText(waited)}</em> : waitText(waited)}
                  </span>
                </span>
                <span className="see">See</span>
              </button>
            )}
            <div className="stats">
              <div className="stat">
                <small>Paid today</small>
                <b>{peso(total)}</b>
                <span>{day.count} cash-outs</span>
              </div>
              <div className="stat">
                <small>Fees today</small>
                <b>{peso2(fees)}</b>
                <span>Kita ngayon</span>
              </div>
            </div>
          </div>

          <div className="right">
            <div className="row-between" style={{ margin: '4px 0 8px' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Recent</h2>
              <button className="link" style={{ background: 'none', border: 0, minHeight: 44, color: 'var(--green-text)', fontSize: 15, fontWeight: 800 }} onClick={() => tab({ name: 'records' })}>
                See all
              </button>
            </div>
            {latest.length === 0 ? (
              <div className="hint">Nothing recorded yet. Tap the green button, take a photo of the GCash receipt, and save it.</div>
            ) : (
              <div className="list">
                {latest.map((r, i) => (
                  <div key={r.id} className={i >= 3 ? 'hide-narrow' : undefined}>
                    <RecRow r={r} fresh={undo?.id === r.id} onClick={() => go({ name: 'detail', id: r.id })} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {undo && (
        <div className="undo" role="status">
          <div>
            {undo.status === 'pending' ? 'Saved as pending' : 'Saved'}
            <button onClick={undoSave}>Undo</button>
          </div>
          <span className="bar">
            <i />
          </span>
        </div>
      )}
      <NavBar active="home" />
    </>
  );
}
