import { defaultSchema } from "rehype-sanitize";
import { Message, MessageTimelineEntry } from "@/types/message";

/**
 * True when the assistant bubble has body text to show — `message.content` or an
 * `assistant_message` entry in the timeline. Used to leave the LoadingMessage
 * loader once real assistant text exists.
 */
export function assistantHasRenderableBody(message: Message): boolean {
  if (message.type !== "assistant") return false;
  if (message.content?.trim()) return true;
  return (
    message.message_timeline?.some((e) => {
      if (e.type !== "assistant_message") return false;
      const content = (e as { content?: string }).content;
      return typeof content === "string" && content.trim().length > 0;
    }) ?? false
  );
}

// Strip dangerous HTML (script/iframe/event handlers) from AI-generated markdown.
// Builds on rehype-sanitize's GitHub-compatible default and keeps syntax-highlight
// classNames so rehype-highlight still works.
export const chatSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), ["className", /^language-/]],
    span: [...(defaultSchema.attributes?.span || []), ["className"]],
    div: [
      ...(defaultSchema.attributes?.div || []),
      ["className", /^callout(-\w+)?$/],
    ],
    p: [...(defaultSchema.attributes?.p || []), ["className", /^callout-/]],
  },
  clobberPrefix: "",
};

// react-markdown serializes a markdown hard break (trailing two spaces) into a
// `<br>` element FOLLOWED by a literal "\n" text node. The paragraph renderer
// uses `white-space: pre-line` to preserve intentional soft-break newlines,
// which unfortunately also renders that redundant "\n" as a SECOND line break —
// so every hard-broken line ends up double-spaced. This plugin strips the lone
// leading newline that immediately follows a `<br>`, leaving the single visual
// break from the element while keeping genuine soft-break newlines intact.
export const rehypeStripBreakNewlines = () => (tree: any) => {
  const walk = (node: any) => {
    if (!node || !Array.isArray(node.children)) return;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child?.type === "element" && child.tagName === "br") {
        const next = node.children[i + 1];
        if (
          next &&
          next.type === "text" &&
          typeof next.value === "string" &&
          next.value.startsWith("\n")
        ) {
          next.value = next.value.replace(/^\n/, "");
        }
      }
      walk(child);
    }
  };
  walk(tree);
};

// Detect if URL is an image (file API or common image extensions)
export const isImageUrl = (href: string | undefined): boolean => {
  if (!href || typeof href !== "string") return false;
  const lower = href.toLowerCase();
  if (lower.includes("/api/file/") || lower.includes("/file/")) return true;
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(href);
};

// In dev, rewrite gotalk.dev URLs to same-origin path so Vite proxy is used (avoids CORS)
export const getFetchUrlForImage = (url: string): string => {
  if (import.meta.env.DEV && url.startsWith("https://gotalk.dev")) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }
  return url;
};

// Normalize assistant content to better match markdown expectations.
// - Converts leading "• " bullet lines into "- " so ReactMarkdown renders <ul>/<li>.
// - Does not touch fenced code blocks (```), to avoid changing code snippets.
export const normalizeMarkdownForDisplay = (text: string): string => {
  if (!text) return text;
  const parts = text.split("```");
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(/^(\s*)•\s+/gm, "$1- ");
  }
  return parts.join("```");
};

