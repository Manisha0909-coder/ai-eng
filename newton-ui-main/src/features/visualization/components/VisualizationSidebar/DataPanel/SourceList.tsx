import React from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { DashboardLoader } from "@/components/ContentLoader";
import { cn } from "@/lib/utils";
import type { DataSourceListItem } from "@/hooks/useDataSources";

export function SourceList({
  leftPanelCollapsed,
  setLeftPanelCollapsed,
  searchQuery,
  setSearchQuery,
  dataSourcesLoading,
  dataSourcesError,
  dataSourcesList,
  visibleDataSourcesList,
  selectedSourceId,
  selectSource,
  handleSourceFocus,
  sourceListItemRefs,
  setVisibleSourcesCount,
  pageSize,
}: {
  leftPanelCollapsed: boolean;
  setLeftPanelCollapsed: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  dataSourcesLoading: boolean;
  dataSourcesError: string | null;
  dataSourcesList: DataSourceListItem[];
  visibleDataSourcesList: DataSourceListItem[];
  selectedSourceId: string | null;
  selectSource: (sourceId: string) => void;
  handleSourceFocus: (sourceId: string, index: number) => void;
  sourceListItemRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
  visibleSourcesCount: number;
  setVisibleSourcesCount: (updater: (prev: number) => number) => void;
  pageSize: number;
}) {
  return (
    <div
      className="scrollbar-themed"
      style={{
        width: leftPanelCollapsed ? 56 : 200,
        minWidth: leftPanelCollapsed ? 56 : 200,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        paddingRight: 4,
        borderRight: "1px solid rgb(var(--color-border))",
        transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexShrink: 0 }}>
        <button
          type="button"
          className="data-tab-nav-btn"
          onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
          aria-label={leftPanelCollapsed ? "Expand panel" : "Collapse panel"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 8,
            border: "1px solid rgb(var(--color-border))",
            background: "rgb(var(--color-surface))",
            color: "rgb(var(--color-text))",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {leftPanelCollapsed ? (
            <ChevronRight style={{ width: 16, height: 16 }} />
          ) : (
            <ChevronLeft style={{ width: 16, height: 16 }} />
          )}
        </button>
      </div>

      {!leftPanelCollapsed && (
        <div style={{ position: "relative", marginBottom: 8, flexShrink: 0 }}>
          <Search
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              width: 14,
              height: 14,
              color: "rgb(var(--color-text-muted))",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search sources…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px 8px 32px",
              borderRadius: 8,
              border: "1px solid rgb(var(--color-border))",
              background: "rgb(var(--color-background))",
              color: "rgb(var(--color-text))",
              fontSize: 13,
              outline: "none",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgb(var(--color-primary))";
              e.currentTarget.style.boxShadow = "0 0 0 1px rgb(var(--color-primary))";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgb(var(--color-border))";
              e.currentTarget.style.boxShadow = "none";
            }}
            aria-label="Search sources"
          />
        </div>
      )}

      {!leftPanelCollapsed &&
        (dataSourcesLoading ? (
          <div
            style={{
              fontSize: 13,
              color: "rgb(var(--color-text-muted))",
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <DashboardLoader size="xs" variant="inline" />
            <span>Loading sources...</span>
          </div>
        ) : dataSourcesError ? (
          <div style={{ fontSize: 13, color: "rgb(var(--color-error))", padding: 16 }}>
            {dataSourcesError}
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
            <div className="data-tab-section-label" style={{ marginBottom: 8 }}>
              {dataSourcesList.length} source{dataSourcesList.length !== 1 ? "s" : ""}
            </div>
            {visibleDataSourcesList.map((source, index) => {
              const isSelected = selectedSourceId === source.source_id;
              const setRef = (el: HTMLButtonElement | null) => {
                if (el) sourceListItemRefs.current.set(source.source_id, el);
                else sourceListItemRefs.current.delete(source.source_id);
              };
              return (
                <button
                  key={source.source_id}
                  ref={setRef}
                  type="button"
                  onClick={() => selectSource(source.source_id)}
                  onFocus={() => handleSourceFocus(source.source_id, index)}
                  className={cn(
                    "flex flex-col items-stretch gap-1.5 px-3 py-2.5 mb-1.5 rounded-lg border-0 w-full text-left cursor-pointer",
                    isSelected
                      ? "bg-primary text-white"
                      : "bg-transparent text-text-main"
                  )}
                  aria-selected={isSelected}
                >
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span className="font-medium text-xs leading-snug break-words">
                      {source.datasource_name}
                    </span>
                    {source.kind && (
                      <span
                        className={cn(
                          "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border",
                          isSelected
                            ? "border-white/40 text-white bg-white/12"
                            : "border-border-main text-text-muted bg-background"
                        )}
                      >
                        {source.kind}
                      </span>
                    )}
                  </div>
                  {source.description && (
                    <div
                      className={cn(
                        "text-[11px] leading-snug break-words",
                        isSelected ? "text-white/80" : "text-text-muted"
                      )}
                    >
                      {source.description}
                    </div>
                  )}
                </button>
              );
            })}
            {visibleDataSourcesList.length < dataSourcesList.length && (
              <button
                type="button"
                className={cn("data-tab-source-btn")}
                onClick={() =>
                  setVisibleSourcesCount((prev) => Math.min(prev + pageSize, dataSourcesList.length))
                }
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px dashed rgb(var(--color-border))",
                  background: "transparent",
                  color: "rgb(var(--color-text-muted))",
                  fontSize: 12,
                  cursor: "pointer",
                  marginTop: 8,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgb(var(--color-primary))";
                  e.currentTarget.style.color = "rgb(var(--color-text))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgb(var(--color-border))";
                  e.currentTarget.style.color = "rgb(var(--color-text-muted))";
                }}
              >
                Load more ({dataSourcesList.length - visibleDataSourcesList.length})
              </button>
            )}
          </div>
        ))}
    </div>
  );
}
