import * as React from "react";

import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "w-icon-sm h-icon-sm",
  md: "w-icon-md h-icon-md",
  lg: "w-icon-lg h-icon-lg",
} as const;

const variantClasses = {
  ghost: "hover:bg-surface",
  overlay: "hover:bg-surface/50",
  solid: "bg-primary text-white hover:bg-primary/90",
} as const;

const shapeClasses = {
  circle: "rounded-full",
  square: "rounded-lg",
} as const;

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  size?: keyof typeof sizeClasses;
  variant?: keyof typeof variantClasses;
  shape?: keyof typeof shapeClasses;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      size = "md",
      variant = "ghost",
      shape = "circle",
      type = "button",
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center shrink-0 text-text-main transition-colors duration-200",
          "[&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
          "[&_svg]:stroke-text-main",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          sizeClasses[size],
          variantClasses[variant],
          shapeClasses[shape],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";

export { IconButton };
