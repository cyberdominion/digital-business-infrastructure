import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn.js';

const fieldVariants = cva(
  'w-full rounded-md border border-border bg-surface-0 px-3 text-sm text-surface-900 transition-colors placeholder:text-surface-400 disabled:cursor-not-allowed disabled:bg-surface-100 disabled:opacity-70 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/20',
  {
    variants: {
      size: {
        sm: 'h-8 text-xs',
        md: 'h-9',
        lg: 'h-11',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export type InputProps = ComponentProps<'input'> & VariantProps<typeof fieldVariants>;

export function Input({ className, size, type = 'text', ...props }: InputProps) {
  return (
    <input type={type} data-slot="input" className={cn(fieldVariants({ size }), className)} {...props} />
  );
}

export type TextareaProps = ComponentProps<'textarea'>;

export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      data-slot="textarea"
      className={cn(fieldVariants({ size: 'md' }), 'resize-y py-2 leading-relaxed', className)}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-surface-700">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}