import { useState } from 'react';
import { peso, peso2 } from '../lib/format';
import { sourceOf } from '../lib/wallets';
import { Icon } from './icons';
import { useApp } from './context';

/** The end of a batch: how many were saved, and the receipts that were set aside. */
export function BatchDone() {
  const { batch, retryInBatch, fixInBatch, finishBatch, t } = useApp();
  const [reading, setReading] = useState<number | null>(null);
  const skipped = batch?.skipped ?? [];
  const why = { duplicate: t('Already saved'), unread: t('Could not read the reference number'), skipped: t('Skipped') } as const;

  async function retry(i: number) {
    setReading(i);
    await retryInBatch(i);
    setReading(null);
  }

  return (
    <main className="page saved batchdone">
      <div className="okring" aria-hidden="true">
        <Icon name="check" size={56} color="#fff" />
      </div>
      <h1 className="h1">{t('All done')}</h1>
      <div className="line">{t('{n} saved', { n: batch?.saved ?? 0 })}</div>

      {skipped.length > 0 && (
        <section className="skiplist" aria-label={t('Set aside')}>
          <div className="muted small" style={{ padding: '0 4px 8px' }}>
            {t('Set aside · {n}', { n: skipped.length })}
          </div>
          {skipped.map((x, i) => {
            const unread = x.why === 'unread';
            return (
              <div className="skipitem" key={i}>
                <div className="top">
                  <span className="mini" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="info">
                    <b>
                      {x.draft.amount ? `${peso(Number(x.draft.amount.replace(/,/g, '')) || 0)} · ` : ''}
                      {x.draft.source || sourceOf({})}
                    </b>
                    <small>{unread && x.tries > 0 ? t('Still could not read the reference number') : why[x.why]}</small>
                  </span>
                </div>
                <div className="acts">
                  {unread && x.tries === 0 && (
                    <button className="btn btn-primary" disabled={reading !== null} onClick={() => void retry(i)}>
                      {reading === i ? t('Reading again…') : t('Try again')}
                    </button>
                  )}
                  <button className={unread && x.tries > 0 ? 'btn btn-primary' : 'btn btn-ghost'} disabled={reading !== null} onClick={() => fixInBatch(i)}>
                    {t('Fix')}
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <div className="stack" style={{ marginTop: 'auto', width: '100%', paddingTop: 20 }}>
        <button className="btn btn-primary" style={{ height: 62, fontSize: 20 }} onClick={finishBatch}>
          {t('Done')}
        </button>
      </div>
    </main>
  );
}
