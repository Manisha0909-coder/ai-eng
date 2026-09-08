import React from "react";
import IFrame from "@/components/IFrame";

// IFrame wrapper component that tracks height changes for carousel
const IFrameWithHeightTracking: React.FC<{
  title: string;
  content: { kind: "html"; value: string };
  size: { mode: "auto"; min?: number; max?: number };
  sandboxLevel: "scripts";
  onHeightChange: (height: number) => void;
}> = ({ title, content, size, sandboxLevel, onHeightChange }) => {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [currentHeight, setCurrentHeight] = React.useState<number>(320);
  const heightTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
  const mutationObserverRef = React.useRef<MutationObserver | null>(null);
  const checkIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    let iframe: HTMLIFrameElement | null = null;
    let loadHandler: (() => void) | null = null;

    // Wait for iframe to be rendered
    const checkForIframe = () => {
      iframe = wrapperRef.current?.querySelector("iframe") || null;
      if (!iframe) {
        // Try again if iframe not ready
        setTimeout(checkForIframe, 50);
        return;
      }

      const checkHeight = () => {
        if (!iframe) return;
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) return;

          // Try to get the actual content height, including any charts/visualizations
          let height = 0;

          // Check body scroll height first
          if (doc.body) {
            height = Math.max(
              doc.body.scrollHeight,
              doc.body.offsetHeight,
              doc.body.clientHeight,
            );
          }

          // Check document element height
          const docHeight = Math.max(
            doc.documentElement?.scrollHeight || 0,
            doc.documentElement?.offsetHeight || 0,
            doc.documentElement?.clientHeight || 0,
          );
          height = Math.max(height, docHeight);

          // Check for chart containers that might need more space
          try {
            const chartElements = doc.querySelectorAll(
              '[class*="chart"],[class*="graph"],[id*="chart"],[id*="graph"],.plotly-graph-div,svg',
            );
            chartElements.forEach((el: Element) => {
              const rect = el.getBoundingClientRect();
              if (rect.height > height) {
                height = rect.height;
              }
            });
          } catch (e) {
          }

          // Fallback to minimum if no height found
          if (height < (size.min ?? 240)) {
            height = size.min ?? 240;
          }

          const clamped = Math.min(
            Math.max(height, size.min ?? 240),
            size.max ?? 2400,
          );

          if (clamped !== currentHeight) {
            setCurrentHeight(clamped);
            onHeightChange(clamped);
          }
        } catch (e) {
          // Error handling
        }
      };

      loadHandler = () => {
        checkHeight();
        // Multiple checks for async content loading (charts, etc.)
        setTimeout(checkHeight, 100);
        setTimeout(checkHeight, 500);
        setTimeout(checkHeight, 1000);
        setTimeout(checkHeight, 2000);

        // Use ResizeObserver for dynamic content
        try {
          const doc =
            iframe?.contentDocument || iframe?.contentWindow?.document;
          if (doc?.body) {
            resizeObserverRef.current = new ResizeObserver(() => {
              if (heightTimeoutRef.current) {
                clearTimeout(heightTimeoutRef.current);
              }
              heightTimeoutRef.current = setTimeout(checkHeight, 100);
            });
            resizeObserverRef.current.observe(doc.body);

            // Also observe mutations for dynamic content
            mutationObserverRef.current = new MutationObserver(() => {
              if (heightTimeoutRef.current) {
                clearTimeout(heightTimeoutRef.current);
              }
              heightTimeoutRef.current = setTimeout(checkHeight, 100);
            });
            mutationObserverRef.current.observe(doc.documentElement, {
              childList: true,
              subtree: true,
              attributes: true,
            });
          }
        } catch (e) {
          // Cross-origin restrictions - ignore
        }
      };

      // Check if already loaded
      if (iframe.contentDocument?.readyState === "complete") {
        loadHandler();
      } else {
        iframe.addEventListener("load", loadHandler, { once: true });
      }

      // Also check periodically as fallback
      checkIntervalRef.current = setInterval(checkHeight, 2000);
    };

    checkForIframe();

    return () => {
      if (iframe && loadHandler) {
        iframe.removeEventListener("load", loadHandler);
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (heightTimeoutRef.current) {
        clearTimeout(heightTimeoutRef.current);
        heightTimeoutRef.current = null;
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (mutationObserverRef.current) {
        mutationObserverRef.current.disconnect();
        mutationObserverRef.current = null;
      }
    };
  }, [content, size, currentHeight, onHeightChange]);

  return (
    <div
      ref={wrapperRef}
      className="w-full flex-1"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <IFrame
        title={title}
        content={content}
        size={size}
        sandboxLevel={sandboxLevel}
      />
    </div>
  );
};

