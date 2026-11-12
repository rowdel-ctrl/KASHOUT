import { useState } from 'react';
import { api } from '../data';
import { DEFAULT_FEES, tierLabel } from '../lib/fees';
import { parseMoney, peso } from '../lib/format';
import type { FeeTier, TextSize, Theme } from '../lib/types';
import { openAlertsApp, sendNtfy, setClosingReminder } from '../native/alerts';
import { Icon } from './icons';
import { NavBar, OptionSheet, Switch, TopBar } from './components';
import { useApp } from './context';

const SIZES: { value: TextSize; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'xl', label: 'Extra large' },
];
const THEMES: { value: Theme; label: string; hint?: string }[] = [
  { value: 'system', label: 'System', hint: 'follows your phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
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
  const { settings, updateSettings, go, toast, user, signOut, alertTopic } = useApp();
  const [sheet, setSheet] = useState<'size' | 'theme' | 'limit' | null>(null);

  async function toggleReminder(on: boolean) {
    const ok = await setClosingReminder(on);
    if (!ok && on) return toast('Could not turn on the reminder. Allow notifications first.', true);
    updateSettings({ closingReminder: on });
  }

  const sizeLabel = SIZES.find((s) => s.value === settings.textSize)!.label;
  const themeLabel = THEMES.find((t) => t.value === settings.theme)!.label;
  const limitLabel = LIMITS.find((l) => l.value === settings.bigLimit)?.label ?? peso(settings.bigLimit);

  return (
    <>
      <main className="page has-nav">
        <h1 className="h1">Settings</h1>

        <div className="sec">Display</div>
        <div className="card flush">
          <button className="item" aria-haspopup="dialog" onClick={() => setSheet('size')}>
            <span className="grow">Text size</span>
            <span className="val">
              {sizeLabel} <Icon name="down" size={16} color="var(--muted)" />
            </span>
          </button>
          <button className="item" aria-haspopup="dialog" onClick={() => setSheet('theme')}>
            <span className="grow">Theme</span>
            <span className="val">
              {themeLabel} <Icon name="down" size={16} color="var(--muted)" />
            </span>
          </button>
        </div>

        <div className="sec">Scanning</div>
        <div className="card flush">
          <div className="item">
            <span className="grow">
              Take photo automatically
              <small>The camera takes the photo when the receipt is steady. You still tap Save.</small>
            </span>
            <Switch on={settings.autoCapture} label="Take photo automatically" onChange={(v) => updateSettings({ autoCapture: v })} />
          </div>
          <div className="item">
            <span className="grow">
              Save receipt photo
              <small>A small copy, for checking later</small>
            </span>
            <Switch on={settings.savePhoto} label="Save receipt photo" onChange={(v) => updateSettings({ savePhoto: v })} />
          </div>
        </div>

        <div className="sec">Cash-out rules</div>
        <div className="card flush">
          <button className="item" aria-haspopup="dialog" onClick={() => setSheet('limit')}>
            <span className="grow">
              Big amount limit
              <small>Warns above this amount</small>
            </span>
            <span className="val">
              {limitLabel} <Icon name="down" size={16} color="var(--muted)" />
            </span>
          </button>
          <div className="item">
            <span className="grow">
              Warn on old receipts
              <small>Date is not today</small>
            </span>
            <Switch on={settings.warnOld} label="Warn on old receipts" onChange={(v) => updateSettings({ warnOld: v })} />
          </div>
          <button className="item" onClick={() => go({ name: 'fees' })}>
            <span className="grow">
              Fee table
              <small>Set by amount</small>
            </span>
            <span className="val">
              View <Icon name="right" size={16} color="var(--muted)" />
            </span>
          </button>
        </div>

        <div className="sec">Alerts</div>
        <div className="card flush">
          <div className="item">
            <span className="grow">
              Closing reminder
              <small>Every day at 8:00 PM</small>
            </span>
            <Switch on={settings.closingReminder} label="Closing reminder" onChange={toggleReminder} />
          </div>
          <div className="item">
            <span className="grow">
              Phone alerts
              <small>Get an alert when someone saves. Needs the free ntfy app.</small>
            </span>
            <button className="chipbtn" onClick={() => alertTopic ? void openAlertsApp(alertTopic) : toast('Alerts are not ready yet. Check your internet.', true)}>
              Turn on
            </button>
          </div>
          <div className="item">
            <span className="grow">
              Send a test alert
              <small>Everyone with alerts on gets it</small>
            </span>
            <button
              className="chipbtn"
              onClick={async () => {
                if (!alertTopic) return toast('Alerts are not ready yet. Check your internet.', true);
                const ok = await sendNtfy(alertTopic, `Test alert from ${user.name}`);
                toast(ok ? 'Test alert sent' : 'Could not send. Check your internet.', !ok);
              }}
            >
              Send
            </button>
          </div>
        </div>

        <div className="card signed">
          <div>
            <small>Signed in as</small>
            <b>{user.name}</b>
          </div>
          <button className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </main>
      <NavBar active="settings" />

      {sheet === 'size' && (
        <OptionSheet
          title="Text size"
          options={SIZES}
          value={settings.textSize}
          onPick={(v) => updateSettings({ textSize: v })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'theme' && <OptionSheet title="Theme" options={THEMES} value={settings.theme} onPick={(v) => updateSettings({ theme: v })} onClose={() => setSheet(null)} />}
      {sheet === 'limit' && (
        <OptionSheet
          title="Big amount limit"
          options={LIMITS.some((l) => l.value === settings.bigLimit) ? LIMITS : [...LIMITS, { value: settings.bigLimit, label: peso(settings.bigLimit) }]}
          value={settings.bigLimit}
          onPick={(v) => updateSettings({ bigLimit: parseMoney(String(v)) })}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  );
}

export function FeeTable() {
  const { fees, toast } = useApp();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<FeeTier[]>(fees);
  const table = edit ? draft : fees;
  const half = Math.ceil(table.length / 2);
  const cols = [table.slice(0, half).map((t, i) => ({ t, i })), table.slice(half).map((t, i) => ({ t, i: i + half }))];

  async function save() {
    try {
      await api.saveFees(draft);
      toast('Fee table saved');
      setEdit(false);
    } catch {
      toast('Could not save the table. Check your internet.', true);
    }
  }

  return (
    <main className="page">
      <TopBar title="Fee table" />
      <div className="example">Example: ₱3,500 cash-out = ₱40 fee</div>
      <div className="card" style={{ marginTop: 12, padding: '6px 16px' }}>
        <div className="tiers">
          {cols.map((col, ci) => (
            <div key={ci}>
              {col.map(({ t, i }) => (
                <div className="tier" key={i}>
                  <span>{tierLabel(table, i)}</span>
                  {edit ? (
                    <input aria-label={`Fee for ${tierLabel(table, i)}`} inputMode="numeric" value={t.fee} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, fee: parseMoney(e.target.value) } : x)))} />
                  ) : (
                    <b>₱{t.fee}</b>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: 15, margin: '14px 0' }}>
        Above ₱{table[table.length - 1].upTo.toLocaleString('en-US')}, type the fee by hand.
      </p>
      {edit ? (
        <div className="stack">
          <button className="btn btn-primary" onClick={save}>
            Save table
          </button>
          <button className="btn btn-ghost" onClick={() => setDraft(DEFAULT_FEES.map((t) => ({ ...t })))}>
            Reset to the sheet
          </button>
          <button className="btn btn-text" onClick={() => setEdit(false)}>
            Cancel
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
          Edit table
        </button>
      )}
    </main>
  );
}
