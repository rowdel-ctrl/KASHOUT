import { useState } from 'react';
import { api } from '../data';
import { DEFAULT_FEES, tierLabel } from '../lib/fees';
import { parseMoney, peso } from '../lib/format';
import type { FeeTier, Lang, TextSize } from '../lib/types';
import { openAlertsApp, sendNtfy } from '../native/alerts';
import { Icon } from './icons';
import { OptionSheet, Switch, TopBar } from './components';
import { useApp } from './context';

const SIZES: { value: TextSize; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'xl', label: 'Extra large' },
];
const LANGS: { value: Lang; label: string }[] = [
  { value: 'tl', label: 'Taglish' },
  { value: 'en', label: 'English' },
];
const LIMITS: { value: number; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 3000, label: '₱3,000' },
  { value: 5000, label: '₱5,000' },
  { value: 10000, label: '₱10,000' },
  { value: 20000, label: '₱20,000' },
  { value: 50000, label: '₱50,000' },
];

export function SettingsScreen() {
  const { settings, updateSettings, go, toast, user, signOut, alertTopic, t, appVersion, checkUpdate, update, downloadUpdate } = useApp();
  const [checking, setChecking] = useState(false);
  const [sheet, setSheet] = useState<'size' | 'limit' | 'lang' | null>(null);

  const sizeLabel = t(SIZES.find((x) => x.value === settings.textSize)!.label);
  const limitLabel = t(LIMITS.find((l) => l.value === settings.bigLimit)?.label ?? peso(settings.bigLimit));
  const langLabel = LANGS.find((l) => l.value === settings.lang)!.label;

  return (
    <>
      <main className="page">
        <TopBar title={t('Settings')} />

        <div className="sec">{t('Language and display')}</div>
        <div className="card flush">
          <button className="item" aria-haspopup="dialog" onClick={() => setSheet('lang')}>
            <span className="grow">
              {t('Language')}
            </span>
            <span className="val">
              {langLabel} <Icon name="down" size={16} color="var(--muted)" />
            </span>
          </button>
          <button className="item" aria-haspopup="dialog" onClick={() => setSheet('size')}>
            <span className="grow">{t('Text size')}</span>
            <span className="val">
              {sizeLabel} <Icon name="down" size={16} color="var(--muted)" />
            </span>
          </button>
        </div>

        <div className="sec">{t('Scanning')}</div>
        <div className="card flush">
          <div className="item">
            <span className="grow">
              {t('Take photo automatically')}
            </span>
            <Switch on={settings.autoCapture} label={t('Take photo automatically')} onChange={(v) => updateSettings({ autoCapture: v })} />
          </div>
          <div className="item">
            <span className="grow">
              {t('Save receipt photo')}
            </span>
            <Switch on={settings.savePhoto} label={t('Save receipt photo')} onChange={(v) => updateSettings({ savePhoto: v })} />
          </div>
        </div>

        <div className="sec">{t('Cash-out rules')}</div>
        <div className="card flush">
          <button className="item" aria-haspopup="dialog" onClick={() => setSheet('limit')}>
            <span className="grow">
              {t('Big amount limit')}
            </span>
            <span className="val">
              {limitLabel} <Icon name="down" size={16} color="var(--muted)" />
            </span>
          </button>
          <div className="item">
            <span className="grow">
              {t('Warn on old receipts')}
            </span>
            <Switch on={settings.warnOld} label={t('Warn on old receipts')} onChange={(v) => updateSettings({ warnOld: v })} />
          </div>
          <button className="item" onClick={() => go({ name: 'fees' })}>
            <span className="grow">
              {t('Charge table')}
            </span>
            <span className="val">
              {t('View')} <Icon name="right" size={16} color="var(--muted)" />
            </span>
          </button>
        </div>

        <div className="sec">{t('Alerts')}</div>
        <div className="card flush">
          <div className="item">
            <span className="grow">
              {t('Phone alerts')}
            </span>
            <button className="chipbtn" onClick={() => alertTopic ? void openAlertsApp(alertTopic) : toast(t('Alerts are not ready yet. Check your internet.'), true)}>
              {t('Turn on')}
            </button>
          </div>
          <div className="item">
            <span className="grow">
              {t('Send a test alert')}
            </span>
            <button
              className="chipbtn"
              onClick={async () => {
                if (!alertTopic) return toast(t('Alerts are not ready yet. Check your internet.'), true);
                const ok = await sendNtfy(alertTopic, `Test alert from ${user.name}`);
                toast(ok ? t('Test alert sent') : t('Could not send. Check your internet.'), !ok);
              }}
            >
              {t('Send')}
            </button>
          </div>
        </div>

        <div className="sec">{t('About')}</div>
        <div className="card flush">
          <div className="item">
            <span className="grow">
              {t('Version')}
              <small>{appVersion ? appVersion : t('Demo')}</small>
            </span>
            {update ? (
              <button className="chipbtn" onClick={downloadUpdate}>
                {t('Download {version}', { version: update.version })}
              </button>
            ) : (
              <button
                className="chipbtn"
                disabled={checking}
                onClick={async () => {
                  setChecking(true);
                  const r = await checkUpdate(true);
                  setChecking(false);
                  toast(r === 'latest' ? t('You have the newest version') : r === 'new' ? t('A new version was found. See the green card on Home.') : t('Could not check for updates. Check your internet.'), r === 'error');
                }}
              >
                {t('Check for updates')}
              </button>
            )}
          </div>
        </div>

        <div className="card signed">
          <div>
            <small>{t('Signed in as')}</small>
            <b>{user.name}</b>
          </div>
          <button className="btn btn-ghost" onClick={signOut}>
            {t('Sign out')}
          </button>
        </div>
      </main>

      {sheet === 'size' && (
        <OptionSheet
          title={t('Text size')}
          options={SIZES.map((o) => ({ ...o, label: t(o.label) }))}
          value={settings.textSize}
          onPick={(v) => updateSettings({ textSize: v })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'lang' && <OptionSheet title={t('Language')} options={LANGS} value={settings.lang} onPick={(v) => updateSettings({ lang: v })} onClose={() => setSheet(null)} />}
      {sheet === 'limit' && (
        <OptionSheet
          title={t('Big amount limit')}
          options={(LIMITS.some((l) => l.value === settings.bigLimit) ? LIMITS : [...LIMITS, { value: settings.bigLimit, label: peso(settings.bigLimit) }]).map((o) => ({ ...o, label: t(o.label) }))}
          value={settings.bigLimit}
          onPick={(v) => updateSettings({ bigLimit: parseMoney(String(v)) })}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

export function FeeTable() {
  const { fees, toast, t } = useApp();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<FeeTier[]>(fees);
  const table = edit ? draft : fees;
  const half = Math.ceil(table.length / 2);
  const cols = [table.slice(0, half).map((tier, i) => ({ tier, i })), table.slice(half).map((tier, i) => ({ tier, i: i + half }))];

  async function save() {
    try {
      await api.saveFees(draft);
      toast(t('Charge table saved'));
      setEdit(false);
    } catch {
      toast(t('Could not save the table. Check your internet.'), true);
    }
  }

  return (
    <main className="page">
      <TopBar title={t('Charge table')} />
      <div className="example">{t('Example: ₱3,500 cash-out = ₱40 charge')}</div>
      <div className="card" style={{ marginTop: 12, padding: '6px 16px' }}>
        <div className="tiers">
          {cols.map((col, ci) => (
            <div key={ci}>
              {col.map(({ tier, i }) => (
                <div className="tier" key={i}>
                  <span>{tierLabel(table, i)}</span>
                  {edit ? (
                    <input aria-label={t('Charge for {range}', { range: tierLabel(table, i) })} inputMode="numeric" value={tier.fee} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, fee: parseMoney(e.target.value) } : x)))} />
                  ) : (
                    <b>₱{tier.fee}</b>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: 15, margin: '14px 0' }}>
        {t('Above ₱{amount}, type the charge by hand.', { amount: table[table.length - 1].upTo.toLocaleString('en-US') })}
      </p>
      {edit ? (
        <div className="stack">
          <button className="btn btn-primary" onClick={save}>
            {t('Save table')}
          </button>
          <button className="btn btn-ghost" onClick={() => setDraft(DEFAULT_FEES.map((t) => ({ ...t })))}>
            {t('Reset to the sheet')}
          </button>
          <button className="btn btn-text" onClick={() => setEdit(false)}>
            {t('Cancel')}
          </button>
        </div>
      ) : (
        <button
          className="btn btn-ghost"
          onClick={() => {
            setDraft(fees.map((t) => ({ ...t })));
            setEdit(true);
          }}
        >
          {t('Edit table')}
        </button>
      )}
    </main>
  );
}
