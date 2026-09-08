import React, { useState, useEffect, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { useIsMobile } from "@/hooks/use-mobile";
import axios from "axios";
import { API_CONFIG } from "@/config/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminSidebar } from "./components/AdminSidebar";
import { IoPersonAddOutline, IoPricetagOutline } from "react-icons/io5";
import {
  rbacApi,
  type ListRolesRequest,
  Tool,
  Tag,
  Role,
  User,
  DocumentTag,
  CreateTagRequest,
  UpdateTagRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
  CreateUserRequest,
  UpdateUserRequest,
  CreateDocumentTagRequest,
  UpdateDocumentTagRequest,
  PersonaMemoryBlock,
  CreatePersonaMemoryBlockRequest,
  UpdatePersonaMemoryBlockRequest,
  Persona,
} from "@/services/rbac/rbacApi";
import { personasApi } from "@/services/rbac/services/personasService";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { DASHBOARD_SEARCH_DEBOUNCE_MS } from "./utils/dashboardSearchDebounceMs";
import notify, { extractErrorMessage } from "@/utils/notify";
import { TagForm } from "./components/Forms/TagForm";
import { RoleForm } from "./components/Forms/RoleForm";
import { UserForm } from "./components/Forms/UserForm";
import { DocumentTagForm } from "./components/Forms/DocumentTagForm";
import { PersonaWizardModal } from "./components/PersonaWizard/PersonaWizardModal";
import { DeleteConfirmationModal } from "./components/DeleteConfirmationModal";
import { InstallationGuideModal } from "./components/Modals/GuideModal";
import { ToolsSection } from "./sections/ToolsSection";
import { DataSourcesSection } from "./sections/DataSourcesSection";
import { TagsSection } from "./sections/TagsSection";
import { RolesSection } from "./sections/RolesSection";
import { UsersSection } from "./sections/UsersSection";
import { DocumentTagsSection } from "./sections/DocumentTagsSection";
import { FeedbackSection } from "./sections/FeedbackSection";
import { ToolServersSection } from "./sections/ToolServersSection";
import { PersonasSection } from "./sections/PersonasSection";
import { DocumentsSection } from "./sections/DocumentsSection";
import { PersonaMemoryBlocksSection } from "./sections/PersonaMemoryBlocksSection";
import { PersonaMemoryBlockForm } from "./components/Forms/PersonaMemoryBlockForm";
import { AdminOverviewSection } from "./sections/AdminOverviewSection";
import { DashboardInsetMobileTabStrip } from "./components/DashboardInsetMobileTabStrip";
import { AdminUsersSection } from "./sections/AdminUsersSection";
import { InvitationsSection } from "./sections/InvitationsSection";
import { ThemeEditorSection } from "./sections/ThemeEditorSection";
import { ProvidersSection } from "./sections/ProvidersSection";
import { CommunicationsSection } from "./sections/CommunicationsSection";
import { fetchUserProfile, type AdminRoles } from "@/services/user/userApi";

export default function Dashboard() {
  // Subscribe to isAdmin separately to ensure re-renders when it changes
  const isAdmin = useStore((state) => state.isAdmin);
  const isMobile = useIsMobile();

  // Admin roles state
  const [adminRoles, setAdminRoles] = useState<AdminRoles | null>(null);

  // Fetch admin roles from profile/me
  useEffect(() => {
    const fetchAdminRoles = async () => {
      // Note: API call will work via httpOnly cookies with credentials: "include"
      try {
        // fetchUserProfile uses credentials: "include", so it will send httpOnly cookies automatically
        const profile = await fetchUserProfile();
        if (profile.admin_roles) {
          setAdminRoles(profile.admin_roles);
        }
      } catch (error) {
        console.error("Error fetching admin roles:", error);
      }
    };
    fetchAdminRoles();
  }, []);

  // Permission helpers
  const isSuperAdmin = adminRoles?.is_super_admin || false;
  const isUserAdmin = adminRoles?.is_user_admin || false;
  const isSystemAdmin = adminRoles?.is_system_admin || false;

  // Check if user can access a tab based on permissions
  // While adminRoles is loading (null), use isAdmin from store as fallback
  const canAccessTab = (tabName: string): boolean => {
    if (tabName === "logs") return false;

    // If adminRoles haven't loaded yet, use isAdmin from store as fallback
    // This ensures tabs are visible while loading
    if (adminRoles === null) {
      // While loading, show all tabs if user is admin (from /me API)
      // This prevents empty sidebar while admin roles are being fetched
      return isAdmin;
    }

    if (isSuperAdmin) return true; // Super admin has access to all tabs

    switch (tabName) {
      case "admin":
      case "theme-editor":
        return isSuperAdmin; // Only super admin can access admin tab
      case "users":
      case "invitations":
      case "roles":
      case "personas":
      case "shared-memory":
        return isUserAdmin || isSuperAdmin;
      case "tools":
      case "tags":
      case "tool-servers":
      case "data-sources":
      case "providers":
      case "communications":
      case "doc-tags":
      case "feedback":
      case "overview":
        return isSystemAdmin || isSuperAdmin;
      case "documents":
        // Only system admins (and super admins) should see the Documents section.
        // User admins do NOT have access to this tab.
        return isSystemAdmin || isSuperAdmin;
      default:
        return true; // Other tabs accessible to all admins
    }
  };

  // State for active tab with persistence
  const { dashboardActiveTab, setDashboardActiveTab } = useStore();
  const [activeTab, setActiveTab] = useState<string>(
    dashboardActiveTab || "overview"
  );

  // Handle tab change with permission check
  const handleTabChange = (value: string) => {
    if (canAccessTab(value)) {
      setActiveTab(value);
    } else {
      notify.error("You don't have permission to access this tab");
    }
  };

  // If current tab becomes inaccessible, switch to first accessible tab
  useEffect(() => {
    if (activeTab === "logs") {
      setActiveTab("overview");
      return;
    }

    // Wait for admin roles to load before checking
    if (adminRoles === null) return;

    // Check if current tab is accessible
    let canAccessCurrentTab = false;
    if (isSuperAdmin) {
      canAccessCurrentTab = true;
    } else {
      switch (activeTab) {
        case "admin":
          canAccessCurrentTab = isSuperAdmin;
          break;
        case "users":
        case "invitations":
        case "roles":
        case "personas":
        case "shared-memory":
          canAccessCurrentTab = isUserAdmin || isSuperAdmin;
          break;
        case "tools":
        case "data-sources":
        case "tags":
        case "tool-servers":
        case "providers":
        case "communications":
        case "doc-tags":
        case "feedback":
        case "overview":
          canAccessCurrentTab = isSystemAdmin || isSuperAdmin;
          break;
        case "documents":
          canAccessCurrentTab = isSystemAdmin || isSuperAdmin;
          break;
        default:
          canAccessCurrentTab = true;
      }
    }

    if (activeTab && !canAccessCurrentTab) {
      // Determine first accessible tab based on user's admin role
      let firstAccessibleTab = "overview";

      if (isSuperAdmin) {
        firstAccessibleTab = "overview";
      } else if (isUserAdmin) {
        // User admin accessible tabs (in order of preference)
        firstAccessibleTab = "users";
      } else if (isSystemAdmin) {
        firstAccessibleTab = "overview";
      }

      setActiveTab(firstAccessibleTab);
    }
  }, [activeTab, adminRoles, isSuperAdmin, isUserAdmin, isSystemAdmin]);

  // State for exporting
  const [isExporting, setIsExporting] = useState(false);

  // State for search and UI
  const [searchTerm, setSearchTerm] = useState("");

  // Feedback and Documents state
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>("");
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState<string>("");
  const [feedbackDateFrom, setFeedbackDateFrom] = useState<string>("");
  const [feedbackDateTo, setFeedbackDateTo] = useState<string>("");

  // State for RBAC entities
  const [tools, setTools] = useState<Tool[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [documentTags, setDocumentTags] = useState<DocumentTag[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [selectedTagTools, setSelectedTagTools] = useState<string[]>([]);
  const [toolSearch, setToolSearch] = useState("");
  const debouncedToolSearch = useDebouncedValue(toolSearch, DASHBOARD_SEARCH_DEBOUNCE_MS);
  const debouncedTagSearch = useDebouncedValue(tagSearch, 2000);
  const [selectedToolTypes, setSelectedToolTypes] = useState<string[]>([]);
  const [selectedServerNames, setSelectedServerNames] = useState<string[]>([]);
  const [roleSearch, setRoleSearch] = useState("");
  const debouncedRoleSearch = useDebouncedValue(roleSearch, DASHBOARD_SEARCH_DEBOUNCE_MS);
  const [tagTotal, setTagTotal] = useState<number>(0);
  const [tagPage, setTagPage] = useState<number>(1);
  const [tagPageSize, setTagPageSize] = useState<number>(50);
  const [toolPage, setToolPage] = useState<number>(1);
  const [toolPageSize, setToolPageSize] = useState<number>(50);
  const [toolTotal, setToolTotal] = useState<number>(0);
  const [userTotal, setUserTotal] = useState<number>(0);
  const [userPage, setUserPage] = useState<number>(1);
  const [userPageSize, setUserPageSize] = useState<number>(50);
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);
  const debouncedUserSearch = useDebouncedValue(searchTerm, 350);
  // Roles pagination state
  const [rolePage, setRolePage] = useState<number>(1);
  const [rolePageSize, setRolePageSize] = useState<number>(50);
  const [roleTotal, setRoleTotal] = useState<number>(0);
  const [roleDocumentTagIds, setRoleDocumentTagIds] = useState<number[]>([]);
  const [rolePersonaIds, setRolePersonaIds] = useState<number[]>([]);
  const [docTagSearch, setDocTagSearch] = useState("");
  const debouncedDocTagSearch = useDebouncedValue(docTagSearch, 2000);
  const [docTagTotal, setDocTagTotal] = useState<number>(0);
  const [docTagPage, setDocTagPage] = useState<number>(1);
  const [docTagPageSize, setDocTagPageSize] = useState<number>(50);

  // Available options for filters
  const [availableToolTypes, setAvailableToolTypes] = useState<string[]>([]);
  const [availableServerNames, setAvailableServerNames] = useState<string[]>(
    []
  );
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  // Loading states
  const [toolsLoading, setToolsLoading] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [docTagsLoading, setDocTagsLoading] = useState(false);

  // Error states
  const [_error, setError] = useState<string | null>(null);

  // Error states for each tab
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [docTagsError, setDocTagsError] = useState<string | null>(null);

  // Form states
  const [isTagFormOpen, setIsTagFormOpen] = useState(false);
  const [isRoleFormOpen, setIsRoleFormOpen] = useState(false);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [isDocTagFormOpen, setIsDocTagFormOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | undefined>();
  const [editingRole, setEditingRole] = useState<Role | undefined>();
  const [editingUser, setEditingUser] = useState<User | undefined>();
  const [editingDocTag, setEditingDocTag] = useState<DocumentTag | undefined>();

  // Delete confirmation states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTagDeleteDialogOpen, setIsTagDeleteDialogOpen] = useState(false);
  const [isRoleDeleteDialogOpen, setIsRoleDeleteDialogOpen] = useState(false);
  const [isDocTagDeleteDialogOpen, setIsDocTagDeleteDialogOpen] =
    useState(false);
  const [userToDelete, setUserToDelete] = useState<{
    id: number | string;
    email?: string;
  } | null>(null);
  const [tagToDelete, setTagToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [docTagToDelete, setDocTagToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);

  // Form loading states
  const [tagFormLoading, setTagFormLoading] = useState(false);
  const [roleFormLoading, setRoleFormLoading] = useState(false);
  const [userFormLoading, setUserFormLoading] = useState(false);
  const [docTagFormLoading, setDocTagFormLoading] = useState(false);
  const [tagDeleteLoading, setTagDeleteLoading] = useState(false);
  const [roleDeleteLoading, setRoleDeleteLoading] = useState(false);
  const [docTagDeleteLoading, setDocTagDeleteLoading] = useState(false);
  const [userDeleteLoading, setUserDeleteLoading] = useState(false);

  // State for expanded tags (to show all tools inline)
  const [expandedTags, setExpandedTags] = useState<Set<number>>(new Set());

  // State for expanded descriptions
  const [expandedTagDescriptions, setExpandedTagDescriptions] = useState<
    Set<number>
  >(new Set());
  const [expandedRoleDescriptions, setExpandedRoleDescriptions] = useState<
    Set<number>
  >(new Set());
  const [expandedDocTagDescriptions, setExpandedDocTagDescriptions] = useState<
    Set<number>
  >(new Set());

  const [personaSearch, setPersonaSearch] = useState("");
  const debouncedPersonaSearch = useDebouncedValue(
    personaSearch,
    DASHBOARD_SEARCH_DEBOUNCE_MS
  );
  const [personaTypeFilter, setPersonaTypeFilter] = useState<string | null>(null);
  const [personaCurrentPage, setPersonaCurrentPage] = useState(1);
  const [personaPageSize, setPersonaPageSize] = useState(10); // Reduced for better UX
  const [personaTotalItems, setPersonaTotalItems] = useState(0);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [personasError, setPersonasError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInstallationGuide, setShowInstallationGuide] = useState(false);
  const [installationGuideType, setInstallationGuideType] = useState<"persona" | "role">("persona");
  const [installationGuideEntityId, setInstallationGuideEntityId] = useState<number>(0);
  const [installationGuideEntityName, setInstallationGuideEntityName] = useState<string>("");

  // Persona Memory Blocks state
  const [personaMemoryBlocks, setPersonaMemoryBlocks] = useState<
    PersonaMemoryBlock[]
  >([]);
  const [blockSearch, setBlockSearch] = useState("");
  const debouncedBlockSearch = useDebouncedValue(blockSearch, DASHBOARD_SEARCH_DEBOUNCE_MS);
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(
    null
  );
  const [blockPage, setBlockPage] = useState<number>(1);
  const [blockPageSize, setBlockPageSize] = useState<number>(50);
  const [blockTotal, setBlockTotal] = useState<number>(0);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blocksError, setBlocksError] = useState<string | null>(null);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [isBlockFormOpen, setIsBlockFormOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<
    PersonaMemoryBlock | undefined
  >();
  const [blockFormLoading, setBlockFormLoading] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState<{
    personaId: number;
    blockId: string;
    label: string;
  } | null>(null);
  const [isBlockDeleteDialogOpen, setIsBlockDeleteDialogOpen] = useState(false);
  const [blockDeleteLoading, setBlockDeleteLoading] = useState(false);

  // Reset to page 1 when list filters change
  useEffect(() => {
    setPersonaCurrentPage(1);
  }, [debouncedPersonaSearch, personaTypeFilter]);

  const fetchPersonas = useCallback(async () => {
    try {
      setPersonasLoading(true);
      setPersonasError(null);
      setError(null);

      const hasSearch = debouncedPersonaSearch.trim().length > 0;
      const limit = personaPageSize;
      const offset = (personaCurrentPage - 1) * personaPageSize;

      const response = await personasApi.list({
        limit,
        offset,
        roots_only: true,
        search: hasSearch ? debouncedPersonaSearch.trim() : undefined,
        ...(personaTypeFilter?.trim() ? { type: personaTypeFilter.trim() } : {}),
      });

      if (!response.success) {
        throw new Error("Failed to fetch personas");
      }

      const sortedPersonas = [...response.data].sort((a, b) => {
        if (a.is_default !== b.is_default) {
          return Number(b.is_default) - Number(a.is_default);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setPersonas(sortedPersonas);
      setPersonaTotalItems(response.total ?? 0);
    } catch (error: unknown) {
      console.error("Error fetching personas:", error);
      const message =
        error instanceof Error ? error.message : "Failed to fetch personas";
      notify.error(message);
      setPersonasError(message);
      setError(message);
      setPersonas([]);
      setPersonaTotalItems(0);
    } finally {
      setPersonasLoading(false);
    }
  }, [
    debouncedPersonaSearch,
    personaTypeFilter,
    personaCurrentPage,
    personaPageSize,
  ]);

  // dropdowns moved into child components

  // Data fetching functions
  const fetchTools = useCallback(
    async () => {
      try {
        setToolsLoading(true);
        setToolsError(null);
        setError(null);
        const offset = (toolPage - 1) * toolPageSize;
        const params: any = { limit: toolPageSize, offset };
        if (debouncedToolSearch.trim().length > 0) {
          params.search = debouncedToolSearch.trim();
        }
        if (selectedToolTypes.length === 1) {
          params.type = selectedToolTypes[0];
        }
        if (selectedServerNames.length === 1) {
          params.tool_server = selectedServerNames[0];
        }
        // Skip API call ONLY if adminRoles have loaded AND user is confirmed to be a user admin

        if (adminRoles !== null && isUserAdmin && !isSuperAdmin && !isSystemAdmin) {
          setTools([]);
          setToolTotal(0);
          setToolsLoading(false);
          return;
        }
        // If adminRoles is null, proceed with API call anyway (will be filtered later if user turns out to be user admin)
        // This ensures system admins can see tools even if adminRoles haven't loaded yet
        const response: any = await rbacApi.tools.list(params);
        // Handle both response.data (from rbacApi wrapper) and response.tools (direct API response)
        const newTools = response.data || response.tools || [];
        const totalFromApi =
          response.total ?? response.count ?? response.meta?.total ?? 0;

        const uniqueTools = Array.from(
          new Map(
            newTools.map((t: Tool) => {
              const key = t.server_name
                ? `${t.name}-${t.server_name}`
                : t.name;
              return [key, t];
            })
          ).values()
        ) as Tool[];
        setTools(uniqueTools);
        setToolTotal(totalFromApi);
      } catch (error: any) {
        console.error("Error fetching tools:", error);
        const errorMsg = extractErrorMessage(error, "Failed to fetch tools");
        notify.error(error);
        setToolsError(errorMsg);
        setError(errorMsg);
        setTools([]);
        setToolTotal(0);
      } finally {
        setToolsLoading(false);
      }
    },
    [
      toolPage,
      toolPageSize,
      isUserAdmin,
      isSuperAdmin,
      isSystemAdmin,
      adminRoles,
      debouncedToolSearch,
      selectedToolTypes,
      selectedServerNames,
    ]
  );

  /** Tool type + server filter dropdowns from `/v1/tool-servers/names`, with fallback to `/tool-servers/list`. */
  const fetchToolServerFilterOptions = useCallback(async () => {
    const applyFromServers = (
      servers: { name?: string; type?: string }[]
    ) => {
      const types = Array.from(
        new Set(servers.map((s) => s.type).filter(Boolean) as string[])
      ).sort((a, b) => a.localeCompare(b));
      const names = Array.from(
        new Set(servers.map((s) => s.name).filter(Boolean) as string[])
      ).sort((a, b) => a.localeCompare(b));
      setAvailableToolTypes(types);
      setAvailableServerNames(names);
    };

    try {
      const data = await rbacApi.toolServers.listNames();
      const servers = data?.servers ?? [];
      if (servers.length > 0) {
        applyFromServers(servers);
        return;
      }
    } catch (e) {
      console.warn(
        "GET /v1/tool-servers/names failed, falling back to tool-servers/list:",
        e
      );
    }

    try {
      const res = await rbacApi.toolServers.list({
        limit: 10000,
        offset: 0,
      });
      const rows = res?.data ?? [];
      applyFromServers(rows);
    } catch (e2) {
      console.error("Failed to load tool server filter options:", e2);
      setAvailableToolTypes([]);
      setAvailableServerNames([]);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      setTagsLoading(true);
      setTagsError(null);
      setError(null);
      const offset = (tagPage - 1) * tagPageSize;
      const params: any = { limit: tagPageSize, offset };
      if (debouncedTagSearch && debouncedTagSearch.trim().length > 0) {
        params.search = debouncedTagSearch.trim();
      }
      if (selectedTagTools.length > 0) {
        params.tool_names = selectedTagTools;
      }
      const response: any = await rbacApi.tags.list(params);
      setTags(response.data);
      const totalFromApi =
        response.total ??
        response.count ??
        response.meta?.total ??
        response.data?.length ??
        0;
      setTagTotal(totalFromApi);

    } catch (error: any) {
      console.error("Error fetching tags:", error);
      const errorMsg = extractErrorMessage(error, "Failed to fetch tags");
      notify.error(error);
      setTagsError(errorMsg);
      setError(errorMsg);
      setTags([]);
      setTagTotal(0);
    } finally {
      setTagsLoading(false);
    }
  }, [
    tagPage,
    tagPageSize,
    debouncedTagSearch,
    selectedTagTools,
    isUserAdmin,
    isSuperAdmin,
    isSystemAdmin,
    adminRoles,
  ]);

  const fetchRoles = useCallback(async () => {
    try {
      setRolesLoading(true);
      setRolesError(null);
      setError(null);
      const offset = (rolePage - 1) * rolePageSize;
      const params: ListRolesRequest = { limit: rolePageSize, offset };
      if (debouncedRoleSearch.trim().length > 0) {
        params.search = debouncedRoleSearch.trim();
      }
      if (roleDocumentTagIds.length > 0) {
        params.document_tag_ids = roleDocumentTagIds;
      }
      if (rolePersonaIds.length > 0) {
        params.persona_ids = rolePersonaIds;
      }
      const response = await rbacApi.roles.list(params);
      const newRoles = response.data || [];
      const totalFromApi =
        response.total ??
        (response as { count?: number }).count ??
        0;
      setRoles(newRoles);
      setRoleTotal(totalFromApi);
    } catch (error: any) {
      console.error("Error fetching roles:", error);
      const errorMsg = extractErrorMessage(error, "Failed to fetch roles");
      notify.error(error);
      setRolesError(errorMsg);
      setError(errorMsg);
      setRoles([]);
      setRoleTotal(0);
    } finally {
      setRolesLoading(false);
    }
  }, [
    rolePage,
    rolePageSize,
    debouncedRoleSearch,
    roleDocumentTagIds,
    rolePersonaIds,
  ]);

  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      setError(null);
      const offset = (userPage - 1) * userPageSize;
      const params: any = { limit: userPageSize, offset };
      if (debouncedUserSearch && debouncedUserSearch.trim().length > 0) {
        params.search = debouncedUserSearch.trim();
      }
      if (selectedUserRoles.length > 0) {
        params.roles = selectedUserRoles;
      }
      const response: any = await rbacApi.users.list(params);
      setUsers(response.data);
      const totalFromApi =
        response.total ??
        response.count ??
        response.meta?.total ??
        response.data?.length ??
        0;
      setUserTotal(totalFromApi);

      // Update available roles for users filter combobox
      try {
        const allRolesResponse = await rbacApi.roles.list({
          limit: 1000,
          offset: 0,
        });
        if (allRolesResponse.success) {
          const uniqueRoles = allRolesResponse.data.map((r: Role) => r.name);
          setAvailableRoles(uniqueRoles);
        }
      } catch (err) {
        console.error("Error fetching roles:", err);
      }
    } catch (error: any) {
      console.error("Error fetching users:", error);
      const errorMsg = extractErrorMessage(error, "Failed to fetch users");
      notify.error(error);
      setUsersError(errorMsg);
      setError(errorMsg);
      setUsers([]);
      setUserTotal(0);
    } finally {
      setUsersLoading(false);
    }
  }, [
    userPage,
    userPageSize,
    debouncedUserSearch,
    selectedUserRoles,
  ]);

  const fetchDocumentTags = useCallback(async () => {
    try {
      setDocTagsLoading(true);
      setDocTagsError(null);
      setError(null);
      const offset = (docTagPage - 1) * docTagPageSize;
      const params: any = { limit: docTagPageSize, offset };
      if (debouncedDocTagSearch && debouncedDocTagSearch.trim().length > 0) {
        params.search = debouncedDocTagSearch.trim();
      }
      const response: any = await rbacApi.documentTags.list(params);
      setDocumentTags(response.data);
      const totalFromApi =
        response.total ??
        response.count ??
        response.meta?.total ??
        response.data?.length ??
        0;
      setDocTagTotal(totalFromApi);
    } catch (error: any) {
      console.error("Error fetching document tags:", error);
      const errorMsg = extractErrorMessage(error, "Failed to fetch document tags");
      notify.error(error);
      setDocTagsError(errorMsg);
      setError(errorMsg);
      setDocumentTags([]);
      setDocTagTotal(0);
    } finally {
      setDocTagsLoading(false);
    }
  }, [
    docTagPage,
    docTagPageSize,
    debouncedDocTagSearch,
  ]);

  // Save active tab to store when it changes
  useEffect(() => {
    setDashboardActiveTab(activeTab);
  }, [activeTab]);

  // Retry functions for each tab
  const retryTools = useCallback(() => {
    fetchTools();
  }, [fetchTools]);

  const retryTags = useCallback(() => {
    fetchTags();
  }, [fetchTags]);

  const retryRoles = useCallback(() => {
    fetchRoles();
  }, [fetchRoles]);

  const retryUsers = useCallback(() => {
    fetchUsers();
  }, [fetchUsers]);

  const retryDocTags = useCallback(() => {
    fetchDocumentTags();
  }, [fetchDocumentTags]);

  // Persona Memory Blocks fetching
  const fetchPersonaMemoryBlocks = useCallback(async () => {
    try {
      setBlocksLoading(true);
      setBlocksError(null);
      setError(null);
      const offset = (blockPage - 1) * blockPageSize;
      const params: any = {
        limit: blockPageSize,
        offset,
        ...(selectedPersonaId != null && { persona_id: selectedPersonaId }),
      };
      if (debouncedBlockSearch.trim().length > 0) {
        params.search = debouncedBlockSearch.trim();
      }
      const response = await rbacApi.personaMemoryBlocks.list(params);
      setPersonaMemoryBlocks(response.data || []);
      setBlockTotal(response.total || 0);
    } catch (error: any) {
      console.error("Error fetching persona memory blocks:", error);
      const errorMsg = extractErrorMessage(error, "Failed to fetch persona memory blocks");
      notify.error(error);
      setBlocksError(errorMsg);
      setError(errorMsg);
      setPersonaMemoryBlocks([]);
      setBlockTotal(0);
    } finally {
      setBlocksLoading(false);
    }
  }, [blockPage, blockPageSize, selectedPersonaId, debouncedBlockSearch]);

  const retryBlocks = useCallback(() => {
    fetchPersonaMemoryBlocks();
  }, [fetchPersonaMemoryBlocks]);

  const retryPersonas = useCallback(() => {
    void fetchPersonas();
  }, [fetchPersonas]);

  // Tags fetching with search/filters/pagination (only when tab is active)
  useEffect(() => {
    if (activeTab === "tags" && adminRoles !== null && (isSuperAdmin || isSystemAdmin)) {
      fetchTags();
    }
  }, [
    activeTab,
    tagPage,
    tagPageSize,
    debouncedTagSearch,
    selectedTagTools,
    adminRoles,
    isUserAdmin,
    isSuperAdmin,
    isSystemAdmin,
    fetchTags,
  ]);

  // Reset to first page on new search
  useEffect(() => {
    setTagPage(1);
  }, [debouncedTagSearch, selectedTagTools]);

  // Users fetching with search/filters/pagination (only when tab is active)
  useEffect(() => {
    if (
      activeTab === "users" &&
      adminRoles !== null &&
      (isUserAdmin || isSuperAdmin)
    ) {
      fetchUsers();
    }
  }, [
    activeTab,
    userPage,
    userPageSize,
    debouncedUserSearch,
    selectedUserRoles,
    adminRoles,
    isUserAdmin,
    isSuperAdmin,
  ]);

  useEffect(() => {
    setUserPage(1);
  }, [debouncedUserSearch, selectedUserRoles]);

  // Roles fetching with pagination (only when tab is active)
  useEffect(() => {
    if (
      activeTab === "roles" &&
      adminRoles !== null &&
      (isUserAdmin || isSuperAdmin)
    ) {
      fetchRoles();
    }
  }, [
    activeTab,
    rolePage,
    rolePageSize,
    adminRoles,
    isUserAdmin,
    isSuperAdmin,
    debouncedRoleSearch,
    fetchRoles,
  ]);

  // Tools fetching with search/filters (only when tab is active)
  useEffect(() => {
    if (activeTab !== "tools" || adminRoles === null || (!isSuperAdmin && !isSystemAdmin)) return;
    fetchTools();
  }, [
    activeTab,
    toolPage,
    toolPageSize,
    debouncedToolSearch,
    selectedToolTypes,
    selectedServerNames,
    adminRoles,
    isUserAdmin,
    isSuperAdmin,
    isSystemAdmin,
    fetchTools,
  ]);

  useEffect(() => {
    setToolPage(1);
  }, [debouncedToolSearch, selectedToolTypes, selectedServerNames]);

  // Populate tool type / tool server filter options from registry API (not from loaded tool rows)
  useEffect(() => {
    if (activeTab !== "tools" || adminRoles === null || (!isSuperAdmin && !isSystemAdmin)) return;
    void fetchToolServerFilterOptions();
  }, [
    activeTab,
    adminRoles,
    isSuperAdmin,
    isSystemAdmin,
    fetchToolServerFilterOptions,
  ]);

  // Document tags fetching with search/pagination (only when tab is active)
  useEffect(() => {
    if (activeTab === "doc-tags" && adminRoles !== null && (isSuperAdmin || isSystemAdmin)) {
      fetchDocumentTags();
    }
  }, [
    activeTab,
    docTagPage,
    docTagPageSize,
    debouncedDocTagSearch,
    adminRoles,
    isUserAdmin,
    isSuperAdmin,
    isSystemAdmin,
    fetchDocumentTags,
  ]);

  useEffect(() => {
    setRolePage(1);
  }, [
    debouncedRoleSearch,
    roleDocumentTagIds,
    rolePersonaIds,
  ]);

  useEffect(() => {
    setDocTagPage(1);
  }, [debouncedDocTagSearch]);

  // Persona Memory Blocks fetching with pagination (only when tab is active)
  useEffect(() => {
    if (
      activeTab === "shared-memory" &&
      adminRoles !== null &&
      (isUserAdmin || isSuperAdmin)
    ) {
      fetchPersonaMemoryBlocks();
    }
  }, [
    activeTab,
    blockPage,
    blockPageSize,
    selectedPersonaId,
    debouncedBlockSearch,
    adminRoles,
    isUserAdmin,
    isSuperAdmin,
    fetchPersonaMemoryBlocks,
  ]);

  useEffect(() => {
    setBlockPage(1);
  }, [selectedPersonaId, debouncedBlockSearch]);

  // Personas fetching with search/filters/pagination (only when tab is active)
  useEffect(() => {
    if (activeTab === "personas") {
      void fetchPersonas();
    }
  }, [
    activeTab,
    personaCurrentPage,
    personaPageSize,
    debouncedPersonaSearch,
    personaTypeFilter,
    fetchPersonas,
  ]);

  // Tag form handlers
  const handleCreateTag = async (data: CreateTagRequest) => {
    setTagFormLoading(true);
    setError(null);
    try {
      await rbacApi.tags.create(data);
      await fetchTags();
      setIsTagFormOpen(false);
    } catch (error: any) {
      console.error("Error creating tag:", error);
      setError(`Failed to create tag: ${error.message || "Unknown error"}`);
    } finally {
      setTagFormLoading(false);
    }
  };

  const handleUpdateTag = async (data: UpdateTagRequest) => {
    if (!editingTag) return;
    setTagFormLoading(true);
    setError(null);
    try {
      await rbacApi.tags.update(editingTag.id, data);
      await fetchTags();
      setIsTagFormOpen(false);
      setEditingTag(undefined);
    } catch (error: any) {
      console.error("Error updating tag:", error);
      setError(`Failed to update tag: ${error.message || "Unknown error"}`);
    } finally {
      setTagFormLoading(false);
    }
  };

  const handleDeleteTagClick = (tagId: number, tagName: string) => {
    setTagToDelete({ id: tagId, name: tagName });
    setIsTagDeleteDialogOpen(true);
  };

  const handleDeleteTag = async () => {
    if (!tagToDelete) return;
    setTagDeleteLoading(true);
    setError(null);
    try {
      await rbacApi.tags.delete(tagToDelete.id);
      await fetchTags();
      setIsTagDeleteDialogOpen(false);
      setTagToDelete(null);
    } catch (error: any) {
      console.error("Error deleting tag:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Unknown error";
      setError(`Failed to delete tag: ${errorMessage}`);
      notify.error(error);
    } finally {
      setTagDeleteLoading(false);
    }
  };

  // Role form handlers
  const handleCreateRole = async (data: CreateRoleRequest) => {
    setRoleFormLoading(true);
    setError(null);
    try {
      const createdRole = await rbacApi.roles.create(data);
      await fetchRoles();
      setIsRoleFormOpen(false);
      // Show installation guide for new role
      if (createdRole?.id) {
        setInstallationGuideType("role");
        setInstallationGuideEntityId(createdRole.id);
        setInstallationGuideEntityName(createdRole.name || data.name);
        setShowInstallationGuide(true);
      }
    } catch (error: any) {
      console.error("Error creating role:", error);
      setError(`Failed to create role: ${error.message || "Unknown error"}`);
    } finally {
      setRoleFormLoading(false);
    }
  };

  const handleUpdateRole = async (data: UpdateRoleRequest) => {
    if (!editingRole) return;
    setRoleFormLoading(true);
    setError(null);
    try {
      await rbacApi.roles.update(editingRole.id, data);
      await fetchRoles();
      setIsRoleFormOpen(false);
      setEditingRole(undefined);
    } catch (error: any) {
      console.error("Error updating role:", error);
      setError(`Failed to update role: ${error.message || "Unknown error"}`);
    } finally {
      setRoleFormLoading(false);
    }
  };

  const handleDeleteRoleClick = (roleId: number, roleName: string) => {
    setRoleToDelete({ id: roleId, name: roleName });
    setIsRoleDeleteDialogOpen(true);
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    setRoleDeleteLoading(true);
    setError(null);
    try {
      await rbacApi.roles.delete(roleToDelete.id);
      await fetchRoles();
      setIsRoleDeleteDialogOpen(false);
      setRoleToDelete(null);
    } catch (error: any) {
      console.error("Error deleting role:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Unknown error";
      setError(`Failed to delete role: ${errorMessage}`);
      notify.error(error);
    } finally {
      setRoleDeleteLoading(false);
    }
  };

  // User form handlers
  const handleCreateUser = async (data: CreateUserRequest) => {
    setUserFormLoading(true);
    setError(null);
    try {
      await rbacApi.users.create(data);
      await fetchUsers();
      setIsUserFormOpen(false);
    } catch (error: any) {
      console.error("Error creating user:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Unknown error";
      setError(`Failed to attach roles: ${errorMessage}`);
      notify.error(error);
    } finally {
      setUserFormLoading(false);
    }
  };

  const handleUpdateUser = async (data: UpdateUserRequest) => {
    if (!editingUser) return;
    setUserFormLoading(true);
    setError(null);

    try {
      // Use user_id (email) instead of id for the update
      await rbacApi.users.update(editingUser.user_id, data);
      await fetchUsers();
      setIsUserFormOpen(false);
      setEditingUser(undefined);
    } catch (error: any) {
      console.error("Error updating user:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Unknown error";
      setError(`Failed to attach roles: ${errorMessage}`);
      notify.error(error);
    } finally {
      setUserFormLoading(false);
    }
  };

  const handleDeleteUserClick = (userId: number | string, user?: User) => {
    const identifier = user?.id ?? userId ?? user?.user_id;
    setUserToDelete({ id: identifier, email: user?.user_id });
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setUserDeleteLoading(true);
    setError(null);
    try {
      await rbacApi.users.delete(userToDelete.id as any);
      await fetchUsers();
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (error: any) {
      console.error("Error deleting user:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Unknown error";
      setError(`Failed to delete user: ${errorMessage}`);
      notify.error(error);
      // Don't close modal on error so user can retry
    } finally {
      setUserDeleteLoading(false);
    }
  };

  // Document Tag form handlers
  const handleCreateDocumentTag = async (data: CreateDocumentTagRequest) => {
    setDocTagFormLoading(true);
    setError(null);
    try {
      await rbacApi.documentTags.create(data);
      await fetchDocumentTags();
      setIsDocTagFormOpen(false);
    } catch (error: any) {
      console.error("Error creating document tag:", error);
      setError(
        `Failed to create document tag: ${error.message || "Unknown error"}`
      );
      notify.error(error);
    } finally {
      setDocTagFormLoading(false);
    }
  };

  const handleUpdateDocumentTag = async (data: UpdateDocumentTagRequest) => {
    if (!editingDocTag) return;
    setDocTagFormLoading(true);
    setError(null);
    try {
      await rbacApi.documentTags.update(editingDocTag.id, data);
      await fetchDocumentTags();
      setIsDocTagFormOpen(false);
      setEditingDocTag(undefined);
    } catch (error: any) {
      console.error("Error updating document tag:", error);
      setError(
        `Failed to update document tag: ${error.message || "Unknown error"}`
      );
      notify.error(error);
    } finally {
      setDocTagFormLoading(false);
    }
  };

  const handleDeleteDocumentTagClick = (tagId: number, tagName: string) => {
    setDocTagToDelete({ id: tagId, name: tagName });
    setIsDocTagDeleteDialogOpen(true);
  };

  const handleDeleteDocumentTag = async () => {
    if (!docTagToDelete) return;
    setDocTagDeleteLoading(true);
    setError(null);
    try {
      await rbacApi.documentTags.delete(docTagToDelete.id);
      await fetchDocumentTags();
      setIsDocTagDeleteDialogOpen(false);
      setDocTagToDelete(null);
    } catch (error: any) {
      console.error("Error deleting document tag:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Unknown error";
      setError(`Failed to delete document tag: ${errorMessage}`);
      notify.error(error);
    } finally {
      setDocTagDeleteLoading(false);
    }
  };

  // Persona Memory Blocks form handlers
  const handleCreatePersonaMemoryBlock = async (
    data: CreatePersonaMemoryBlockRequest
  ) => {
    setBlockFormLoading(true);
    setError(null);
    try {
      await rbacApi.personaMemoryBlocks.create(data);
      await fetchPersonaMemoryBlocks();
      setIsBlockFormOpen(false);
    } catch (error: any) {
      console.error("Error creating persona memory block:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Unknown error";
      setError(`Failed to create persona memory block: ${errorMessage}`);
      notify.error(error);
    } finally {
      setBlockFormLoading(false);
    }
  };

  const handleUpdatePersonaMemoryBlock = async (
    data: UpdatePersonaMemoryBlockRequest
  ) => {
    if (!editingBlock) return;
    const personaId =
      editingBlock.persona_id ?? editingBlock.persona?.id;
    if (personaId == null) {
      notify.error("Cannot update: missing persona id for this block.");
      return;
    }
    setBlockFormLoading(true);
    setError(null);
    try {
      await rbacApi.personaMemoryBlocks.update(
        personaId,
        editingBlock.block_id,
        data
      );
      await fetchPersonaMemoryBlocks();
      setIsBlockFormOpen(false);
      setEditingBlock(undefined);
    } catch (error: any) {
      console.error("Error updating persona memory block:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Unknown error";
      setError(`Failed to update persona memory block: ${errorMessage}`);
      notify.error(error);
    } finally {
      setBlockFormLoading(false);
    }
  };

  const handleDeleteBlockClick = (
    personaId: number,
    blockId: string,
    label: string
  ) => {
    setBlockToDelete({ personaId, blockId, label });
    setIsBlockDeleteDialogOpen(true);
  };

  const handleDeletePersonaMemoryBlock = async () => {
    if (!blockToDelete) return;
    setBlockDeleteLoading(true);
    setError(null);
    try {
      await rbacApi.personaMemoryBlocks.delete(
        blockToDelete.personaId,
        blockToDelete.blockId
      );
      await fetchPersonaMemoryBlocks();
      setIsBlockDeleteDialogOpen(false);
      setBlockToDelete(null);
    } catch (error: any) {
      console.error("Error deleting persona memory block:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Unknown error";
      setError(`Failed to delete persona memory block: ${errorMessage}`);
      notify.error(error);
    } finally {
      setBlockDeleteLoading(false);
    }
  };

  // Export feedback to Excel (CSV format)
  const handleExportFeedback = async () => {
    setIsExporting(true);
    try {
      const baseUrl = API_CONFIG.LOCAL_API_BASE_URL || "";

      // Build query parameters - fetch all feedback with current filters
      const params = new URLSearchParams({
        limit: "10000", // Large number to get all records
        offset: "0",
        sort_by: "created_at",
        sort_order: "desc",
      });

      // Add filters if they're set
      if (feedbackSearch) {
        params.append("search", feedbackSearch);
      }
      if (feedbackStatusFilter && feedbackStatusFilter !== "") {
        params.append("status", feedbackStatusFilter);
      }
      if (feedbackRatingFilter && feedbackRatingFilter !== "") {
        params.append("feedback_type", feedbackRatingFilter);
      }

      const url = `${baseUrl.replace(
        /\/$/,
        ""
      )}/feedback/all?${params.toString()}`;

      const response = await axios.get(url, {
        headers: {
          ...API_CONFIG.API_HEADERS,
        },
        withCredentials: true, // Include httpOnly cookies automatically
      });

      const feedbackData = response.data.feedback || [];

      if (feedbackData.length === 0) {
        alert("No feedback data to export");
        return;
      }

      // Convert to CSV
      const headers = [
        "ID",
        "User ID",
        "Message ID",
        "User Query",
        "AI Response",
        "Feedback Type",
        "Reason",
        "Status",
        "Resolution Comment",
        "Created At",
        "Resolved At",
      ];

      const csvRows = [
        headers.join(","),
        ...feedbackData.map((item: any) => {
          const row = [
            item.id || "",
            `"${(item.user_id || "").replace(/"/g, '""')}"`,
            `"${(item.message_id || "").replace(/"/g, '""')}"`,
            `"${(item.user_query || "").replace(/"/g, '""')}"`,
            `"${(item.ai_response || "").replace(/"/g, '""')}"`,
            item.feedback_type || "",
            `"${(item.reason || "").replace(/"/g, '""')}"`,
            item.is_resolved ? "Resolved" : "Unresolved",
            `"${(item.resolution_comment || "").replace(/"/g, '""')}"`,
            item.created_at || "",
            item.resolved_at || "",
          ];
          return row.join(",");
        }),
      ];

      const csvContent = csvRows.join("\n");

      // Create and download the file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url_obj = URL.createObjectURL(blob);

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .split("T")[0];
      link.setAttribute("href", url_obj);
      link.setAttribute("download", `feedback_export_${timestamp}.csv`);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url_obj);
    } catch (error) {
      console.error("Failed to export feedback:", error);
      alert("Failed to export feedback. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-text-main antialiased">
      {/* Spectrum rule */}
      <div className="h-0.5 shrink-0 bg-gradient-to-r from-primary via-secondary to-accent" />

      {/* Body: sidebar + main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:flex md:shrink-0">
          <AdminSidebar
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            canAccessTab={canAccessTab}
            isSystemAdmin={isSystemAdmin}
            isUserAdmin={isUserAdmin}
            isSuperAdmin={isSuperAdmin}
          />
        </div>

        {/* Main content column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:px-6 md:py-6">
          {/* Content Area */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex h-full min-h-0 w-full flex-col [&_[role=tabpanel]]:!mt-1 sm:[&_[role=tabpanel]]:!mt-2"
          >
            <AdminOverviewSection
              activeTab={activeTab}
              onFeedbackTabClick={() => {
                setFeedbackStatusFilter("unresolved");
                handleTabChange("feedback");
              }}
            />

            <TagsSection
              isAdmin={Boolean(isAdmin)}
              isUserAdmin={isUserAdmin}
              isMobile={isMobile}
              tagSearch={tagSearch}
              setTagSearch={setTagSearch}
              selectedTagTools={selectedTagTools}
              setSelectedTagTools={setSelectedTagTools}
              tags={tags}
              tagsLoading={tagsLoading}
              tagsError={tagsError}
              retryTags={retryTags}
              tagPage={tagPage}
              setTagPage={setTagPage}
              tagPageSize={tagPageSize}
              setTagPageSize={setTagPageSize}
              tagTotal={tagTotal}
              expandedTags={expandedTags}
              setExpandedTags={setExpandedTags}
              expandedTagDescriptions={expandedTagDescriptions}
              setExpandedTagDescriptions={setExpandedTagDescriptions}
              setIsTagFormOpen={setIsTagFormOpen}
              setEditingTag={setEditingTag}
              handleDeleteTag={handleDeleteTagClick}
            />

            <ToolsSection
              tools={tools}
              toolSearch={toolSearch}
              setToolSearch={setToolSearch}
              selectedToolTypes={selectedToolTypes}
              setSelectedToolTypes={setSelectedToolTypes}
              selectedServerNames={selectedServerNames}
              setSelectedServerNames={setSelectedServerNames}
              availableToolTypes={availableToolTypes}
              availableServerNames={availableServerNames}
              toolsError={toolsError}
              toolsLoading={toolsLoading}
              retryTools={retryTools}
              toolPage={toolPage}
              setToolPage={setToolPage}
              toolPageSize={toolPageSize}
              setToolPageSize={setToolPageSize}
              toolTotal={toolTotal}
              isMobile={isMobile}
            />

            <DataSourcesSection
              isAdmin={Boolean(isAdmin)}
              isMobile={isMobile}
              activeTab={activeTab}
            />

            <RolesSection
              isAdmin={Boolean(isAdmin)}
              isMobile={isMobile}
              activeTab={activeTab}
              roles={roles}
              rolesLoading={rolesLoading}
              rolesError={rolesError}
              retryRoles={retryRoles}
              roleSearch={roleSearch}
              setRoleSearch={setRoleSearch}
              setEditingRole={setEditingRole}
              setIsRoleFormOpen={setIsRoleFormOpen}
              handleDeleteRole={handleDeleteRoleClick}
              expandedRoleDescriptions={expandedRoleDescriptions}
              setExpandedRoleDescriptions={setExpandedRoleDescriptions}
              rolePage={rolePage}
              setRolePage={setRolePage}
              rolePageSize={rolePageSize}
              setRolePageSize={setRolePageSize}
              roleTotal={roleTotal}
              roleDocumentTagIds={roleDocumentTagIds}
              setRoleDocumentTagIds={setRoleDocumentTagIds}
              rolePersonaIds={rolePersonaIds}
              setRolePersonaIds={setRolePersonaIds}
            />

            <PersonasSection
              personaSearch={personaSearch}
              setPersonaSearch={setPersonaSearch}
              personaTypeFilter={personaTypeFilter}
              setPersonaTypeFilter={setPersonaTypeFilter}
              personaCurrentPage={personaCurrentPage}
              setPersonaCurrentPage={setPersonaCurrentPage}
              personaPageSize={personaPageSize}
              setPersonaPageSize={setPersonaPageSize}
              personaTotalItems={personaTotalItems}
              personas={personas}
              personasLoading={personasLoading}
              personasError={personasError}
              onOpenCreateModal={() => setShowCreateModal(true)}
              isMobile={isMobile}
              retryPersonas={retryPersonas}
            />

            <PersonaWizardModal
              isOpen={showCreateModal}
              mode="create"
              onClose={() => setShowCreateModal(false)}
              onSave={() => {
                setShowCreateModal(false);
                setPersonaCurrentPage(1);
                retryPersonas();
              }}
              onCreated={(personaId, personaName) => {
                setInstallationGuideType("persona");
                setInstallationGuideEntityId(personaId);
                setInstallationGuideEntityName(personaName);
                setShowInstallationGuide(true);
              }}
            />
            {/* Users Tab */}
            <UsersSection
              isAdmin={Boolean(isAdmin)}
              isMobile={isMobile}
              usersLoading={usersLoading}
              users={users}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              availableRoles={availableRoles}
              selectedUserRoles={selectedUserRoles}
              setSelectedUserRoles={setSelectedUserRoles}
              setEditingUser={setEditingUser}
              setIsUserFormOpen={setIsUserFormOpen}
              handleDeleteClick={handleDeleteUserClick}
              userPage={userPage}
              setUserPage={setUserPage}
              userPageSize={userPageSize}
              setUserPageSize={setUserPageSize}
              userTotal={userTotal}
              usersError={usersError}
              onRetryUsers={retryUsers}
            />

            <DocumentTagsSection
              isAdmin={Boolean(isAdmin)}
              docTagSearch={docTagSearch}
              setDocTagSearch={setDocTagSearch}
              documentTags={documentTags}
              docTagsLoading={docTagsLoading}
              docTagsError={docTagsError}
              retryDocTags={retryDocTags}
              setEditingDocTag={setEditingDocTag}
              setIsDocTagFormOpen={setIsDocTagFormOpen}
              handleDeleteDocumentTag={handleDeleteDocumentTagClick}
              expandedDocTagDescriptions={expandedDocTagDescriptions}
              setExpandedDocTagDescriptions={setExpandedDocTagDescriptions}
              docTagPage={docTagPage}
              setDocTagPage={setDocTagPage}
              docTagPageSize={docTagPageSize}
              setDocTagPageSize={setDocTagPageSize}
              docTagTotal={docTagTotal}
              isMobile={isMobile}
            />

            <FeedbackSection
              feedbackSearch={feedbackSearch}
              setFeedbackSearch={setFeedbackSearch}
              feedbackStatusFilter={feedbackStatusFilter}
              setFeedbackStatusFilter={setFeedbackStatusFilter}
              feedbackRatingFilter={feedbackRatingFilter}
              setFeedbackRatingFilter={setFeedbackRatingFilter}
              feedbackDateFrom={feedbackDateFrom}
              setFeedbackDateFrom={setFeedbackDateFrom}
              feedbackDateTo={feedbackDateTo}
              setFeedbackDateTo={setFeedbackDateTo}
              isExporting={isExporting}
              handleExportFeedback={handleExportFeedback}
              activeTab={activeTab}
            />

            {/* Documents section is only available for system admins and super admins.
            User admins should not see this section in the dashboard. */}
            {(isSystemAdmin || isSuperAdmin) && <DocumentsSection />}

            <ToolServersSection
              isAdmin={Boolean(isAdmin)}
              isMobile={isMobile}
              activeTab={activeTab}
            />

            <ProvidersSection
              isAdmin={Boolean(isAdmin)}
              isMobile={isMobile}
              activeTab={activeTab}
            />

            <CommunicationsSection
              isAdmin={Boolean(isAdmin)}
              activeTab={activeTab}
            />

            <PersonaMemoryBlocksSection
              isAdmin={Boolean(isAdmin)}
              isMobile={isMobile}
              blockSearch={blockSearch}
              setBlockSearch={setBlockSearch}
              selectedPersonaId={selectedPersonaId}
              setSelectedPersonaId={setSelectedPersonaId}
              blocks={personaMemoryBlocks}
              blocksLoading={blocksLoading}
              blocksError={blocksError}
              retryBlocks={retryBlocks}
              blockPage={blockPage}
              setBlockPage={setBlockPage}
              blockPageSize={blockPageSize}
              setBlockPageSize={setBlockPageSize}
              blockTotal={blockTotal}
              expandedBlocks={expandedBlocks}
              setExpandedBlocks={setExpandedBlocks}
              setIsBlockFormOpen={setIsBlockFormOpen}
              setEditingBlock={setEditingBlock}
              handleDeleteBlock={handleDeleteBlockClick}
            />

            <AdminUsersSection
              isSuperAdmin={isSuperAdmin}
              activeTab={activeTab}
            />

            <InvitationsSection
              isUserAdmin={isUserAdmin}
              isSuperAdmin={isSuperAdmin}
              activeTab={activeTab}
            />

            <ThemeEditorSection
              isSuperAdmin={isSuperAdmin}
              activeTab={activeTab}
            />
          </Tabs>
          </div>

          {/* Mobile section nav — bottom bar so back/picker sit in the thumb zone */}
          <DashboardInsetMobileTabStrip
            className="md:hidden shrink-0 border-t border-border-main bg-surface"
            activeTab={activeTab}
            onTabChange={handleTabChange}
            canAccessTab={canAccessTab}
            isSystemAdmin={isSystemAdmin}
            isUserAdmin={isUserAdmin}
            isSuperAdmin={isSuperAdmin}
          />
        </div>
      </div>

      {/* Form Components */}
      <TagForm
        isOpen={isTagFormOpen}
        onClose={() => {
          setIsTagFormOpen(false);
          setEditingTag(undefined);
        }}
        onSubmit={
          editingTag ? (handleUpdateTag as any) : (handleCreateTag as any)
        }
        tag={editingTag}
        isLoading={tagFormLoading}
        isUserAdmin={isUserAdmin}
      />

      <RoleForm
        isOpen={isRoleFormOpen}
        onClose={() => {
          setIsRoleFormOpen(false);
          setEditingRole(undefined);
        }}
        onSubmit={
          editingRole ? (handleUpdateRole as any) : (handleCreateRole as any)
        }
        role={editingRole}
        isLoading={roleFormLoading}
      />

      <UserForm
        isOpen={isUserFormOpen}
        onClose={() => {
          setIsUserFormOpen(false);
          setEditingUser(undefined);
        }}
        onSubmit={
          editingUser ? (handleUpdateUser as any) : (handleCreateUser as any)
        }
        user={editingUser}
        isLoading={userFormLoading}
        existingUserEmails={users.map((u) => u.user_id)}
      />

      <DocumentTagForm
        isOpen={isDocTagFormOpen}
        onClose={() => {
          setIsDocTagFormOpen(false);
          setEditingDocTag(undefined);
        }}
        onSubmit={
          editingDocTag
            ? (handleUpdateDocumentTag as any)
            : (handleCreateDocumentTag as any)
        }
        tag={editingDocTag}
        isLoading={docTagFormLoading}
      />

      <PersonaMemoryBlockForm
        isOpen={isBlockFormOpen}
        onClose={() => {
          setIsBlockFormOpen(false);
          setEditingBlock(undefined);
        }}
        onSubmit={
          editingBlock
            ? (handleUpdatePersonaMemoryBlock as any)
            : (handleCreatePersonaMemoryBlock as any)
        }
        block={editingBlock}
        isLoading={blockFormLoading}
      />

      {/* Unified Delete Confirmation Modals */}
      {/* User Delete */}
      <DeleteConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleDeleteUser}
        title="Delete User?"
        description="This action cannot be undone."
        itemName={userToDelete?.email}
        isLoading={userDeleteLoading}
      />

      {/* Tag Delete */}
      <DeleteConfirmationModal
        isOpen={isTagDeleteDialogOpen}
        onClose={() => {
          setIsTagDeleteDialogOpen(false);
          setTagToDelete(null);
        }}
        onConfirm={handleDeleteTag}
        title="Delete Tag?"
        description="This action cannot be undone."
        itemName={tagToDelete?.name}
        isLoading={tagDeleteLoading}
      />

      {/* Role Delete */}
      <DeleteConfirmationModal
        isOpen={isRoleDeleteDialogOpen}
        onClose={() => {
          setIsRoleDeleteDialogOpen(false);
          setRoleToDelete(null);
        }}
        onConfirm={handleDeleteRole}
        title="Delete Role?"
        description="This action cannot be undone."
        itemName={roleToDelete?.name}
        isLoading={roleDeleteLoading}
      />

      {/* Document Tag Delete */}
      <DeleteConfirmationModal
        isOpen={isDocTagDeleteDialogOpen}
        onClose={() => {
          setIsDocTagDeleteDialogOpen(false);
          setDocTagToDelete(null);
        }}
        onConfirm={handleDeleteDocumentTag}
        title="Delete Document Tag?"
        description="This action cannot be undone."
        itemName={docTagToDelete?.name}
        isLoading={docTagDeleteLoading}
      />

      {/* Installation Guide Modal */}
      <InstallationGuideModal
        isOpen={showInstallationGuide}
        onClose={() => setShowInstallationGuide(false)}
        onComplete={(redirectTo) => {
          setShowInstallationGuide(false);
          if (redirectTo === "roles") {
            setActiveTab("roles");
          } else if (redirectTo === "users") {
            setActiveTab("users");
          }
        }}
        type={installationGuideType}
        entityId={installationGuideEntityId}
        entityName={installationGuideEntityName}
      />

      {/* Persona Memory Block Delete */}
      <DeleteConfirmationModal
        isOpen={isBlockDeleteDialogOpen}
        onClose={() => {
          setIsBlockDeleteDialogOpen(false);
          setBlockToDelete(null);
        }}
        onConfirm={handleDeletePersonaMemoryBlock}
        title="Delete Memory Block?"
        description="This action cannot be undone."
        itemName={blockToDelete?.label}
        isLoading={blockDeleteLoading}
      />
    </div>
  );
}