// Local carousel component for html_data charts. Isolated so hooks order is stable.
const HtmlCarousel: React.FC<{
  entries: Array<{ html: string; title?: string }>;
  baseTitle?: string;
}> = ({ entries, baseTitle }) => {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [current, setCurrent] = React.useState(0);
  const isProgrammaticRef = React.useRef(false);
  const targetIndexRef = React.useRef<number | null>(null);
  const scrollEndTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Track heights of each iframe slide
  const [slideHeights, setSlideHeights] = React.useState<Map<number, number>>(
    new Map(),
  );
  const [maxHeight, setMaxHeight] = React.useState(400); // fallback minimum
  const slideRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());

  // Update maxHeight when slide heights change
  React.useEffect(() => {
    if (slideHeights.size > 0) {
      const heights = Array.from(slideHeights.values());
      const newMaxHeight = Math.max(...heights, 400);
      setMaxHeight(newMaxHeight);
    }
  }, [slideHeights]);

  // Handle iframe height updates
  const handleIframeResize = React.useCallback(
    (index: number, height: number) => {
      setSlideHeights((prev) => {
        const next = new Map(prev);
        next.set(index, height);
        return next;
      });
    },
    [],
  );

  const handleScroll = React.useCallback(() => {
    // Ignore intermediate scroll events while programmatic navigation is in progress
    if (isProgrammaticRef.current) return;
    const el = trackRef.current;
    if (!el) return;
    const width = el.clientWidth || 1;
    const idx = Math.round(el.scrollLeft / width);
    if (idx !== current) setCurrent(idx);
  }, [current]);

  const goTo = React.useCallback((idx: number) => {
    const el = trackRef.current;
    if (!el) return;
    const width = el.clientWidth;
    // Mark programmatic navigation to prevent number flicker
    isProgrammaticRef.current = true;
    targetIndexRef.current = idx;
    if (scrollEndTimerRef.current) {
      globalThis.clearTimeout(scrollEndTimerRef.current);
      scrollEndTimerRef.current = null;
    }
    el.scrollTo({ left: idx * width, behavior: "smooth" });
    // Ensure the number updates immediately
    setCurrent(idx);
    // Clear programmatic flag after animation settles
    scrollEndTimerRef.current = globalThis.setTimeout(() => {
      isProgrammaticRef.current = false;
      targetIndexRef.current = null;
      scrollEndTimerRef.current = null;
    }, 350);
  }, []);

  React.useEffect(() => {
    // Notify container that a carousel is ready so it can optionally scroll to it
    const el = rootRef.current;
    if (el) {
      try {
        const evt = new CustomEvent("chat:html-carousel-ready", {
          detail: { el },
        });
        globalThis.dispatchEvent(evt);
      } catch {}
    }
  }, []);

  return (
    <div ref={rootRef} className="w-full">
      <div className="mb-2 text-xs text-text-muted">
        {entries.length} {entries.length === 1 ? "chart" : "charts"}
      </div>
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-3 scrollbar-hide"
          style={{
            height: maxHeight,
            transition: "height 0.3s ease-out",
          }}
        >
          {entries.map(({ html, title }, idx) => (
            <div
              key={idx}
              className="snap-start shrink-0 w-full"
              ref={(el) => {
                if (el) {
                  slideRefs.current.set(idx, el);
                } else {
                  slideRefs.current.delete(idx);
                }
              }}
              style={{
                height: maxHeight,
                display: "flex",
                alignItems: "stretch",
                transition: "height 0.3s ease-out",
              }}
            >
              <div
                className="rounded-xl border border-border-main bg-surface p-2 shadow-sm w-full flex flex-col"
                style={{ height: "100%" }}
              >
                <IFrameWithHeightTracking
                  title={baseTitle || title || `Chart ${idx + 1}`}
                  content={{ kind: "html", value: html }}
                  size={{ mode: "auto", min: 240, max: 2400 }}
                  sandboxLevel="scripts"
                  onHeightChange={(height) => handleIframeResize(idx, height)}
                />
              </div>
            </div>
          ))}
        </div>
        {entries.length > 1 && (
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-8 z-10">
            <div className="pointer-events-auto flex items-center justify-center gap-2 px-1 rounded-full bg-surface/90 border border-border-main backdrop-blur">
              <button
                aria-label="Previous chart"
                onClick={() => goTo(Math.max(0, current - 1))}
                disabled={current === 0}
                className={`h-7 w-7 rounded-full flex items-center justify-center text-text-main ${
                  current === 0
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-background"
                }`}
              >
                ‹
              </button>
              <button
                aria-label="Next chart"
                onClick={() => goTo(Math.min(entries.length - 1, current + 1))}
                disabled={current === entries.length - 1}
                className={`h-7 w-7 rounded-full flex items-center justify-center text-text-main ${
                  current === entries.length - 1
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-background"
                }`}
              >
                ›
              </button>
            </div>
          </div>
        )}
        {/* Page indicator at top-right */}
        <div className="absolute right-2 -top-8 z-10">
          <div className="text-xs px-2 py-1  text-text-main">
            {current + 1} / {entries.length}
          </div>
        </div>
      </div>
      {/* Dots removed; using numeric page indicator instead */}
    </div>
  );
};

export { IFrameWithHeightTracking };
export default HtmlCarousel;
