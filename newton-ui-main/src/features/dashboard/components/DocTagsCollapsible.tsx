import {
  useState,
  useRef,
  useLayoutEffect,
  useEffect,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DashboardPill } from "./DashboardPill";

export interface DocTagItem {
  id: string | number;
  name: string;
}

export interface DocTagsCollapsibleProps {
  items: DocTagItem[];
  /** Prefix for stable React keys (e.g. role id or document id). */
  idPrefix: string;
  isMobile: boolean;
  className?: string;
  emptyContent?: ReactNode | null;
}

/**
 * Doc tags with optional collapse: if all badges fit on one row, shows all; otherwise
 * shows up to MAX then "Show N more doc tags" / "Collapse (N hidden)" inline (matches UsersSection).
 */
export function DocTagsCollapsible({
  items,
  idPrefix,
  isMobile,
  className,
  emptyContent = null,
}: DocTagsCollapsibleProps) {
  const [isExpandedDisplay, setIsExpandedDisplay] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const MAX_VISIBLE = isMobile ? 1 : 3;

  const [allTagsFit, setAllTagsFit] = useState(
    () => items.length <= MAX_VISIBLE,
  );

  useLayoutEffect(() => {
    if (items.length <= MAX_VISIBLE) {
      setAllTagsFit(true);
      return;
    }

    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const updateFit = () => {
      const available = container.getBoundingClientRect().width;
      if (available < 1) return;
      const needed = measure.getBoundingClientRect().width;
      setAllTagsFit(needed <= available + 1);
    };

    updateFit();
    const ro = new ResizeObserver(updateFit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [items, MAX_VISIBLE, idPrefix]);

  useEffect(() => {
    if (allTagsFit) {
      setIsExpandedDisplay(false);
    }
  }, [allTagsFit]);

  if (items.length === 0) {
    return emptyContent !== null ? <>{emptyContent}</> : null;
  }

  const hiddenCount = Math.max(0, items.length - MAX_VISIBLE);

  let itemsToShow: DocTagItem[];
  if (items.length <= MAX_VISIBLE) {
    itemsToShow = items;
  } else if (allTagsFit || isExpandedDisplay) {
    itemsToShow = items;
  } else {
    itemsToShow = items.slice(0, MAX_VISIBLE);
  }

  const showToggle = items.length > MAX_VISIBLE && !allTagsFit;
  const hiddenCountLabel = hiddenCount;

  const expandTitle = `Show ${hiddenCountLabel} more ${hiddenCountLabel === 1 ? "doc tag" : "doc tags"}`;
  const collapseTitle = `Collapse (${hiddenCountLabel} hidden)`;

  const tagToggleButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={isExpandedDisplay ? collapseTitle : expandTitle}
      className="h-6 min-h-6 px-1.5 py-0 text-2xs font-medium leading-none text-primary hover:text-primary/80 hover:bg-primary/10 gap-0.5 rounded-full border border-primary/20 hover:border-primary/40 w-fit shrink-0 [&_svg]:size-3"
      onClick={(e) => {
        e.stopPropagation();
        setIsExpandedDisplay((v) => !v);
      }}
    >
      {isExpandedDisplay ? (
        <>
          <ChevronUp className="size-3" />
       {hiddenCountLabel} less
        </>
      ) : (
        <>
          <ChevronDown className="size-3" />+{hiddenCountLabel} more
        </>
      )}
    </Button>
  );

  const tagPill = (item: DocTagItem, key: string) => (
    <DashboardPill
      key={key}
      intent="entity"
      entity="doc-tag"
      label={item.name}
    />
  );

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div ref={containerRef} className="relative min-w-0">
        {items.length > MAX_VISIBLE && (
          <div
            ref={measureRef}
            className="pointer-events-none invisible absolute left-0 top-0 flex w-max flex-nowrap gap-2"
            aria-hidden
          >
            {items.map((item) =>
              tagPill(item, `${idPrefix}-measure-${item.id}`),
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {itemsToShow.map((item) =>
            tagPill(item, `${idPrefix}-tag-${item.id}`),
          )}
          {showToggle && tagToggleButton}
        </div>
      </div>
    </div>
  );
}
