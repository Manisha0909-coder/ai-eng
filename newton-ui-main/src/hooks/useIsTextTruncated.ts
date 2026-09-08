import { useEffect, useRef, useState } from "react";

/**
 * Hook to detect if text content is truncated based on view height/width
 * @param text - The text content to check
 * @param checkHeight - Whether to check for height-based truncation (default: true)
 * @param checkWidth - Whether to check for width-based truncation (default: false)
 * @param isExpanded - Whether the content is currently expanded (affects truncation check)
 * @param lineClampLines - Number of lines for line-clamp (default: 2)
 * @returns Object with ref to attach to element and isTruncated boolean
 */
export function useIsTextTruncated(
  text: string,
  checkHeight: boolean = true,
  checkWidth: boolean = false,
  isExpanded: boolean = false,
  lineClampLines: number = 2
) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const wasTruncatedRef = useRef<boolean>(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const computeTruncation = () => {
      if (!element) return;
      
      let truncated = false;
      
      if (checkHeight) {
        if (!isExpanded) {
          // When collapsed, check actual truncation and store it
          truncated = element.scrollHeight > element.clientHeight;
          wasTruncatedRef.current = truncated;
        } else {
          // When expanded, use the stored truncated state
          // But also re-check by comparing natural height to expected collapsed height
          // This handles cases where content changes or window resizes
          const computedStyle = window.getComputedStyle(element);
          const fontSize = parseFloat(computedStyle.fontSize);
          const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.5;
          // Account for padding if any
          const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
          const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
          const expectedCollapsedHeight = (lineHeight * lineClampLines) + paddingTop + paddingBottom;
          
          truncated = element.scrollHeight > expectedCollapsedHeight;
          wasTruncatedRef.current = truncated;
        }
      }
      
      if (checkWidth && !truncated) {
        truncated = element.scrollWidth > element.clientWidth;
      }
      
      setIsTruncated(truncated);
    };

    // Initial check
    computeTruncation();

    // Set up ResizeObserver to handle dynamic content and window resize
    const resizeObserver = new ResizeObserver(computeTruncation);
    resizeObserver.observe(element);
    window.addEventListener("resize", computeTruncation);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", computeTruncation);
    };
  }, [text, checkHeight, checkWidth, isExpanded, lineClampLines]);

  return { ref, isTruncated };
}
