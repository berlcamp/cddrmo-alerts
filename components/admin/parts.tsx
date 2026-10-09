import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Small rounded tag for row metadata. */
export function RowTag({ icon: Icon, label, className }: { icon?: LucideIcon; label: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold', className)}>
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      {label}
    </span>
  );
}

/** A checkbox laid out as a bordered card with a one-line hint. */
export function CheckCard({ name, label, hint, defaultChecked }: { name: string; label: string; hint: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-150 hover:bg-accent/60 has-checked:border-primary/50 has-checked:bg-primary/5">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-5 shrink-0 accent-primary" />
      <span>
        <span className="block font-bold">{label}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

/** Heading row for a managed list: title, description and a primary action. */
export function SectionHeader({ id, title, description, action }: { id: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        <h2 id={id} className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
