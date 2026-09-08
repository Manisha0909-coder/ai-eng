import { ChevronLeft, ChevronRight } from "lucide-react";

import { DashboardLoader } from "@/components/ContentLoader";
import { cn } from "@/lib/utils";

export function TablesList({
  exploreTablesCount,
  exploreLoading,
  exploreError,
  visibleTableNames,
  selectedTableName,
  tablesListPage,
  tablesListTotalPages,
  tablesListStart,
  tablesListEnd,
  onSelectTable,
  onPrevPage,
  onNextPage,
}: {
  exploreTablesCount: number;
  exploreLoading: boolean;
  exploreError: string | null;
  visibleTableNames: string[];
  selectedTableName: string | null;
  tablesListPage: number;
  tablesListTotalPages: number;
  tablesListStart: number;
  tablesListEnd: number;
  onSelectTable: (tableName: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid rgb(var(--color-border))",
        background: "rgb(var(--color-background))",
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 12, color: "rgb(var(--color-text-muted))", fontWeight: 600 }}>
        Tables ({exploreTablesCount})
      </span>

      {exploreLoading ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontSize: 12,
            color: "rgb(var(--color-text-muted))",
            minHeight: 120,
            width: "100%",
          }}
        >
          <DashboardLoader size="xs" variant="inline" />
          <span>Loading tables…</span>
        </div>
      ) : exploreError ? (
        <div style={{ fontSize: 12, color: "rgb(var(--color-error))" }}>{exploreError}</div>
      ) : exploreTablesCount === 0 ? (
        <div style={{ fontSize: 12, color: "rgb(var(--color-text-muted))" }}>No tables found</div>
      ) : (
        <>
          <div
            className="scrollbar-themed"
            style={{
              borderRadius: 8,
              border: "1px solid rgb(var(--color-border))",
              overflow: "auto",
              flex: 1,
              minHeight: 0,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead >
                <tr style={{ background: "rgb(var(--color-surface))" }}>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 10px",
                      borderBottom: "1px solid rgb(var(--color-border))",
                      color: "rgb(var(--color-text-muted))",
                      fontWeight: 600,
                      width: 40,
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "6px 10px",
                      borderBottom: "1px solid rgb(var(--color-border))",
                      color: "rgb(var(--color-text-muted))",
                      fontWeight: 600,
                    }}
                  >
                    Table
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleTableNames.map((name, i) => {
                  const globalIndex = (tablesListPage - 1) * 30 + i + 1;
                  const isTableSelected = selectedTableName === name;
                  return (
                    <tr
                      key={`tbl-${name}`}
                      className={cn(
                        "border-b border-border-main transition-colors duration-150",
                        isTableSelected
                          ? "bg-primary text-white ring-1 ring-inset ring-white/12"
                          : "hover:bg-primary/10"
                      )}
                    >
                      <td
                        className={cn(
                          "px-2.5 py-2 text-xs tabular-nums align-middle",
                          isTableSelected ? "text-white/85" : "text-text-muted"
                        )}
                      >
                        {globalIndex}
                      </td>
                      <td className="p-0 align-middle">
                        <button
                          type="button"
                          aria-label={
                            isTableSelected
                              ? `${name} (selected). Open schema and preview.`
                              : `Open table ${name}`
                          }
                          onClick={() => onSelectTable(name)}
                          className={cn(
                            "group w-full min-w-0 text-left px-2.5 py-2 text-xs border-0 bg-transparent cursor-pointer",
                            "overflow-hidden text-ellipsis whitespace-nowrap rounded-md transition-colors duration-150",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            isTableSelected
                              ? "text-white font-medium"
                              : "text-text-main underline-offset-2 decoration-primary/55 hover:text-primary hover:underline hover:decoration-primary"
                          )}
                          title={name}
                        >
                          {name}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {exploreTablesCount > 30 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
                fontSize: 11,
                color: "rgb(var(--color-text-muted))",
                flexShrink: 0,
              }}
            >
              <span>
                {tablesListStart}–{tablesListEnd} of {exploreTablesCount}
              </span>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  onClick={onPrevPage}
                  disabled={tablesListPage <= 1}
                  aria-label="Previous tables page"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    border: "1px solid rgb(var(--color-border))",
                    borderRadius: 6,
                    background: "rgb(var(--color-surface))",
                    color: "rgb(var(--color-text))",
                    cursor: tablesListPage <= 1 ? "not-allowed" : "pointer",
                    opacity: tablesListPage <= 1 ? 0.4 : 1,
                  }}
                >
                  <ChevronLeft style={{ width: 14, height: 14 }} />
                </button>
                <span style={{ minWidth: 56, textAlign: "center", fontWeight: 500 }}>
                  {tablesListPage} / {tablesListTotalPages}
                </span>
                <button
                  type="button"
                  onClick={onNextPage}
                  disabled={tablesListPage >= tablesListTotalPages}
                  aria-label="Next tables page"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    border: "1px solid rgb(var(--color-border))",
                    borderRadius: 6,
                    background: "rgb(var(--color-surface))",
                    color: "rgb(var(--color-text))",
                    cursor: tablesListPage >= tablesListTotalPages ? "not-allowed" : "pointer",
                    opacity: tablesListPage >= tablesListTotalPages ? 0.4 : 1,
                  }}
                >
                  <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
