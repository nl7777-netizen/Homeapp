/**
 * Shared UI primitives (Tailwind v4, dark/light aware, tabular-nums money).
 */

import React from 'react';
import { X } from 'lucide-react';

export const fmtMoney = (n: number, digits = 0): string =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-AU', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtPct = (n: number, digits = 1): string => `${(n * 100).toFixed(digits)}%`;

export function Card({ title, subtitle, children, right, className = '' }: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div>
            {title && <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Money({ value, className = '', digits = 0 }: { value: number; className?: string; digits?: number }) {
  return <span className={`money ${className}`}>{fmtMoney(value, digits)}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-zinc-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';

export function NumberField({ value, onChange, step = 1, min, max, prefix, suffix, className = '' }: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">{prefix}</span>}
      <input
        type="number"
        className={`${inputCls} ${prefix ? 'pl-7 ' : ''}${suffix ? 'pr-10' : ''} money`}
        value={Number.isFinite(value) ? value : ''}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(Number.isNaN(n) ? 0 : n);
        }}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">{suffix}</span>}
    </div>
  );
}

export function TextField({ value, onChange, placeholder, type = 'text' }: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      className={inputCls}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SelectField<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-left"
    >
      <span className="text-sm text-zinc-700 dark:text-zinc-200">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
          checked ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export function Badge({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'neutral'; children: React.ReactNode }) {
  const cls = {
    good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    bad: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
    neutral: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

export function Button({ children, onClick, variant = 'primary', disabled, className = '' }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  className?: string;
}) {
  const cls = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-700',
    secondary:
      'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
    ghost: 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
  }[variant];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${cls} ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className={`thin-scroll max-h-[90vh] w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: 'good' | 'warn' | 'bad' }) {
  const toneCls = tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : tone === 'bad' ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-zinc-100';
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{label}</div>
      <div className={`money mt-0.5 text-lg font-semibold ${toneCls}`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-400">{sub}</div>}
    </div>
  );
}
