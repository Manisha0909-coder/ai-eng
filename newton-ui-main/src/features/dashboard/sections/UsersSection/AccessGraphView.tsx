/**
 * Access Graph drawer view.
 *
 * Renders a user's access hierarchy as a dark, step-wise expandable tree:
 *   USER → ROLE → PERSONA → DOC TAG / TOOL TAG → TOOL
 *
 * The tree, header identity and the "{user} can reach …" summary are wired to
 * real RBAC data. Tabs (Profile/Activity/Audit), the status/MFA chrome and the
 * inline "+ …" affordances are intentionally presentational for this pass;
 * "Add role" hooks into the existing user form.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  X,
  Plus,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { UserAvatar } from "../../components/UserAvatar";
import { cn } from "@/lib/utils";
import { SheetClose, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  buildAccessTree,
  computeAccessSummary,
  computeAccessGroups,
  collectExpandableKeys,
  defaultExpandedKeys,
  type AccessNode,
  type AccessNodeType,
  type AccessGroups,
} from "./accessTree";

/* ---------------------------------------------------------------------------
 *  Per-node-type visual language (colour accent + glyph dot + label).
 * ------------------------------------------------------------------------- */
interface NodeStyle {
  label: string;
  badge: string;
  dot: string;
  mono: boolean;
}
// Theme-safe palette: light-tinted chip + mid-tone dot + dark label, readable on
// both dashboard themes. This app switches theme via CSS variables (not a
// `.dark` class), so `dark:` variants do not apply — node names use
// `var(--color-text)` so they flip with the theme.
const NODE_STYLE: Record<AccessNodeType, NodeStyle> = {
  root: {
    label: "USER",
    badge: "bg-surface-2 text-text-muted border-border-main",
    dot: "bg-text-muted",
    mono: false,
  },
  role: {
    label: "ROLE",
    badge:
      "bg-entity-role/[var(--pill-bg-alpha)] text-entity-role border-entity-role/[var(--pill-border-alpha)]",
    dot: "bg-entity-role",
    mono: true,
  },
  persona: {
    label: "PERSONA",
    badge:
      "bg-entity-persona/[var(--pill-bg-alpha)] text-entity-persona border-entity-persona/[var(--pill-border-alpha)]",
    dot: "bg-entity-persona",
    mono: false,
  },
  tool_tag: {
    label: "TOOL TAG",
    badge:
      "bg-entity-tool-tag/[var(--pill-bg-alpha)] text-entity-tool-tag border-entity-tool-tag/[var(--pill-border-alpha)]",
    dot: "bg-entity-tool-tag",
    mono: true,
  },
  doc_tag: {
    label: "DOC TAG",
    badge:
      "bg-entity-doc-tag/[var(--pill-bg-alpha)] text-entity-doc-tag border-entity-doc-tag/[var(--pill-border-alpha)]",
    dot: "bg-entity-doc-tag",
    mono: true,
  },
  tool: {
    label: "TOOL",
    badge: "bg-surface border-border-main text-text-muted",
    dot: "bg-text-muted",
    mono: true,
  },
};

/* ---------------------------------------------------------------------------
 *  Identity helpers (mirror the lightweight ones used elsewhere in Users).
 * ------------------------------------------------------------------------- */
function getInitials(value: string): string {
  const base = (value || "").split("@")[0];
  const parts = base.split(/[.\s_-]+/).filter(Boolean);
  const letters =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return (letters || "?").toUpperCase();
}

/* ---------------------------------------------------------------------------
 *  Small presentational atoms.
 * ------------------------------------------------------------------------- */
const Pill = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center gap-1 rounded border border-border-main bg-surface/60 px-1.5 py-px text-2xs font-medium text-text-muted",
      className
    )}
  >
    {children}
  </span>
);

const TypeBadge = ({ type }: { type: AccessNodeType }) => {
  const s = NODE_STYLE[type];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide",
        s.badge
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
};

