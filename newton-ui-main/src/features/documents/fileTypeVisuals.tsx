import {
  FileText,
  FileSpreadsheet,
  FileImage,
  FileCode2,
  FileType,
  File as FileIcon,
  Presentation,
  RefreshCw,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Per-file-type icon + colors, keyed by extension/format. Shared by the admin
 *  DocumentsSection table and the user-panel DocumentsTab so both stay in sync. */
export interface FileTypeVisual {
  icon: LucideIcon;
  /** text-color class for the icon */
  color: string;
  /** background tint class for the icon container */
  bg: string;
  /** full class string for a color-coded format chip (bg + text + border) */
  pillClass: string;
}

export const DEFAULT_FILE_VISUAL: FileTypeVisual = {
  icon: FileIcon,
  color: "text-text-muted",
  bg: "bg-surface-2",
  pillClass: "bg-surface-2 text-text-muted border-border-main",
};

const DOC_VISUAL: FileTypeVisual = {
  icon: FileText,
  color: "text-blue-500",
  bg: "bg-blue-500/10",
  pillClass: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

const SHEET_VISUAL: FileTypeVisual = {
  icon: FileSpreadsheet,
  color: "text-status-success",
  bg: "bg-status-success/10",
  pillClass: "bg-status-success/10 text-status-success border-status-success/20",
};

const SLIDES_VISUAL: FileTypeVisual = {
  icon: Presentation,
  color: "text-orange-500",
  bg: "bg-orange-500/10",
  pillClass: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

const IMAGE_VISUAL: FileTypeVisual = {
  icon: FileImage,
  color: "text-violet-500",
  bg: "bg-violet-500/10",
  pillClass: "bg-violet-500/10 text-violet-500 border-violet-500/20",
};

const MARKUP_VISUAL: FileTypeVisual = {
  icon: FileType,
  color: "text-amber-500",
  bg: "bg-amber-500/10",
  pillClass: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

export const FILE_TYPE_VISUALS: Record<string, FileTypeVisual> = {
  pdf: {
    icon: FileText,
    color: "text-status-error",
    bg: "bg-status-error/10",
    pillClass: "bg-status-error/10 text-status-error border-status-error/20",
  },
  doc: DOC_VISUAL,
  docx: DOC_VISUAL,
  xls: SHEET_VISUAL,
  xlsx: SHEET_VISUAL,
  csv: SHEET_VISUAL,
  ppt: SLIDES_VISUAL,
  pptx: SLIDES_VISUAL,
  jpg: IMAGE_VISUAL,
  jpeg: IMAGE_VISUAL,
  png: IMAGE_VISUAL,
  html: {
    icon: FileCode2,
    color: "text-sky-500",
    bg: "bg-sky-500/10",
    pillClass: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  },
  md: MARKUP_VISUAL,
  asciidoc: MARKUP_VISUAL,
  adoc: MARKUP_VISUAL,
};

/** Resolve a visual from a file format ("pdf") or a filename ("report.pdf"). */
export function getFileTypeVisual(formatOrName: string | null | undefined): FileTypeVisual {
  const raw = (formatOrName || "").trim().toLowerCase();
  if (!raw) return DEFAULT_FILE_VISUAL;
  // Take the part after the last dot if it looks like a filename, else use as-is.
  const key = (raw.includes(".") ? raw.split(".").pop() || raw : raw).replace(/^\./, "");
  return FILE_TYPE_VISUALS[key] ?? DEFAULT_FILE_VISUAL;
}

export interface DocFileIconProps {
  /** File format/extension ("pdf") — preferred source. */
  format?: string | null;
  /** Filename ("report.pdf") — used to derive the extension when `format` is absent. */
  name?: string | null;
  /** Processing progress 0-100. When 1-99, a spinner overlays the type icon. -1 or `hasFailed` shows a retry glyph. Status 0 (queued) keeps the type icon. */
  status?: number | null;
  hasFailed?: boolean;
  className?: string;
  iconSize?: number;
}

/** Tinted, file-type-aware icon square. Pass `status`/`hasFailed` to overlay
 *  processing (spinner) or failed (retry) states — omit them for a plain type icon. */
export function DocFileIcon({
  format,
  name,
  status,
  hasFailed,
  className,
  iconSize = 16,
}: DocFileIconProps) {
  const { icon: Icon, color, bg } = getFileTypeVisual(format || name);
  const isFailed = hasFailed || status === -1;
  // Queued (0) keeps the type icon; only in-flight progress shows a spinner.
  const isProcessing = typeof status === "number" && status > 0 && status < 100;

  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        isFailed ? "bg-status-error/10" : bg,
        className,
      )}
    >
      {isFailed ? (
        <RefreshCw size={iconSize - 2} className="text-status-error" />
      ) : isProcessing ? (
        <Loader2 size={iconSize - 2} className={cn(color, "animate-spin")} />
      ) : (
        <Icon size={iconSize} className={color} />
      )}
    </div>
  );
}
