import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-xs hover:bg-brand-700 active:bg-brand-800',
        secondary: 'border border-border bg-surface-0 text-surface-900 hover:bg-surface-50',
        ghost: 'text-surface-700 hover:bg-surface-100 hover:text-surface-900',
        danger: 'bg-danger text-white shadow-xs hover:opacity-90',
        dangerGhost: 'text-danger hover:bg-danger-soft',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-3.5',
        lg: 'h-11 px-5',
        icon: 'size-9',
        iconSm: 'size-8',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, block, type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

export { buttonVariants };