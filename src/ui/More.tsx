import { useMemo, useState } from 'react';
import { DEFAULT_FEES, tierLabel } from '../lib/fees';
import { api } from '../data';
import { shareCsv, sharePdf } from '../lib/export';
import { isToday, isYesterday, parseMoney, peso, peso2, shortDate } from '../lib/format';
import type { FeeTier, TextSize } from '../lib/types';
import { sendNtfy, setClosingReminder } from '../native/alerts';
import { Icon } from './icons';
import { NavBar, Switch, TopBar } from './components';
import { useApp } from './context';

export function More() {
  const { user, go, signOut } = useApp();
  return (
    <>
      <main className="screen has-nav">
        <h1 className="h1">More</h1>
        <div className="list" style={{ marginTop: 16, gap: 12 }}>
          <button className="menu" onClick={() => go({ name: 'closing' })}>
            <span className="ico">
              <Icon name="closing" size={28} color="#0A7A4A" />
            </span>
            <span className="txt">
              <b>Closing</b>
              <span>Totals, who saved what, export</span>
            </span>
            <Icon name="right" size={22} color="#4A5D52" stroke={2.4} />
          </button>
          <button className="menu" onClick={() => go({ name: 'settings' })}>
            <span className="ico">
              <Icon name="sliders" size={28} color="#0A7A4A" />
            </span>
            <span className="txt">
              <b>Settings</b>
              <span>Text size, warnings, alerts</span>
            </span>
            <Icon name="right" size={22} color="#4A5D52" stroke={2.4} />
          </button>
        </div>
        <div className="card signed">
          <div>
            <small>Signed in as</small>
            <b>{user.name}</b>
          </div>
          <button className="btn btn-outline" onClick={signOut}>
            Sign out
          </button>
        </div>
      </main>
      <NavBar active="more" />
    </>
  );
}

type Day = 'today' | 'yesterday' | 'all';

