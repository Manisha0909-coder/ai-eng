import { useEffect, useRef, useState } from "react";

export function useSidebarResize({
  variant,
  isMobile,
}: {
  variant: "sidebar" | "inline";
  isMobile: boolean;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return 0;
    const vw = window.innerWidth || 1200;
    // Default to 65% of viewport width for dashboard
    const base = Math.round(vw * 0.65);
    const min = 320;
    const max = Math.round(vw * 0.65);
    return Math.min(Math.max(base, min), max);
  });

  const isResizingSidebarRef = useRef(false);

  const effectiveSidebarWidth = !isMobile && sidebarWidth > 0 ? sidebarWidth : 0;

  // Sidebar resizing (drag handle on left edge of sidebar)
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizingSidebarRef.current) return;
      try {
        const vw = window.innerWidth || 1200;
        const min = 280;
        // Cap at 65% to maintain 65/35 split (dashboard/chat)
        const max = Math.round(vw * 0.65);
        const newWidth = Math.min(Math.max(vw - event.clientX, min), max);
        setSidebarWidth(newWidth);
      } catch {
        // ignore resize errors
      }
    };

    const handleMouseUp = () => {
      if (isResizingSidebarRef.current) {
        isResizingSidebarRef.current = false;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Expose sidebar width to the rest of the app via a CSS variable (only when variant is sidebar)
  useEffect(() => {
    if (typeof document === "undefined" || variant === "inline") return;
    const root = document.documentElement;

    if (!isMobile && effectiveSidebarWidth > 0) {
      root.style.setProperty("--viz-sidebar-width", `${effectiveSidebarWidth}px`);
    } else {
      root.style.setProperty("--viz-sidebar-width", "0px");
    }

    return () => {
      root.style.setProperty("--viz-sidebar-width", "0px");
    };
  }, [effectiveSidebarWidth, isMobile, variant]);

  return {
    sidebarWidth,
    setSidebarWidth,
    effectiveSidebarWidth,
    isResizingSidebarRef,
  };
}

