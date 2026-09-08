import axios from "axios";
import { API_CONFIG } from "@/config/api";
import { type Persona } from "@/store/useStore";


const toSafeErrorLog = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.response?.status,
      serverMessage:
        typeof data === "string"
          ? data.slice(0, 500)
          : data?.message ?? data?.detail ?? data?.error?.message ?? undefined,
    };
  }
  if (error && typeof error === "object" && "message" in (error as any)) {
    return { message: String((error as any).message) };
  }
  return { message: String(error) };
};

/**
 * Persona from /me API response (raw format)
 */
interface MeApiPersona {
  display_text: string | null;
  greeting_message: string | null;
  id: number;
  is_default: boolean;
  persona_name: string;
  supports_images?: boolean;
  // New persona type field from backend. Defaults to "chat".
  type?: "chat" | "dashboard";
  has_datasources?: boolean;
  supports_documents?: boolean;
  system_prompt?: string | null;
}

/**
 * User profile response from /me API
 * This is the single source of truth for authenticated user information
 */
export interface AdminRoles {
  is_super_admin: boolean;
  is_system_admin: boolean;
  is_user_admin: boolean;
}

/** Connection status per provider from /me API (e.g. connected.google.is_connected). */
export interface ConnectedProvider {
  is_connected: boolean;
  email?: string | null;
  user_id?: string | null;
}

export interface ConnectedStatus {
  google?: ConnectedProvider;
  microsoft?: ConnectedProvider;
  noah?: ConnectedProvider;
  connectsecure?: ConnectedProvider;
}

/** Per-user starred default persona id per surface, from /profile/me. */
export interface DefaultPersonas {
  chat?: number | null;
  dashboard?: number | null;
}

export interface UserProfile {
  department: string | null;
  email: string;
  employee_id: string | null;
  full_name: string;
  given_name: string;
  is_admin: boolean;
  admin_roles?: AdminRoles;
  job_title: string | null;
  manager: string | null;
  mobile_phone: string | null;
  office_location: string | null;
  personas: MeApiPersona[];
  default_personas?: DefaultPersonas;
  position: string | null;
  profile_picture: string | null;
  username: string | null;
  work_phone: string | null;
  supports_images?: boolean;
  /** Which providers are connected (from /me). Used in Settings instead of /status API. */
  connected?: ConnectedStatus;
}

// Persona type is imported from store/useStore to ensure type compatibility

/**
 * Centralized service for fetching user profile from /me API
 * This is the SINGLE SOURCE OF TRUTH for:
 * - User profile details
 * - Admin status (is_admin field)
 * - All assigned personas (including default persona configuration)
 */
class UserApiService {
  private profileCache: UserProfile | null = null;
  private profileCacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private fetchPromise: Promise<UserProfile> | null = null;
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY = 1000; // 1 second
  private readonly LOGOUT_FLAG_KEY = "logout_in_progress";

