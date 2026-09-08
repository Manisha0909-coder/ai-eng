import { type Dispatch, type SetStateAction } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import BffAuthScreen from "@/screens/BffAuthScreen";
import InviteRedeemScreen from "@/screens/InviteRedeemScreen";
import { App } from "@/App";
import { ProtectedRoute } from "@/layouts/ProtectedRoute";
import { AdminProtectedRoute } from "@/features/auth/components/AdminProtectedRoute";
import { Dashboard } from "@/features/dashboard";
import ShareChat from "@/features/chat/components/ShareChat/ShareChat";
import { OAuthCallback } from "@/features/auth/components/OAuthCallback";
import { ConnectionsOAuthCallback } from "@/features/auth/components/ConnectionsOAuthCallback";

interface AppRoutesProps {
  setSidebarTracker: Dispatch<SetStateAction<boolean | null>>;
}

export function AppRoutes({ setSidebarTracker }: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/login/*" element={<BffAuthScreen />} />
      <Route path="/invite" element={<InviteRedeemScreen />} />
      <Route path="/auth/*" element={<Navigate to="/login" replace />} />
      <Route path="/docs" element={<div>Documentation</div>} />
      <Route path="/openapi" element={<div>OpenAPI Specification</div>} />

      {/* OAuth callback routes */}
      <Route path="/outlook-connected" element={<OAuthCallback />} />
      <Route path="/outlook-error" element={<OAuthCallback />} />
      <Route path="/gmail-connected" element={<OAuthCallback />} />
      <Route path="/gmail-error" element={<OAuthCallback />} />
      <Route
        path="/connections"
        element={
          <ProtectedRoute>
            <ConnectionsOAuthCallback />
          </ProtectedRoute>
        }
      />
      <Route
        path="/connections/oauth/return"
        element={
          <ProtectedRoute>
            <ConnectionsOAuthCallback />
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <App setSidebarTracker={setSidebarTracker} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Navigate to="/" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:sessionId"
        element={
          <ProtectedRoute>
            <App setSidebarTracker={setSidebarTracker} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-dashboard"
        element={
          <ProtectedRoute>
            <AdminProtectedRoute>
              <Dashboard />
            </AdminProtectedRoute>
          </ProtectedRoute>
        }
      />
      <Route path="/chat_share/:id/public" element={<ShareChat />} />
      <Route
        path="/chat_share/:id"
        element={
          <ProtectedRoute>
            <ShareChat />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
