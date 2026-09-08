import { useMemo } from 'react';
import { ChevronDown, ChevronUp, Database, SquarePen, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { RawPromptBlock } from './Modals/personaVersion/RawPromptBlock';
import { PersonaMemoryBlock } from '@/services/rbac/rbacApi';
import { cn } from '@/lib/utils';
import { DashboardPill } from './DashboardPill';
import {
  personaDetailPanelClass,
  personaDetailSectionLabelClass,
} from '../utils/dashboardHelper';

const detailShellClass = 'bg-background';

const detailOutlineButtonClass =
  'gap-2 border-border-main bg-surface text-text-main hover:bg-surface/80';

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h3 className={personaDetailSectionLabelClass}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

export interface MemoryBlockSidebarProps {
  block: PersonaMemoryBlock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: PersonaMemoryBlock[];
  getBlockKey: (block: PersonaMemoryBlock) => string;
  getPersonaName: (block: PersonaMemoryBlock) => string;
  getBlockPersonaId: (block: PersonaMemoryBlock) => number | null;
  isAdmin: boolean;
  onEdit: (block: PersonaMemoryBlock) => void;
  onDelete: (block: PersonaMemoryBlock) => void;
  onNavigate?: (block: PersonaMemoryBlock) => void;
}

export function MemoryBlockSidebar({
  block,
  open,
  onOpenChange,
  blocks,
  getBlockKey,
  getPersonaName,
  getBlockPersonaId,
  isAdmin,
  onEdit,
  onDelete,
  onNavigate,
}: MemoryBlockSidebarProps) {
  const currentIndex = useMemo(
    () => (block ? blocks.findIndex((b) => getBlockKey(b) === getBlockKey(block)) : -1),
    [block, blocks, getBlockKey]
  );

  if (!block) return null;

  const navigatePrev = () => {
    if (currentIndex > 0) onNavigate?.(blocks[currentIndex - 1]);
  };

  const navigateNext = () => {
    if (currentIndex >= 0 && currentIndex < blocks.length - 1) {
      onNavigate?.(blocks[currentIndex + 1]);
    }
  };

  const currentValue = block.current_value?.trim() ?? '';
  const blockPersonaId = getBlockPersonaId(block);
  const actionsDisabled = !isAdmin || blockPersonaId === null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'flex w-full flex-col gap-0 border-border-main p-0 sm:max-w-xl md:max-w-2xl',
          detailShellClass,
          '[&>button]:hidden'
        )}
      >
        <div className="shrink-0 bg-background px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Database size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold leading-tight text-text-main">
                  {block.label}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <DashboardPill
                    intent="entity"
                    entity="persona"
                    label={getPersonaName(block)}
                  />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border-main/60 bg-surface p-1 text-text-muted">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 p-1 hover:bg-surface"
                disabled={currentIndex <= 0}
                onClick={navigatePrev}
                title="Previous block"
              >
                <ChevronUp size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 p-1 hover:bg-surface"
                disabled={currentIndex < 0 || currentIndex >= blocks.length - 1}
                onClick={navigateNext}
                title="Next block"
              >
                <ChevronDown size={18} />
              </Button>
              <span className="hidden border-l border-border-main/60 px-2 text-xs sm:inline">
                navigate
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 p-1 hover:bg-surface"
                onClick={() => onOpenChange(false)}
                title="Close"
              >
                <X size={18} />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'scrollbar-themed min-h-0 flex-1 overflow-y-auto border-t border-border-main/40 px-5 py-5',
            detailShellClass
          )}
        >
          <DetailSection title="Current value">
            {currentValue ? (
              <RawPromptBlock content={currentValue} />
            ) : (
              <div className={cn(personaDetailPanelClass, 'min-h-[72px] px-3 py-3')}>
                <p className="text-sm italic text-text-muted">
                  No current value set
                </p>
              </div>
            )}
          </DetailSection>
        </div>

        <div className="shrink-0 border-t border-border-main/40 bg-background px-5 py-4">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className={detailOutlineButtonClass}
              disabled={actionsDisabled}
              title={
                !isAdmin
                  ? 'Admin privileges required'
                  : blockPersonaId === null
                    ? 'Missing persona id from API response'
                    : 'Edit block'
              }
              onClick={() => onEdit(block)}
            >
              <SquarePen size={16} />
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-border-main bg-surface text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={actionsDisabled}
              title={
                !isAdmin
                  ? 'Admin privileges required'
                  : blockPersonaId === null
                    ? 'Missing persona id from API response'
                    : 'Delete block'
              }
              onClick={() => onDelete(block)}
            >
              <Trash2 size={16} />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
