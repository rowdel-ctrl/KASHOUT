import { isToday, peso } from '../lib/format';
import { Icon } from './icons';
import { NavBar, RecRow } from './components';
import { useApp } from './context';

export function Home() {
  const { user, records, syncLabel, go, tab, undo, undoSave } = useApp();
  const today = records.filter((r) => isToday(r.savedAt));
  const total = today.reduce((s, r) => s + r.amount, 0);
  const latest = records.slice(0, 3);

  return (
    <>
      <main className="screen has-nav">
        <div className="home-head">
          <div>
            <div className="muted">Hi, {user.name}</div>
            <h1 className="h1">Kashawt</h1>
          </div>
          <div className={`pill${syncLabel.wait ? ' wait' : ''}`}>
            <i />
            {syncLabel.text}
          </div>
        </div>

        <button className="record-btn" onClick={() => go({ name: 'scan' })}>
          <span className="ring">
            <Icon name="camera" size={56} stroke={1.8} color="#fff" />
          </span>
          <b>Record a cash-out</b>
          <span>Take a photo or pick a screenshot</span>
        </button>

        <div className="today">
          Today
          <b>
            {today.length} cash-outs · {peso(total)}
          </b>
        </div>

        <div className="sec-head">
          Latest
          <button className="link" onClick={() => tab({ name: 'records' })}>
            See all
          </button>
        </div>
        <div className="list">
          {latest.map((r) => (
            <RecRow key={r.id} r={r} fresh={undo?.id === r.id} onClick={() => go({ name: 'detail', id: r.id })} />
          ))}
          {latest.length === 0 && <div className="empty">No cash-outs yet. Tap the green button to record the first one.</div>}
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
