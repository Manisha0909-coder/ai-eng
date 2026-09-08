import React, { useEffect, useMemo, useRef, useState } from "react";

type Content =
  | { kind: "html"; value: string }
  | { kind: "url"; value: string };

type SizeMode =
  | { mode: "auto"; min?: number; max?: number }
  | { mode: "fixed"; height: number }
  | { mode: "viewport"; vh?: number }
  | { mode: "aspect"; ratio: number };

type SandboxLevel = "strict" | "scripts" | "trusted";

type IFrameProps = {
  title: string;
  content: Content;
  className?: string;
  size?: SizeMode;
  sandboxLevel?: SandboxLevel;
  /**
   * Optional base URL to resolve relative asset/script paths when using srcDoc HTML.
   * Example: https://cdn.example.com/app/ so that <script src="./bundle.js"> resolves.
   */
  baseUrl?: string;
  loading?: "lazy" | "eager";
  allow?: string;
  allowFullScreen?: boolean;
};

const sandboxByLevel: Record<SandboxLevel, string> = {
  strict: "allow-same-origin",
  scripts: "allow-scripts",
  trusted:
    "allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts",
};

export default function IFrame({
  title,
  content,
  className,
  size = { mode: "auto", min: 240, max: 2400 },
  sandboxLevel = content.kind === "html" ? "scripts" : "strict",
  loading = "lazy",
  allow = "clipboard-read; clipboard-write; fullscreen",
  allowFullScreen = true,
  baseUrl,
}: IFrameProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [autoHeight, setAutoHeight] = useState<number | undefined>(undefined);

  const srcDoc = useMemo(() => {
    if (content.kind !== "html") return undefined;
    const html = content.value || "";
    // Strip SRI/crossorigin that can fail silently in srcDoc
    const cleanedHtml = html
      .replace(/integrity="[^"]*"/g, "")
      .replace(/crossorigin="[^"]*"/g, "");
    // Remove any autofocus attributes that can steal focus inside the iframe
    const withoutAutoFocus = cleanedHtml.replace(/\sautofocus(=[^ >]*)?/gi, "");
    const styleTag =
      "<style>html,body{margin:0;padding:0;overflow:hidden;height:100%;min-height:100%;display:flex;flex-direction:column}html>body>*{flex:1;min-height:0}::-webkit-scrollbar{display:none}*{scrollbar-width:none;-ms-overflow-style:none}.plotly-graph-div{min-height:320px;height:100%}div[class*='chart'],div[class*='graph'],div[id*='chart'],div[id*='graph']{min-height:100%;height:100%}svg{max-height:100%}</style>";
    const fixHeightScript =
      "<script>(function(){function fix(){try{var els=document.querySelectorAll('.plotly-graph-div');els.forEach(function(el){if((el.clientHeight||0)<50){el.style.height='400px';}});}catch(e){}};function stretchContent(){try{var html=document.documentElement;var body=document.body;if(html&&body){var iframeHeight=window.innerHeight||html.clientHeight;html.style.height=iframeHeight+'px';body.style.height=iframeHeight+'px';body.style.minHeight=iframeHeight+'px';var mainContent=body.querySelector('div[class*=\"chart\"],div[class*=\"graph\"],div[id*=\"chart\"],div[id*=\"graph\"],svg,canvas')||body.firstElementChild;if(mainContent){mainContent.style.flex='1';mainContent.style.minHeight='100%';mainContent.style.height='100%';}}var chartEls=document.querySelectorAll('[class*=\"chart\"],[class*=\"graph\"],[id*=\"chart\"],[id*=\"graph\"],svg');chartEls.forEach(function(el){el.style.flex='1';el.style.minHeight='100%';if(el.clientHeight<window.innerHeight*0.8){el.style.height=window.innerHeight+'px';}});}catch(e){}};function runBoth(){fix();stretchContent();}if(document.readyState==='complete'||document.readyState==='interactive'){runBoth();setTimeout(runBoth,50);setTimeout(runBoth,300);setTimeout(runBoth,1000);}else{document.addEventListener('DOMContentLoaded',function(){runBoth();setTimeout(runBoth,50);setTimeout(runBoth,300);setTimeout(runBoth,1000);});}window.addEventListener('resize',stretchContent);})();</script>";
    const baseTag = baseUrl && !/\<base\s/i.test(html)
      ? `<base href="${baseUrl.replace(/"/g, "&quot;")}">`
      : "";
    const inject = `${baseTag}${styleTag}${fixHeightScript}`;
    if (withoutAutoFocus.includes("</head>")) {
      return withoutAutoFocus.replace("</head>", `${inject}</head>`);
    }
    return `${inject}${withoutAutoFocus}`;
  }, [content, baseUrl]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    if (size.mode !== "auto") {
      setAutoHeight(undefined);
      return;
    }

    const onLoad = () => {
      try {
        const doc = el.contentDocument || el.contentWindow?.document;
        if (!doc) return;

        // Prevent focus-induced jump into iframe on load
        if (document.activeElement === el) {
          (document.activeElement as HTMLElement).blur();
          window.focus();
        }

        // Preserve scroll position while sizing changes occur
        const preserveScrollTop = () => {
          const currentTop = window.scrollY || window.pageYOffset;
          window.scrollTo({ top: currentTop });
        };

        const update = () => {
          // Try to get the actual content height, including any charts/visualizations
          let next = 0;
          
          // Check body scroll height first
          if (doc.body) {
            next = Math.max(
              doc.body.scrollHeight,
              doc.body.offsetHeight,
              doc.body.clientHeight
            );
          }
          
          // Check document element height
          const docHeight = Math.max(
            doc.documentElement?.scrollHeight || 0,
            doc.documentElement?.offsetHeight || 0,
            doc.documentElement?.clientHeight || 0
          );
          next = Math.max(next, docHeight);
          
          // Check for chart containers that might need more space
          try {
            const chartElements = doc.querySelectorAll('[class*="chart"],[class*="graph"],[id*="chart"],[id*="graph"],.plotly-graph-div,svg');
            chartElements.forEach((el: Element) => {
              const rect = el.getBoundingClientRect();
              if (rect.height > next) {
                next = rect.height;
              }
            });
          } catch (e) {
            // Ignore if querySelector fails
          }
          
          // Fallback to minimum if no height found
          if (next < (size.min ?? 200)) {
            next = size.min ?? 200;
          }
          
          const clamped = Math.min(
            Math.max(next, size.min ?? 200),
            size.max ?? 2400
          );
          setAutoHeight(clamped);
          preserveScrollTop();
        };

        // initial and follow-up updates for async charts
        update();
        requestAnimationFrame(() => { update(); });
        setTimeout(update, 250);
        setTimeout(update, 1000);

        const ro = new ResizeObserver(update);
        if (doc.body) ro.observe(doc.body);
        // observe DOM mutations as a fallback (Plotly mutates canvas late)
        const mo = new MutationObserver(update);
        mo.observe(doc.documentElement, { childList: true, subtree: true, attributes: true });
        // Notify host app that iframe is ready (CDN/content loaded)
        try {
          window.dispatchEvent(
            new CustomEvent("IFRAME_READY", { detail: { title } })
          );
        } catch {}

        return () => {
          ro.disconnect();
          mo.disconnect();
        };
      } catch {
        setAutoHeight(undefined);
        try {
          window.dispatchEvent(
            new CustomEvent("IFRAME_READY", { detail: { title, error: true } })
          );
        } catch {}
      }
    };

    el.addEventListener("load", onLoad);
    return () => el.removeEventListener("load", onLoad);
  }, [size]);

  // Prevent iframe from ever taking focus by blurring immediately if it does
  useEffect(() => {
    const iframeEl = frameRef.current;
    if (!iframeEl) return;

    const restoreFocus = () => {
      // Prefer focusing wrapper (keeps layout local), else body/window
      if (wrapperRef.current) {
        try { wrapperRef.current.focus({ preventScroll: true }); } catch {}
      } else {
        try { (document.body as HTMLElement).focus({ preventScroll: true }); } catch {}
        try { window.focus(); } catch {}
      }
    };

    const blurIfIframeFocused = () => {
      if (document.activeElement === iframeEl) {
        try { iframeEl.blur(); } catch {}
        restoreFocus();
      }
    };

    // Listen for focus events at the window level (captures late focus too)
    const onFocusIn = () => blurIfIframeFocused();
    window.addEventListener("focusin", onFocusIn);

    // Also attach directly to the iframe (capture phase)
    const onIframeFocus = () => blurIfIframeFocused();
    iframeEl.addEventListener("focus", onIframeFocus, true);

    // Initial defocus attempts in case it grabs focus during attach
    setTimeout(blurIfIframeFocused, 0);
    setTimeout(blurIfIframeFocused, 200);
    setTimeout(blurIfIframeFocused, 600);

    return () => {
      window.removeEventListener("focusin", onFocusIn);
      iframeEl.removeEventListener("focus", onIframeFocus, true);
    };
  }, []);

  const style: React.CSSProperties = useMemo(() => {
    if (size.mode === "fixed") return { height: size.height, border: 0 };
    if (size.mode === "viewport")
      return { height: `${size.vh ?? 70}vh`, border: 0 };
    if (size.mode === "aspect")
      return { aspectRatio: `${size.ratio}`, width: "100%", border: 0 };
    return { height: autoHeight ?? (content.kind === "url" ? 560 : 320), border: 0 };
  }, [size, autoHeight, content]);

  const iframeProps = content.kind === "html" ? { srcDoc } : { src: content.value };

  return (
    <div
      className={[
        "w-full rounded-xl overflow-hidden ring-1 ring-white/10 shadow-lg scrollbar-hide",
        // "bg-[rgba(31,41,55,0.5)] backdrop-blur",
        className || "",
      ].join(" ")}
      ref={wrapperRef}
      style={{ overflowAnchor: "none", height: "100%", display: "flex", flexDirection: "column" }}
    >
      <iframe
        ref={frameRef}
        title={title}
        {...iframeProps}
        sandbox={sandboxByLevel[sandboxLevel]}
        loading={loading}
        allow={allow}
        allowFullScreen={allowFullScreen}
        className="block w-full bg-transparent flex-1"
        style={{ ...style, flex: 1, minHeight: 0 }}
        tabIndex={-1}
        scrolling="no"
        aria-hidden="true"
      />
    </div>
  );
}