/** Dashed "+ …" affordance. Wired when `onClick` is given, else a placeholder. */
const AddAction = ({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={onClick ? label : "Coming soon"}
    className={cn(
      "mt-0.5 ml-2 inline-flex items-center gap-1 rounded-md border border-dashed border-border-main px-2 py-1 text-[11px] text-text-muted transition-colors hover:border-primary/60 hover:text-text-main",
      !onClick && "opacity-70"
    )}
  >
    <Plus className="h-3 w-3" />
    {label}
  </button>
);

/* ---------------------------------------------------------------------------
 *  Recursive tree row.
 * ------------------------------------------------------------------------- */
const supportsActions = (type: AccessNodeType) =>
  type === "role" || type === "persona";

interface TreeRowProps {
  node: AccessNode;
  expanded: Set<string>;
  onToggle: (key: string) => void;
}

const TreeRow = ({ node, expanded, onToggle }: TreeRowProps) => {
  const s = NODE_STYLE[node.type];
  const hasChildren = node.children.length > 0;
  const canExpand = hasChildren || supportsActions(node.type);
  const isOpen = expanded.has(node.key);

  return (
    <div className="relative">
      <div
        role="treeitem"
        aria-expanded={canExpand ? isOpen : undefined}
        tabIndex={0}
        onClick={() => canExpand && onToggle(node.key)}
        onKeyDown={(e) => {
          if (canExpand && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onToggle(node.key);
          }
        }}
        className={cn(
          "group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
          canExpand
            ? "cursor-pointer hover:bg-surface/50"
            : "hover:bg-surface/30"
        )}
      >
        {canExpand ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-text-muted transition-transform",
              isOpen && "rotate-90"
            )}
          />
        ) : (
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
            <span className="h-1 w-1 rounded-full bg-text-muted/60" />
          </span>
        )}

        <TypeBadge type={node.type} />

        <span
          className={cn(
            "shrink-0 max-w-[40%] truncate text-[13px] font-medium text-text-main",
            s.mono && "font-mono"
          )}
        >
          {node.name}
        </span>

        {node.version && <Pill>{node.version}</Pill>}
        {node.model && (
          <span className="shrink-0 font-mono text-[11px] text-text-muted">
            {node.model}
          </span>
        )}

        {(node.desc || node.meta) && (
          <span className="truncate text-[11px] text-text-muted">
            {node.grantedByRole && (
              <span className="text-text-muted/80">
                granted by role ·{" "}
              </span>
            )}
            {node.desc && <span>{node.desc}</span>}
            {node.desc && node.meta && (
              <span className="opacity-50"> · </span>
            )}
            {node.meta && <span className="opacity-80">{node.meta}</span>}
          </span>
        )}

        {node.pathCount != null && node.pathCount > 1 && (
          <Pill className="ml-auto border-emerald-300 text-emerald-700">
            × {node.pathCount} paths
          </Pill>
        )}
      </div>

      {canExpand && isOpen && (
        <div className="ml-[15px] border-l border-border-main/70 pl-2">
          {node.children.map((child) => (
            <TreeRow
              key={child.key}
              node={child}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
          {node.type === "role" && (
            <div className="flex flex-wrap">
              <AddAction label="New persona for this role" />
              <AddAction label="Doc tag" />
            </div>
          )}
          {node.type === "persona" && (
            <AddAction label="Attach tag to persona" />
          )}
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------------------
 *  Summary view — the tree flattened into type-grouped cards.
 * ------------------------------------------------------------------------- */
const SUMMARY_GROUPS: ReadonlyArray<{
  key: keyof AccessGroups;
  type: AccessNodeType;
  label: string;
}> = [
  { key: "roles", type: "role", label: "Roles" },
  { key: "personas", type: "persona", label: "Personas" },
  { key: "docTags", type: "doc_tag", label: "Doc tags" },
  { key: "toolTags", type: "tool_tag", label: "Tool tags" },
  { key: "tools", type: "tool", label: "Tools" },
];

const SummaryView = ({ groups }: { groups: AccessGroups }) => (
  <div className="space-y-6">
    {SUMMARY_GROUPS.map(({ key, type, label }) => {
      const items = groups[key];
      if (items.length === 0) return null;
      return (
        <section key={key}>
          <div className="mb-2 flex items-center gap-2">
            <TypeBadge type={type} />
            <h3 className="text-sm font-semibold text-text-main">
              {label}
            </h3>
            <span className="text-xs text-text-muted">
              {items.length}
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
            {items.map((item) => (
              <div
                key={item.key}
                className="rounded-lg border border-border-main bg-surface/40 px-3 py-2.5"
              >
                <div
                  className={cn(
                    "truncate text-[13px] font-medium text-text-main",
                    item.mono && "font-mono"
                  )}
                  title={item.name}
                >
                  {item.name}
                </div>
                {item.meta && (
                  <div className="mt-0.5 truncate text-[11px] text-text-muted">
                    {item.meta}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      );
    })}
  </div>
);

/* ---------------------------------------------------------------------------
 *  View modes.
 * ------------------------------------------------------------------------- */
const VIEW_MODES = ["Tree", "Summary"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

export interface AccessGraphViewProps {
  /** Row identity (renders the header immediately). */
  user: { user_id: string; updated_at?: string };
  /** Full nested user for the tree; falls back to `user` when absent. */
  treeUser: any | null;
  isAdmin: boolean;
  /** True while the nested detail is still loading. */
  loading?: boolean;
  onAddRole: () => void;
}

export const AccessGraphView = ({
  user,
  treeUser,
  isAdmin,
  loading = false,
  onAddRole,
}: AccessGraphViewProps) => {
  const root = useMemo(
    () => buildAccessTree(treeUser ?? user),
    [treeUser, user]
  );
  const summary = useMemo(() => computeAccessSummary(root), [root]);
  const groups = useMemo(() => computeAccessGroups(root), [root]);

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(defaultExpandedKeys(root))
  );
  const [viewMode, setViewMode] = useState<ViewMode>("Tree");

  // `root` is rebuilt when the nested detail arrives (or the user changes);
  // re-open the default first chain so it matches the reference's initial look.
  useEffect(() => {
    setExpanded(new Set(defaultExpandedKeys(root)));
  }, [root]);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const expandAll = () => setExpanded(new Set(collectExpandableKeys(root)));
  const collapseAll = () => setExpanded(new Set([root.key]));

  const email = user.user_id.includes("@") ? user.user_id : null;

  return (
    <div className="flex h-full flex-col bg-background text-text-main">
      {/* a11y title/description for the underlying dialog */}
      <SheetTitle className="sr-only">
        Access graph for {email}
      </SheetTitle>
      <SheetDescription className="sr-only">
        Role, persona, tag and tool access hierarchy for {user.user_id}
      </SheetDescription>

      {/* ---------- Header ---------- */}
      <div className="flex-shrink-0 border-b border-border-main px-5 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          {/* identity */}
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar label={user.user_id} size="md" />
            <div className="min-w-0">
              {email && (
                <div className="truncate text-sm font-medium text-text-main">
                  {email}
                </div>
              )}
            </div>
          </div>
          {/* actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            <SheetClose className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>
        </div>
      </div>

      {/* ---------- Section label ---------- */}
      <div className="flex flex-shrink-0 items-center border-b border-border-main px-5">
        <div className="relative flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium text-text-main">
          Access graph
          <span className="rounded bg-surface px-1 py-px text-2xs text-text-muted">
            {summary.roles}r
          </span>
          <span className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-full bg-primary" />
        </div>
      </div>

      {/* ---------- Summary + controls ---------- */}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-main px-5 py-3">
        <p className="text-xs text-text-muted">
          <span className="font-semibold text-text-main">
            {email}
          </span>{" "}
          can reach{" "}
          <span className="font-semibold text-text-main">
            {summary.tools} tools
          </span>{" "}
          via <span className="text-text-main">{summary.roles} role</span>{" "}
          <span className="opacity-50">→</span>{" "}
          <span className="text-text-main">
            {summary.personas} personas
          </span>{" "}
          <span className="opacity-50">→</span>{" "}
          <span className="text-text-main">
            {summary.docTags} doc tags
          </span>{" "}
          · <span className="text-text-main">{summary.toolTags} tool tags</span>
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border-main bg-surface/50 p-0.5">
            {VIEW_MODES.map((mode) => {
              const isActive = mode === viewMode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "rounded px-2 py-1 text-[11px] font-medium transition-colors",
                    isActive
                      ? "bg-background text-text-main shadow-sm"
                      : "text-text-muted hover:text-text-main"
                  )}
                >
                  {mode}
                </button>
              );
            })}
          </div>
          {viewMode === "Tree" && (
            <>
              <button
                type="button"
                onClick={expandAll}
                className="text-[11px] text-text-muted transition-colors hover:text-text-main"
              >
                Expand all
              </button>
              <span className="text-border-main">·</span>
              <button
                type="button"
                onClick={collapseAll}
                className="text-[11px] text-text-muted transition-colors hover:text-text-main"
              >
                Collapse all
              </button>
            </>
          )}
        </div>
      </div>

      {/* ---------- Body (tree / summary) ---------- */}
      <div
        className="scrollbar-themed min-h-0 flex-1 overflow-y-auto px-4 py-4"
        role={viewMode === "Tree" ? "tree" : undefined}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading access graph…
          </div>
        ) : viewMode === "Summary" ? (
          <SummaryView groups={groups} />
        ) : (
          <>
            {/* Root (user) row — always expanded. */}
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-teal-500" />
              <TypeBadge type="root" />
              <span className="truncate text-[13px] font-semibold text-text-main">
                {email}
              </span>
              <span className="ml-auto shrink-0 text-[11px] text-text-muted">
                can access {summary.tools} tools via {summary.roles} role
                {summary.roles === 1 ? "" : "s"}
              </span>
            </div>

            <div className="ml-[15px] border-l border-border-main/70 pl-2">
              {root.children.length === 0 ? (
                <p className="px-2 py-3 text-xs text-text-muted">
                  No roles assigned to this user.
                </p>
              ) : (
                root.children.map((roleNode) => (
                  <TreeRow
                    key={roleNode.key}
                    node={roleNode}
                    expanded={expanded}
                    onToggle={toggle}
                  />
                ))
              )}
              <AddAction
                label={`Add role to ${email}`}
                onClick={isAdmin ? onAddRole : undefined}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
