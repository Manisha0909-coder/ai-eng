import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import "./services/api/client";
import { initTheme } from "./utils/theme";
import { applyDefaultTheme } from "./features/dashboard/theme-editor/defaultTheme";
import { announceVersionChange, setupServiceWorkerUpdates } from "./pwa/swUpdates";

setupServiceWorkerUpdates();
announceVersionChange();

initTheme();
// Paint the admin-chosen default preset before first render (no flash of the
// shipped palette). A live Theme Editor preview still overrides this.
applyDefaultTheme();

// Suppress defaultProps deprecation warnings from third-party libraries
if (import.meta.env.DEV) {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const message = args[0];
    if (
      typeof message === "string" &&
      message.includes("defaultProps will be removed from function components")
    ) {
      // Suppress this specific warning from react-scroll-to-bottom
      return;
    }
    originalWarn.apply(console, args);
  };
}

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// ── Viewport height + keyboard: ONE mechanism (ChatGPT-style resize) ─────
// The app's height (--vh) IS the visible viewport. While a text control is
// focused or the visual viewport is keyboard-shrunk, that means
// visualViewport.height — the layout itself shrinks so the chat input sits
// above the keyboard by normal flow. No transforms, no lift: previous
// attempts that lifted the input while iOS/standalone ALSO resized or panned
// always produced a two-phase "fly up, then settle" motion.
//
// The spam-proofing trick: on focus, pre-shrink instantly using the cached
// keyboard height, so by the time the keyboard starts animating the layout
// is already final — opening/closing repeatedly just toggles between two
// static layouts. The page is pinned at scroll 0 whenever the keyboard is
// involved so iOS's auto-pan never sticks.
const KB_MIN = 60;

