// Replaced luxon with native Date methods

// /**
//  * Get cookie value by name
//  * Note: httpOnly cookies cannot be read by JavaScript
//  */
// const getCookie = (name: string): string | null => {
//   if (typeof document === "undefined") return null;
  
//   const value = `; ${document.cookie}`;
//   const parts = value.split(`; ${name}=`);
  
//   if (parts.length === 2) {
//     return parts.pop()?.split(';').shift() || null;
//   }
  
//   return null;
// };


/**
 * Get cookie value by name
 * Note: httpOnly cookies cannot be read by JavaScript
 */
export const getCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  
  try {
    const cookies = document.cookie;
    
    // Escape special regex characters in cookie name
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Try exact match first
    const exactMatchRegex = new RegExp(String.raw`(^|;\s*)${escapedName}\s*=\s*([^;]*)`);
    const exactMatch = exactMatchRegex.exec(cookies);
    if (exactMatch?.[2]) {
      return decodeURIComponent(exactMatch[2].trim());
    }
    
    // Try case-insensitive match
    const caseInsensitiveRegex = new RegExp(String.raw`(^|;\s*)${escapedName}\s*=\s*([^;]*)`, 'i');
    const caseInsensitiveMatch = caseInsensitiveRegex.exec(cookies);
    if (caseInsensitiveMatch?.[2]) {
      return decodeURIComponent(caseInsensitiveMatch[2].trim());
    }
    
    // Fallback to original method
    const value = `; ${cookies}`;
    const parts = value.split(`; ${name}=`);
    
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift();
      return cookieValue ? decodeURIComponent(cookieValue.trim()) : null;
    }
    
    return null;
  } catch (error) {
    console.error(`Error reading cookie ${name}:`, error);
    return null;
  }
};

/**
 * Clear a specific cookie by name
 * Note: httpOnly cookies cannot be cleared by JavaScript
 * @param name - The name of the cookie to clear
 * @param path - Optional path (defaults to '/')
 * @param domain - Optional domain
 */
export const clearCookie = (name: string, path: string = '/', domain?: string): void => {
  if (typeof document === "undefined") return;
  
  try {
    // Set cookie to expire in the past
    const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
    
    // Try clearing with different combinations of path and domain
    const variations = [
      `${name}=; expires=${expires}; path=${path}`,
      `${name}=; expires=${expires}; path=/`,
      `${name}=; expires=${expires}`,
    ];
    
    if (domain) {
      variations.push(
        `${name}=; expires=${expires}; path=${path}; domain=${domain}`,
        `${name}=; expires=${expires}; path=/; domain=${domain}`,
        `${name}=; expires=${expires}; domain=${domain}`
      );
    }
    
    // Also try with .domain format if domain is provided
    if (domain && !domain.startsWith('.')) {
      variations.push(
        `${name}=; expires=${expires}; path=${path}; domain=.${domain}`,
        `${name}=; expires=${expires}; path=/; domain=.${domain}`,
        `${name}=; expires=${expires}; domain=.${domain}`
      );
    }
    
    // Apply all variations
    variations.forEach(variation => {
      document.cookie = variation;
    });
  } catch (error) {
    console.error(`Error clearing cookie ${name}:`, error);
  }
};

/**
 * Clear all cookies accessible by JavaScript
 * Note: httpOnly cookies cannot be cleared by JavaScript and must be cleared by the backend
 * This function will attempt to clear all cookies by parsing document.cookie
 * and trying different path/domain combinations
 */
export const clearAllCookies = (): void => {
  if (typeof document === "undefined") return;
  
  try {
    // Get current hostname and domain
    const hostname = window.location.hostname;
    const domain = hostname.split('.').slice(-2).join('.'); // Get domain (e.g., example.com)
    
    // Parse all cookies
    const cookies = document.cookie.split(';');
    
    cookies.forEach(cookie => {
      const cookiePart = cookie.trim().split('=');
      if (cookiePart.length > 0) {
        const cookieName = cookiePart[0].trim();
        if (cookieName) {
          // Try clearing with different path and domain combinations
          clearCookie(cookieName, '/', domain);
          clearCookie(cookieName, '/', `.${domain}`);
          clearCookie(cookieName, '/');
          clearCookie(cookieName, '', domain);
          clearCookie(cookieName, '', `.${domain}`);
        }
      }
    });
    
    // Also try to clear common cookie names that might exist
    const commonCookieNames = [
      'access_token',
      'refresh_token',
      'session',
      'sessionid',
      'session_id',
      'auth_token',
      'token',
      'jwt',
      'csrf',
      'csrftoken',
    ];
    
    commonCookieNames.forEach(name => {
      clearCookie(name, '/', domain);
      clearCookie(name, '/', `.${domain}`);
      clearCookie(name, '/');
    });
    
  } catch (error) {
    console.error("Error clearing all cookies:", error);
  }
};

/** Clears all keys in `sessionStorage` (e.g. on logout fallback). */
export const clearSessionStorage = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.clear();
  } catch (error) {
    console.error("Error clearing sessionStorage:", error);
  }
};






export const convertTime = (utcTime: string) => {
    try {
      if (!utcTime) return "Invalid Time";
  
      // Try to parse the UTC time
      let date;
      try {
        date = new Date(utcTime);
      } catch {
        return "Invalid Time";
      }

      if (isNaN(date.getTime())) return "Invalid Time";

      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      if (isToday) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleString([], { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
    } catch (error) {
      return "Invalid Time";
    }
  };

/**
 * Generates a unique session ID for new chat sessions
 * @returns A unique session ID string
 */
// export const generateSessionId = (): string => generateChatId();

/**
 * Generates a unique chat ID
 * @returns A unique chat ID string
 */
let chatIdCounter = 0;
export const generateChatId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older environments:
  // Prefer cryptographically strong randomness if available; otherwise fall back
  // to a monotonic, timestamp-based id (unique within a single runtime).
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${Date.now()}-${hex}`;
  }

  chatIdCounter += 1;
  const perf = typeof performance !== "undefined" ? Math.floor(performance.now() * 1000) : 0;
  return `${Date.now()}-${perf.toString(16)}-${chatIdCounter.toString(16)}`;
};

/**
 * Formats a date string to a standardized format: "Nov 25, 2025, 07:51 PM"
 * @param dateString - The date string to format (ISO string, date string, etc.)
 * @returns Formatted date string in the format "MMM DD, YYYY, HH:MM AM/PM"
 */
export const formatDashboardDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "-";
    }
    
    // Format date part: "Nov 25, 2025"
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    
    // Format time part: "07:51 PM" (ensuring 2-digit hour)
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const hoursStr = displayHours.toString().padStart(2, "0");
    const minutesStr = minutes.toString().padStart(2, "0");
    const timeStr = `${hoursStr}:${minutesStr} ${ampm}`;
    
    return `${dateStr}, ${timeStr}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    return "-";
  }
};
