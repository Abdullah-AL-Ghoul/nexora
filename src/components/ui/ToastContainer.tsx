import React from 'react';
import { useStore } from '../../store/useStore';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

/** Toast stack — uses real CSS keyframes (defined in index.css) + design tokens. */
export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useStore();
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 z-[90] flex max-w-md w-full flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-surface p-4 text-fg shadow-overlay"
          style={{ animation: 'toast-in 0.25s var(--ease-out)' }}
        >
          <div className="mt-0.5 shrink-0">
            {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-gold" aria-hidden />}
            {toast.type === 'error' && <AlertCircle className="h-5 w-5 text-danger" aria-hidden />}
            {toast.type === 'info' && <Info className="h-5 w-5 text-info" aria-hidden />}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium tracking-tight text-fg">{toast.title}</h4>
            {toast.message && (
              <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">{toast.message}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="-mr-1 p-1 text-fg-muted transition-colors hover:text-fg"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
