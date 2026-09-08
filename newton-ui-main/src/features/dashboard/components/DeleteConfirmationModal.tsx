import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Trash2 } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DashboardLoader } from "@/components/ContentLoader";
import { cn } from "@/lib/utils";

/**
 * Centered delete confirmation modal — consistent pattern across all CRUD entities.
 *
 * Copy contract:
 * - `title`: `Delete {Entity}?` or `Delete {n} {entities}?`
 * - `description`: short fixed line, e.g. `"This action cannot be undone."`
 * - `itemName`: entity name or count summary shown in the mono highlight box
 * - `usageNote`: optional dependency impact, e.g. `"3 tools and 2 personas use this tag."`
 */
interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  itemName?: string;
  usageNote?: string;
  confirmLabel?: string;
  isLoading?: boolean;
  /** Use when the modal must stack above overlays like UserPanel (`z-[9000]`). */
  layerClassName?: string;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  usageNote,
  confirmLabel = "Delete",
  isLoading = false,
  layerClassName = "z-50",
}: DeleteConfirmationModalProps) {
  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      console.error("Error in delete confirmation:", error);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => { if (!open) onClose(); }}
    >
      <DialogPortal>
        <DialogOverlay className={layerClassName} />
        <DialogPrimitive.Content
          aria-describedby="delete-modal-description"
          className={cn(
            "fixed left-[50%] top-[50%] w-[calc(100vw-2rem)] max-w-dialog-sm translate-x-[-50%] translate-y-[-50%]",
            layerClassName,
            "bg-surface border border-border-main rounded-2xl shadow-dialog overflow-hidden",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>

          <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-status-error/10 flex items-center justify-center mb-4">
              <Trash2 size={22} className="text-status-error" />
            </div>
            <h2
              id="delete-modal-description"
              className="font-display font-semibold text-base text-text-main mb-1"
            >
              {title}
            </h2>
            {description && (
              <p className="text-sm text-text-muted mb-3 whitespace-pre-line">{description}</p>
            )}
            {itemName && (
              <div className="w-full px-3 py-2 rounded-lg border border-status-error/30 bg-status-error/5 font-mono text-sm text-center mb-2 text-text-main">
                {itemName}
              </div>
            )}
            {usageNote && (
              <p className="text-2xs text-text-muted">{usageNote}</p>
            )}
          </div>

          <div className="px-6 pb-5 pt-1 flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 h-9 rounded-[0.6rem] border-border-main text-text-muted hover:bg-surface-2 hover:text-text-main"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1 h-9 rounded-[0.6rem] bg-status-error text-white hover:bg-status-error/90"
            >
              {isLoading ? (
                <>
                  <DashboardLoader variant="inline" className="mr-2" />
                  Deleting…
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
