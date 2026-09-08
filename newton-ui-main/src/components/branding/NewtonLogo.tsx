import { cn } from "@/lib/utils";

import markDark from "@/assets/brand/newton-mark-dark.png";
import markLight from "@/assets/brand/newton-mark-light.png";
import lockupDark from "@/assets/brand/newton-lockup-dark.png";
import lockupLight from "@/assets/brand/newton-lockup-light.png";
import stackedDark from "@/assets/brand/newton-stacked-dark.png";
import stackedLight from "@/assets/brand/newton-stacked-light.png";

/** Three artwork variants, each with a light-mode (black ink) and a dark-mode
 *  (white ink) rendering. Ratios are the intrinsic size of the trimmed art, so
 *  callers only ever specify a height and the width follows. */
const VARIANTS = {
  mark:    { light: markLight,    dark: markDark,    ratio: 181 / 171 },
  lockup:  { light: lockupLight,  dark: lockupDark,  ratio: 266 / 120 },
  stacked: { light: stackedLight, dark: stackedDark, ratio: 181 / 216 },
} as const;

type Variant = keyof typeof VARIANTS;

interface BrandImageProps {
  /** Rendered height in px; width is derived from the artwork's aspect ratio. */
  size?: number;
  className?: string;
}

function BrandImage({
  variant,
  size,
  className,
}: BrandImageProps & { variant: Variant; size: number }) {
  const { light, dark, ratio } = VARIANTS[variant];
  return (
    <span
      role="img"
      aria-label="Newton"
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      style={{ height: size, width: Math.round(size * ratio) }}
    >
      <img
        src={light}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-full w-full object-contain select-none dark:hidden"
      />
      <img
        src={dark}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="hidden h-full w-full object-contain select-none dark:block"
      />
    </span>
  );
}

interface NewtonMarkProps extends BrandImageProps {
  /** `current` paints the mark in the inherited text color instead of swapping
   *  the light/dark artwork — for placement on a filled (e.g. primary) surface
   *  where neither the black nor the white rendering would read. */
  tone?: "default" | "current";
}

export function NewtonMark({ size = 18, tone = "default", className }: NewtonMarkProps) {
  if (tone === "current") {
    const maskUrl = `url(${markDark})`;
    return (
      <span
        role="img"
        aria-label="Newton"
        className={cn("inline-block shrink-0 bg-current", className)}
        style={{
          height: size,
          width: Math.round(size * VARIANTS.mark.ratio),
          maskImage: maskUrl,
          WebkitMaskImage: maskUrl,
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
      />
    );
  }
  return <BrandImage variant="mark" size={size} className={className} />;
}

/** Horizontal lockup — the mark doubles as the N of "NEWTON". Replaces a
 *  mark + wordmark pair; don't set a separate "Newton" label beside it. */
export function NewtonLockup({ size = 18, className }: BrandImageProps) {
  return <BrandImage variant="lockup" size={size} className={className} />;
}

/** Stacked lockup — mark above the wordmark, for large brand moments. */
export function NewtonStacked({ size = 72, className }: BrandImageProps) {
  return <BrandImage variant="stacked" size={size} className={className} />;
}

export function NewtonAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15",
        className,
      )}
    >
      <NewtonMark size={26} tone="current" className="text-primary" />
    </div>
  );
}
