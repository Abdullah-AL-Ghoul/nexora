import React, { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' };

/** Accessible modal: focus trap, Esc to close, scroll lock, aria-modal. */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
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
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
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
    // Focus the panel (or first focusable) on open
    requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previousFocus.current?.focus?.();
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Dialog'}
      aria-describedby={description ? 'modal-desc' : undefined}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        style={{ animation: 'fade-in 0.2s ease-out' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative w-full ${sizes[size]} rounded-lg border border-line bg-surface shadow-overlay focus:outline-none`}
        style={{ animation: 'modal-in 0.25s var(--ease-out)' }}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-bold text-fg">{title}</h2>
              {description && (
                <p id="modal-desc" className="mt-0.5 text-sm text-fg-muted">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-md p-1.5 text-fg-muted transition-colors hover:bg-raised hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
