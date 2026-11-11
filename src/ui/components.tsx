import type { ReactNode } from 'react';
import { dateTime, peso2, timeOf } from '../lib/format';
import type { CashRecord, Route } from '../lib/types';
import { Icon } from './icons';
import { useApp } from './context';

export function TopBar({ title, onBack }: { title: string; onBack?: () => void }) {
  const { back } = useApp();
  return (
    <div className="topbar">
      <button className="back" aria-label="Back" onClick={onBack ?? back}>
        <Icon name="back" size={28} />
      </button>
      <h1>{title}</h1>
    </div>
  );
}

export function NavBar({ active }: { active: 'home' | 'records' | 'more' }) {
  const { tab } = useApp();
  const items: { key: 'home' | 'records' | 'more'; label: string; icon: string; route: Route }[] = [
    { key: 'home', label: 'Home', icon: 'home', route: { name: 'home' } },
    { key: 'records', label: 'Records', icon: 'list', route: { name: 'records' } },
    { key: 'more', label: 'More', icon: 'more', route: { name: 'more' } },
  ];
  return (
    <nav className="nav" aria-label="Main">
      {items.map((i) => (
        <button key={i.key} className={active === i.key ? 'on' : ''} aria-current={active === i.key ? 'page' : undefined} onClick={() => tab(i.route)}>
          <Icon name={i.icon} />
          {i.label}
        </button>
      ))}
    </nav>
  );
}

export function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={`switch${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}

export function RecRow({ r, onClick, fresh }: { r: CashRecord; onClick?: () => void; fresh?: boolean }) {
  const inner = (
    <>
      <div className="amt">{peso2(r.amount)}</div>
      <div className="sub">
        {r.name || 'No name'} · {timeOf(r.savedAt)}
      </div>
    </>
  );
  return onClick ? (
    <button className={`rec${fresh ? ' new' : ''}`} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className={`rec${fresh ? ' new' : ''}`}>{inner}</div>
  );
}

export function WarnBar({ children }: { children: ReactNode }) {
  return (
    <div className="warnbar" role="status">
      <Icon name="warn" size={22} />
      <div>{children}</div>
    </div>
  );
}

export function when(ms: number): string {
  return dateTime(ms);
}
