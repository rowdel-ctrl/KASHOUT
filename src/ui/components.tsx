import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatRef, peso, timeOf } from '../lib/format';
import { LATE_MS, highlight, highlightRef, isPending, matchRecord, whenOf } from '../lib/records';
import type { CashRecord } from '../lib/types';
import { sourceOf, walletColor } from '../lib/wallets';
import { useApp } from './context';
import { Icon } from './icons';

export function TopBar({ title, onBack }: { title: string; onBack?: () => void }) {
  const { back, t } = useApp();
  return (
    <div className="topbar">
      <button className="round" aria-label={t('Back')} onClick={onBack ?? back}>
        <Icon name="back" size={22} />
      </button>
      <h1>{title}</h1>
    </div>
  );
}

export function NavBar({ active }: { active: 'home' | 'records' }) {
  const { tab, go, t } = useApp();
  return (
    <nav className="nav" aria-label={t('Main')}>
      <button className={`tab${active === 'home' ? ' on' : ''}`} aria-current={active === 'home' ? 'page' : undefined} onClick={() => tab({ name: 'home' })}>
        <Icon name="home" size={24} soft={active === 'home'} />
        {t('Home')}
      </button>
      <button className="scanbtn" aria-label={t('Scan a receipt')} onClick={() => go({ name: 'scan' })}>
        <Icon name="camera" size={42} />
      </button>
      <button className={`tab${active === 'records' ? ' on' : ''}`} aria-current={active === 'records' ? 'page' : undefined} onClick={() => tab({ name: 'records' })}>
        <Icon name="list" size={24} soft={active === 'records'} />
        {t('Records')}
      </button>
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
  const amountText = peso(r.amount);
  const pending = isPending(r);
  const late = pending && Date.now() - r.savedAt >= LATE_MS;
  const { t } = useApp();
  const source = sourceOf(r);
  const inner = (
    <>
      <span className={`av${green ? ' g' : ''}`}>
        {initials(r.name)}
        <i className="wd" style={{ background: walletColor(source) }} title={source} />
      </span>
      <span className="mid">
        <div className={`ref${r.ref.length > 16 ? ' long' : ''}`}>
          {q && field === 'ref'
            ? highlightRef(r.ref, q).map((p, i) => (p.hit ? <mark key={i}>{p.t}</mark> : <span key={i}>{p.t}</span>))
            : formatRef(r.ref)}
        </div>
        <div className="sub">
          <Hl text={r.name || t('No name')} q={field === 'name' ? q : undefined} /> · <Hl text={r.by} q={field === 'staff' ? q : undefined} />
        </div>
        {field === 'number' && q && (
          <div className="ext">
            <Hl text={r.number} q={q.replace(/\s+/g, '')} />
          </div>
        )}
      </span>
      <span className="right">
        <div className="amt">{field === 'amount' ? <mark>{amountText}</mark> : amountText}</div>
        {pending ? <div className={`tag${late ? ' late' : ''}`}>{t('Pending')}</div> : <div className="when">{timeOf(whenOf(r))}</div>}
      </span>
    </>
  );
  const cls = `rec${fresh ? ' new' : ''}${selected ? ' sel' : ''}${pending ? ' pending' : ''}${late ? ' late' : ''}`;
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

/**
 * A button that only works when it is held down. A quick tap does nothing.
 * Used for things that cannot be undone, so one slip of the finger cannot do them.
 */
export function HoldButton({ label, holding, onDone, ms = 1000 }: { label: string; holding: string; onDone: () => void; ms?: number }) {
  const [on, setOn] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const start = () => {
    if (timer.current) return;
    setOn(true);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setOn(false);
      onDone();
    }, ms);
  };
  const stop = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setOn(false);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={`btn btn-danger hold${on ? ' on' : ''}`}
      style={{ ['--ms' as string]: `${ms}ms` }}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && start()}
      onKeyUp={(e) => (e.key === 'Enter' || e.key === ' ') && stop()}
      onBlur={stop}
    >
      <i aria-hidden="true" />
      <span>{on ? holding : label}</span>
    </button>
  );
}
