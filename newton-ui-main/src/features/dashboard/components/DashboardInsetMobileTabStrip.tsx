import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Database,
  FileText,
  LayoutDashboard,
  MailPlus,
  MessageSquare,
  Palette,
  Plug,
  Server,
  Shield,
  Tags as TagsIcon,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { IoPersonAddOutline, IoPricetagOutline } from "react-icons/io5";

type Props = {
  activeTab: string;
  onTabChange: (value: string) => void;
  canAccessTab: (tabName: string) => boolean;
  isSystemAdmin: boolean;
  isUserAdmin: boolean;
  isSuperAdmin: boolean;
  className?: string;
};

/**
 * Mobile section nav for the admin dashboard: a back-to-chat button plus a
 * dropdown section picker, rendered as a bottom bar so both controls sit in
 * the thumb zone. Replaces the old horizontally-scrolling top tab strip,
 * which hid most sections off-screen and offered no way back to the chat.
 */
export function DashboardInsetMobileTabStrip({
  activeTab,
  onTabChange,
  canAccessTab,
  isSystemAdmin,
  isUserAdmin,
  isSuperAdmin,
  className,
}: Props) {
  const navigate = useNavigate();

  const systemAdmin = isSystemAdmin || isSuperAdmin;
  const userAdmin = isUserAdmin || isSuperAdmin;
  const iconProps = { size: 15, strokeWidth: 1.5, "aria-hidden": true } as const;

  const sections: {
    value: string;
    label: string;
    icon: React.ReactNode;
    show: boolean;
  }[] = [
    {
      value: "overview",
      label: "Overview",
      icon: <LayoutDashboard {...iconProps} />,
      show: canAccessTab("overview"),
    },
    {
      value: "tools",
      label: "Tools",
      icon: <Wrench {...iconProps} />,
      show: systemAdmin && canAccessTab("tools"),
    },
    {
      value: "tags",
      label: "Tags",
      icon: <TagsIcon {...iconProps} />,
      show: systemAdmin && canAccessTab("tags"),
    },
    {
      value: "data-sources",
      label: "Data sources",
      icon: <Database {...iconProps} />,
      show: systemAdmin && canAccessTab("data-sources"),
    },
    {
      value: "tool-servers",
      label: "Tool servers",
      icon: <Server {...iconProps} />,
      show: systemAdmin && canAccessTab("tool-servers"),
    },
    {
      value: "documents",
      label: "Documents",
      icon: <FileText {...iconProps} />,
      show: systemAdmin && canAccessTab("documents"),
    },
    {
      value: "doc-tags",
      label: "Document tags",
      icon: <IoPricetagOutline size={15} style={{ strokeWidth: 1.5 }} aria-hidden />,
      show: systemAdmin && canAccessTab("doc-tags"),
    },
    {
      value: "roles",
      label: "Roles",
      icon: <UserCheck {...iconProps} />,
      show: userAdmin && canAccessTab("roles"),
    },
    {
      value: "personas",
      label: "Personas",
      icon: <IoPersonAddOutline size={15} style={{ strokeWidth: 1.5 }} aria-hidden />,
      show: userAdmin && canAccessTab("personas"),
    },
    {
      value: "shared-memory",
      label: "Shared memory",
      icon: <Database {...iconProps} />,
      show: userAdmin && canAccessTab("shared-memory"),
    },
    {
      value: "users",
      label: "Users",
      icon: <Users {...iconProps} />,
      show: userAdmin && canAccessTab("users"),
    },
    {
      value: "invitations",
      label: "Invitations",
      icon: <MailPlus {...iconProps} />,
      show: userAdmin && canAccessTab("invitations"),
    },
    {
      value: "providers",
      label: "Providers",
      icon: <Plug {...iconProps} />,
      show: canAccessTab("providers"),
    },
    {
      value: "feedback",
      label: "Feedback",
      icon: <MessageSquare {...iconProps} />,
      show: canAccessTab("feedback"),
    },
    {
      value: "admin",
      label: "Admin",
      icon: <Shield {...iconProps} />,
      show: canAccessTab("admin"),
    },
    {
      value: "theme-editor",
      label: "Theme editor",
      icon: <Palette {...iconProps} />,
      show: isSuperAdmin && canAccessTab("theme-editor"),
    },
  ].filter((s) => s.show);

  const current = sections.find((s) => s.value === activeTab);

  return (
    <div className={cn("m-0 w-full", className)}>
      <div
        className="flex items-center gap-1.5 px-3 pt-2"
        style={{ paddingBottom: "max(0.5rem, var(--safe-bottom, 0px))" }}
      >
        {/* Back to chat */}
        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="Back to chat"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-main transition-colors hover:bg-surface-2 active:bg-surface-2"
        >
          <ArrowLeft size={19} strokeWidth={1.75} />
        </button>

        {/* Section picker */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-main/70 bg-surface-2/60 px-3 py-2 text-sm text-text-main transition-colors hover:border-primary"
            >
              <span className="shrink-0 text-text-muted">{current?.icon}</span>
              <span className="truncate font-medium">
                {current?.label ?? "Choose section"}
              </span>
              <ChevronDown size={15} className="ml-auto shrink-0 opacity-60" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            sideOffset={6}
            className="z-[100] max-h-[60vh] min-w-[220px] overflow-y-auto rounded-xl bg-surface/85 shadow-dialog backdrop-blur-md"
          >
            {sections.map((s) => (
              <DropdownMenuItem
                key={s.value}
                onClick={() => onTabChange(s.value)}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm focus:bg-surface-2"
                style={{
                  background:
                    activeTab === s.value
                      ? "rgb(var(--color-primary) / 0.08)"
                      : undefined,
                }}
              >
                <span className="shrink-0 text-text-muted">{s.icon}</span>
                <span className="flex-1 truncate">{s.label}</span>
                {activeTab === s.value && (
                  <Check size={14} className="shrink-0 text-primary" aria-hidden />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
