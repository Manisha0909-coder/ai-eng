import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PersonaWizardShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  stepper: React.ReactNode;
  children: React.ReactNode;
  sidebar: React.ReactNode;
  footer: React.ReactNode;
  successOverlay?: React.ReactNode;
}

export function PersonaWizardShell({
  isOpen,
  onClose,
  title,
  subtitle,
  stepper,
  children,
  sidebar,
  footer,
  successOverlay,
}: PersonaWizardShellProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-50 w-[calc(100vw-2rem)] translate-x-[-50%] translate-y-[-50%]',
            'max-w-[95vw] sm:max-w-dialog-lg h-[min(88vh,680px)] overflow-hidden',
            'bg-surface border border-border-main rounded-2xl shadow-dialog',
            'duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <div className="relative flex h-full min-h-0 flex-col">
            <div className="border-b border-border-main px-6 pt-5 pb-0 shrink-0">
              <div className="flex items-center justify-between mb-4 pr-8">
                <div className="min-w-0">
                  <DialogPrimitive.Title className="font-display font-semibold text-base text-text-main">
                    {title}
                  </DialogPrimitive.Title>
                  <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>
                </div>
                <DialogPrimitive.Close
                  className="absolute right-5 top-5 w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-2 transition-colors"
                  aria-label="Close"
                >
                  <X size={14} />
                </DialogPrimitive.Close>
              </div>
              <div className="pb-4">{stepper}</div>
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="flex-1 min-h-0 min-w-0 overflow-y-auto px-6 py-5">
                {children}
              </div>
              {sidebar}
            </div>

            <div className="border-t border-border-main px-6 py-3.5 bg-surface-2/30 shrink-0">
              {footer}
            </div>

            {successOverlay}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
