import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

const alertVariants = cva('flex gap-3 rounded-md border p-3.5 text-xs', {
  variants: {
    tone: {
      info: 'border-info/25 bg-info-soft text-info',
      success: 'border-success/25 bg-success-soft text-success',
      warning: 'border-warning/25 bg-warning-soft text-warning',
      danger: 'border-danger/25 bg-danger-soft text-danger',
    },
  },
  defaultVariants: { tone: 'info' },
});

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
} as const;

export type AlertProps = ComponentProps<'div'> &
  VariantProps<typeof alertVariants> & {
    title?: ReactNode;
  };

export function Alert({ className, tone = 'info', title, children, ...props }: AlertProps) {
  const Icon = icons[tone ?? 'info'];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      data-slot="alert"
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <Icon className="mt-px size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed opacity-90">{children}</div> : null}
      </div>
    </div>
  );
}