const isTextControl = (el: unknown): el is HTMLElement =>
  el instanceof HTMLElement &&
  (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

const pinScroll = () => {
  if (window.scrollY !== 0) window.scrollTo(0, 0);
  if (document.documentElement.scrollTop !== 0) document.documentElement.scrollTop = 0;
  if (document.body.scrollTop !== 0) document.body.scrollTop = 0;
  // iOS's reveal-focused-input pan also scrolls overflow:hidden ANCESTORS of
  // the input and leaves them scrolled after the keyboard closes — the whole
  // app then sits shifted up and the input bar hangs off-screen. Walk the
  // chat layout chain and zero any leftover offsets (the real message
  // scroller lives deeper inside and is not an ancestor of the input bar).
  let el: HTMLElement | null = document.querySelector(".main-content");
  while (el) {
    if (el.scrollTop !== 0) el.scrollTop = 0;
    if (el.scrollLeft !== 0) el.scrollLeft = 0;
    el = el.parentElement;
  }
};

const applyVh = (px: number) => {
  document.documentElement.style.setProperty("--vh", `${px * 0.01}px`);
};

// Standalone-iPad detection for the resting-height re-baseline below.
// (iPadOS 13+ reports as Macintosh but is touch-capable.)
const isIpadDevice =
  /iPad/.test(navigator.userAgent) ||
  (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
const isIpadStandalone =
  isIpadDevice &&
  (window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    (window.navigator as { standalone?: boolean }).standalone === true);

// Height of the window with no keyboard involved. Needed because standalone
// iOS shrinks innerHeight itself for the keyboard — without this we couldn't
// tell "innerHeight is already the visible area" from "keyboard incoming".
let restingHeight = window.innerHeight;

const syncViewport = () => {
  const vv = window.visualViewport;
  const focused = isTextControl(document.activeElement);
  const kb = vv ? Math.max(0, window.innerHeight - vv.height) : 0;

  // While the keyboard is up, iOS's native pan owns the layout. Any runtime
  // "correction" here feeds back into iOS's own re-panning and oscillates —
  // verified on device. The only augmentation is a CONSTANT focus-time lift
  // applied in CSS (see .chat-input-anchor rule in index.css).

  // Resting state (keyboard fully gone): restore the layout and undo every
  // form of leftover pan.
  if (!focused && kb <= KB_MIN) {
    restingHeight = Math.max(restingHeight, window.innerHeight);

    // iOS standalone bug (measured on device: ih stuck at 844 vs screen 912
    // after a keyboard-open app switch): the window height stays shrunken by
    // ~the QuickType bar FOR GOOD — every layout below is then uniformly cut.
    // The known cure is forcing WebKit to re-derive the window size with a
    // one-frame display toggle of the app root.
    if (restingHeight - window.innerHeight > 40) {
      if (isIpadStandalone) {
        // iPad windows come back from the app switcher (and multitasking
        // resizes) genuinely smaller, with no orientationchange. The heal
        // can't restore anything real here — it just loops with a stale
        // --vh, leaving the chat input below the fold. Accept the new size
        // as the baseline and fall through to applying it.
        restingHeight = window.innerHeight;
      } else {
        healViewport();
        setTimeout(syncViewport, 300);
        return;
      }
    }

    applyVh(window.innerHeight);
    pinScroll();

    // iOS 26 bug: dismissing the keyboard while the app is backgrounded can
    // leave visualViewport.offsetTop stuck non-zero after return — the
    // visible region then sits below the layout origin and no scroll API
    // clears it. Translate the fixed body (portaled overlays included) down
    // by the stuck amount. Loop-free: the transform doesn't change offsetTop.
    const stuck = vv ? Math.round(vv.offsetTop) : 0;
    const wanted = stuck > 1 ? `translateY(${stuck}px)` : "";
    if (document.body.style.transform !== wanted) {
      document.body.style.transform = wanted;
    }
    // iOS can recover from either bug without firing any viewport event —
    // keep watching until the compensation is no longer needed.
    if (wanted) setTimeout(syncViewport, 600);
  }
};

// One-frame display toggle: forces WebKit to recompute the stuck window
// size. Rate-limited so a heal that doesn't take can't flicker-loop.
let lastHealAt = 0;
const healViewport = () => {
  const now = Date.now();
  if (now - lastHealAt < 2000) return;
  lastHealAt = now;
  const root = document.getElementById("root");
  if (!root) return;
  root.style.display = "none";
  void root.offsetHeight;
  root.style.display = "";
};

// iOS reports stale sizes through launch/restore/rotation animations — the
// delayed re-measures let the value settle without user interaction.
const resyncViewportHeight = () => {
  syncViewport();
  setTimeout(syncViewport, 250);
  setTimeout(syncViewport, 1000);
};

// Measure the real bottom safe-area inset with a rendered probe — reading
// env() straight in a stylesheet has proven unreliable in standalone iOS
// (resolves 0), which left bottom bars flush against the home indicator.
// Standalone iOS gets a 34px floor: every home-indicator iPhone needs at
// least that much clearance even when env() misreports.
const measureSafeBottom = () => {
  let sab = 0;
  try {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;bottom:0;left:0;width:1px;height:0;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)";
    document.body.appendChild(probe);
    sab = Math.round(probe.getBoundingClientRect().height);
    probe.remove();
  } catch {}
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    (window.navigator as any).standalone === true;
  const isIos =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (standalone && isIos && sab < 20) sab = 34;
  document.documentElement.style.setProperty("--safe-bottom", `${sab}px`);
  // The keyboard-lift correction below is for Safari's reveal pan specifically;
  // Chrome/Android resizes the viewport correctly and needs no lift.
  document.documentElement.classList.toggle("is-ios", isIos);
};

// Set initial viewport height and safe-area measurement
syncViewport();
measureSafeBottom();
window.addEventListener("pageshow", measureSafeBottom);

// Every viewport-affecting signal funnels into the same sync
window.addEventListener("resize", syncViewport);
window.visualViewport?.addEventListener("resize", syncViewport);
window.visualViewport?.addEventListener("scroll", syncViewport);
window.addEventListener("orientationchange", () => {
  // A rotation legitimately changes the window height — reset the resting
  // baseline so the shrunken-viewport heal can't misfire in landscape.
  restingHeight = 0;
  resyncViewportHeight();
});
window.addEventListener("pageshow", resyncViewportHeight);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  // Returning from the app switcher can leave an input focused WITHOUT iOS
  // re-opening the keyboard. The lingering focus keeps viewport handling in
  // keyboard mode and the layout stays shifted/cut. If there's no keyboard
  // actually present shortly after return, drop the focus so the resting
  // layout is restored.
  setTimeout(() => {
    const vv = window.visualViewport;
    const kb = vv ? window.innerHeight - vv.height : 0;
    if (isTextControl(document.activeElement) && kb <= KB_MIN) {
      (document.activeElement as HTMLElement).blur();
    }
  }, 150);
  resyncViewportHeight();
});
document.addEventListener("focusin", (e) => {
  if (isTextControl(e.target)) syncViewport();
});
document.addEventListener("focusout", () => {
  setTimeout(syncViewport, 50);
});