export const fixStreamingChunks = (content: string): string => {
  if (!content) return content;
  let fixed = content
    .replace(/:\s*"}\s*n(\d+\.)/g, ":\n$1")
    .replace(/:\s*\\"\s*}\s*n(\d+\.)/g, ":\n$1")
    .replace(/:\s*"}\s*n(\S)/g, ":\n$1")
    .replace(/:\s*\\"\s*}\s*n(\S)/g, ":\n$1")
    .replace(/:\s*n(\d+\.)/g, ":\n$1")
    .replace(/:\s*n(\S)/g, ":\n$1")
    .replace(/([A-Za-z])n(\d+\.)/g, "$1\n$2")
    .replace(/:\s*"}\s*n/g, ":\n")
    .replace(/:\s*\\"\s*}\s*n/g, ":\n")
    .replace(/:"n/g, ":\n")
    .replace(/:\\"n/g, ":\n");
  return fixed;
};

/** Table / bold-label / blank-line cleanup — no streaming-corruption heuristics. */
export const preprocessMarkdownStructure = (content: string): string => {
  if (!content) return content;
  let processedContent = content;

  if (processedContent.includes("| **Upcoming Courses**")) {
    const parts = processedContent.split("\n\n| **Upcoming Courses**");
    if (parts.length === 2) {
      const firstTablePart = parts[0];
      const secondTablePart = parts[1];
      let upcomingCoursesSection = secondTablePart;
      const headerRow =
        "| **Upcoming Courses** | **Instructor** | **Category** | **Dates** | **Duration (days)** |";
      const separatorRow = "| --- | --- | --- | --- | --- |";
      if (!upcomingCoursesSection.includes(separatorRow)) {
        const lines = upcomingCoursesSection.split("\n");
        if (lines.length > 0) {
          upcomingCoursesSection = [
            headerRow,
            separatorRow,
            ...lines.slice(1),
          ].join("\n");
        }
      }
      processedContent = firstTablePart + "\n\n" + upcomingCoursesSection;
    }
  }

  const lines = processedContent.split("\n");
  const processedLines = lines.map((line) => {
    if (line.includes("|") && !line.includes("---")) {
      const cells = line.split("|");
      if (cells.length >= 2) {
        return cells.map((cell) => cell.trim()).join(" | ");
      }
    }
    return line;
  });

  let result = processedLines.join("\n");
  let prevResult = "";
  while (prevResult !== result) {
    prevResult = result;
    result = result.replace(
      /(\*\*[^*]+\*\*:\s*[^\n]+)\n(\*\*[^*]+\*\*:)/g,
      "$1\n\n$2",
    );
  }
  result = result.replace(
    /(\*\*[^*]+\*\*:\s*[^\n]+)\n\s*\n(\*\*[^*]+\*\*:)/g,
    "$1\n\n$2",
  );
  result = result.replace(/\n{3,}/g, "\n\n");
  return result;
};

export const preprocessMarkdownContent = (content: string): string => {
  if (!content) return content;
  let processedContent = fixStreamingChunks(content);
  processedContent = processedContent
    .replace(/:\\"}\s*n(?=\n|$)/g, ":\n")
    .replace(/:\\"}n(?=\n|$)/g, ":\n")
    .replace(/:"}\s*n(?=\n|$)/g, ":\n")
    .replace(/:"}\s*n/g, ":\n")
    .replace(/:\\"}\s*n/g, ":\n")
    .replace(/:\s*n(?=\d+\.)/g, ":\n")
    .replace(/:\s*"}\s*n/g, ":\n")
    .replace(/:"n/g, ":\n");

  return preprocessMarkdownStructure(processedContent);
};

export const decodeUnicodeEscapes = (str: string): string => {
  if (!str) return str;
  try {
    let decoded = fixStreamingChunks(str);
    decoded = decoded.replace(/\\u([0-9a-fA-F]{4})/g, (hex) =>
      String.fromCharCode(parseInt(hex.slice(2), 16)),
    );
    decoded = decoded
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, "\\");
    decoded = decoded
      .replace(/:\\"}\s*n(?=\n|$)/g, ":\n")
      .replace(/:\\"}n(?=\n|$)/g, ":\n")
      .replace(/:"}\s*n(?=\n|$)/g, ":\n")
      .replace(/:"}\s*n/g, ":\n")
      .replace(/:\\"}\s*n/g, ":\n")
      .replace(/:\s*n(?=\d+\.)/g, ":\n")
      .replace(/:\s*"}\s*n/g, ":\n")
      .replace(/:"n/g, ":\n");
    return decoded;
  } catch (error) {
    return str;
  }
};

/**
 * Apply a transform only outside fenced code blocks so ```...``` samples
 * keep literal `\n`, `\t`, `\uXXXX`, etc.
 */
const mapOutsideCodeFences = (
  text: string,
  transform: (segment: string) => string,
): string => {
  if (!text) return text;
  const parts = text.split("```");
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = transform(parts[i]);
  }
  return parts.join("```");
};

/**
 * Convert JSON-style `\n` / `\r` / `\t` into real whitespace for markdown
 * parsing, without the blanket decodeUnicodeEscapes footguns.
 *
 * Only unescapes newlines that look structural (paragraph breaks, list/heading
 * markers, RTL letters, EOF) so Windows paths like `C:\new\folder` and
 * prose like `\u0600` stay intact. Tabs only unescape at boundaries (not `\tmp`).
 */
export const unescapeMarkdownNewlines = (text: string): string => {
  if (!text) return text;

  return (
    text
      // Paragraph breaks first so paired escapes become real blank lines
      .replace(/\\n\\n/g, "\n\n")
      // Markdown hard breaks: two trailing spaces + escaped newline
      .replace(/ {2}\\n/g, "  \n")
      // Single escaped newline before markdown structure, whitespace, RTL, or EOS
      .replace(
        /\\n(?=[-*+#|>!`\[\]]|\d+\.|\s|[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]|$)/g,
        "\n",
      )
      .replace(/\\r\\n/g, "\r\n")
      .replace(/\\r(?=\n|$)/g, "\r")
      // Avoid turning `\tmp` into a tab + `mp`
      .replace(/\\t(?=\s|$)/g, "\t")
  );
};

/**
 * Display prep for assistant markdown (timeline + legacy).
 * Unescapes structural newlines (fixes Arabic/escaped-MD lists) while avoiding
 * decodeUnicodeEscapes side effects on paths, unicode discussions, and prose.
 * Code fences are excluded so snippets keep literal escapes.
 */
export const prepareMarkdownContent = (content: string): string => {
  if (!content) return content;
  return normalizeMarkdownForDisplay(
    mapOutsideCodeFences(content, (segment) =>
      preprocessMarkdownStructure(unescapeMarkdownNewlines(segment)),
    ),
  );
};

/** Arabic-only (no Latin letters) assistant text → action bar aligns to end under the bubble. */
export const isPrimarilyArabicScript = (text: string): boolean => {
  if (!text || !text.trim()) return false;
  const arabicPattern =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\FB50-\uFDFF\uFE70-\uFEFF]/;
  const hasArabic = arabicPattern.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  return hasArabic && !hasLatin;
};

export const groupTimelineEntries = (timeline: MessageTimelineEntry[]) => {
  if (!timeline) return [];
  const groups: any[] = [];
  const processGroup: any[] = [];

  timeline.forEach((entry) => {
    if (entry.type === "reasoning" || entry.type === "tool_call") {
      processGroup.push({ ...entry });
    } else if (entry.type === "tool_return") {
      // Update the status of the corresponding tool call in processGroup
      const toolCall = processGroup.find(
        (tg) =>
          tg.type === "tool_call" && tg.tool_call_id === entry.tool_call_id,
      );
      if (toolCall) {
        toolCall.status = entry.status;
        toolCall.duration = entry.duration;
      }
    } else if (entry.type === "assistant_message") {
      // Reasoning/tool events between assistant chunks create separate timeline
      // entries, but those are hoisted into process_group above — merge the
      // fragments so they render as one continuous paragraph.
      const last = groups[groups.length - 1];
      if (last?.type === "assistant_message") {
        groups[groups.length - 1] = {
          ...last,
          content: (last.content ?? "") + (entry.content ?? ""),
          timestamp: entry.timestamp || last.timestamp,
        };
      } else {
        groups.push({ ...entry });
      }
    } else {
      groups.push(entry);
    }
  });

  if (processGroup.length > 0) {
    // Always render thoughts & tools at the top for a consistent UI position
    groups.unshift({
      type: "process_group",
      entries: processGroup,
    });
  }

  return groups;
};

// In-memory cache to avoid refetching the same authenticated images
export const imageBlobUrlCache: Map<string, string> = new Map();
// Track in-flight requests to dedupe parallel fetches
export const inflightImageRequests: Map<string, Promise<string>> = new Map();
