import { useState, useRef, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function SmartTooltipText({ 
  text, 
  className = "",
  maxWidth
}: { 
  text: string; 
  className?: string;
  maxWidth?: string;
}) {
  const [isTruncated, setIsTruncated] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const compute = () => setIsTruncated(el.scrollWidth > el.clientWidth);
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [text]);

  const handleTouch = () => {
    if (isTruncated) setShowTooltip((prev) => !prev);
  };

  const handleMouseEnter = () => isTruncated && setShowTooltip(true);
  const handleMouseLeave = () => setShowTooltip(false);

  const maxWidthClass = maxWidth || "max-w-[150px]";

  return (
    <TooltipProvider>
      <Tooltip open={showTooltip}>
        <TooltipTrigger
          asChild
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouch}
        >
          <div ref={textRef} className={`truncate ${maxWidthClass} cursor-default ${className}`}>
            {text}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="text-xs px-2 py-1 bg-surface text-text-main border border-border-main rounded-md"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default SmartTooltipText;


