import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? <div className="text-surface-400">{icon}</div> : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-surface-900">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}