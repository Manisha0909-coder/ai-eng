import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlarmClock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Link,
  MessageCircle,
  Plug,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/env";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  fetchUserProfile,
  type UserProfile,
} from "@/services/user/userApi";
import { DocumentsTab } from "./tabs/DocumentsTab";
import { SharedLinksTab } from "./tabs/SharedLinksTab";
import { ConnectionsTab } from "./tabs/ConnectionsTab";
import { CommunicationsTab } from "./tabs/CommunicationsTab";
import { TasksTab } from "./tabs/TasksTab";
import { SecurityTab } from "./tabs/SecurityTab";

export type UserPanelTab =
  | "documents"
  | "shared-links"
  | "connections"
  | "communications"
  | "tasks"
  | "security";

interface UserPanelProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: UserPanelTab;
}

const NAV_ITEMS: {
  id: UserPanelTab;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "documents",
    label: "Documents",
    icon: <FileText size={15} aria-hidden />,
  },
  {
    id: "shared-links",
    label: "Shared Links",
    icon: <Link size={15} aria-hidden />,
  },
  {
    id: "connections",
    label: "Connections",
    icon: <Plug size={15} aria-hidden />,
  },
  {
    id: "communications",
    label: "Communications",
    icon: <MessageCircle size={15} aria-hidden />,
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: <AlarmClock size={15} aria-hidden />,
  },
  {
    id: "security",
    label: "Security",
    icon: <ShieldCheck size={15} aria-hidden />,
  },
];

const TAB_TITLES: Record<UserPanelTab, string> = {
  documents: "Documents",
  "shared-links": "Shared Links",
  connections: "Connections",
  communications: "Communications",
  tasks: "Tasks & Reminders",
  security: "Security",
};

