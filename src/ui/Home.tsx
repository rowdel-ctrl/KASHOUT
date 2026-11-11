import { isToday, peso, peso2 } from '../lib/format';
import { Icon } from './icons';
import { NavBar, RecRow } from './components';
import { useApp } from './context';

export function Home() {
  const { user, records, syncLabel, go, tab, undo, undoSave } = useApp();
  const today = records.filter((r) => isToday(r.savedAt));
  const total = today.reduce((s, r) => s + r.amount, 0);
  const fees = today.reduce((s, r) => s + r.fee, 0);
  const latest = records.slice(0, 5);

  return (
    <>
      <main className="page wide has-nav">
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
            <div className="stats">
              <div className="stat">
                <small>Today</small>
                <b>{peso(total)}</b>
                <span>{today.length} cash-outs</span>
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
            Saved
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
