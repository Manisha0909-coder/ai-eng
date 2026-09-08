import { Copy, Download, Loader2 } from "lucide-react";
import React, { useCallback, useState } from "react";
import { Components } from "react-markdown";
import notify from "@/utils/notify";
import { getFetchUrlForImage, isImageUrl } from "./utils";
import type { CodeProps } from "./types";

export {
  chatSanitizeSchema,
  decodeUnicodeEscapes,
  fixStreamingChunks,
  isImageUrl,
  getFetchUrlForImage,
  normalizeMarkdownForDisplay,
  prepareMarkdownContent,
  preprocessMarkdownContent,
  preprocessMarkdownStructure,
  rehypeStripBreakNewlines,
  unescapeMarkdownNewlines,
} from "./utils";

function extractCodeText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractCodeText).join("");
  if (React.isValidElement(node)) {
    return extractCodeText(node.props.children);
  }
  return "";
}

const LANGUAGE_LABELS: Record<string, string> = {
  js: "JavaScript",
  ts: "TypeScript",
  tsx: "TSX",
  jsx: "JSX",
  py: "Python",
  python: "Python",
  json: "JSON",
  sql: "SQL",
  bash: "Bash",
  sh: "Shell",
  html: "HTML",
  css: "CSS",
  md: "Markdown",
  yaml: "YAML",
  yml: "YAML",
};

function formatLanguageLabel(lang: string): string {
  if (!lang) return "Code";
  return LANGUAGE_LABELS[lang.toLowerCase()] ?? lang.charAt(0).toUpperCase() + lang.slice(1);
}

const CodeBlockPre: React.FC<React.ComponentPropsWithoutRef<"pre">> = ({
  children,
  ...props
}) => {
  const [copied, setCopied] = useState(false);

  const child = React.Children.toArray(children).find(React.isValidElement) as
    | React.ReactElement<{ className?: string; children?: React.ReactNode }>
    | undefined;

  const className = child?.props?.className ?? "";
  const langMatch = /language-([\w-]+)/.exec(className);
  const lang = langMatch?.[1] ?? "";

  const handleCopy = useCallback(async () => {
    const text = extractCodeText(child?.props?.children);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error("Failed to copy code");
    }
  }, [child]);

  return (
    <div className="code-block not-prose">
      <div className="code-block-hdr">
        <span className="text-2xs font-mono text-text-muted">
          {formatLanguageLabel(lang)}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-2xs text-text-muted transition-colors hover:text-text-main"
        >
          <Copy size={12} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre {...props}>{children}</pre>
    </div>
  );
};

// Renders links in markdown; for image URLs shows preview + Download instead of redirecting
const ImageLinkRenderer: React.FC<{
  href?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}> = ({ href, children, ...props }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!href || downloading) return;
      setDownloading(true);
      try {
        const fetchUrl = getFetchUrlForImage(href);
        const response = await fetch(fetchUrl, { credentials: "include" });
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        const filename = href.split("/").pop()?.split("?")[0] || "image.jpg";
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      } catch {
        notify.error("Failed to download image");
      } finally {
        setDownloading(false);
      }
    },
    [href, downloading],
  );

  if (href && isImageUrl(href)) {
    return (
      <span className="my-1 inline-flex max-w-full flex-col items-start gap-2 rounded-lg border border-border-main bg-surface p-2 sm:flex-row sm:items-center">
        <span className="max-w-[280px] truncate break-all text-sm opacity-90 sm:max-w-[400px]">
          {children}
        </span>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary/20 px-2.5 py-1 text-sm font-medium text-primary hover:bg-primary/30 disabled:opacity-60"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading ? "Downloading..." : "Download"}
        </button>
      </span>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
};

export const MarkdownComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="markdown-table-wrap scrollbar-themed">
      <table {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => <thead {...props}>{children}</thead>,
  th: ({ children, ...props }) => <th {...props}>{children}</th>,
  tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
  tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,
  td: ({ children, ...props }) => <td {...props}>{children}</td>,
  h1: ({ children, ...props }) => <h1 {...props}>{children}</h1>,
  h2: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
  h3: ({ children, ...props }) => <h3 {...props}>{children}</h3>,
  h4: ({ children, ...props }) => <h4 {...props}>{children}</h4>,
  h5: ({ children, ...props }) => <h5 {...props}>{children}</h5>,
  h6: ({ children, ...props }) => <h6 {...props}>{children}</h6>,
  img: ({ src, alt, ...props }) => (
    <img src={src} alt={alt} loading="lazy" {...props} />
  ),
  hr: ({ ...props }) => <hr className="spectrum-hr" {...props} />,
  br: ({ ...props }) => <br {...props} />,
  code: ({ children, className, inline, ...props }: CodeProps) => {
    const hasLanguageClass = className && className.startsWith("language-");
    const isInlineCode =
      inline === true || (!hasLanguageClass && inline !== false);

    if (isInlineCode) {
      return (
        <code className="inline-code" dir="ltr" {...props}>
          {children}
        </code>
      );
    }

    return (
      <code className={className} dir="ltr" {...props}>
        {children}
      </code>
    );
  },
  pre: CodeBlockPre,
  p: ({ children, ...props }) => (
    <p style={{ whiteSpace: "pre-line" }} {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => <ul {...props}>{children}</ul>,
  ol: ({ children, ...props }) => <ol {...props}>{children}</ol>,
  li: ({ children, ...props }) => <li {...props}>{children}</li>,
  blockquote: ({ children, ...props }) => (
    <blockquote {...props}>{children}</blockquote>
  ),
  strong: ({ children, ...props }) => <strong {...props}>{children}</strong>,
  em: ({ children, ...props }) => <em {...props}>{children}</em>,
  del: ({ children, ...props }) => <del {...props}>{children}</del>,
  a: ({ children, href, ...props }) => (
    <ImageLinkRenderer href={href} {...props}>
      {children}
    </ImageLinkRenderer>
  ),
};

export const ReasoningMarkdownComponents: Components = {
  ...MarkdownComponents,
  pre: ({ children, ...props }) => (
    <pre {...props}>{children}</pre>
  ),
};

export default MarkdownComponents;
