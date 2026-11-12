import { peso, peso2 } from '../lib/format';
import { applyFilters, summarize } from '../lib/records';
import { DEFAULT_FILTERS } from '../lib/types';
import { Icon } from './icons';
import { useApp } from './context';

/** Shown right after Save. One tap to scan the next receipt. */
export function Saved() {
  const { lastSaved, records, undo, undoSave, tab, replace } = useApp();
  const day = summarize(applyFilters(records, { ...DEFAULT_FILTERS, period: 'today' }));
  const pending = lastSaved?.status === 'pending';
  return (
    <main className="page saved">
      <div className="okring" aria-hidden="true">
        <Icon name={pending ? 'clock' : 'check'} size={56} color="#fff" />
      </div>
      <h1 className="h1">{pending ? 'Saved as pending' : 'Saved'}</h1>
      {lastSaved && (
        <div className="line">
          {peso2(lastSaved.amount)}
          {lastSaved.name ? ` · ${lastSaved.name}` : ''} · {pending ? 'Pending' : 'Paid'}
        </div>
      )}
      <div className="muted">Paid today: {peso(day.total)}</div>
      <div className="stack" style={{ marginTop: 'auto', width: '100%' }}>
        <button className="btn btn-primary" style={{ height: 62, fontSize: 20 }} onClick={() => replace({ name: 'scan' })}>
          <Icon name="camera" size={24} />
          Scan next
        </button>
        <button className="btn btn-ghost" onClick={() => tab({ name: 'home' })}>
          Done
        </button>
        {undo && undo.id === lastSaved?.id && (
          <button className="btn btn-text" style={{ color: 'var(--red)' }} onClick={undoSave}>
            Undo
          </button>
        )}
      </div>
    </main>
  );
}
