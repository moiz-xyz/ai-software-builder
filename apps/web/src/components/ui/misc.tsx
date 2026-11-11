'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const BADGE: Record<string, string> = {
  default: 'bg-secondary text-secondary-foreground',
  green: 'bg-emerald-100 text-emerald-800',
  blue: 'bg-blue-100 text-blue-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-700',
  violet: 'bg-violet-100 text-violet-800',
};

export function Badge({ children, tone = 'default', className }: { children: React.ReactNode; tone?: keyof typeof BADGE; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', BADGE[tone], className)}>{children}</span>;
}

const STATUS_TONE: Record<string, keyof typeof BADGE> = {
  PUBLISHED: 'green', SUCCEEDED: 'green', ACTIVE: 'green',
  PREVIEW_READY: 'blue', DRAFT: 'gray', QUEUED: 'gray', TRIALING: 'blue',
  PUBLISHING: 'violet', RUNNING: 'violet', APPROVED: 'violet',
  AWAITING_APPROVAL: 'amber', PENDING: 'amber', UNPUBLISHED: 'gray', PAST_DUE: 'amber',
  REJECTED: 'red', FAILED: 'red', SUSPENDED: 'red', CANCELLED: 'red', ARCHIVED: 'gray',
};
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status] ?? 'default'}>{status.replace(/_/g, ' ').toLowerCase()}</Badge>;

export function Alert({ tone = 'info', children, className }: { tone?: 'info' | 'error' | 'success' | 'warning'; children: React.ReactNode; className?: string }) {
  const t = { info: 'border-blue-200 bg-blue-50 text-blue-900', error: 'border-red-200 bg-red-50 text-red-900', success: 'border-emerald-200 bg-emerald-50 text-emerald-900', warning: 'border-amber-200 bg-amber-50 text-amber-900' }[tone];
  return <div className={cn('rounded-md border px-4 py-3 text-sm', t, className)}>{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return <div className={cn('h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground', className)} />;
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner />
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16" onMouseDown={onClose}>
      <div className={cn('w-full rounded-lg bg-background shadow-xl', wide ? 'max-w-3xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} className={cn('rounded px-3 py-1.5 text-sm font-medium transition', value === t.key ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function JsonView({ value }: { value: unknown }) {
  return <pre className="max-h-[480px] overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