export function Closing() {
  const { records, user, settings, tab, toast } = useApp();
  const [day, setDay] = useState<Day>('today');
  const [who, setWho] = useState<'all' | 'me'>('all');

  const list = useMemo(
    () =>
      records.filter((r) => {
        if (day === 'today' && !isToday(r.savedAt)) return false;
        if (day === 'yesterday' && !isYesterday(r.savedAt)) return false;
        return who === 'all' || r.byUid === user.uid;
      }),
    [records, day, who, user.uid],
  );
  const total = list.reduce((s, r) => s + r.amount, 0);
  const fees = list.reduce((s, r) => s + r.fee, 0);
  const people = useMemo(() => {
    const m = new Map<string, { n: number; sum: number }>();
    for (const r of list) {
      const p = m.get(r.by) ?? { n: 0, sum: 0 };
      p.n += 1;
      p.sum += r.amount;
      m.set(r.by, p);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [list]);
  const maxN = Math.max(1, ...people.map(([, p]) => p.n));
  const label = day === 'today' ? shortDate(Date.now()) : day === 'yesterday' ? shortDate(Date.now() - 86_400_000) : 'All records';

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).toLowerCase();
      if (!msg.includes('cancel') && !msg.includes('abort')) toast('Could not export. Please try again.', true);
    }
  }

  async function sendSummary() {
    if (!settings.ntfyTopic.trim()) return toast('Add your alert code in Settings first.', true);
    const ok = await sendNtfy(settings.ntfyTopic, `Closing ${label}: ${list.length} cash-outs, ${peso(total)}`);
    toast(ok ? 'Summary sent' : 'Could not send. Check your internet.', !ok);
  }

  const days: [Day, string][] = [['today', 'Today'], ['yesterday', 'Yesterday'], ['all', 'All']];

  return (
    <main className="screen">
      <TopBar title={`Closing · ${label}`} />
      <div className="chips" style={{ marginTop: 0 }}>
        {days.map(([k, l]) => (
          <button key={k} className={`chip${day === k ? ' on' : ''}`} aria-pressed={day === k} onClick={() => setDay(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="chips">
        <button className={`chip${who === 'all' ? ' on' : ''}`} aria-pressed={who === 'all'} onClick={() => setWho('all')}>
          Everyone
        </button>
        <button className={`chip${who === 'me' ? ' on' : ''}`} aria-pressed={who === 'me'} onClick={() => setWho('me')}>
          Just me
        </button>
      </div>

      <div className="summary">
        <div className="big">
          <div>
            <b>{list.length}</b>
            <small>cash-outs</small>
          </div>
          <div>
            <b>{peso(total)}</b>
            <small>given out</small>
          </div>
        </div>
        <hr />
        <div className="fees">
          <span style={{ color: '#E6F7ED' }}>Fees earned</span>
          <span>{peso2(fees)}</span>
        </div>
      </div>

      <h2 className="sec-head" style={{ marginBottom: 8 }}>
        Who saved
      </h2>
      <div className="card tight">
        {people.map(([name, p]) => (
          <div className="who" key={name}>
            <div>
              <b>{name}</b>
              <span>
                {p.n} · {peso(p.sum)}
              </span>
            </div>
            <span className="track">
              <i style={{ width: `${(p.n / maxN) * 100}%` }} />
            </span>
          </div>
        ))}
        {people.length === 0 && <div className="empty">No records for this choice.</div>}
      </div>

      <div className="stack" style={{ marginTop: 18 }}>
        <button className="btn btn-primary" onClick={sendSummary}>
          Send summary
        </button>
        <div className="two">
          <button className="btn btn-outline" disabled={!list.length} onClick={() => run(() => shareCsv(list, day))}>
            Excel
          </button>
          <button className="btn btn-outline" disabled={!list.length} onClick={() => run(() => sharePdf(list, day, `Cash-outs · ${label}`))}>
            PDF
          </button>
        </div>
        <button className="link" style={{ textAlign: 'center' }} onClick={() => tab({ name: 'records', filter: 'today' })}>
          Check refs before clearing GCash inbox
        </button>
      </div>
    </main>
  );
}

export function SettingsScreen() {
  const { settings, updateSettings, go, toast } = useApp();
  const sizes: [TextSize, string][] = [['normal', 'Normal'], ['large', 'Large'], ['xl', 'Extra large']];

  async function toggleReminder(on: boolean) {
    const ok = await setClosingReminder(on);
    if (!ok && on) return toast('Could not turn on the reminder. Allow notifications first.', true);
    updateSettings({ closingReminder: on });
  }

  return (
    <main className="screen">
      <TopBar title="Settings" />

      <div className="sec-title">Text size</div>
      <div className="card" style={{ padding: 12 }}>
        <div className="seg" role="group" aria-label="Text size">
          {sizes.map(([k, l]) => (
            <button key={k} className={settings.textSize === k ? 'on' : ''} aria-pressed={settings.textSize === k} onClick={() => updateSettings({ textSize: k })}>
              {l}
            </button>
          ))}
        </div>
        <div className="preview">This is how text looks in the app.</div>
      </div>

      <div className="sec-title">Warnings</div>
      <div className="card tight">
        <div className="srow">
          <div>
            <b>Old receipt</b>
            <small>Date is not today</small>
          </div>
          <Switch on={settings.warnOld} label="Old receipt warning" onChange={(v) => updateSettings({ warnOld: v })} />
        </div>
        <div className="srow">
          <div>
            <b>Big amount</b>
            <small>Above this amount</small>
          </div>
          <Switch on={settings.warnBig} label="Big amount warning" onChange={(v) => updateSettings({ warnBig: v })} />
        </div>
        <div className="srow">
          <label htmlFor="limit">
            <b>Big amount limit (₱)</b>
          </label>
          <input id="limit" inputMode="numeric" value={settings.bigLimit} onChange={(e) => updateSettings({ bigLimit: parseMoney(e.target.value) })} />
        </div>
      </div>

      <div className="sec-title">Records</div>
      <div className="card tight">
        <div className="srow">
          <div>
            <b>Fee table</b>
            <small>Set by amount. Edit on each record.</small>
          </div>
          <button className="go" onClick={() => go({ name: 'fees' })}>
            ₱5–₱110 <Icon name="right" size={18} stroke={2.6} />
          </button>
        </div>
        <div className="srow">
          <div>
            <b>Save receipt photo</b>
            <small>A small copy, for checking later</small>
          </div>
          <Switch on={settings.savePhoto} label="Save receipt photo" onChange={(v) => updateSettings({ savePhoto: v })} />
        </div>
      </div>

      <div className="sec-title">Alerts</div>
      <div className="card tight">
        <div className="srow">
          <div>
            <b>Closing reminder</b>
            <small>Every day at 8:00 PM</small>
          </div>
          <Switch on={settings.closingReminder} label="Closing reminder" onChange={toggleReminder} />
        </div>
        <div className="srow">
          <div>
            <label htmlFor="topic">
              <b>Alert code</b>
            </label>
            <small>Secret. Stays on this phone.</small>
          </div>
          <input id="topic" className="wide" type="password" autoComplete="off" value={settings.ntfyTopic} onChange={(e) => updateSettings({ ntfyTopic: e.target.value })} />
        </div>
      </div>
    </main>
  );
}

export function FeeTable() {
  const { fees, toast } = useApp();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<FeeTier[]>(fees);
  const table = edit ? draft : fees;
  const half = Math.ceil(table.length / 2);
  const cols = [table.slice(0, half).map((t, i) => ({ t, i })), table.slice(half).map((t, i) => ({ t, i: i + half }))];

  function startEdit() {
    setDraft(fees.map((t) => ({ ...t })));
    setEdit(true);
  }
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
    <main className="screen">
      <TopBar title="Fee table" />
      <div className="example">Example: ₱3,500 cash-out = ₱40 fee</div>
      <div className="card" style={{ marginTop: 12, padding: '6px 14px' }}>
        <div className="tiers">
          {cols.map((col, ci) => (
            <div key={ci}>
              {col.map(({ t, i }) => (
                <div className="tier" key={i}>
                  <span>{tierLabel(table, i)}</span>
                  {edit ? (
                    <input
                      aria-label={`Fee for ${tierLabel(table, i)}`}
                      inputMode="numeric"
                      value={t.fee}
                      onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, fee: parseMoney(e.target.value) } : x)))}
                    />
                  ) : (
                    <b>₱{t.fee}</b>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: 15 }}>
        Above ₱{table[table.length - 1].upTo.toLocaleString('en-US')}, type the fee by hand.
      </p>
      {edit ? (
        <div className="stack">
          <button className="btn btn-primary" onClick={save}>
            Save table
          </button>
          <button className="btn btn-outline" onClick={() => setDraft(DEFAULT_FEES.map((t) => ({ ...t })))}>
            Reset to the sheet
          </button>
          <button className="btn btn-text" onClick={() => setEdit(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-outline" onClick={startEdit}>
          Edit table
        </button>
      )}
    </main>
  );
}