function userInitials(profile: UserProfile | null) {
  if (!profile) return "?";
  const name = profile.full_name?.trim() || profile.email || "";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function UserPanel({ open, onClose, defaultTab = "documents" }: UserPanelProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<UserPanelTab>(defaultTab);
  // Mobile drill-down: null shows the section menu, a tab shows that section.
  const [mobileTab, setMobileTab] = useState<UserPanelTab | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Keep activeTab in sync when defaultTab prop changes (e.g., opened from "openSettings" event)
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      // Deep links (tasks chip, OAuth return) land straight in the section;
      // a generic open starts at the menu.
      setMobileTab(defaultTab === "documents" ? null : defaultTab);
    }
  }, [open, defaultTab]);

  // Fetch profile for sidebar chip
  useEffect(() => {
    if (!open) return;
    fetchUserProfile()
      .then(setProfile)
      .catch(() => {});
  }, [open]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const initials = userInitials(profile);

  const closeButton = (
    <button
      onClick={onClose}
      aria-label="Close"
      className={cn(
        "rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors",
        isMobile ? "w-9 h-9" : "w-7 h-7",
      )}
    >
      <X size={isMobile ? 17 : 14} />
    </button>
  );

  const tabContent = (tab: UserPanelTab) => (
    <>
      {tab === "documents" && <DocumentsTab isActive={tab === "documents"} />}
      {tab === "shared-links" && <SharedLinksTab isActive={tab === "shared-links"} />}
      {tab === "connections" && <ConnectionsTab isActive={tab === "connections"} />}
      {tab === "communications" && <CommunicationsTab isActive={tab === "communications"} />}
      {tab === "tasks" && <TasksTab isActive={tab === "tasks"} />}
      {tab === "security" && <SecurityTab isActive={tab === "security"} />}
    </>
  );

  const userChip = (
    <div className="flex items-center gap-2.5 min-w-0">
      {profile?.profile_picture ? (
        <img
          src={profile.profile_picture}
          alt="Profile"
          className="w-7 h-7 rounded-lg object-cover ring-1 ring-primary/20 shrink-0"
        />
      ) : (
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center font-display font-semibold text-xs text-primary shrink-0 ring-1 ring-primary/20">
          {initials}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-sm font-medium truncate text-text-main">
          {profile?.full_name || "—"}
        </div>
        <div className="text-xs text-text-muted truncate">
          {profile?.email || ""}
        </div>
      </div>
    </div>
  );

  // ── Mobile: bottom sheet with menu → section drill-down. Controls live in
  // a bottom action bar so they sit in the thumb zone. ─────────────────────
  if (isMobile) {
    return createPortal(
      <div
        className="fixed inset-x-0 top-0 z-[9000] h-[calc(var(--vh,1vh)*100)]"
        aria-modal="true"
        role="dialog"
        aria-label="User Panel"
      >
        {/* Backdrop — tap to close */}
        <div
          className="absolute inset-0 bg-black/50 animate-in fade-in-0 duration-200"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Bottom sheet: auto-height for the menu, tall for section content */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl border-t border-border-main bg-surface shadow-2xl",
            "animate-in slide-in-from-bottom duration-200",
            mobileTab !== null && "h-[calc(var(--vh,1vh)*88)]",
          )}
          style={{ maxHeight: "calc(var(--vh, 1vh) * 88)" }}
        >
          <div className="spectrum-rule shrink-0" />

          {/* Grab handle + title */}
          <div className="shrink-0 px-4 pb-2 pt-2.5">
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-border-main" />
            <h2 className="font-display text-base font-semibold truncate">
              {mobileTab === null ? "Account" : TAB_TITLES[mobileTab]}
            </h2>
          </div>

          {mobileTab === null ? (
            /* Section menu */
            <div className="min-h-0 flex-1 overflow-y-auto">
              <nav className="space-y-1 px-3 pb-2">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setMobileTab(item.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-text-main transition-colors hover:bg-surface-2 active:bg-surface-2"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {item.icon}
                    </span>
                    <span className="flex-1 font-medium">{item.label}</span>
                    <ChevronRight size={16} className="text-text-muted" aria-hidden />
                  </button>
                ))}
              </nav>

              <div className="border-t border-border-main p-4">
                {userChip}
                <div className="mt-2 text-xs text-text-muted font-mono select-none opacity-60">
                  v.{APP_VERSION}
                </div>
              </div>
            </div>
          ) : (
            /* Section content */
            <div className="flex min-h-0 flex-1 flex-col">
              {tabContent(mobileTab)}
            </div>
          )}

          {/* Bottom action bar — Back/Close in the thumb zone */}
          <div
            className="flex shrink-0 items-center gap-2 border-t border-border-main px-4 pt-2.5"
            style={{ paddingBottom: "max(0.625rem, var(--safe-bottom, 0px))" }}
          >
            {mobileTab !== null && (
              <button
                onClick={() => setMobileTab(null)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border-main bg-surface-2 py-2.5 text-sm font-medium text-text-main transition-colors hover:border-primary active:bg-surface"
              >
                <ChevronLeft size={16} aria-hidden /> Back
              </button>
            )}
            <button
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border-main bg-surface-2 py-2.5 text-sm font-medium text-text-main transition-colors hover:border-primary active:bg-surface"
            >
              <X size={15} aria-hidden /> Close
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ── Desktop: centered dialog with left sidebar nav ───────────────────────
  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleOverlayClick}
      aria-modal="true"
      role="dialog"
      aria-label="User Panel"
    >
      <div
        className="relative bg-surface border border-border-main rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ width: "min(672px, 96vw)", height: "min(580px, 90vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Spectrum gradient bar */}
        <div className="spectrum-rule shrink-0" />

        {/* Main row: left sidebar nav + content */}
        <div className="flex flex-row flex-1 min-h-0">
          <div className="flex flex-col border-r border-border-main bg-surface-2 shrink-0 w-[176px]">
            <nav className="flex flex-col flex-1 space-y-0.5 p-2 pt-3">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left transition-colors whitespace-nowrap",
                    activeTab === item.id
                      ? "bg-surface text-text-main font-medium shadow-sm"
                      : "text-text-muted hover:bg-surface/60 hover:text-text-main",
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Version */}
            <div className="px-3 pb-1 text-right">
              <span className="text-xs text-text-muted font-mono select-none opacity-60">
                v.{APP_VERSION}
              </span>
            </div>

            {/* User chip */}
            <div className="border-t border-border-main p-3">{userChip}</div>
          </div>

          {/* Right panel */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3.5 border-b border-border-main shrink-0">
              <h2 className="font-display font-semibold text-base">
                {TAB_TITLES[activeTab]}
              </h2>
              {closeButton}
            </div>

            {/* Tab content */}
            {tabContent(activeTab)}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
