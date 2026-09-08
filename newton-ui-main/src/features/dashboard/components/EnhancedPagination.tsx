import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EnhancedPaginationProps {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalItems: number;
  displayedItemsCount?: number;
  pageSizeOptions?: number[];
  isMobile?: boolean;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];

function buildPageWindows(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const lo = Math.max(2, current - 1);
  const hi = Math.min(total - 1, current + 1);
  if (lo > 2) pages.push("…");
  for (let p = lo; p <= hi; p++) pages.push(p);
  if (hi < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export const EnhancedPagination = ({
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  totalItems,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  isMobile = false,
  onPageChange,
  onPageSizeChange,
}: Readonly<EnhancedPaginationProps>) => {
  const [pageSizeDropdownOpen, setPageSizeDropdownOpen] = useState(false);

  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const start = totalItems === 0 ? 0 : Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const end = Math.min(currentPage * pageSize, totalItems);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    setPageSizeDropdownOpen(false);
    onPageSizeChange?.(newSize);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pageSizeDropdownOpen) {
        const target = event.target as Element;
        if (!target.closest("[data-page-size-popover]")) {
          setPageSizeDropdownOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pageSizeDropdownOpen]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, setCurrentPage]);

  const PageSizeDropdown = (
    <div className="relative" data-page-size-popover>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setPageSizeDropdownOpen(!pageSizeDropdownOpen);
        }}
        className="inline-flex items-center justify-between h-7 px-2 w-14 rounded-md border border-border-main bg-surface text-xs font-medium text-text-main hover:bg-surface-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        {pageSize}
        <ChevronDown className="h-3 w-3 ml-1 text-text-muted" />
      </button>

      {pageSizeDropdownOpen && (
        <div className="absolute bottom-full mb-1 w-14 rounded-md shadow-lg z-20 border border-border-main bg-surface">
          <div className="py-1">
            {pageSizeOptions.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handlePageSizeChange(size)}
                className={cn(
                  "block w-full text-left px-2 py-1.5 text-xs transition-colors",
                  pageSize === size
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-text-main hover:bg-surface-2"
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span className="tabular-nums">
            Showing{" "}
            <span className="text-text-main font-medium">{start}–{end}</span>{" "}
            of{" "}
            <span className="text-text-main font-medium">{totalItems}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-2xs">Rows</span>
            {PageSizeDropdown}
          </div>
        </div>
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1 || totalItems === 0}
            aria-label="Previous page"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted border border-border-main hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {buildPageWindows(currentPage, totalPages).map((p, i) =>
            p === "…" ? (
              <span key={`ellipsis-${i}`} className="px-1 text-text-muted text-xs">…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => handlePageChange(p)}
                className={cn(
                  "w-7 h-7 rounded-lg text-xs transition-colors",
                  currentPage === p
                    ? "bg-primary text-white dark:text-background font-medium"
                    : "text-text-muted border border-border-main hover:bg-surface-2"
                )}
              >
                {p}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
            disabled={currentPage === totalPages || totalItems === 0}
            aria-label="Next page"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted border border-border-main hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span className="tabular-nums">
          Showing{" "}
          <span className="text-text-main font-medium">{start}–{end}</span>{" "}
          of{" "}
          <span className="text-text-main font-medium">{totalItems}</span>
        </span>
        <span className="hidden sm:inline text-border-main">|</span>
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="text-2xs">Rows per page</span>
          {PageSizeDropdown}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
          disabled={currentPage === 1 || totalItems === 0}
          aria-label="Previous page"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted border border-border-main hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {buildPageWindows(currentPage, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-text-muted text-xs">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => handlePageChange(p)}
              className={cn(
                "w-7 h-7 rounded-lg text-xs transition-colors",
                currentPage === p
                  ? "bg-primary text-white dark:text-background font-medium"
                  : "text-text-muted border border-border-main hover:bg-surface-2"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
          disabled={currentPage === totalPages || totalItems === 0}
          aria-label="Next page"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted border border-border-main hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
