import { formatRef, parseMoney, peso, peso2, waitText } from '../lib/format';
import { applyFilters, summarize } from '../lib/records';
import { DEFAULT_FILTERS } from '../lib/types';
import { sourceOf } from '../lib/wallets';
import { Icon } from './icons';
import { NavBar, RecRow } from './components';
import { useApp } from './context';

export function Home() {
  const { user, records, syncLabel, go, tab, undo, undoSave, t, settings, unsaved, resumeDraft, dropDraft, keepDraft, toast, update, downloadUpdate, laterUpdate, keptBatch, resumeBatch, dropBatch } = useApp();
  const tl = settings.lang === 'tl';
  // Cash-out is the cash that went out today. Pending records are counted apart.
  const todayList = applyFilters(records, { ...DEFAULT_FILTERS, period: 'today' });
  const day = summarize(todayList);
  const waiting = summarize(applyFilters(records, { ...DEFAULT_FILTERS, status: 'pending' }));

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
          <div className="row-between" style={{ gap: 8 }}>
            {syncLabel.wait && (
              <div className="pill wait" role="status">
                <i />
                {syncLabel.text}
              </div>
            )}
            <button className="round" aria-label={t('Settings')} onClick={() => go({ name: 'settings' })}>
              <Icon name="gear" size={24} />
            </button>
          </div>
        </div>

        <div className="home-grid">
          <div className="left">
            <div className="tiles">
              <div className="tile main">
                <small>{t('Cash-out')}</small>
                <b>{peso(day.total)}</b>
              </div>
              <div className="tile">
                <small>{t('Charge')}</small>
                <b>{peso(day.fees)}</b>
              </div>
            </div>
            {keptBatch && (
              <div className="draftcard" role="status">
                <b>{t('{n} receipts are not checked yet', { n: keptBatch.batch.ready.length })}</b>
                <span>
                  {t('{n} saved already', { n: keptBatch.batch.saved })} · {t('{time} ago', { time: waitText(Date.now() - keptBatch.at, tl) })}
                </span>
                <div className="two">
                  <button className="btn btn-ghost" onClick={dropBatch}>
                    {t('Discard')}
                  </button>
                  <button className="btn btn-primary" onClick={resumeBatch}>
                    {t('Continue')}
                  </button>
                </div>
              </div>
            )}
            {unsaved && (
              <div className="draftcard" role="status">
                <b>{t('You have a scan that is not saved')}</b>
                <span>
                  {peso2(parseMoney(unsaved.draft.amount))} · {unsaved.draft.source || 'GCash'} · {formatRef(unsaved.draft.ref)} · {t('{time} ago', { time: waitText(Date.now() - unsaved.at, tl) })}
                </span>
                <div className="two">
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
                  <button className="btn btn-primary" onClick={resumeDraft}>
                    {t('Continue')}
                  </button>
                </div>
              </div>
            )}
            {waiting.pendingCount > 0 && (
              <button className="pendingbar" onClick={() => tab({ name: 'records', status: 'pending' })}>
                <b>
                  {t('{n} pending', { n: waiting.pendingCount })} · {peso(waiting.pendingTotal)}
                </b>
                <span>{t('See')}</span>
              </button>
            )}
            {update && (
              <div className="updatebar" role="status">
                <b>{t('New version available')}</b>
                <button className="later" onClick={laterUpdate}>
                  {t('Later')}
                </button>
                <button className="go" onClick={downloadUpdate}>
                  {t('Update')}
                </button>
              </div>
            )}
          </div>

          <div className="right">
            <div className="row-between" style={{ margin: '4px 4px 8px' }}>
              <h2 style={{ fontSize: 18 }}>{t('Today')}</h2>
              <span className="muted small">{t('{n} records', { n: todayList.length })}</span>
            </div>
            {todayList.length === 0 ? (
              <div className="emptybox">
                <div className="art">
                  <Icon name="camera" size={54} />
                </div>
                <b>{t('No cash-out yet today')}</b>
                <span>{t('Tap the round button to scan.')}</span>
              </div>
            ) : (
              <div className="list">
                {todayList.map((r) => (
                  <RecRow key={r.id} r={r} fresh={undo?.id === r.id} onClick={() => go({ name: 'detail', id: r.id })} />
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
