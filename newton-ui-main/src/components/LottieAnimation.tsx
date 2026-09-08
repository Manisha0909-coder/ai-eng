import React from "react";
import LottieImport, { type LottieComponentProps } from "lottie-react";

/**
 * Vite's lottie-vendor chunk exposes `default` as a module object
 * (`{ default: Lottie, useLottie, ... }`), not the component itself.
 * Resolve the actual component before rendering.
 */
const Lottie: React.FC<LottieComponentProps> =
  typeof LottieImport === "function"
    ? (LottieImport as React.FC<LottieComponentProps>)
    : (LottieImport as { default: React.FC<LottieComponentProps> }).default;

export default Lottie;
