'use client';
import { type ReactNode } from 'react';
import { Package, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
export function Brand() {
  return (
    <a className="brand" href="/">
      <span className="brand-mark">i</span>InChouf
      <span className="brand-product">OrderPilot</span>
    </a>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field"><label className="field-label"><span>{label}</span>{children}</label>{hint && <small>{hint}</small>}</div>
  );
}
export function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <Select value={value} onValueChange={(v) => v !== null && onChange(v)}>
        <SelectTrigger aria-label={label} className="choice-trigger">
          <SelectValue>
            {options
              .map((x) => (typeof x === 'string' ? { value: x, label: x } : x))
              .find((x) => x.value === value)?.label || 'Choose an option'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((x) => {
            const o = typeof x === 'string' ? { value: x, label: x } : x;
            return (
              <SelectItem value={o.value} key={o.value}>
                {o.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <Switch checked={value} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
export function Modal({
  title,
  description,
  open,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="op-modal">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description || 'Review the details below.'}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: string;
  retry?: () => void;
}) {
  return error ? (
    <div className="error-box" role="alert">
      {error}
      {retry && <button onClick={retry}>Try again</button>}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="loading-state" aria-label="Loading" role="status">
      <Skeleton className="h-8 w-60" />
      <div className="metric-grid">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64" />
      <span className="sr-only">Loading workspace</span>
    </div>
  );
}
export function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Empty className="empty-state">
      <Package size={28} />
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
      {action}
    </Empty>
  );
}
export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={
        'badge ' +
        (['Delivered', 'Paid', 'Approved', 'active'].includes(value)
          ? 'green'
          : [
                'Cancelled',
                'Returned',
                'Failed Delivery',
                'Needs Attention',
                'suspended',
                'Changes requested',
              ].includes(value)
            ? 'red'
            : ['Picking', 'Confirmed', 'trial'].includes(value)
              ? 'violet'
              : value === 'Packed'
                ? 'blue'
                : 'orange')
      }
    >
      {value}
    </span>
  );
}
export function Submit({
  busy,
  children = 'Save changes',
}: {
  busy: boolean;
  children?: ReactNode;
}) {
  return (
    <button type="submit" className="button" disabled={busy}>
      {busy && <Loader2 size={16} className="animate-spin" />}
      {busy ? 'Saving…' : children}
    </button>
  );
}
export function ProductImage({ src, name }: { src: string; name: string }) {
  return src ? (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  ) : (
    <div className="no-image">
      <Package size={35} />
      <span>No image yet</span>
    </div>
  );
}
