import { useMemo, useState } from 'react';
import { peso, shortDate } from '../lib/format';
import { RANGES, insightsFor, type InsightRange } from '../lib/insights';
import { TopBar } from './components';
import { useApp } from './context';

const RANGE_LABELS: Record<InsightRange, string> = { '7': '7 days', '30': '30 days', '90': '3 months' };

/** Earnings over time: Charge and Cash-out for the last days, with small bars. */
export function Insights() {
  const { records, today, t } = useApp();
  const [range, setRange] = useState<InsightRange>('7');
  const [sel, setSel] = useState<number | null>(null);
  const r = useMemo(() => insightsFor(records, range), [records, today, range]);
  const max = Math.max(1, ...r.buckets.map((b) => b.charge));
  const weekdays = [t('Sun'), t('Mon'), t('Tue'), t('Wed'), t('Thu'), t('Fri'), t('Sat')];
  const labelOf = (start: number, i: number): string => {
    if (range === '7') return weekdays[new Date(start).getDay()];
    if (range === '30') return i % 5 === 0 ? String(new Date(start).getDate()) : '';
    return i % 4 === 0 ? shortDate(start) : '';
  };
  const fullLabel = (start: number): string => (range === '90' ? t('Week of {date}', { date: shortDate(start) }) : `${weekdays[new Date(start).getDay()]} ${shortDate(start)}`);
  const delta = (v: number | null) => (v === null ? '' : v >= 0 ? t('Up {n}% from before', { n: v }) : t('Down {n}% from before', { n: Math.abs(v) }));
  const picked = sel !== null ? r.buckets[sel] : null;

  return (
    <main className="page insights">
      <TopBar title={t('Insights')} />
      <div className="seg3" role="group" aria-label={t('Dates')}>
        {(Object.keys(RANGES) as InsightRange[]).map((k) => (
          <button
            key={k}
            className={range === k ? 'on' : ''}
            aria-pressed={range === k}
            onClick={() => {
              setRange(k);
              setSel(null);
            }}
          >
            {t(RANGE_LABELS[k])}
          </button>
        ))}
      </div>

      <div className="itiles">
        <div className="tile gold">
          <small>{t('Charge')}</small>
          <b>{peso(r.charge)}</b>
          {delta(r.chargeDelta) && <span>{delta(r.chargeDelta)}</span>}
        </div>
        <div className="tile green">
          <small>{t('Cash-out')}</small>
          <b>{peso(r.cash)}</b>
          {delta(r.cashDelta) && <span>{delta(r.cashDelta)}</span>}
        </div>
      </div>

      <section className="chartcard" aria-label={t('Charge per day')}>
        <div className="cap">
          <b>{range === '90' ? t('Charge per week') : t('Charge per day')}</b>
        </div>
        {r.count === 0 ? (
          <div className="nodata">{t('No cash-out in this time yet.')}</div>
        ) : (
          <>
            <div className="bars">
              {r.buckets.map((b, i) => (
                <button
                  key={b.start}
                  className={`${i === r.buckets.length - 1 ? 'now' : ''}${i === sel ? ' sel' : ''}`}
                  aria-label={`${fullLabel(b.start)}: ${t('Charge')} ${peso(b.charge)}`}
                  aria-pressed={i === sel}
                  onClick={() => setSel(i === sel ? null : i)}
                >
                  <i style={{ height: `${b.charge > 0 ? Math.max(6, Math.round((b.charge / max) * 100)) : 0}%` }} />
                </button>
              ))}
            </div>
            <div className="axis" aria-hidden="true">
              {r.buckets.map((b, i) => (
                <span key={b.start}>{labelOf(b.start, i)}</span>
              ))}
            </div>
            <div className="pickline" aria-live="polite">
              {picked ? `${fullLabel(picked.start)} · ${t('Charge')} ${peso(picked.charge)} · ${t('{n} cash-outs', { n: picked.count })}` : t('Tap a bar to see that day.')}
            </div>
          </>
        )}
      </section>

      <div className="istats">
        <div>
          <small>{t('Cash-outs')}</small>
          <b>{r.count}</b>
        </div>
        <div>
          <small>{t('Average')}</small>
          <b>{peso(r.average)}</b>
        </div>
        <div>
          <small>{t('Best day')}</small>
          <b>{r.best ? peso(r.best.charge) : '—'}</b>
        </div>
      </div>
    </main>
  );
}
