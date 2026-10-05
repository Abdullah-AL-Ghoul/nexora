import React from 'react';

const fieldBase =
  'w-full rounded-md border border-line bg-raised px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-faint transition-colors duration-150 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/30 disabled:opacity-50';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => (
    <input ref={ref} className={`${fieldBase} ${className}`} {...rest} />
  )
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = '', ...rest }, ref) => (
  <textarea ref={ref} className={`${fieldBase} min-h-[96px] ${className}`} {...rest} />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <select ref={ref} className={`${fieldBase} appearance-none pr-9 ${className}`} {...rest}>
      {children}
    </select>
  )
);
Select.displayName = 'Select';

export interface FieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
}

export const Field: React.FC<FieldProps & { children: React.ReactNode }> = ({ label, htmlFor, error, hint, children }) => (
  <div className="space-y-1.5">
    {label && (
      <label htmlFor={htmlFor} className="block text-xs font-medium tracking-wide text-fg-muted">
        {label}
      </label>
    )}
    {children}
    {hint && !error && <p className="text-xs text-fg-faint">{hint}</p>}
    {error && (
      <p role="alert" className="text-xs font-medium text-danger">{error}</p>
    )}
  </div>
);
