/** Ignore placeholder / unreachable URLs from docs or unfilled `.env`. */
function resolveAssetUrl(
  envValue: string | undefined,
  fallback: string,
): string {
  const value = String(envValue ?? "").trim();
  if (!value) return fallback;
  if (/cdn\.example\.com/i.test(value)) return fallback;
  return value;
}

export const tenantAssets = {
  hasCustomLogo: Boolean(String(import.meta.env.VITE_LOGO_URL ?? "").trim()),
  logoUrl: resolveAssetUrl(
    import.meta.env.VITE_LOGO_URL,
    "/ThemeLogos/headerlogo.png",
  ),
  mobileLogoUrl: resolveAssetUrl(
    import.meta.env.VITE_MOBILE_LOGO_URL,
    "/ThemeLogos/headerlogomb.png",
  ),
  botLogoUrl: resolveAssetUrl(
    import.meta.env.VITE_BOT_LOGO_URL,
    "/BotLogos/NewtonLogo2.png",
  ),
  botLogoHeight: Number(import.meta.env.VITE_BOT_LOGO_HEIGHT ?? 48),
  botLogoWidth: Number(import.meta.env.VITE_BOT_LOGO_WIDTH ?? 48),
  chatbotIcon: resolveAssetUrl(
    import.meta.env.VITE_CHATBOT_ICON,
    "/BotLogos/Newton.jpg",
  ),
  favicon: resolveAssetUrl(import.meta.env.VITE_FAVICON, "/icons/favicon.svg"),
  loadingAnimation: resolveAssetUrl(
    import.meta.env.VITE_LOADING_ANIMATION,
    "/LoadingAnimations/NewtonLoading.json",
  ),
  loadingAnimationHeight: Number(
    import.meta.env.VITE_LOADING_ANIMATION_HEIGHT ?? 80,
  ),
  loadingAnimationWidth: Number(
    import.meta.env.VITE_LOADING_ANIMATION_WIDTH ?? 80,
  ),
} as const;