  private isLogoutInProgress(): boolean {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(this.LOGOUT_FLAG_KEY) === "true";
    } catch {
      return false;
    }
  }

  /**
   * Check if error is a CORS error
   */
  private isCorsError(error: any): boolean {
    if (!error) return false;
    
    // Check for CORS-related error messages
    const errorMessage = error.message?.toLowerCase() || "";
    const isNetworkError = error.code === "ERR_NETWORK" || error.code === "ERR_FAILED";
    const hasCorsMessage = errorMessage.includes("cors") || 
                          errorMessage.includes("access-control") ||
                          errorMessage.includes("credentials");
    
    return isNetworkError || hasCorsMessage;
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: any): string {
    if (this.isCorsError(error)) {
      return "CORS configuration error: The server needs to allow credentials from this origin. Please contact support or check server CORS settings.";
    }
    
    if (error?.response?.status === 401) {
      return "Authentication required. Please log in again.";
    }
    
    if (error?.response?.status === 403) {
      return "Access denied. You don't have permission to access this resource.";
    }
    
    if (error?.code === "ERR_NETWORK" || error?.code === "ERR_FAILED") {
      return "Network error: Unable to connect to the server. Please check your connection.";
    }
    
    return (
      error?.response?.data?.error?.message ||
      error?.response?.data?.message ||
      error?.message ||
      "Failed to fetch user profile. Please try again."
    );
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetch user profile from /me API with retry logic
   * Uses caching to prevent multiple simultaneous requests
   * Authentication is handled via httpOnly cookies (access_token cookie)
   */
  async fetchUserProfile(retryAttempt = 0): Promise<UserProfile> {
    // During logout we must not call /me (cookies may not be cleared yet and can race).
    // Treat as unauthenticated and let callers route to /auth.
    if (this.isLogoutInProgress()) {
      const enhancedError = new Error("Logout in progress");
      (enhancedError as any).status = 401;
      throw enhancedError;
    }

    // Return cached profile if still valid
    const now = Date.now();
    if (
      this.profileCache &&
      now - this.profileCacheTimestamp < this.CACHE_DURATION &&
      retryAttempt === 0 // Don't use cache on retry attempts
    ) {
      return this.profileCache;
    }

    // If there's already a fetch in progress and not retrying, return that promise
    if (this.fetchPromise && retryAttempt === 0) {
      return this.fetchPromise;
    }

    // Create new fetch promise
    // Note: httpOnly cookies (like access_token) won't be visible in document.cookie
    // but they should still be sent automatically with withCredentials: true
    
    const apiUrl = `${API_CONFIG.LOCAL_API_BASE_URL}/profile/me`;

    // Headers for cookie-based authentication (httpOnly cookies)
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    this.fetchPromise = axios
      .get<UserProfile>(apiUrl, {
        headers,
        withCredentials: true, // Include cookies in the request - CRITICAL for cookie-based auth
        timeout: 10000, // 10 second timeout
        silent: true,
      } as any)
      .then((response) => {
        if (response.status === 200 && response.data) {
          this.profileCache = response.data;
          this.profileCacheTimestamp = Date.now();
          return response.data;
        } else {
          throw new Error("Failed to fetch user profile");
        }
      })
      .catch(async (error: any) => {
        // Enhanced error logging for 401 errors (dev only)
        if (import.meta.env.DEV && error?.response?.status === 401) {
          console.error("401 Unauthorized - Cookie authentication failed:", {
            url: `${API_CONFIG.LOCAL_API_BASE_URL}/profile/me`,
            withCredentials: true,
            message: "The access_token cookie may not be set or may have expired. Please log in again.",
            error: toSafeErrorLog(error),
          });
        }
        const errorMessage = this.getErrorMessage(error);
        if (import.meta.env.DEV) {
          console.error("Error fetching user profile from /me API:", {
            error: toSafeErrorLog(error),
            message: errorMessage,
            attempt: retryAttempt + 1,
            isCorsError: this.isCorsError(error),
          });
        }

        // Retry logic for network errors (but not CORS errors or auth errors)
        const shouldRetry = 
          retryAttempt < this.MAX_RETRIES &&
          !this.isCorsError(error) &&
          error?.response?.status !== 401 &&
          error?.response?.status !== 403 &&
          (error?.code === "ERR_NETWORK" || error?.code === "ERR_FAILED" || error?.code === "ECONNABORTED");

        if (shouldRetry) {
          const delay = this.RETRY_DELAY * Math.pow(2, retryAttempt); // Exponential backoff
          await this.sleep(delay);
          return this.fetchUserProfile(retryAttempt + 1);
        }

        // Create a more informative error
        const enhancedError = new Error(errorMessage);
        (enhancedError as any).originalError = error;
        (enhancedError as any).isCorsError = this.isCorsError(error);
        (enhancedError as any).status = error?.response?.status;
        throw enhancedError;
      })
      .finally(() => {
        // Clear the fetch promise so subsequent calls can create a new one
        if (retryAttempt === 0) {
          this.fetchPromise = null;
        }
      });

    return this.fetchPromise;
  }

  /**
   * Clear the profile cache
   * Useful when user data might have changed
   */
  clearCache(): void {
    this.profileCache = null;
    this.profileCacheTimestamp = 0;
  }

  /**
   * Get admin status from cached profile or fetch if needed
   */
  async getAdminStatus(): Promise<boolean> {
    try {
      const profile = await this.fetchUserProfile();
      return profile.is_admin || false;
    } catch (error) {
      console.error("Error getting admin status:", toSafeErrorLog(error));
      return false;
    }
  }

  /**
   * Get personas from cached profile or fetch if needed
   * Maps /me API persona format to store Persona format
   */
  async getPersonas(): Promise<Persona[]> {
    try {
      const profile = await this.fetchUserProfile();
      const apiPersonas = profile.personas || [];
      
      // Map /me API persona format to store Persona format
      // /me API personas don't include persona_prompt, so we set it to empty string
      return apiPersonas.map((apiPersona): Persona => ({
        id: apiPersona.id,
        persona_name: apiPersona.persona_name,
        persona_prompt: "", // /me API doesn't provide persona_prompt
        display_text: apiPersona.display_text ?? undefined, // Convert null to undefined
        greeting_message: apiPersona.greeting_message ?? undefined, // Convert null to undefined
        is_default: apiPersona.is_default,
        // Default to "chat" for backward compatibility
        type: apiPersona.type ?? "chat",
        has_datasources: apiPersona.has_datasources ?? false,
        supports_documents: apiPersona.supports_documents ?? false,
        system_prompt: apiPersona.system_prompt,
      }));
    } catch (error) {
      console.error("Error getting personas:", toSafeErrorLog(error));
      return [];
    }
  }

  /**
   * Get default persona from cached profile or fetch if needed
   */
  async getDefaultPersona(): Promise<Persona | null> {
    try {
      const personas = await this.getPersonas();
      return personas.find((p) => p.is_default) || personas[0] || null;
    } catch (error) {
      console.error("Error getting default persona:", toSafeErrorLog(error));
      return null;
    }
  }

  /**
   * Star a persona as the user's default for its type (chat or dashboard).
   * Replaces any previous default of the same type.
   */
  async setDefaultPersona(personaId: number): Promise<void> {
    await axios.put(
      `${API_CONFIG.LOCAL_API_BASE_URL}/profile/me/default-persona`,
      { persona_id: personaId },
      { withCredentials: true, headers: { "Content-Type": "application/json" } }
    );
    this.clearCache();
  }

  /**
   * Unstar the user's default persona for the given type. Idempotent.
   */
  async clearDefaultPersona(personaType: "chat" | "dashboard"): Promise<void> {
    await axios.delete(
      `${API_CONFIG.LOCAL_API_BASE_URL}/profile/me/default-persona/${personaType}`,
      { withCredentials: true }
    );
    this.clearCache();
  }
}

// Export singleton instance
export const userApiService = new UserApiService();

// Export convenience functions
export const fetchUserProfile = () =>
  userApiService.fetchUserProfile();
export const getAdminStatus = () =>
  userApiService.getAdminStatus();
export const getPersonas = () =>
  userApiService.getPersonas();
export const getDefaultPersona = () =>
  userApiService.getDefaultPersona();
export const clearUserProfileCache = () => userApiService.clearCache();

