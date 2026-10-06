import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Card } from './Card.js';

export interface StatCardProps {
  label: string;
  value: string;
  /** Percentage change vs the previous period. */
  delta?: number | null;
  deltaLabel?: string;
  hint?: ReactNode;
  /** Reverses delta colouring when a decrease is the good outcome (e.g. churn). */
  invertDelta?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  invertDelta = false,
  className,
}: StatCardProps) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const flat = hasDelta && Math.abs(delta) < 0.05;
  const rising = hasDelta && !flat && delta > 0;
  const good = hasDelta && !flat && (invertDelta ? !rising : rising);

  return (
    <Card className={cn('flex flex-col gap-3 p-5', className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2.5">
        <p className="text-2xl font-semibold tracking-tight tabular-nums text-surface-900">{value}</p>
        {hasDelta ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
              flat && 'text-muted-foreground',
              !flat && good && 'text-success',
              !flat && !good && 'text-danger',
            )}
          >
            {flat ? (
              <Minus className="size-3" aria-hidden />
            ) : rising ? (
              <ArrowUpRight className="size-3" aria-hidden />
            ) : (
              <ArrowDownRight className="size-3" aria-hidden />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : null}
      </div>
      {(deltaLabel || hint) && (
        <p className="text-xs text-muted-foreground">{hint ?? deltaLabel}</p>
      )}
    </Card>
  );
}