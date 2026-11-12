import { useEffect, useMemo, useRef, useState } from 'react';
import { feeFor, tierLabel } from '../lib/fees';
import { dateTime, formatRef, fromLocalInput, isValidRef, parseMoney, peso, peso2, toLocalInput } from '../lib/format';
import { nameForNumber } from '../lib/identity';
import { reviewWarnings } from '../lib/warnings';
import { isPending } from '../lib/records';
import { isMeaningful } from '../native/draftStore';
import type { CashRecord, Draft } from '../lib/types';
import { walletChoices, walletColor } from '../lib/wallets';
import { Icon } from './icons';
import { missingFields, rereadSamePicture } from './retry';
import { PhotoViewer } from './PhotoViewer';
import { Sheet, TopBar, WarnBar } from './components';
import { useApp } from './context';

export function Review({ initial }: { initial: Draft }) {
  const { settings, fees, records, saveDraft, markPaid, tab, go, replace, toast, t, keepDraft, dropDraft, setLeaveGuard } = useApp();
  const [d, setD] = useState<Draft>(initial);
  const [dup, setDup] = useState<CashRecord | null>(null);
  const [saveAs, setSaveAs] = useState<'paid' | 'pending'>('paid');
  const [sheet, setSheet] = useState<'fee' | 'customer' | 'read' | 'wallet' | null>(null);
  // Reading a missing field again: 0 = not tried, 1 = tried once and still missing.
  const [tries, setTries] = useState(0);
  const [rereading, setRereading] = useState(false);
  const [viewing, setViewing] = useState(false);
  // "This is different": the person says the saved record with this reference is another cash-out.
  const [differs, setDiffers] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const nameTouched = useRef(false);

  const refDigits = d.ref.replace(/\s+/g, '');
  const refOk = isValidRef(refDigits);
  const amount = parseMoney(d.amount);
  const warns = useMemo(() => reviewWarnings(d, settings), [d, settings]);
  const has = (k: string) => warns.some((w) => w.key === k);
  const canSave = refDigits.length > 0 && amount > 0;
  const autoFee = feeFor(amount, fees);
  const feeNum = parseMoney(d.fee);
  const photo = d.photoUrl ?? d.photo ?? d.thumb;
  // Same reference as a record that is already saved. Shown at once, before Save.
  const dupNow = refDigits ? records.find((r) => r.ref === refDigits) : undefined;
  const showDup = !!dupNow && !differs;

  // Fill in the name from an earlier record with the same number, unless the person typed one.
  const known = useMemo(() => (d.name ? '' : nameForNumber(records, d.number)), [records, d.name, d.number]);
  useEffect(() => {
    if (known && !d.name && !nameTouched.current) setD((p) => (p.name ? p : { ...p, name: known, autoName: true }));
  }, [known, d.name]);

  // Keep what was read on this phone, so a scan is not lost if the person forgets to save.
  useEffect(() => {
    if (!isMeaningful(d)) return;
    const id = window.setTimeout(() => keepDraft(d), 800);
    return () => window.clearTimeout(id);
  }, [d, keepDraft]);

  // Back (the button or the phone's Back) asks first when there is something to lose.
  const meaningful = isMeaningful(d);
  const meaningfulRef = useRef(meaningful);
  meaningfulRef.current = meaningful;
  const leavingRef = useRef(leaving);
  leavingRef.current = leaving;
  useEffect(() => {
    setLeaveGuard(() => {
      if (leavingRef.current) {
        setLeaving(false);
        return true;
      }
      if (!meaningfulRef.current) return false;
      setLeaving(true);
      return true;
    });
    return () => setLeaveGuard(null);
  }, [setLeaveGuard]);
  const requestLeave = () => (meaningful ? setLeaving(true) : tab({ name: 'home' }));

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
    if (found && !differs) setDup(found);
    else saveDraft({ ...d, ref: refDigits }, differs, status);
  }

  const showSaved = (r: CashRecord) => {
    // Open the record that already has this reference. Back goes home.
    dropDraft();
    tab({ name: 'home' });
    go({ name: 'detail', id: r.id });
  };
  const payNow = (r: CashRecord) => {
    // Give the cash now: mark the pending record as paid and go home.
    dropDraft();
    markPaid(r);
    tab({ name: 'home' });
  };

  const missing = d.rawText !== undefined || photo ? missingFields(d) : [];
  const source = d.source || 'GCash';

  async function tryAgain() {
    setRereading(true);
    const before = missingFields(d).length;
    const next = await rereadSamePicture(d, { fees, settings });
    setRereading(false);
    setD(next);
    if (missingFields(next).length < before) {
      setTries(0);
      toast(t('Read it! The missing fields are filled in.'));
    } else setTries((n) => n + 1);
  }
  function newPicture() {
    // Keep what is here, so going back from the camera does not lose it.
    replace({ name: 'review', draft: d });
    go({ name: 'scan', retake: d });
  }
  const what = (k: string) => (k === 'reference' ? t('Reference number') : k === 'amount' ? t('Amount') : t('Date and time'));

  return (
    <>
      <main className="page review">
        <TopBar title={t('Check and save')} onBack={requestLeave} />

        {showDup && dupNow && (
          <div className="dupbanner" role="alert">
            <b>{isPending(dupNow) ? t('Waiting for cash') : t('Already saved. This may be paid twice.')}</b>
            <span>
              {isPending(dupNow) ? t('Pending') : t('Paid')} · {peso2(dupNow.amount)} · {dupNow.by} · {dateTime(dupNow.savedAt)}
            </span>
          </div>
        )}

        <div className="amtcard">
          <div className="amtleft">
            <label htmlFor="amt">{t('Amount')}</label>
            <div className={`amtin${has('big') ? ' warn' : ''}`}>
              <span aria-hidden="true">₱</span>
              <input id="amt" inputMode="decimal" autoComplete="off" placeholder="0.00" value={d.amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            {has('big') && <div className="note">{t('Above your {limit} limit', { limit: peso(settings.bigLimit) })}</div>}
            <button className="tag wallet" aria-haspopup="dialog" aria-label={t('Where the money came from: {name}. Change', { name: source })} onClick={() => setSheet('wallet')}>
              <i className="dot" style={{ background: walletColor(source) }} />
              {source}
              <Icon name="down" size={14} />
            </button>
          </div>
          <button className="rthumb" aria-label={photo ? t('View photo') : t('No photo')} disabled={!photo} onClick={() => setViewing(true)}>
            {photo ? <img src={d.thumb ?? photo} alt="" /> : <span aria-hidden="true"><i /><i /><i /></span>}
          </button>
        </div>

        {missing.length > 0 && !showDup && (
          <div className="missingbox" role="status">
            <b>{t(tries ? 'Still could not read: {what}' : 'Could not read: {what}', { what: missing.map(what).join(', ') })}</b>
            {tries > 0 && <span>{t('Hold the camera close to it, or type it below.')}</span>}
            <div className="two">
              {tries > 0 ? (
                <button className="btn btn-primary" onClick={newPicture}>
                  {t('New picture')}
                </button>
              ) : (
                <button className="btn btn-primary" disabled={rereading} onClick={() => void tryAgain()}>
                  {rereading ? t('Reading again…') : t('Try again')}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="card fieldscard">
          <div className="field" style={{ marginTop: 0 }}>
            <label htmlFor="ref">{t('Reference number')}</label>
            <input
              id="ref"
              className={`box big ${refOk ? 'ok' : 'warn'}`}
              inputMode={/[A-Za-z]/.test(d.ref) ? 'text' : 'numeric'}
              autoComplete="off"
              placeholder={t('13 digits')}
              value={d.ref}
              onChange={(e) => setD({ ...d, ref: e.target.value })}
            />
            {!refOk && refDigits.length > 0 && <div className="note">{t('{n} digits. It should be 13.', { n: refDigits.length })}</div>}
          </div>

          <div className="two">
            <div className="field">
              <span className="lab">{t('Charge')}</span>
              <button className="box" aria-haspopup="dialog" aria-label={t('Charge {amount}. Change', { amount: peso2(feeNum) })} onClick={() => setSheet('fee')}>
                <span>{d.fee ? peso(feeNum) : '—'}</span>
                <Icon name="down" size={18} />
              </button>
            </div>
            <div className="field" style={{ flex: 1.7 }}>
              <label htmlFor="dt">{t('Date and time')}</label>
              <input id="dt" type="datetime-local" className={`box${has('old') || has('date') ? ' warn' : ''}`} value={toLocalInput(d.txAt)} onChange={(e) => setD({ ...d, txAt: fromLocalInput(e.target.value), dateGuess: false })} />
            </div>
          </div>
          {has('old') && <div className="note">{t('This receipt is not from today')}</div>}
          {d.dateGuess && <div className="note">{t('No date was found, so today was used. Change it if the receipt is older.')}</div>}

        <div className="field" style={{ marginTop: 14 }}>
          <span className="lab">{t('Customer')}</span>
          <button className="box" aria-haspopup="dialog" onClick={() => setSheet('customer')}>
            <span>{d.name || d.number ? `${d.name || t('No name')} · ${d.number || t('No number')}` : t('Add name and number')}</span>
            <Icon name="right" size={18} />
          </button>
          {d.autoName && d.name && <div className="note good">{t('Name filled in from an earlier record. Tap to change.')}</div>}
        </div>
        </div>
        {d.rawText !== undefined && (
          <button className="btn btn-text" style={{ height: 40, fontSize: 13 }} onClick={() => setSheet('read')}>
            {t('What the app read')}
          </button>
        )}
      </main>

      <div className="savebar">
        <div className="in">
          {warns.length > 0 && canSave && (
            <WarnBar>
              <b>{t('Please check.')}</b> {warns.map((w) => t(w.tpl, w.args)).join(' ')}
            </WarnBar>
          )}
          {showDup && dupNow ? (
            <>
              {isPending(dupNow) && (
                <button className="btn btn-primary" onClick={() => payNow(dupNow)}>
                  {t('Mark as paid')}
                </button>
              )}
              <button className={isPending(dupNow) ? 'btn btn-ghost' : 'btn btn-primary'} onClick={() => showSaved(dupNow)}>
                {t('Show saved record')}
              </button>
              <div className="sepgap" aria-hidden="true" />
              <button className="btn btn-danger" onClick={() => setDiffers(true)}>
                {t('This is different. Save anyway')}
              </button>
            </>
          ) : (
            <>
              {!canSave && (
                <div className="saveas need" role="status">
                  {t('Fill in the reference number and amount first.')}
                </div>
              )}
              <div className="savepair">
                <button className="btn btn-pending" disabled={!canSave} onClick={() => onSave('pending')}>
                  {t('Save · Pending')}
                </button>
                <button className="btn btn-primary" disabled={!canSave} onClick={() => onSave('paid')}>
                  {t('Save · Paid')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {leaving && (
        <Sheet title={t('Not saved yet')} onClose={() => setLeaving(false)}>
          <div className="muted" style={{ marginTop: -6, marginBottom: 14, fontSize: 16, lineHeight: 1.4 }}>
            {amount > 0 ? `${peso2(amount)} · ` : ''}
            {refDigits ? `${formatRef(refDigits)}. ` : ''}
            {t('If you leave, this cash-out is not recorded.')}
          </div>
          <div className="stack">
            <button className="btn btn-primary" onClick={() => setLeaving(false)}>
              {t('Go back and save')}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                keepDraft(d);
                tab({ name: 'home' });
              }}
            >
              {t('Keep it for later (draft)')}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                dropDraft();
                tab({ name: 'home' });
              }}
            >
              {t('Leave and discard')}
            </button>
          </div>
        </Sheet>
      )}

      {sheet === 'fee' && (
        <Sheet title={t('Charge')} onClose={() => setSheet(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              className={`opt${!d.feeTouched ? ' on' : ''}`}
              onClick={() => {
                setD({ ...d, feeTouched: false, fee: autoFee != null ? autoFee.toFixed(2) : '' });
                setSheet(null);
              }}
            >
              <span>
                {t('Automatic')} <small>· {autoFee != null ? t('{fee} for {amount}', { fee: peso(autoFee), amount: peso(amount) }) : t('type it below')}</small>
              </span>
              {!d.feeTouched && <Icon name="check" size={22} />}
            </button>
            {fees.map((tier, i) => (
              <button
                key={i}
                className={`opt${d.feeTouched && feeNum === tier.fee ? ' on' : ''}`}
                onClick={() => {
                  setD({ ...d, fee: tier.fee.toFixed(2), feeTouched: true });
                  setSheet(null);
                }}
              >
                <span>
                  {peso(tier.fee)} <small>· ₱{tierLabel(fees, i)}</small>
                </span>
                {d.feeTouched && feeNum === tier.fee && <Icon name="check" size={22} />}
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="cfee">{t('Other charge (₱)')}</label>
            <input
              id="cfee"
              className="box"
              inputMode="decimal"
              value={d.feeTouched ? d.fee : ''}
              placeholder={t('Type a charge')}
              onChange={(e) => setD({ ...d, fee: e.target.value, feeTouched: true })}
            />
          </div>
          <button className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => setSheet(null)}>
            {t('Done')}
          </button>
        </Sheet>
      )}

      {sheet === 'wallet' && (
        <Sheet title={t('Where did the money come from?')} onClose={() => setSheet(null)}>
          <div role="radiogroup" aria-label={t('Where did the money come from?')} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {walletChoices(source).map((n) => (
              <button
                key={n}
                role="radio"
                aria-checked={n === source}
                className={`opt${n === source ? ' on' : ''}`}
                onClick={() => {
                  setD({ ...d, source: n });
                  setSheet(null);
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <i className="dot" style={{ background: walletColor(n) }} />
                  {n}
                </span>
                {n === source && <Icon name="check" size={22} />}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'read' && (
        <Sheet title={t('What the app read')} onClose={() => setSheet(null)}>
          <p className="muted" style={{ fontSize: 15, marginTop: -4, marginBottom: 10 }}>
            {t('This is the text the app found in the photo. If a field is wrong, send a screenshot of this to the developer. Hide real numbers first.')}
          </p>
          <pre className="rawtext">{d.rawText ? d.rawText : t('(nothing was read)')}</pre>
          <button className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => setSheet(null)}>
            {t('Close')}
          </button>
        </Sheet>
      )}

      {sheet === 'customer' && (
        <Sheet title={t('Customer')} onClose={() => setSheet(null)}>
          <div className="field" style={{ marginTop: 0 }}>
            <label htmlFor="nm">{t('Name')}</label>
            <input
              id="nm"
              className="box"
              value={d.name}
              onChange={(e) => {
                nameTouched.current = true;
                setD({ ...d, name: e.target.value, autoName: false });
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="no">{t('Number')}</label>
            <input id="no" className="box" inputMode="tel" value={d.number} onChange={(e) => setD({ ...d, number: e.target.value })} />
          </div>
          <button className="btn btn-soft" style={{ marginTop: 16 }} onClick={() => setSheet(null)}>
            {t('Done')}
          </button>
        </Sheet>
      )}

      {dup && (
        <Sheet title={isPending(dup) ? t('Waiting for cash') : t('Already saved')} onClose={() => setDup(null)}>
          <div className="muted" style={{ marginTop: -6, marginBottom: 14, fontSize: 16 }}>
            {isPending(dup) ? t('This one was saved as pending. If the cash is given now, mark it as paid.') : t('This may be paid out twice.')}
          </div>
          <div className="card" style={{ boxShadow: 'none', background: 'var(--bg)' }}>
            <div className="muted small">{t('Reference number')}</div>
            <div className="bigref">{formatRef(dup.ref)}</div>
            <div className="kv">
              <span>{t('Saved by')}</span>
              <b>{dup.by}</b>
            </div>
            <div className="kv">
              <span>{t('When')}</span>
              <b>{dateTime(dup.savedAt)}</b>
            </div>
            <div className="kv">
              <span>{t('Amount')}</span>
              <b>{peso2(dup.amount)}</b>
            </div>
            <div className="kv">
              <span>{t('Status')}</span>
              <b style={isPending(dup) ? { color: 'var(--warn-text)' } : undefined}>{isPending(dup) ? t('Pending') : t('Paid')}</b>
            </div>
          </div>
          <div className="stack" style={{ marginTop: 16 }}>
            {isPending(dup) ? (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setDup(null);
                  payNow(dup);
                }}
              >
                {t('Mark as paid')}
              </button>
            ) : null}
            <button
              className={isPending(dup) ? 'btn btn-ghost' : 'btn btn-primary'}
              onClick={() => {
                setDup(null);
                showSaved(dup);
              }}
            >
              {t('Show saved record')}
            </button>
            <button className="btn btn-danger" onClick={() => saveDraft({ ...d, ref: refDigits }, true, saveAs)}>
              {t('This is different. Save anyway')}
            </button>
            <button className="btn btn-text" onClick={() => setDup(null)}>
              {t('Cancel')}
            </button>
          </div>
        </Sheet>
      )}

      {viewing && photo && <PhotoViewer src={photo} onClose={() => setViewing(false)} />}
    </>
  );
}
