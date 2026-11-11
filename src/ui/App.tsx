import { useEffect, useState } from 'react';
import { api } from '../data';
import type { AppUser, Settings } from '../lib/types';
import { loadSettings, saveSettings } from '../native/storage';
import { Icon } from './icons';
import { AppProvider, useApp } from './context';
import { Home } from './Home';
import { Closing, FeeTable, More, SettingsScreen } from './More';
import { Detail, Records } from './Records';
import { Review } from './Review';
import { Scan } from './Scan';

const SCALE = { normal: 0.9, large: 1, xl: 1.15 } as const;

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);

  useEffect(() => {
    void loadSettings().then(setSettings);
    return api.onAuth(setUser);
  }, []);

  useEffect(() => {
    if (settings) document.documentElement.style.fontSize = `${16 * SCALE[settings.textSize]}px`;
  }, [settings?.textSize]);

  const updateSettings = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s!, ...patch };
      void saveSettings(next);
      return next;
    });

  if (!settings || user === undefined) return <div className="app"><div className="screen center">Loading…</div></div>;
  if (!user) return <div className="app"><Login /></div>;

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
    case 'records': return <Records initial={route.filter} />;
    case 'detail': return <Detail id={route.id} />;
    case 'more': return <More />;
    case 'closing': return <Closing />;
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
        <Icon name="camera" size={56} color="#fff" stroke={1.8} />
      </div>
      <h1>Cash-out Log</h1>
      <p>Record every GCash cash-out, so nothing is paid twice or lost.</p>
      <button
        className="btn btn-primary"
        style={{ maxWidth: 320 }}
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
        Sign in with Google
      </button>
      {err && <div className="err-text" role="alert">{err}</div>}
      {api.mode === 'demo' && (
        <div className="notice">Demo mode. This is sample data only. Nothing is saved or shared.</div>
      )}
    </div>
  );
}

function Denied({ email }: { email: string }) {
  const { signOut } = useApp();
  return (
    <main className="screen center" style={{ gap: 12 }}>
      <h1 className="h1">This account is not allowed</h1>
      <p className="muted" style={{ maxWidth: 320, fontSize: 18 }}>
        {email} is not on the list. Ask the owner to add this email, then sign in again.
      </p>
      <button className="btn btn-outline" style={{ maxWidth: 260 }} onClick={signOut}>
        Sign out
      </button>
    </main>
  );
}
