import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 font-semibold tracking-wide transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

const variants: Record<Variant, string> = {
  primary: 'bg-gold text-ink hover:bg-gold-soft active:bg-gold',
  secondary: 'bg-raised border border-line text-fg hover:border-gold/60 hover:text-gold',
  ghost: 'bg-transparent text-fg-muted hover:text-fg hover:bg-surface',
  danger: 'bg-danger/10 border border-danger/40 text-danger hover:bg-danger/20',
};

const sizes: Record<Size, string> = {
  sm: 'text-xs px-3 py-2 rounded-md',
  md: 'text-sm px-5 py-2.5 rounded-md',
  lg: 'text-sm px-7 py-3 rounded-lg',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}) => (
  <button
    className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    disabled={disabled || loading}
    {...rest}
  >
    {loading && (
      <span
        aria-hidden
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
    )}
    {children}
  </button>
);
