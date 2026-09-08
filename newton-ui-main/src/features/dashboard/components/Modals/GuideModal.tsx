import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { rbacApi, type Role } from "@/services/rbac/rbacApi";
import { Combobox } from "@/components/ui/combobox";
import notify from "@/utils/notify";
import { DashboardLoader } from "@/components/ContentLoader";

interface InstallationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (redirectTo?: "roles" | "users") => void;
  type: "persona" | "role";
  entityId: number;
  entityName: string;
}

export function InstallationGuideModal({
  isOpen,
  onClose,
  onComplete,
  type,
  entityId,
  entityName,
}: InstallationGuideModalProps) {
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [attaching, setAttaching] = useState(false);

  // Fetch available roles (for persona attachment)
  const fetchRoles = useCallback(async () => {
    if (type !== "persona") return;
    setLoadingRoles(true);
    try {
      const response = await rbacApi.roles.list({
        limit: 1000,
        offset: 0,
      });
      if (response.success && Array.isArray(response.data)) {
        setAvailableRoles(response.data);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
      notify.error("Failed to fetch roles");
    } finally {
      setLoadingRoles(false);
    }
  }, [type]);

  /** GET /v1/users/user_list?search=… — used by Combobox (debounced). */
  const fetchAttachableUsers = useCallback(async (searchQuery?: string) => {
    try {
      const response = await rbacApi.users.userList({
        search: searchQuery?.trim() || undefined,
      });
      if (response.success && Array.isArray(response.user_ids)) {
        return response.user_ids.filter((id) => Boolean(id?.trim?.()));
      }
      return [];
    } catch (error) {
      console.error("Error fetching users:", error);
      notify.error("Failed to fetch users");
      return [];
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (type === "persona") {
        fetchRoles();
      }
    }
    if (!isOpen) {
      setSelectedRoleIds([]);
      setSelectedUserIds([]);
      setAvailableRoles([]);
    }
  }, [isOpen, type, fetchRoles]);

  /** Pass as `items` so Combobox filters client-side (onOpen mode skips local search). */
  const roleItemNames = useMemo(
    () => availableRoles.map((r) => r.name).filter(Boolean) as string[],
    [availableRoles],
  );

  const selectedRoleNames = useMemo(
    () =>
      selectedRoleIds
        .map((id) => availableRoles.find((r) => r.id === id)?.name)
        .filter(Boolean) as string[],
    [selectedRoleIds, availableRoles]
  );


  const handleRoleSelect = (value: string | string[]) => {
    const names = Array.isArray(value) ? value : [value];
    const ids = names
      .map((name) => availableRoles.find((r) => r.name === name)?.id)
      .filter((id): id is number => typeof id === "number");
    setSelectedRoleIds(ids);
  };

  const handleUserSelect = (value: string | string[]) => {
    const ids = Array.isArray(value) ? value : [value];
    setSelectedUserIds(ids);
  };

  const removeRole = (roleId: number) => {
    setSelectedRoleIds((prev) => prev.filter((id) => id !== roleId));
  };

  const removeUser = (userId: string) => {
    setSelectedUserIds((prev) => prev.filter((id) => id !== userId));
  };

  const handleAttach = async () => {
    setAttaching(true);
    try {
      if (type === "persona" && selectedRoleIds.length > 0) {
        await rbacApi.personas.bulkAttachRoles(entityId, selectedRoleIds);
        onComplete("roles");
      } else if (type === "role" && selectedUserIds.length > 0) {
        await rbacApi.roles.bulkAttachUsers(entityId, selectedUserIds);
        onComplete("users");
      } else {
        // Skip attachment
        onComplete();
      }
    } catch (error: any) {
      console.error("Error attaching:", error);
      notify.error(error);
    } finally {
      setAttaching(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] bg-surface border-border-main overflow-visible">
        <DialogHeader>
          <DialogTitle className="text-text-main">
          Attach {type === "persona" ? "Roles" : "Users"}
          </DialogTitle>
          <DialogDescription className="text-text-muted">
            {type === "persona"
              ? `Attach roles to the persona "${entityName}" to grant access. You can skip this step and do it later.`
              : `Attach users to the role "${entityName}" to grant access. You can skip this step and do it later.`}
          </DialogDescription>
        </DialogHeader>

        {/* z-10 so Combobox panel (absolute) stacks above DialogFooter; otherwise footer captures clicks */}
        <div className="relative z-10 space-y-4 py-4 overflow-visible">
          {type === "persona" ? (
            <>
              <div className="space-y-2 overflow-visible">
                <label className="text-sm font-medium text-text-main">
                  Select Roles to Attach
                </label>
                {selectedRoleNames.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedRoleNames.map((name) => {
                      const roleId = availableRoles.find((r) => r.name === name)
                        ?.id;
                      return (
                        <Badge
                          key={roleId}
                          variant="secondary"
                          className="flex items-center gap-1 bg-background text-text-main border-border-main"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={() => roleId && removeRole(roleId)}
                            className="ml-1 hover:bg-surface rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <div className="relative z-[1000] overflow-visible">
                  <Combobox
                    items={roleItemNames}
                    placeholder={
                      loadingRoles
                        ? "Loading roles..."
                        : "Search and select roles to attach..."
                    }
                    onSelect={handleRoleSelect}
                    defaultValue={selectedRoleNames}
                    className="text-text-main border-border-main"
                    disabled={loadingRoles}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2 overflow-visible">
                <label className="text-sm font-medium text-text-main">
                  Select Users to Attach
                </label>
                {selectedUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedUserIds.map((userId) => (
                      <Badge
                        key={userId}
                        variant="secondary"
                        className="flex items-center gap-1 bg-background text-text-main border-border-main"
                      >
                        {userId}
                        <button
                          type="button"
                          onClick={() => removeUser(userId)}
                          className="ml-1 hover:bg-surface rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="relative z-[1000] overflow-visible">
                  <Combobox
                    onOpen={fetchAttachableUsers}
                    placeholder="Search and select users to attach..."
                    onSelect={handleUserSelect}
                    defaultValue={selectedUserIds}
                    className="text-text-main border-border-main"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="relative z-0 flex flex-row justify-between items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSkip}
            disabled={attaching}
            className="border-border-main text-text-main hover:bg-background rounded-md"
          >
            Skip
          </Button>
          <Button
            type="button"
            onClick={handleAttach}
            disabled={attaching}
            className="hover:bg-primary/90 text-white rounded-md"
          >
            {attaching ? (
              <>
                <DashboardLoader variant="inline" className="mr-2" />
                Attaching...
              </>
            ) : (
              `Attach ${type === "persona" ? "Roles" : "Users"}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

