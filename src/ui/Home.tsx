import { formatRef, parseMoney, peso, peso2, waitText } from '../lib/format';
import { LATE_MS, applyFilters, summarize } from '../lib/records';
import { DEFAULT_FILTERS } from '../lib/types';
import { Icon } from './icons';
import { NavBar, RecRow } from './components';
import { useApp } from './context';

export function Home() {
  const { user, records, syncLabel, go, tab, undo, undoSave, markPaid, t, settings, unsaved, resumeDraft, dropDraft, keepDraft, toast } = useApp();
  const tl = settings.lang === 'tl';
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
            <div className="muted">{t('Hi, {name}', { name: user.name })}</div>
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
              <b>{t('Record a cash-out')}</b>
              <span>{t('Take a photo or pick a screenshot')}</span>
            </button>
            {unsaved && (
              <div className="draftcard" role="status">
                <b>{t('You have a scan that is not saved')}</b>
                <span>
                  {peso2(parseMoney(unsaved.draft.amount))} · {formatRef(unsaved.draft.ref)} · {t('{time} ago', { time: waitText(Date.now() - unsaved.at, tl) })}
                </span>
                <div className="two">
                  <button className="btn btn-primary" onClick={resumeDraft}>
                    {t('Continue')}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      const old = unsaved.draft;
                      dropDraft();
                      toast(t('Scan discarded'), false, { label: t('Undo'), run: () => keepDraft(old) });
                    }}
                  >
                    {t('Discard')}
                  </button>
                </div>
              </div>
            )}
            {waiting.pendingCount > 0 && (
              <button className="pendingcard" onClick={() => tab({ name: 'records', status: 'pending' })}>
                <span className="ic">
                  <Icon name="clock" size={24} />
                </span>
                <span>
                  <b>{t('{n} pending', { n: waiting.pendingCount })}</b>
                  <span>
                    {peso2(waiting.pendingTotal)} · {t('oldest')} {waited >= LATE_MS ? <em>{waitText(waited, tl)}</em> : waitText(waited, tl)}
                  </span>
                </span>
                <span className="see">{t('See')}</span>
              </button>
            )}
            <div className="stats">
              <div className="stat">
                <small>{t('Paid today')}</small>
                <b>{peso(total)}</b>
                <span>{t('{n} cash-outs', { n: day.count })}</span>
              </div>
              <div className="stat">
                <small>{t('Fees today')}</small>
                <b>{peso2(fees)}</b>
                <span>{t('From fees')}</span>
              </div>
            </div>
          </div>

          <div className="right">
            <div className="row-between" style={{ margin: '4px 0 8px' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>{t('Recent')}</h2>
              <button className="link" style={{ background: 'none', border: 0, minHeight: 44, color: 'var(--green-text)', fontSize: 15, fontWeight: 800 }} onClick={() => tab({ name: 'records' })}>
                {t('See all')}
              </button>
            </div>
            {latest.length === 0 ? (
              <div className="hint">{t('Nothing recorded yet. Tap the green button, take a photo of the GCash receipt, and save it.')}</div>
            ) : (
              <div className="list">
                {latest.map((r, i) => (
                  <div key={r.id} className={i >= 3 ? 'hide-narrow' : undefined}>
                    <RecRow r={r} fresh={undo?.id === r.id} onClick={() => go({ name: 'detail', id: r.id })} onMarkPaid={() => markPaid(r)} />
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
            {undo.status === 'pending' ? t('Saved as pending') : t('Saved')}
            <button onClick={undoSave}>{t('Undo')}</button>
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
