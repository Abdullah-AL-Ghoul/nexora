import React from 'react';
import { Loader2, AlertTriangle, HeartCrack } from 'lucide-react';

/** Centered gold spinner with accessible status. */
export const Spinner: React.FC<{ label?: string; className?: string }> = ({ label = 'Loading', className = '' }) => (
  <div
    role="status"
    aria-label={label}
    className={`flex items-center justify-center gap-3 py-16 ${className}`}
  >
    <Loader2 className="h-7 w-7 animate-spin text-gold" aria-hidden />
    <span className="sr-only">{label}</span>
  </div>
);

/** Skeleton shimmer block. */
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    aria-hidden
    className={`animate-pulse rounded-md bg-line/40 ${className}`}
    style={{ backgroundImage: 'linear-gradient(90deg, rgba(201,169,97,0.05) 25%, rgba(201,169,97,0.12) 50%, rgba(201,169,97,0.05) 75%)', backgroundSize: '468px 100%' }}
  />
);

/** Grid of product-card skeletons for initial loads. */
export const CardSkeletonGrid: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4" aria-hidden>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="overflow-hidden rounded-lg border border-line bg-surface">
        <Skeleton className="aspect-square w-full rounded-none" />
        <div className="space-y-2 p-4">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

/** Purposeful empty state. */
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-line bg-surface px-6 py-14 text-center ${className}`}>
    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-raised text-gold">
      {icon ?? <HeartCrack className="h-5 w-5" aria-hidden />}
    </div>
    <h3 className="font-display text-lg font-bold text-fg">{title}</h3>
    {description && <p className="max-w-sm text-sm text-fg-muted">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

/** Actionable error state with retry. */
export const ErrorState: React.FC<{
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}> = ({ title = 'Something went wrong', message, onRetry, retryLabel = 'Try Again', className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-danger/30 bg-surface px-6 py-14 text-center ${className}`}>
    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-danger/40 bg-raised text-danger">
      <AlertTriangle className="h-5 w-5" aria-hidden />
    </div>
    <h3 className="font-display text-lg font-bold text-fg">{title}</h3>
    {message && <p className="max-w-sm text-sm text-fg-muted">{message}</p>}
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-2 rounded-md bg-gold px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-gold-soft"
      >
        {retryLabel}
      </button>
    )}
  </div>
);

/** Badge for status/labels. */
export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: 'gold' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}> = ({ children, tone = 'neutral', className = '' }) => {
  const tones = {
    gold: 'bg-gold/15 text-gold border-gold/30',
    neutral: 'bg-line/30 text-fg-muted border-line',
    success: 'bg-success/10 text-success border-success/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
    info: 'bg-info/10 text-info border-info/30',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
};

/** Card surface with optional hover treatment. */
export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  as?: 'div' | 'article' | 'li';
}> = ({ children, className = '', hover = false, as: Tag = 'div' }) => (
  <Tag
    className={`rounded-lg border border-line bg-surface shadow-card ${hover ? 'transition-colors duration-200 hover:border-gold/50' : ''} ${className}`}
  >
    {children}
  </Tag>
);
