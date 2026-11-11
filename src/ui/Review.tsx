import { useMemo, useState } from 'react';
import { feeFor } from '../lib/fees';
import { fromLocalInput, isToday, parseMoney, peso, shortDate, toLocalInput, dateTime } from '../lib/format';
import type { CashRecord, Draft } from '../lib/types';
import { Icon } from './icons';
import { TopBar, WarnBar } from './components';
import { useApp } from './context';

export function Review({ initial }: { initial: Draft }) {
  const { settings, fees, records, saveDraft, tab } = useApp();
  const [d, setD] = useState<Draft>(initial);
  const [more, setMore] = useState(false);
  const [dup, setDup] = useState<CashRecord | null>(null);

  const refDigits = d.ref.replace(/\s+/g, '');
  const refOk = /^\d{13}$/.test(refDigits);
  const amount = parseMoney(d.amount);

  const warns = useMemo(() => {
    const w: string[] = [];
    if (settings.warnOld) {
      if (d.txAt == null) w.push('We could not read the date.');
      else if (!isToday(d.txAt)) w.push(`This receipt is from ${shortDate(d.txAt)}.`);
    }
    if (settings.warnBig && amount > settings.bigLimit) w.push(`${peso(amount)} is a big amount.`);
    if (!refOk) w.push('The reference number is not 13 digits.');
    return w;
  }, [settings.warnOld, settings.warnBig, settings.bigLimit, d.txAt, amount, refOk]);

  const oldWarn = settings.warnOld && (d.txAt == null || !isToday(d.txAt));
  const bigWarn = settings.warnBig && amount > settings.bigLimit;
  const canSave = refDigits.length > 0 && amount > 0;

  function setAmount(v: string) {
    setD((p) => {
      const next = { ...p, amount: v };
      if (!p.feeTouched) {
        const f = feeFor(parseMoney(v), fees);
        next.fee = f != null ? f.toFixed(2) : '';
      }
      return next;
    });
  }

  function onSave() {
    const found = records.find((r) => r.ref === refDigits);
    if (found) setDup(found);
    else saveDraft({ ...d, ref: refDigits }, false);
  }

  return (
    <>
      <main className="screen review">
        <TopBar title="Check and save" />

        {d.thumb && !more && (
          <div className="thumb-row">
            <img src={d.thumb} alt="Your receipt photo" />
            <p>We read this from your photo. Please check it.</p>
          </div>
        )}
        {!d.thumb && !more && (
          <div className="thumb-row">
            <p>Type the details from the GCash receipt.</p>
          </div>
        )}

        <div className="field">
          <label htmlFor="ref">Reference number</label>
          <input id="ref" inputMode="numeric" autoComplete="off" className={refOk ? '' : 'warn'} value={d.ref} onChange={(e) => setD({ ...d, ref: e.target.value })} />
          <div className={`hint${refOk ? '' : ' bad'}`}>{refOk ? '13 digits ✓' : `${refDigits.length} digits. It should be 13.`}</div>
        </div>

        <div className="field">
          <label htmlFor="amt">Amount (₱)</label>
          <input id="amt" inputMode="decimal" autoComplete="off" className={bigWarn ? 'warn' : ''} value={d.amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <button className="more-btn" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? 'Hide details' : 'More details'}
          <small>
            {!more && 'Name, number, date, fee'}
            <Icon name={more ? 'up' : 'down'} size={20} />
          </small>
        </button>

        {more && (
          <>
            <div className="two">
              <div className="field small">
                <label htmlFor="nm">Name</label>
                <input id="nm" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
              </div>
              <div className="field small">
                <label htmlFor="no">Number</label>
                <input id="no" inputMode="tel" value={d.number} onChange={(e) => setD({ ...d, number: e.target.value })} />
              </div>
            </div>
            <div className="two">
              <div className="field small" style={{ flex: 1.5 }}>
                <label htmlFor="dt">Date and time</label>
                <input id="dt" type="datetime-local" className={oldWarn ? 'warn' : ''} value={toLocalInput(d.txAt)} onChange={(e) => setD({ ...d, txAt: fromLocalInput(e.target.value) })} />
              </div>
              <div className="field small">
                <label htmlFor="fee">Fee (₱)</label>
                <input id="fee" inputMode="decimal" value={d.fee} onChange={(e) => setD({ ...d, fee: e.target.value, feeTouched: true })} />
              </div>
            </div>
          </>
        )}
      </main>

      <div className="savebar">
        {warns.length > 0 && (
          <WarnBar>
            <b>Please check.</b> {warns.join(' ')}
          </WarnBar>
        )}
        <button className="btn btn-primary" disabled={!canSave} onClick={onSave}>
          Save · Cash given
        </button>
        <button className="btn btn-text" onClick={() => tab({ name: 'home' })}>
          Cancel
        </button>
      </div>

      {dup && (
        <div className="sheet-back" role="dialog" aria-modal="true" aria-label="Already saved">
          <div className="sheet">
            <div className="grip" />
            <div className="sheet-head">
              <div className="badge">
                <Icon name="warn" size={30} color="#5C4300" />
              </div>
              <div>
                <b>Already saved</b>
                <span>This may be paid out twice.</span>
              </div>
            </div>
            <div className="card">
              <div className="muted" style={{ fontSize: 15 }}>
                Reference number
              </div>
              <div className="bigref">{dup.ref}</div>
              <div className="kv">
                <span>Saved by</span>
                <b>{dup.by}</b>
              </div>
              <div className="kv">
                <span>When</span>
                <b>{dateTime(dup.savedAt)}</b>
              </div>
              <div className="kv">
                <span>Amount</span>
                <b>{peso(dup.amount)}</b>
              </div>
            </div>
            <div className="stack">
              <button className="btn btn-primary" onClick={() => tab({ name: 'home' })}>
                Don't save
              </button>
              <button className="btn btn-danger" onClick={() => saveDraft({ ...d, ref: refDigits }, true)}>
                This is different. Save anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
