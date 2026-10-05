import React, { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: 'right' | 'left';
  children: React.ReactNode;
  label?: string;
  footer?: React.ReactNode;
}

/** Accessible slide-over drawer (RTL-aware: side flips automatically by CSS dir). */
export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  side = 'right',
  children,
  label = 'Panel',
  footer,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previousFocus.current?.focus?.();
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  // RTL: `right`/`left` are already flipped by `[dir=rtl]` when using logical props;
  // here we simply anchor with `inset-inline-end`-style utilities via Tailwind.
  const anchored = side === 'right' ? 'right-0' : 'left-0';

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={label}>
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={{ animation: 'fade-in 0.2s ease-out' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`absolute inset-y-0 ${anchored} flex w-full max-w-md flex-col border-line bg-surface shadow-overlay focus:outline-none`}
        style={{ animation: 'drawer-in 0.3s var(--ease-out)' }}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-base font-bold text-fg">{label}</h2>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-raised hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-t border-line px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
};
