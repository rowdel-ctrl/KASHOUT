import { useMemo, useState } from 'react';
import { feeFor, tierLabel } from '../lib/fees';
import { dateTime, formatRef, fromLocalInput, parseMoney, peso, peso2, toLocalInput } from '../lib/format';
import { reviewWarnings } from '../lib/warnings';
import type { CashRecord, Draft } from '../lib/types';
import { Icon } from './icons';
import { PhotoViewer } from './PhotoViewer';
import { Sheet, TopBar, WarnBar } from './components';
import { useApp } from './context';

export function Review({ initial }: { initial: Draft }) {
  const { settings, fees, records, saveDraft, tab, go } = useApp();
  const [d, setD] = useState<Draft>(initial);
  const [dup, setDup] = useState<CashRecord | null>(null);
  const [saveAs, setSaveAs] = useState<'paid' | 'pending'>('paid');
  const [sheet, setSheet] = useState<'fee' | 'customer' | 'read' | null>(null);
  const [viewing, setViewing] = useState(false);

  const refDigits = d.ref.replace(/\s+/g, '');
  const refOk = /^\d{13}$/.test(refDigits);
  const amount = parseMoney(d.amount);
  const warns = useMemo(() => reviewWarnings(d, settings), [d, settings]);
  const has = (k: string) => warns.some((w) => w.key === k);
  const canSave = refDigits.length > 0 && amount > 0;
  const autoFee = feeFor(amount, fees);
  const feeNum = parseMoney(d.fee);
  const photo = d.photoUrl ?? d.thumb;

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

  function onSave(status: 'paid' | 'pending') {
    setSaveAs(status);
    const found = records.find((r) => r.ref === refDigits);
    if (found) setDup(found);
    else saveDraft({ ...d, ref: refDigits }, false, status);
  }

  return (
    <>
      <main className="page review">
        <TopBar title="Check and save" />

        <div className="photo-card">
          {photo ? <img className="thumb" src={d.thumb ?? photo} alt="" /> : <div className="thumb" aria-hidden="true" />}
          <div>
            <b>{photo ? 'We read this from your photo' : 'Type the receipt details'}</b>
            <p>{photo ? 'Check each box. Tap one to fix it.' : 'Copy them from the GCash receipt.'}</p>
            {photo && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="link" onClick={() => setViewing(true)}>
                  View photo
                </button>
                {d.rawText !== undefined && (
                  <button className="link" onClick={() => setSheet('read')}>
                    What the app read
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="ref">Reference number</label>
          <input id="ref" className={`box big ${refOk ? 'ok' : 'warn'}`} inputMode="numeric" autoComplete="off" value={d.ref} onChange={(e) => setD({ ...d, ref: e.target.value })} />
          <div className={`note${refOk ? ' good' : ''}`}>{refOk ? '13 digits ✓' : `${refDigits.length} digits. It should be 13.`}</div>
        </div>

        <div className="two">
          <div className="field">
            <label htmlFor="amt">Amount</label>
            <input id="amt" className={`box big${has('big') ? ' warn' : ''}`} inputMode="decimal" autoComplete="off" value={d.amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="field">
            <span className="lab">Fee</span>
            <button className="box big" aria-haspopup="dialog" aria-label={`Fee ${peso2(feeNum)}. Change`} onClick={() => setSheet('fee')}>
              <span>{d.fee ? peso(feeNum) : '—'}</span>
              <Icon name="down" size={18} />
            </button>
          </div>
        </div>
        {has('big') && <div className="note">Above your {peso(settings.bigLimit)} limit</div>}

        <div className="field">
          <label htmlFor="dt">Date and time</label>
          <input id="dt" type="datetime-local" className={`box${has('old') || has('date') ? ' warn' : ''}`} value={toLocalInput(d.txAt)} onChange={(e) => setD({ ...d, txAt: fromLocalInput(e.target.value) })} />
          {has('old') && <div className="note">This receipt is not from today</div>}
          {has('date') && <div className="note">The date is missing. Please set it.</div>}
        </div>

        <div className="field">
          <span className="lab">Customer</span>
          <button className="box" aria-haspopup="dialog" onClick={() => setSheet('customer')}>
            <span>{d.name || d.number ? `${d.name || 'No name'} · ${d.number || 'No number'}` : 'Add name and number'}</span>
            <Icon name="right" size={18} />
          </button>
        </div>
      </main>

      <div className="savebar">
        <div className="in">
          {warns.length > 0 && (
            <WarnBar>
              <b>Please check.</b> {warns.map((w) => w.text).join(' ')}
            </WarnBar>
          )}
          <button className="btn btn-primary" disabled={!canSave} onClick={() => onSave('paid')}>
            <Icon name="check" size={22} />
            Save · Paid
          </button>
          <button className="btn btn-pending" disabled={!canSave} onClick={() => onSave('pending')}>
            <Icon name="clock" size={22} />
            Save · Pending
          </button>
          <div className="muted small" style={{ textAlign: 'center', lineHeight: 1.35 }}>
            Pending keeps the receipt. Mark it <b>Paid</b> when you give the cash.
          </div>
          <button className="btn btn-text" onClick={() => tab({ name: 'home' })}>
            Discard
          </button>
        </div>
      </div>

      {sheet === 'fee' && (
        <Sheet title="Fee" onClose={() => setSheet(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              className={`opt${!d.feeTouched ? ' on' : ''}`}
              onClick={() => {
                setD({ ...d, feeTouched: false, fee: autoFee != null ? autoFee.toFixed(2) : '' });
                setSheet(null);
              }}
            >
              <span>
                Automatic <small>· {autoFee != null ? `${peso(autoFee)} for ${peso(amount)}` : 'type it below'}</small>
              </span>
              {!d.feeTouched && <Icon name="check" size={22} />}
            </button>
            {fees.map((t, i) => (
              <button
                key={i}
                className={`opt${d.feeTouched && feeNum === t.fee ? ' on' : ''}`}
                onClick={() => {
                  setD({ ...d, fee: t.fee.toFixed(2), feeTouched: true });
                  setSheet(null);
                }}
              >
                <span>
                  {peso(t.fee)} <small>· ₱{tierLabel(fees, i)}</small>
                </span>
                {d.feeTouched && feeNum === t.fee && <Icon name="check" size={22} />}
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="cfee">Other fee (₱)</label>
            <input
              id="cfee"
              className="box"
              inputMode="decimal"
              value={d.feeTouched ? d.fee : ''}
              placeholder="Type a fee"
              onChange={(e) => setD({ ...d, fee: e.target.value, feeTouched: true })}
            />
          </div>
          <button className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => setSheet(null)}>
            Done
          </button>
        </Sheet>
      )}

      {sheet === 'read' && (
        <Sheet title="What the app read" onClose={() => setSheet(null)}>
          <p className="muted" style={{ fontSize: 15, marginTop: -4, marginBottom: 10 }}>
            This is the text the app found in the photo. If a field is wrong, send a screenshot of this to the developer. Hide real numbers first.
          </p>
          <pre className="rawtext">{d.rawText ? d.rawText : '(nothing was read)'}</pre>
          <button className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => setSheet(null)}>
            Close
          </button>
        </Sheet>
      )}

      {sheet === 'customer' && (
        <Sheet title="Customer" onClose={() => setSheet(null)}>
          <div className="field" style={{ marginTop: 0 }}>
            <label htmlFor="nm">Name</label>
            <input id="nm" className="box" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="no">Number</label>
            <input id="no" className="box" inputMode="tel" value={d.number} onChange={(e) => setD({ ...d, number: e.target.value })} />
          </div>
          <button className="btn btn-soft" style={{ marginTop: 16 }} onClick={() => setSheet(null)}>
            Done
          </button>
        </Sheet>
      )}

      {dup && (
        <Sheet title="Already saved" onClose={() => setDup(null)}>
          <div className="muted" style={{ marginTop: -6, marginBottom: 14, fontSize: 16 }}>
            This may be paid out twice.
          </div>
          <div className="card" style={{ boxShadow: 'none', background: 'var(--bg)' }}>
            <div className="muted small">Reference number</div>
            <div className="bigref">{formatRef(dup.ref)}</div>
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
              <b>{peso2(dup.amount)}</b>
            </div>
          </div>
          <div className="stack" style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                // Open the record that already has this reference. Back goes home.
                setDup(null);
                tab({ name: 'home' });
                go({ name: 'detail', id: dup.id });
              }}
            >
              Show saved record
            </button>
            <button className="btn btn-danger" onClick={() => saveDraft({ ...d, ref: refDigits }, true, saveAs)}>
              This is different. Save anyway
            </button>
            <button className="btn btn-text" onClick={() => setDup(null)}>
              Cancel
            </button>
          </div>
        </Sheet>
      )}

      {viewing && photo && <PhotoViewer src={photo} onClose={() => setViewing(false)} />}
    </>
  );
}
