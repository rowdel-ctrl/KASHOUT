import { useEffect, type ReactNode } from 'react';
import { peso2, timeOf } from '../lib/format';
import { highlight, matchRecord } from '../lib/records';
import type { CashRecord, Route } from '../lib/types';
import { useApp } from './context';
import { Icon } from './icons';

export function TopBar({ title, onBack }: { title: string; onBack?: () => void }) {
  const { back } = useApp();
  return (
    <div className="topbar">
      <button className="round" aria-label="Back" onClick={onBack ?? back}>
        <Icon name="back" size={22} />
      </button>
      <h1>{title}</h1>
    </div>
  );
}

export function NavBar({ active }: { active: 'home' | 'records' | 'settings' }) {
  const { tab } = useApp();
  const items: { key: 'home' | 'records' | 'settings'; label: string; icon: string; route: Route }[] = [
    { key: 'home', label: 'Home', icon: 'home', route: { name: 'home' } },
    { key: 'records', label: 'Records', icon: 'list', route: { name: 'records' } },
    { key: 'settings', label: 'Settings', icon: 'gear', route: { name: 'settings' } },
  ];
  return (
    <nav className="nav" aria-label="Main">
      {items.map((i) => (
        <button key={i.key} className={active === i.key ? 'on' : ''} aria-current={active === i.key ? 'page' : undefined} onClick={() => tab(i.route)}>
          <i>
            <Icon name={i.icon} />
          </i>
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

/** Bottom sheet. Closes on the dark area or the Escape key. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grip" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export interface Option<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

/** A sheet with one choice per row (the "dropdown"). */
export function OptionSheet<T extends string | number>({
  title, options, value, onPick, onClose,
}: { title: string; options: Option<T>[]; value: T; onPick: (v: T) => void; onClose: () => void }) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div role="radiogroup" aria-label={title} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={o.value === value}
            className={`opt${o.value === value ? ' on' : ''}`}
            onClick={() => {
              onPick(o.value);
              onClose();
            }}
          >
            <span>
              {o.label}
              {o.hint && <small> · {o.hint}</small>}
            </span>
            {o.value === value && <Icon name="check" size={22} />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

const initials = (name: string) => (name.replace(/[^A-Za-z]/g, '').slice(0, 2) || '?').toUpperCase();

function Hl({ text, q }: { text: string; q?: string }) {
  if (!q) return <>{text}</>;
  return (
    <>
      {highlight(text, q).map((p, i) => (p.hit ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>))}
    </>
  );
}

export function RecRow({ r, onClick, fresh, selected, q }: { r: CashRecord; onClick?: () => void; fresh?: boolean; selected?: boolean; q?: string }) {
  const green = r.ref.charCodeAt(r.ref.length - 1) % 2 === 0;
  const field = q ? matchRecord(r, q) : null;
  const amountText = peso2(r.amount);
  const inner = (
    <>
      <span className={`av${green ? ' g' : ''}`}>{initials(r.name)}</span>
      <span className="mid">
        <div className="amt">{field === 'amount' ? <mark>{amountText}</mark> : amountText}</div>
        <div className="sub">
          <Hl text={r.name || 'No name'} q={field === 'name' ? q : undefined} /> · <Hl text={r.by} q={field === 'staff' ? q : undefined} />
        </div>
        {field === 'ref' && q && (
          <div className="ext">
            Ref <Hl text={r.ref} q={q.replace(/\s+/g, '')} />
          </div>
        )}
        {field === 'number' && q && (
          <div className="ext">
            <Hl text={r.number} q={q.replace(/\s+/g, '')} />
          </div>
        )}
      </span>
      <span className="when">{timeOf(r.savedAt)}</span>
    </>
  );
  const cls = `rec${fresh ? ' new' : ''}${selected ? ' sel' : ''}`;
  return onClick ? (
    <button className={cls} onClick={onClick} aria-pressed={selected}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
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