// The transform-lift is retired — layout resize replaced it. Keep the var
// pinned at 0 for the CSS that still references it.
document.documentElement.style.setProperty("--kb-offset", "0px");

import {
  BrowserRouter,
  useLocation,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import notify from "@/utils/notify";
import { useReminderNotifications } from "@/hooks/useReminderNotifications";
import { SidebarProvider } from "./components/ui/sidebar";
import { AppSidebar } from "./layouts/Sidebar/AppSidebar";
import { useStore } from "./store/useStore";
import { AppRoutes } from "./routes";

// Component to conditionally render sidebar
const AppLayout = () => {
  const { isAuthenticated } = useStore();
  const location = useLocation();
  // Treat `/login` and `/login/` (and any subpaths) as auth screen.
  const isAuthScreen = location.pathname === "/login";
  const isPublicRoute =
    location.pathname === "/docs" || location.pathname === "/openapi";
  const isAdminDashboard = location.pathname === "/admin-dashboard";
  const isChatShareRoute = location.pathname.startsWith("/chat_share");
  const [sidebarTracker, setSidebarTracker] = useState<boolean | null>(null);

  // Reminder toasts + Web Push subscription upkeep (no-op until signed in).
  useReminderNotifications();

  // Handle error messages from navigation state
  useEffect(() => {
    if (location.state?.error) {
      notify.error(location.state.error);
      // Clear the state to prevent showing the error again
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  return (
    <div className="flex h-full w-full">
      {isAuthenticated && !isAuthScreen && !isPublicRoute && !isAdminDashboard && !isChatShareRoute && (
        <AppSidebar sidebarTracker={sidebarTracker} />
      )}
      <main
        className={`flex min-w-0 flex-1 flex-col ${
          isPublicRoute || isAdminDashboard ? "w-full" : ""
        }`}
      >
        <AppRoutes setSidebarTracker={setSidebarTracker} />
      </main>
    </div>
  );
};

import { AppErrorBoundary } from "./components/AppErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
    <SidebarProvider>
      <BrowserRouter>
        <AppLayout />
        <Toaster
          position="top-right"
          gutter={8}
          containerStyle={{
            top: "calc(1.25rem + env(safe-area-inset-top))",
            right: "1.25rem",
          }}
          toastOptions={{
            success: {
              icon: (
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgb(var(--color-success) / 0.12)",
                  border: "1px solid rgb(var(--color-success) / 0.3)",
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                       stroke="rgb(var(--color-success))" strokeWidth="2.5"
                       strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              ),
            },
            error: {
              icon: (
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgb(var(--color-error) / 0.12)",
                  border: "1px solid rgb(var(--color-error) / 0.3)",
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                       stroke="rgb(var(--color-error))" strokeWidth="2.5"
                       strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </div>
              ),
            },
            loading: {
              icon: (
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgb(var(--color-border) / 0.5)",
                  border: "1px solid rgb(var(--color-border))",
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                       stroke="rgb(var(--color-primary))" strokeWidth="2.5"
                       strokeLinecap="round" className="animate-spin">
                    <path d="M12 2a10 10 0 0 1 10 10" opacity="0.3"/>
                    <path d="M22 12A10 10 0 0 1 12 22"/>
                  </svg>
                </div>
              ),
            },
          }}
        />
      </BrowserRouter>
    </SidebarProvider>
    </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>
);
