import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import type React from "react";
import { NewtonLockup } from "@/components/branding/NewtonLogo";
import {
  Database,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  MailPlus,
  MessageCircle,
  MessageSquare,
  MessageSquareText,
  Moon,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Server,
  Shield,
  Sun,
  Tags as TagsIcon,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";
import { IoPersonAddOutline, IoPricetagOutline } from "react-icons/io5";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { checkActiveTheme } from "@/env";
import { VITE_API_BASE_URL } from "@/env";
import { useStore } from "@/store/useStore";
import { clearSessionStorage } from "@/utils/helper";
import { flushClientSessionBeforeBffLogout } from "@/utils/logoutClientCleanup";
import {
  COLOR_SCHEME_CHANGED,
  isDarkMode,
  toggleDarkMode,
} from "@/utils/theme";

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  canAccessTab: (tab: string) => boolean;
  isSystemAdmin: boolean;
  isUserAdmin: boolean;
  isSuperAdmin: boolean;
}

const ICON_SIZE = 14;

export function AdminSidebar({
  activeTab,
  setActiveTab,
  canAccessTab,
  isSystemAdmin,
  isUserAdmin,
  isSuperAdmin,
}: AdminSidebarProps) {
  const navigate = useNavigate();
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  const [collapsed, setCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDark, setIsDark] = useState(() => isDarkMode());

  useEffect(() => {
    const handler = () => setIsDark(isDarkMode());
    window.addEventListener(COLOR_SCHEME_CHANGED, handler);
    return () => window.removeEventListener(COLOR_SCHEME_CHANGED, handler);
  }, []);

  const handleToggleTheme = useCallback(() => {
    try {
      toggleDarkMode();
      setIsDark(isDarkMode());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    flushSync(() => setIsLoggingOut(true));
    try {
      window.sessionStorage.setItem("logout_in_progress", "true");
    } catch {
      // ignore storage errors
    }

    const returnBase =
      typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
    const redirectUri = new URL("/login", returnBase).toString();
    const authBase = (VITE_API_BASE_URL || "").replace(/\/$/, "");

    try {
      if (typeof window !== "undefined" && authBase) {
        const url = new URL(`${authBase}/auth/logout`);
        url.searchParams.set("redirect_uri", redirectUri);
        try {
          await flushClientSessionBeforeBffLogout();
        } catch (e) {
          console.error("Local session cleanup before BFF logout failed:", e);
        }
        window.location.replace(url.toString());
        return;
      }
    } catch (error) {
      console.error("Failed to build upstream logout URL, falling back:", error);
    }

    try {
      await flushClientSessionBeforeBffLogout();
    } catch (e) {
      console.error("Local session cleanup (fallback logout) failed:", e);
    }
    clearSessionStorage();
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  };

  const navItem = (tab: string, icon: React.ReactNode, label: string) => {
    if (!canAccessTab(tab)) return null;
    const isActive = activeTab === tab;

    const btn = (
      <button
        key={tab}
        onClick={() => setActiveTab(tab)}
        className={cn(
          "flex w-full items-center rounded-lg py-2 text-sm transition-colors",
          collapsed ? "justify-center px-2" : "gap-2.5 px-3",
          isActive
            ? "border border-primary/20 bg-primary/10 font-medium text-primary"
            : "text-text-muted hover:bg-surface-2 hover:text-text-main",
        )}
      >
        {icon}
        {!collapsed && label}
      </button>
    );

    if (!collapsed) return btn;

    return (
      <Tooltip key={tab} delayDuration={0}>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };

  const groupHeader = (label: string) =>
    !collapsed ? (
      <div className="pt-3 pb-1 px-3">
        <span className="text-2xs font-mono uppercase tracking-[0.1em] text-text-muted">
          {label}
        </span>
      </div>
    ) : (
      <div className="my-1.5 mx-2 border-t border-border-main/40" />
    );

  const iconBtn = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    disabled = false,
  ) => (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side={collapsed ? "right" : "top"} className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );

  const showTools = isSystemAdmin || isSuperAdmin;
  const showAccess = isUserAdmin || isSuperAdmin;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col border-r border-border-main/60 bg-surface transition-[width] duration-200",
        collapsed ? "w-12" : "w-52",
      )}
    >
      {/* Sticky header: Newton wordmark + collapse toggle.
          Same height/padding as the chat sidebar header so the logo sits
          identically across pages. */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-border-main/60 px-2.5 py-2.5",
          collapsed && "justify-center px-0",
        )}
      >
        {!collapsed && (
          <div className="flex flex-1 items-center overflow-hidden">
            <NewtonLockup size={38} />
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-main transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen size={17} strokeWidth={1.75} />
          ) : (
            <PanelLeftClose size={17} strokeWidth={1.75} />
          )}
        </button>
      </div>

      {/* Scrollable nav items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-border-main [&::-webkit-scrollbar-track]:bg-transparent">
        {navItem(
          "overview",
          <LayoutDashboard size={ICON_SIZE} strokeWidth={1.75} />,
          "Overview",
        )}

        {showTools && (
          <>
            {groupHeader("Tools & Servers")}
            {navItem("tools", <Wrench size={ICON_SIZE} strokeWidth={1.75} />, "Tools")}
            {navItem("tags", <TagsIcon size={ICON_SIZE} strokeWidth={1.75} />, "Tool Tags")}
            {navItem("data-sources", <Database size={ICON_SIZE} strokeWidth={1.75} />, "Data Sources")}
            {navItem("tool-servers", <Server size={ICON_SIZE} strokeWidth={1.75} />, "Servers")}

            {groupHeader("Documents")}
            {navItem("documents", <FileText size={ICON_SIZE} strokeWidth={1.75} />, "Docs")}
            {navItem("doc-tags", <IoPricetagOutline size={ICON_SIZE} />, "Doc Tags")}
          </>
        )}

        {showAccess && (
          <>
            {groupHeader("Access")}
            {navItem("roles", <UserCheck size={ICON_SIZE} strokeWidth={1.75} />, "Roles")}
            {navItem("personas", <IoPersonAddOutline size={ICON_SIZE} />, "Personas")}
            {navItem("shared-memory", <Database size={ICON_SIZE} strokeWidth={1.75} />, "Shared Memory")}
            {navItem("users", <Users size={ICON_SIZE} strokeWidth={1.75} />, "Users")}
            {navItem("invitations", <MailPlus size={ICON_SIZE} strokeWidth={1.75} />, "Invitations")}
          </>
        )}

        {groupHeader("Other")}
        {navItem("providers", <Plug size={ICON_SIZE} strokeWidth={1.75} />, "Provider")}
        {navItem("communications", <MessageCircle size={ICON_SIZE} strokeWidth={1.75} />, "Communications")}
        {navItem("feedback", <MessageSquare size={ICON_SIZE} strokeWidth={1.75} />, "Feedback")}
        {navItem("admin", <Shield size={ICON_SIZE} strokeWidth={1.75} />, "Admin")}
        {isSuperAdmin && navItem("theme-editor", <Palette size={ICON_SIZE} strokeWidth={1.75} />, "Theme Editor")}
      </nav>

      {/* Pinned footer: actions */}
      <div
        className={cn(
          "shrink-0 border-t border-border-main/40 px-2 py-2",
          collapsed
            ? "flex flex-col items-center gap-0.5"
            : "flex items-center gap-1",
        )}
      >
        {collapsed ? (
          <>
            {iconBtn("Go to chat", <MessageSquareText size={17} strokeWidth={1.75} />, () => navigate("/"))}
            {checkActiveTheme("Gemini") &&
              iconBtn(
                isDark ? "Switch to light mode" : "Switch to dark mode",
                isDark ? <Moon size={17} strokeWidth={1.75} /> : <Sun size={17} strokeWidth={1.75} />,
                handleToggleTheme,
              )}
            {(isAuthenticated || isLoggingOut) &&
              iconBtn(
                "Logout",
                isLoggingOut
                  ? <Loader2 size={17} className="animate-spin" />
                  : <LogOut size={17} strokeWidth={1.75} />,
                handleLogout,
                isLoggingOut,
              )}
          </>
        ) : (
          <>
            {iconBtn("Go to chat", <MessageSquareText size={17} strokeWidth={1.75} />, () => navigate("/"))}
            {checkActiveTheme("Gemini") &&
              iconBtn(
                isDark ? "Switch to light mode" : "Switch to dark mode",
                isDark ? <Moon size={17} strokeWidth={1.75} /> : <Sun size={17} strokeWidth={1.75} />,
                handleToggleTheme,
              )}
            {(isAuthenticated || isLoggingOut) &&
              iconBtn(
                "Logout",
                isLoggingOut
                  ? <Loader2 size={17} className="animate-spin" />
                  : <LogOut size={17} strokeWidth={1.75} />,
                handleLogout,
                isLoggingOut,
              )}
          </>
        )}
      </div>
    </div>
  );
}
