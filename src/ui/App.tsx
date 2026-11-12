import { useEffect, useState } from 'react';
import { api } from '../data';
import type { AppUser, Settings } from '../lib/types';
import { loadSettings, saveSettings } from '../native/storage';
import { Icon } from './icons';
import { AppProvider, useApp } from './context';
import { Home } from './Home';
import { Detail, Records } from './Records';
import { Review } from './Review';
import { Scan } from './Scan';
import { FeeTable, SettingsScreen } from './Settings';

const SCALE = { normal: 0.9, large: 1, xl: 1.15 } as const;

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);

  useEffect(() => {
    void loadSettings().then(setSettings);
    return api.onAuth(setUser);
  }, []);

  useEffect(() => {
    if (!settings) return;
    document.documentElement.style.fontSize = `${16 * SCALE[settings.textSize]}px`;
    document.documentElement.dataset.theme = settings.theme;
  }, [settings?.textSize, settings?.theme]);

  const updateSettings = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s!, ...patch };
      void saveSettings(next);
      return next;
    });

  if (!settings || user === undefined) {
    return (
      <div className="app">
        <div className="page center">Loading…</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="app">
        <Login />
      </div>
    );
  }
  if (!settings.tourDone) {
    return (
      <div className="app">
        <Tour onDone={() => updateSettings({ tourDone: true })} />
      </div>
    );
  }

  return (
    <div className="app">
      <AppProvider user={user} settings={settings} updateSettings={updateSettings}>
        {({ route, toasts, denied }) => (
          <>
            {denied ? <Denied email={user.email} /> : <Screen route={route} />}
            <div className="toasts" aria-live="polite">
              {toasts.map((t) => (
                <div key={t.id} className={`toast${t.err ? ' err' : ''}`}>
                  {t.text}
                </div>
              ))}
            </div>
          </>
        )}
      </AppProvider>
    </div>
  );
}

function Screen({ route }: { route: ReturnType<typeof useApp>['route'] }) {
  switch (route.name) {
    case 'home': return <Home />;
    case 'scan': return <Scan />;
    case 'review': return <Review initial={route.draft} />;
    case 'records': return <Records key={route.status ?? 'all'} initialPeriod={route.period} initialStatus={route.status} />;
    case 'detail': return <Detail id={route.id} />;
    case 'settings': return <SettingsScreen />;
    case 'fees': return <FeeTable />;
  }
}

function Login() {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="center login">
      <div className="logo">
        <Icon name="camera" size={58} />
      </div>
      <h1>Kashawt</h1>
      <p>Record every GCash cash-out. Nothing paid twice.</p>
      <button
        className="btn gbtn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr('');
          try {
            await api.signIn();
          } catch (e) {
            const m = String((e as Error)?.message ?? e);
            if (!/cancel|closed|dismiss/i.test(m)) setErr('Sign-in did not work. Check your internet and try again.');
          }
          setBusy(false);
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
          <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.8 19.8 8.2 22 12 22z" />
          <path fill="#FBBC05" d="M6.4 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.5H3.1C2.4 8.9 2 10.4 2 12s.4 3.1 1.1 4.5l3.3-2.6z" />
          <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8.2 2 4.8 4.2 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" />
        </svg>
        Sign in with Google
      </button>
      <div className="muted small" style={{ marginTop: 14 }}>
        Only approved staff accounts can sign in.
      </div>
      {err && (
        <div className="err-text" role="alert">
          {err}
        </div>
      )}
      {api.mode === 'demo' && <div className="notice">Demo mode. This is sample data only. Nothing is saved or shared.</div>}
    </div>
  );
}

const CARDS = [
  { title: 'Take a photo of the receipt', body: 'Fit the whole receipt inside the frame. The app reads the details for you.', icon: 'camera' },
  { title: 'Check the details', body: 'Look at the reference number and amount. Tap any box to fix it. Yellow notes mean please check.', icon: 'search' },
  { title: 'Save, and undo if needed', body: 'Tap Save when the cash is given. You have 5 seconds to undo. Other staff see it right away.', icon: 'check' },
] as const;

function Tour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const c = CARDS[i];
  const last = i === CARDS.length - 1;
  return (
    <div className="tour">
      <div className="row-between">
        <span className="muted small">
          {i + 1} of {CARDS.length}
        </span>
        <button className="btn-text" style={{ height: 44, border: 0, background: 'none', fontSize: 16, fontWeight: 800, color: 'var(--green-text)', padding: '0 8px' }} onClick={onDone}>
          Skip
        </button>
      </div>
      <div className="art">
        <div className="phone" aria-hidden="true">
          <div className="blk">
            <Icon name={c.icon} size={46} />
          </div>
          <i />
          <i style={{ width: '70%' }} />
        </div>
      </div>
      <h2>{c.title}</h2>
      <p>{c.body}</p>
      <div className="dots" aria-hidden="true">
        {CARDS.map((_, n) => (
          <i key={n} className={n === i ? 'on' : ''} />
        ))}
      </div>
      <button className="btn btn-primary" onClick={() => (last ? onDone() : setI(i + 1))}>
        {last ? 'Get started' : 'Next'}
      </button>
    </div>
  );
}

function Denied({ email }: { email: string }) {
  const { signOut } = useApp();
  return (
    <main className="page center" style={{ gap: 12 }}>
      <h1 className="h1">This account is not allowed</h1>
      <p className="muted" style={{ maxWidth: 320, fontSize: 18 }}>
        {email} is not on the list. Ask the owner to add this email, then sign in again.
      </p>
      <button className="btn btn-ghost" style={{ maxWidth: 260 }} onClick={signOut}>
        Sign out
      </button>
    </main>
  );
}
