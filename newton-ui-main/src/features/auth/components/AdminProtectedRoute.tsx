import React, { useEffect, useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useStore } from "@/store/useStore";
import { fetchUserProfile } from "@/services/user/userApi";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

export const AdminProtectedRoute: React.FC<AdminProtectedRouteProps> = ({ children }) => {
  // Subscribe to isAdmin separately to ensure re-renders when it changes
  const { isAdmin, setIsAdmin } = useStore();
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const hasCheckedRef = useRef(false);

  // Watch for isAdmin changes - if it becomes true while checking, stop checking
  useEffect(() => {
    if (isAdmin && isCheckingAdmin) {
      setIsCheckingAdmin(false);
    }
  }, [isAdmin, isCheckingAdmin]);

  // Fetch admin status on mount if not already set
  useEffect(() => {
    // Skip if already checked or if admin status is already true
    if (hasCheckedRef.current || isAdmin) {
      setIsCheckingAdmin(false);
      return;
    }

    const checkAdminStatus = async () => {
      hasCheckedRef.current = true;

      try {
        // Fetch user profile to get admin status
        const userProfile = await fetchUserProfile();
        const isAdminFromApi = userProfile?.is_admin === true;
        
        // Update store with admin status
        setIsAdmin(isAdminFromApi);
      } catch (error) {
        console.error("Error checking admin status:", error);
        // On error, assume not admin
        setIsAdmin(false);
      } finally {
        setIsCheckingAdmin(false);
      }
    };

    checkAdminStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Show loading state while checking admin status
  if (isCheckingAdmin) {
    return null; // or return a loading spinner if preferred
  }

  // If not admin, redirect to main dashboard with error message
  if (!isAdmin) {
    return <Navigate to="/" replace state={{ error: "Admin privileges required to access this page" }} />;
  }

  // If admin, render the protected content
  return <>{children}</>;
};
