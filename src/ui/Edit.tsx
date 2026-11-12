import { useState } from 'react';
import { fieldLabel, showValue } from '../lib/edit';
import { feeFor } from '../lib/fees';
import { dateTime, formatRef, fromLocalInput, parseMoney, peso, peso2, toLocalInput } from '../lib/format';
import { isPending } from '../lib/records';
import { TopBar } from './components';
import { useApp } from './context';

/** Change a saved record. Only the person who saved it. Every change goes into History. */
export function Edit({ id }: { id: string }) {
  const { records, user, fees, editRecord, back, t, settings } = useApp();
  const tl = settings.lang === 'tl';
  const r = records.find((x) => x.id === id);
  const [ref, setRef] = useState(r?.ref ?? '');
  const [amount, setAmount] = useState(r ? String(r.amount) : '');
  const [fee, setFee] = useState(r ? String(r.fee) : '');
  const [txAt, setTxAt] = useState<number | null>(r?.txAt ?? null);
  const [name, setName] = useState(r?.name ?? '');
  const [number, setNumber] = useState(r?.number ?? '');

  if (!r) {
    return (
      <main className="page">
        <TopBar title={t('Edit record')} />
        <div className="empty">{t('This record is not here anymore.')}</div>
      </main>
    );
  }
  if (r.byUid !== user.uid) {
    return (
      <main className="page">
        <TopBar title={t('Edit record')} />
        <div className="empty">{t('Only {name} can edit this record.', { name: r.by })}</div>
      </main>
    );
  }

  const refDigits = ref.replace(/\s+/g, '');
  const amountNum = parseMoney(amount);
  const feeNum = parseMoney(fee);
  const clash = refDigits !== r.ref && records.some((x) => x.id !== r.id && x.ref === refDigits);
  const refOk = /^\d{13}$/.test(refDigits);
  const canSave = refDigits.length > 0 && amountNum > 0 && !clash;
  const auto = feeFor(amountNum, fees);

  return (
    <>
      <main className="page review">
        <TopBar title={t('Edit record')} />
        <div className="muted" style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
          {t('Change what is wrong. The old values are kept in History.')}
        </div>

        <div className="field">
          <label htmlFor="eref">{t('Reference number')}</label>
          <input id="eref" className={`box big ${refOk ? 'ok' : 'warn'}`} inputMode="numeric" autoComplete="off" value={ref} onChange={(e) => setRef(e.target.value)} />
          {clash ? <div className="note">{t('Another record already has this reference number.')}</div> : <div className={`note${refOk ? ' good' : ''}`}>{refOk ? t('13 digits ✓') : t('{n} digits. It should be 13.', { n: refDigits.length })}</div>}
        </div>

        <div className="two">
          <div className="field">
            <label htmlFor="eamt">{t('Amount')}</label>
            <input id="eamt" className="box big" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="efee">{t('Fee')}</label>
            <input id="efee" className="box big" inputMode="decimal" autoComplete="off" value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
        </div>
        {auto != null && auto !== feeNum && (
          <button className="link" style={{ marginTop: 6 }} onClick={() => setFee(auto.toFixed(2))}>
            {t('Use the table fee: {fee}', { fee: peso(auto) })}
          </button>
        )}

        <div className="field">
          <label htmlFor="edt">{t('Date and time')}</label>
          <input id="edt" type="datetime-local" className="box" value={toLocalInput(txAt)} onChange={(e) => setTxAt(fromLocalInput(e.target.value))} />
        </div>

        <div className="field">
          <label htmlFor="enm">{t('Customer name')}</label>
          <input id="enm" className="box" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="eno">{t('Customer number')}</label>
          <input id="eno" className="box" inputMode="tel" value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
      </main>

      <div className="savebar">
        <div className="in">
          <button
            className="btn btn-primary"
            disabled={!canSave}
            onClick={() => {
              if (editRecord(r, { ref: refDigits, amount: amountNum, fee: feeNum, txAt, name: name.trim(), number: number.trim() })) back();
            }}
          >
            {t('Save changes')}
          </button>
          <button className="btn btn-text" onClick={back}>
            {t('Cancel')}
          </button>
        </div>
      </div>
    </>
  );
}

/** Who changed what, and when. Newest first. */
export function History({ id }: { id: string }) {
  const { records, t } = useApp();
  const r = records.find((x) => x.id === id);
  if (!r) {
    return (
      <main className="page">
        <TopBar title={t('History')} />
        <div className="empty">{t('This record is not here anymore.')}</div>
      </main>
    );
  }
  const entries = [...(r.history ?? [])].reverse();
  const tv = (f: string, v: string | number | null) => { const x = showValue(f, v); return x === 'empty' ? t('empty') : x; };
  return (
    <main className="page">
      <TopBar title={t('History')} />
      <div className="muted" style={{ fontSize: 16, fontWeight: 700, margin: '4px 0 12px' }}>
        {formatRef(r.ref)} · {t('every change is kept')}
      </div>
      <div className="stack">
        {entries.map((e, i) => (
          <div className="card histcard" key={i}>
            <div className="row-between">
              <b>{t('{name} edited', { name: e.by })}</b>
              <span className="muted small">{dateTime(e.at)}</span>
            </div>
            {e.changes.map((c, j) => (
              <div className="chg" key={j}>
                <b>{t(fieldLabel(c.f))}</b>
                <div>
                  <s>{tv(c.f, c.from)}</s> → <strong>{tv(c.f, c.to)}</strong>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div className="card histcard">
          <div className="row-between">
            <b>{t('{name} saved', { name: r.by })}</b>
            <span className="muted small">{dateTime(r.savedAt)}</span>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {isPending(r) ? t('Pending') : t('Paid')} · {t('{amount} now', { amount: peso2(r.amount) })}
          </div>
        </div>
      </div>
      <div className="muted small" style={{ textAlign: 'center', marginTop: 14 }}>
        {t('Everyone on the list can see this history.')}
      </div>
    </main>
  );
}
