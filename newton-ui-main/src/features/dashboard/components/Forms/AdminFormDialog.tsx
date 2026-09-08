import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "max-w-dialog-sm",
  md: "max-w-dialog-md",
  lg: "max-w-dialog-lg",
} as const;

type OutsideInteractEvent = {
  target: EventTarget | null;
  detail?: { originalEvent: Event };
};

function getOutsideInteractTarget(event: OutsideInteractEvent): EventTarget | null {
  return event.detail?.originalEvent?.target ?? event.target;
}

/** Portaled popovers/combobox menus live outside Dialog content in the DOM. */
function isPortaledDropdownTarget(event: OutsideInteractEvent): boolean {
  const target = getOutsideInteractTarget(event);
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("[data-radix-popper-content-wrapper]") ||
      target.closest("[data-combobox-dropdown]"),
  );
}

interface AdminFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
  size?: keyof typeof SIZE_CLASS;
  bodyClassName?: string;
  contentClassName?: string;
}

export function AdminFormDialog({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  size = "md",
  bodyClassName,
  contentClassName,
}: AdminFormDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          onPointerDownOutside={(event) => {
            if (isPortaledDropdownTarget(event)) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (isPortaledDropdownTarget(event)) {
              event.preventDefault();
            }
          }}
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-[calc(100vw-2rem)] translate-x-[-50%] translate-y-[-50%]",
            "bg-surface border border-border-main rounded-2xl shadow-dialog overflow-hidden",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            SIZE_CLASS[size],
            contentClassName,
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-main shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-primary">{icon}</span>
              <DialogPrimitive.Title className="font-display font-semibold text-sm text-text-main">
                {title}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-2 transition-colors"
              aria-label="Close"
            >
              <X size={14} />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className={cn("px-5 py-4 overflow-y-auto max-h-[65vh]", bodyClassName)}>
            {children}
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-border-main bg-surface-2/50 shrink-0">
            {footer}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

export function FormDialogFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      {children}
    </div>
  );
}

export function FormDialogFooterWithDestructive({
  destructiveSlot,
  children,
}: {
  destructiveSlot: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {destructiveSlot}
      <div className="flex-1" />
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
