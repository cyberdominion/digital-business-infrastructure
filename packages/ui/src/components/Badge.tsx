import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn.js';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-surface-100 text-surface-700',
        brand: 'border-brand-200 bg-brand-50 text-brand-800',
        success: 'border-transparent bg-success-soft text-success',
        warning: 'border-transparent bg-warning-soft text-warning',
        danger: 'border-transparent bg-danger-soft text-danger',
        info: 'border-transparent bg-info-soft text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };