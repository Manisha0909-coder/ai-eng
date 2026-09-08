import React, { useState, useCallback, useRef, useEffect, memo, useMemo } from "react";
import type { ReactNode } from "react";
import Lottie from "@/components/LottieAnimation";
import cardLoadingAnimation from "@/assets/loading.json";
import { imageLoadQueue } from "@/utils/imageLoadQueue";
import axios from "axios";
import FullScreenViewer from "./FullScreenViewer";
import FlightDetailsModal from "./FlightDetailsModal";
import { API_CONFIG } from "@/config/api";


// Global modal state manager to track which card is being displayed
const modalState = {
  isOpen: false,
  activeCardId: null as string | null,
  setActiveCard: (id: string | null) => {
    modalState.activeCardId = id;
    modalState.isOpen = id !== null;
  }
};

export type ContentItem = {
  image?: { type: "url"; value: string };
  title?: { type: "text"; value: string };
  description?: { type: "text"; value: string };
  footer?: { type: "text"; value: string };
  metadata?: {
    linkUrl?: string;
    variant?: string;
    interactionType?: "link" | "button";
    departureToken?: string;
  };
};

interface CardProps {
  /** Unique identifier for the card (used for expansion state) */
  id?: string;
  /** Content items - can be array or single object */
  content?: ContentItem[] | ContentItem;
  /** Image URL or JSX element (legacy, for backward compatibility) */
  image?: string | ReactNode;
  /** Title string or JSX (legacy, for backward compatibility) */
  title?: string | ReactNode;
  /** Description string or JSX (legacy, for backward compatibility) */
  description?: string | ReactNode;
  /** Optional footer content (JSX or string) (legacy, for backward compatibility) */
  footer?: string | ReactNode;
  /** Optional click handler */
  onClick?: () => void;
  /** Card orientation - portrait (default) or landscape */
  orientation?: "portrait" | "landscape";
  /** Card category for specialized styling */
  category?: string;
  /** Optional additional CSS classes for the card container */
  className?: string;
  /** Optional CSS classes for the image container */
  imageClassName?: string;
  /** Optional CSS classes for the content container */
  contentClassName?: string;
  /** Optional CSS classes for the title container */
  titleClassName?: string;
  /** Optional CSS classes for the description container */
  descriptionClassName?: string;
  /** Optional CSS classes for the footer container */
  footerClassName?: string;
  /** Whether the card contains only an image with no text content */
  isImageOnly?: boolean;
}

interface AuthenticatedImageProps {
  src: string;
  alt: string;
  className: string;
  fallbackSrc?: string;
}

// Global image batch management
class ImageBatchManager {
  private static instance: ImageBatchManager;
  private batchQueue: Array<{url: string, resolve: (blobUrl: string) => void, reject: (error: Error) => void}> = [];
  private isProcessing = false;
  private readonly BATCH_SIZE = 4; // Process 4 images at a time
  private readonly BATCH_DELAY = 150; // 150ms between batches

  static getInstance(): ImageBatchManager {
    if (!ImageBatchManager.instance) {
      ImageBatchManager.instance = new ImageBatchManager();
    }
    return ImageBatchManager.instance;
  }

  async addToBatch(url: string): Promise<string> {
    // Return cached URL immediately if available
    const cached = imageBlobUrlCache.get(url);
    if (cached) {
      incrementBlobRefCount(cached);
      return cached;
    }

    // Check if already in flight
    const inflight = inflightImageRequests.get(url);
    if (inflight) {
      return inflight;
    }

    // Create new promise and add to batch
    const promise = new Promise<string>((resolve, reject) => {
      this.batchQueue.push({ url, resolve, reject });
      
      if (!this.isProcessing) {
        this.processBatch();
      }
    });

    inflightImageRequests.set(url, promise);
    return promise;
  }

  private async processBatch() {
    if (this.isProcessing || this.batchQueue.length === 0) return;
    
    this.isProcessing = true;

    while (this.batchQueue.length > 0) {
      const batch = this.batchQueue.splice(0, this.BATCH_SIZE);
      
      // Process current batch in parallel
      const batchPromises = batch.map(({ url, resolve, reject }) => 
        this.fetchSingleImage(url).then(resolve).catch(reject)
      );

      await Promise.allSettled(batchPromises);

      // Delay before next batch
      if (this.batchQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
      }
    }

    this.isProcessing = false;
  }

  private async fetchSingleImage(url: string): Promise<string> {
    try {
      const response = await axios.get(normalizeUrl(url), {
        withCredentials: true,
        responseType: "blob",
        timeout: 10000,
      });
      
      const imageBlob = new Blob([response.data], {
        type: response.headers["content-type"] || "image/png",
      });
      
      const blobUrl = URL.createObjectURL(imageBlob);
      imageBlobUrlCache.set(url, blobUrl);
      incrementBlobRefCount(blobUrl);
      
      return blobUrl;
    } catch (error) {
      throw error;
    } finally {
      inflightImageRequests.delete(url);
    }
  }
}

const imageBlobUrlCache = new Map<string, string>();
const inflightImageRequests = new Map<string, Promise<string>>();
const blobUrlRefCount = new Map<string, number>();
const imageBatchManager = ImageBatchManager.getInstance();

const PLACEHOLDER_SVG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzZiNzI4MCIgZHk9Ii4zZW0iIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';

const ImageLoadingOverlay = memo(
  ({ className = "", size = 36 }: { className?: string; size?: number }) => (
    <div
      className={`flex items-center justify-center pointer-events-none ${className}`}
      aria-label="Loading image"
    >
      <Lottie animationData={cardLoadingAnimation} loop style={{ width: size, height: size }} />
    </div>
  )
);

ImageLoadingOverlay.displayName = "ImageLoadingOverlay";

const GridImage = memo(
  ({
    src,
    alt,
    isImageCard,
  }: {
    src: string;
    alt: string;
    isImageCard: boolean;
  }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    const imgClasses = isImageCard
      ? "w-full h-full object-contain"
      : "w-full h-full rounded object-cover";

    return (
      <div className="relative w-full h-full min-h-[82px] bg-surface-2 rounded overflow-hidden">
        {!isLoaded && !hasError && (
          <ImageLoadingOverlay className="absolute inset-0 bg-surface-2/70" size={28} />
        )}
        <img
          src={src}
          alt={alt}
          className={`${imgClasses} ${!isLoaded ? "opacity-0" : "opacity-100"}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setHasError(true);
            setIsLoaded(true);
          }}
        />
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
            <span className="text-2xs text-text-muted">No image</span>
          </div>
        )}
      </div>
    );
  }
);

GridImage.displayName = "GridImage";

const normalizeUrl = (url: string): string => {
  if (url.startsWith("http")) return url;
  if (url.startsWith("/files/")) return `${API_CONFIG.LOCAL_API_BASE_URL}${url}`;
  return url;
};

const incrementBlobRefCount = (blobUrl: string): void => {
  blobUrlRefCount.set(blobUrl, (blobUrlRefCount.get(blobUrl) || 0) + 1);
};

const decrementBlobRefCount = (blobUrl: string): void => {
  const count = (blobUrlRefCount.get(blobUrl) || 1) - 1;
  if (count <= 0) {
    blobUrlRefCount.delete(blobUrl);
    URL.revokeObjectURL(blobUrl);
    for (const [key, value] of imageBlobUrlCache.entries()) {
      if (value === blobUrl) {
        imageBlobUrlCache.delete(key);
        break;
      }
    }
  } else {
    blobUrlRefCount.set(blobUrl, count);
  }
};

const fetchAuthenticatedImage = async (url: string): Promise<string> => {
  const key = normalizeUrl(url);
  
  const cached = imageBlobUrlCache.get(key);
  if (cached) {
    incrementBlobRefCount(cached);
    return cached;
  }

  // Use batch manager for authenticated images
  return imageBatchManager.addToBatch(key);
};

const AuthenticatedImage = memo<AuthenticatedImageProps>(({
  src,
  alt,
  className,
  fallbackSrc = PLACEHOLDER_SVG,
}) => {
  const [state, setState] = useState<{
    imageSrc: string;
    loading: boolean;
    error: boolean;
    triedAuth: boolean;
  }>({
    imageSrc: PLACEHOLDER_SVG,
    loading: true,
    error: false,
    triedAuth: false,
  });
  const [showFullScreen, setShowFullScreen] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentBlobRef = useRef<string | null>(null);
  const isAuthenticatedUrlRef = useRef<boolean>(false);

  useEffect(() => {
    abortControllerRef.current = new AbortController();
    
    if (src.startsWith("blob:")) {
      setState({ imageSrc: src, loading: false, error: false, triedAuth: true });
      return;
    }


    const normalizedUrl = normalizeUrl(src);
    isAuthenticatedUrlRef.current = normalizedUrl.includes('/files/');
    
    const cached = imageBlobUrlCache.get(normalizedUrl);
    
    if (cached) {
      incrementBlobRefCount(cached);
      currentBlobRef.current = cached;
      setState({ imageSrc: cached, loading: false, error: false, triedAuth: true });
      return;
    }

    if (isAuthenticatedUrlRef.current) {
      setState(prev => ({ ...prev, loading: true }));
      fetchAuthenticatedImage(normalizedUrl)
        .then((blobUrl) => {
          if (!abortControllerRef.current?.signal.aborted) {
            currentBlobRef.current = blobUrl;
            setState({ imageSrc: blobUrl, loading: false, error: false, triedAuth: true });
          }
        })
        .catch(() => {
          if (!abortControllerRef.current?.signal.aborted) {
            setState({ imageSrc: fallbackSrc, error: true, loading: false, triedAuth: true });
          }
        });
    } else {
      setState({ imageSrc: normalizedUrl, loading: false, error: false, triedAuth: false });
    }

    return () => {
      abortControllerRef.current?.abort();
      if (currentBlobRef.current && currentBlobRef.current.startsWith("blob:")) {
        decrementBlobRefCount(currentBlobRef.current);
        currentBlobRef.current = null;
      }
    };
  }, [src, fallbackSrc]);

  const handleError = useCallback(async () => {
    if (state.triedAuth || isAuthenticatedUrlRef.current) {
      setState(prev => ({ ...prev, imageSrc: fallbackSrc, error: true, loading: false }));
      return;
    }

    try {
      const blobUrl = await fetchAuthenticatedImage(src);
      if (!abortControllerRef.current?.signal.aborted) {
        currentBlobRef.current = blobUrl;
        setState({ imageSrc: blobUrl, loading: false, error: false, triedAuth: true });
      }
    } catch {
      if (!abortControllerRef.current?.signal.aborted) {
        setState({ imageSrc: fallbackSrc, error: true, loading: false, triedAuth: true });
      }
    }
  }, [src, fallbackSrc, state.triedAuth]);

  const handleFullScreen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFullScreen(true);
  }, []);

  if (state.loading) {
    return (
      <div className={`${className} min-w-[150px] relative bg-gradient-to-br from-surface-2 via-surface to-surface-2 bg-[length:200%_200%] animate-[shimmer_1.5s_ease-in-out_infinite]`}>
        <ImageLoadingOverlay className="absolute inset-0" size={30} />
      </div>
    );
  }

  if (state.error && !state.imageSrc) {
    return (
      <div className={`${className} min-w-[150px] flex items-center justify-center bg-surface-2 text-text-muted`}>
        <span className="text-text-muted text-sm">No image</span>
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full h-full">
        {state.loading && (
          <ImageLoadingOverlay className="absolute inset-0 bg-surface-2/70" size={28} />
        )}
        <img
          src={state.imageSrc}
          alt={alt}
          className={`${className} ${
            state.loading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'
          } cursor-pointer hover:opacity-90 transition-all h-full w-full`}
          loading="lazy"
          onClick={handleFullScreen}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setState(prev => ({ ...prev, loading: false }))}
          onError={handleError}
        />
      </div>
      {showFullScreen && (
        <FullScreenViewer 
          src={src} 
          onClose={() => setShowFullScreen(false)} 
        />
      )}
    </>
  );
});

AuthenticatedImage.displayName = "AuthenticatedImage";

const LOW_IMAGE_WIDTH = 360;
const MEDIUM_IMAGE_WIDTH = 960;
const HIGH_IMAGE_WIDTH = MEDIUM_IMAGE_WIDTH;

const LOW_IMAGE_QUALITY = 48;
const MEDIUM_IMAGE_QUALITY = 68;
const HIGH_IMAGE_QUALITY = MEDIUM_IMAGE_QUALITY;

const IMAGE_SIZES_ATTRIBUTE =
  "(max-width: 640px) 92vw, (max-width: 1024px) 60vw, (max-width: 1440px) 480px, 560px";

interface ImageParameterOptions {
  width: number;
  quality: number;
}

const applyImageParameters = (
  inputUrl: string,
  { width, quality }: ImageParameterOptions
): string => {
  if (!/^https?:\/\//i.test(inputUrl)) {
    return inputUrl;
  }

  try {
    const url = new URL(inputUrl);
    const { host, searchParams } = url;

    const setQualityParam = (key: string, value: string) => {
      const existing = searchParams.get(key);
      if (!existing) {
        searchParams.set(key, value);
        return;
      }
      const existingNumber = Number(existing);
      const incomingNumber = Number(value);
      if (!Number.isNaN(existingNumber) && !Number.isNaN(incomingNumber)) {
        if (existingNumber > incomingNumber) {
          searchParams.set(key, value);
        }
        return;
      }
      searchParams.set(key, value);
    };

    const ensureWidthParam = (keys: string[]) => {
      for (const key of keys) {
        if (searchParams.has(key)) {
          const current = Number(searchParams.get(key));
          if (Number.isNaN(current) || current > width) {
            searchParams.set(key, String(width));
          }
          return;
        }
      }
      searchParams.set(keys[0], String(width));
    };

    const ensureAutoParam = (value: string) => {
      const current = searchParams.get("auto");
      if (!current) {
        searchParams.set("auto", value);
        return;
      }

      if (!current.includes(value)) {
        searchParams.set("auto", `${current},${value}`);
      }
    };

    const ensureFitParam = (value: string) => {
      if (!searchParams.has("fit")) {
        searchParams.set("fit", value);
      }
    };

    if (host.includes("unsplash.com") || host.includes("unsplashusercontent.com")) {
      ensureWidthParam(["w"]);
      setQualityParam("q", String(quality));
      ensureAutoParam("format");
      ensureFitParam("max");
      return url.toString();
    }

    if (host.includes("pexels.com")) {
      ensureWidthParam(["w"]);
      setQualityParam("h", String(Math.round(width * 0.66)));
      searchParams.set("dpr", "1");
      setQualityParam("q", String(quality));
      ensureAutoParam("compress");
      return url.toString();
    }

    if (
      host.includes("pixabay.com") ||
      host.includes("freepik.com") ||
      host.includes("shutterstock.com")
    ) {
      ensureWidthParam(["w"]);
      setQualityParam("q", String(quality));
      ensureAutoParam("compress");
      return url.toString();
    }

    if (host.includes("cloudinary.com")) {
      // Cloudinary uses path-based transformations. If a transformation already exists, leave as is.
      const segments = url.pathname.split("/");
      const uploadIndex = segments.findIndex((segment) => segment === "upload");
      if (uploadIndex >= 0) {
        const transformationSegment = segments[uploadIndex + 1] || "";
        if (!transformationSegment || !/q_\d+/i.test(transformationSegment)) {
          segments.splice(
            uploadIndex + 1,
            0,
            `f_auto,q_${quality},w_${width}`
          );
          url.pathname = segments.join("/");
        }
      }
      return url.toString();
    }

    // Generic fallback: add common quality parameters.
    ensureWidthParam(["w", "width"]);
    setQualityParam("quality", String(quality));
    setQualityParam("q", String(quality));
    ensureAutoParam("compress");
    ensureFitParam("max");

    return url.toString();
  } catch {
    return inputUrl;
  }
};

const getGoogleImageBase = (url: string): string => {
  const [path] = url.split("?");
  return path.replace(/=s\d+$/i, "");
};

const createGoogleSizedUrl = (url: string, size: number): string => {
  return `${getGoogleImageBase(url)}=s${size}`;
};

const optimizeImageUrl = (url: string): string => {
  if (url.startsWith("data:")) return url;

  if (url.startsWith('/files/') || url.startsWith('files/')) {
    return normalizeUrl(url);
  }
  
  if (url.includes('visitqatar.com')) {
    return url;
  }
  
  if (url.includes('serpapi.com')) {
    return url;
  }
  
  if (url.includes('googleusercontent.com')) {
    return createGoogleSizedUrl(url, MEDIUM_IMAGE_WIDTH);
  }
  
  return applyImageParameters(url, {
    width: MEDIUM_IMAGE_WIDTH,
    quality: MEDIUM_IMAGE_QUALITY,
  });
};

interface ResponsiveImageSources {
  primary: string;
  srcSet?: string;
  sizes?: string;
}

const dedupeSrcSetEntries = (entries: string[]) =>
  entries.filter((entry, index, array) => entry && array.indexOf(entry) === index);

const buildResponsiveImageSources = (url: string): ResponsiveImageSources => {
  if (url.startsWith("data:")) {
    return { primary: url };
  }

  if (url.startsWith('/files/') || url.startsWith('files/')) {
    return { primary: normalizeUrl(url) };
  }

  if (url.includes('visitqatar.com')) {
    return { primary: url };
  }

  if (url.includes('serpapi.com')) {
    return { primary: url };
  }

  if (url.includes('googleusercontent.com')) {
    const low = createGoogleSizedUrl(url, LOW_IMAGE_WIDTH);
    const medium = createGoogleSizedUrl(url, MEDIUM_IMAGE_WIDTH);
    const high = createGoogleSizedUrl(url, HIGH_IMAGE_WIDTH);
    const srcSet = dedupeSrcSetEntries([
      `${low} ${LOW_IMAGE_WIDTH}w`,
      `${medium} ${MEDIUM_IMAGE_WIDTH}w`,
      `${high} ${HIGH_IMAGE_WIDTH}w`,
    ]).join(", ");
    return {
      primary: medium,
      srcSet: srcSet || undefined,
      sizes: IMAGE_SIZES_ATTRIBUTE,
    };
  }

  const low = applyImageParameters(url, {
    width: LOW_IMAGE_WIDTH,
    quality: LOW_IMAGE_QUALITY,
  });
  const medium = applyImageParameters(url, {
    width: MEDIUM_IMAGE_WIDTH,
    quality: MEDIUM_IMAGE_QUALITY,
  });
  const high = applyImageParameters(url, {
    width: HIGH_IMAGE_WIDTH,
    quality: HIGH_IMAGE_QUALITY,
  });

  const srcSetEntries = dedupeSrcSetEntries([
    `${low} ${LOW_IMAGE_WIDTH}w`,
    `${medium} ${MEDIUM_IMAGE_WIDTH}w`,
    `${high} ${HIGH_IMAGE_WIDTH}w`,
  ]);

  return {
    primary: medium,
    srcSet: srcSetEntries.join(", ") || undefined,
    sizes: IMAGE_SIZES_ATTRIBUTE,
  };
};

const MAX_IMAGE_RETRIES = 1;

interface ImageLoadState {
  currentUrl: string | null;
  fallbackIndex: number;
  isLoading: boolean;
  hasError: boolean;
  shouldLoad: boolean;
  retryCount: number;
}

const Card: React.FC<CardProps> = memo(({
  id,
  content,
  image,
  title,
  description,
  footer,
  onClick,
  orientation = "portrait",
  category,
  className = "",
  imageClassName = "",
  contentClassName = "",
  titleClassName = "",
  descriptionClassName = "",
  footerClassName = "",
  isImageOnly = false,
}) => {
  // Normalize orientation to handle typos (potrait -> portrait)
  const normalizedOrientation = useMemo(() => {
    if (!orientation) return "portrait";
    const orientationLower = orientation.toLowerCase();
    if (orientationLower === "potrait") return "portrait";
    if (orientationLower === "landscape") return "landscape";
    return "portrait";
  }, [orientation]);

  // Handle new content prop format
  const contentArray = useMemo(() => {
    if (content) {
      if (Array.isArray(content)) {
        return content;
      }
      return [content];
    }
    return [];
  }, [content]);

  // Determine if we're using new or legacy format
  const isUsingNewFormat = useMemo(() => contentArray.length > 0, [contentArray.length]);
  
  // Extract first content item for backward compatibility
  const firstContent = useMemo(() => contentArray[0], [contentArray]);
  
  // Determine if this is a multi-content card (like flight with multiple segments)
  const isMultiContentCard = useMemo(() => contentArray.length > 1, [contentArray.length]);
  
  // Check if this is an image card (category = "Images")
  const isImageCard = useMemo(() => category === "Images" || category === "images", [category]);
  
  const isFlightCard = useMemo(() => 
    category?.toLowerCase() === "flight" || category?.includes('→'), 
    [category]
  );

  // Legacy image/title/description handling
  const legacyImage = image || (isUsingNewFormat ? firstContent?.image?.value : undefined);
  const legacyTitle = title || (isUsingNewFormat ? firstContent?.title?.value : undefined);
  const legacyDescription = description || (isUsingNewFormat ? firstContent?.description?.value : undefined);
  const legacyFooter = footer || (isUsingNewFormat ? firstContent?.footer?.value : undefined);

  const [imageState, setImageState] = useState<ImageLoadState>({
    currentUrl: null,
    fallbackIndex: 0,
    isLoading: true,
    hasError: false,
    shouldLoad: false,
    retryCount: 0,
  });
  const [isInView, setIsInView] = useState(false);
  // Generate a unique ID for this card instance if not provided - used for modal key
  const modalId = useMemo(() => `modal-${id || Math.random().toString(36).substring(2, 9)}`, [id]);
  
  // Modal state for flight details
  const [showModal, setShowModal] = useState(false);
  
  // Open modal handler
  const handleOpenModal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowModal(true);
  }, []);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const prefetchedUrlRef = useRef<string | null>(null);
  const prefetchInFlightRef = useRef(false);
  const prefetchIdleHandleRef = useRef<number | null>(null);
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prefetchedForUrlRef = useRef<string | null>(null);
  const prefetchLoadedRef = useRef(false);
  const failedUrlsRef = useRef<Set<string>>(new Set());

  const handleImageLoad = useCallback(() => {
    setImageState(prev => ({ ...prev, isLoading: false, hasError: false, retryCount: 0 }));
  }, []);

  useEffect(() => {
    const element = imageContainerRef.current;
    if (!element || typeof legacyImage !== 'string') return;

    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
      (entries) => {
          if (entries[0]?.isIntersecting) {
            setIsInView(true);
            observerRef.current?.disconnect();
            observerRef.current = null;
          }
      },
      {
          rootMargin: '400px 0px 400px 0px',
        threshold: 0.01,
      }
    );
    }

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [legacyImage]);

  const isLegacyGotalkImage = useMemo(() => {
    if (typeof legacyImage !== "string") return false;
    return (
      legacyImage.includes("/files/") ||
      legacyImage.startsWith("/files/")
    );
  }, [legacyImage]);

  const responsiveSources = useMemo(() => {
    if (typeof legacyImage !== "string") return null;
    return buildResponsiveImageSources(legacyImage);
  }, [legacyImage]);

  const primaryOptimizedUrl = responsiveSources?.primary;

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    const originalUrl = typeof legacyImage === 'string' ? legacyImage : '';
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (!originalUrl) {
      setImageState(prev => ({ ...prev, hasError: true, isLoading: false, retryCount: MAX_IMAGE_RETRIES }));
      target.src = PLACEHOLDER_SVG;
      return;
    }
    
    // Mark this URL and all its variants as failed to prevent retries
    failedUrlsRef.current.add(originalUrl);
    const optimizedUrl = primaryOptimizedUrl ?? optimizeImageUrl(originalUrl);
    if (optimizedUrl) {
      failedUrlsRef.current.add(optimizedUrl);
    }
    if (responsiveSources?.primary) {
      failedUrlsRef.current.add(responsiveSources.primary);
    }
    
    // Stop retrying immediately when image gives error - show placeholder
    setImageState(prev => ({ ...prev, hasError: true, isLoading: false, retryCount: MAX_IMAGE_RETRIES }));
    target.src = PLACEHOLDER_SVG;
  }, [legacyImage, primaryOptimizedUrl, responsiveSources]);

  useEffect(() => {
    if (
      typeof legacyImage !== "string" ||
      imageState.shouldLoad ||
      imageState.hasError ||
      (prefetchedForUrlRef.current &&
        prefetchedForUrlRef.current === legacyImage &&
        prefetchedUrlRef.current) ||
      prefetchInFlightRef.current ||
      isLegacyGotalkImage ||
      failedUrlsRef.current.has(legacyImage)
    ) {
      return;
    }

    if (
      prefetchedForUrlRef.current &&
      prefetchedForUrlRef.current !== legacyImage
    ) {
      prefetchedForUrlRef.current = null;
      prefetchedUrlRef.current = null;
    }

    const optimizedUrl =
      primaryOptimizedUrl ?? optimizeImageUrl(legacyImage);

    if (!optimizedUrl || failedUrlsRef.current.has(optimizedUrl)) return;

    prefetchInFlightRef.current = true;
    prefetchLoadedRef.current = false;

    const startPrefetch = () => {
      if (prefetchIdleHandleRef.current !== null) {
        prefetchIdleHandleRef.current = null;
      }
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
        prefetchTimeoutRef.current = null;
      }
      imageLoadQueue
        .loadImage(optimizedUrl)
        .then((displayableUrl) => {
          prefetchLoadedRef.current = true;
          prefetchedUrlRef.current = displayableUrl;
          prefetchedForUrlRef.current = legacyImage;
        })
        .catch(() => {
          // Mark URL as failed to prevent further attempts
          failedUrlsRef.current.add(optimizedUrl);
          failedUrlsRef.current.add(legacyImage);
          prefetchLoadedRef.current = false;
          prefetchedUrlRef.current = optimizedUrl;
          prefetchedForUrlRef.current = legacyImage;
        })
        .finally(() => {
          prefetchInFlightRef.current = false;
        });
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      prefetchIdleHandleRef.current = (window as any).requestIdleCallback(
        startPrefetch,
        { timeout: 2000 }
      );
    } else {
      prefetchTimeoutRef.current = setTimeout(startPrefetch, 300);
    }

    return () => {
      if (
        typeof window !== "undefined" &&
        "cancelIdleCallback" in window &&
        prefetchIdleHandleRef.current !== null
      ) {
        (window as any).cancelIdleCallback(prefetchIdleHandleRef.current);
        prefetchIdleHandleRef.current = null;
      }
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
        prefetchTimeoutRef.current = null;
      }
      prefetchInFlightRef.current = false;
    };
  }, [
    legacyImage,
    primaryOptimizedUrl,
    imageState.shouldLoad,
    isLegacyGotalkImage,
  ]);

  useEffect(() => {
    if (
      !isInView || 
      typeof legacyImage !== "string" || 
      imageState.shouldLoad || 
      imageState.hasError ||
      failedUrlsRef.current.has(legacyImage)
    ) return;

    const prefetchedUrl = prefetchedUrlRef.current;
    const optimizedUrl =
      prefetchedUrl ?? primaryOptimizedUrl ?? optimizeImageUrl(legacyImage);

    if (!optimizedUrl || failedUrlsRef.current.has(optimizedUrl)) {
      // If URL has failed, set error state immediately
      if (failedUrlsRef.current.has(legacyImage) || failedUrlsRef.current.has(optimizedUrl || '')) {
        setImageState(prev => ({ ...prev, hasError: true, isLoading: false, retryCount: MAX_IMAGE_RETRIES }));
      }
      return;
    }

    if (prefetchedUrl) {
      prefetchedUrlRef.current = null;
      prefetchedForUrlRef.current = null;
      const wasPrefetchSuccessful = prefetchLoadedRef.current;
      prefetchLoadedRef.current = false;
      setImageState((prev) => ({
        ...prev,
        shouldLoad: true,
        currentUrl: optimizedUrl,
        fallbackIndex: 0,
        isLoading: !wasPrefetchSuccessful,
        hasError: false,
        retryCount: 0,
      }));
      return;
    }

    imageLoadQueue
      .loadImage(optimizedUrl)
      .then((displayableUrl) => {
        setImageState((prev) => ({
          ...prev,
          shouldLoad: true,
          currentUrl: displayableUrl,
          fallbackIndex: 0,
          isLoading: true,
          hasError: false,
          retryCount: 0,
        }));
        })
        .catch(() => {
        // Mark URL as failed to prevent further attempts
        failedUrlsRef.current.add(optimizedUrl);
        failedUrlsRef.current.add(legacyImage);
        setImageState((prev) => ({
          ...prev,
          shouldLoad: true,
          currentUrl: optimizedUrl,
          fallbackIndex: 0,
          isLoading: false,
          hasError: true,
          retryCount: MAX_IMAGE_RETRIES,
        }));
      });
  }, [
    isInView,
    legacyImage,
    imageState.shouldLoad,
    primaryOptimizedUrl,
  ]);

  const imageContainerClasses = useMemo(() => {
    if (isImageOnly) return `${imageClassName} w-full h-full rounded-lg`;
    
    // For Images category, allow natural dimensions
    if (isImageCard) return `${imageClassName} w-full rounded-lg`;
    
    const isString = typeof legacyImage === "string";
    if (normalizedOrientation === "landscape") {
      return `${imageClassName} ${
        isString
              ? isFlightCard 
                ? "h-full min-w-[80px] w-[25%] rounded-l-lg rounded-r-none flex items-center justify-center bg-surface-2" // Added centering and background
                : "h-full min-w-[120px] w-[40%] rounded-l-lg rounded-r-none"
              : "rounded-l-lg rounded-r-none"
      }`;
    }
    
    // UPDATED: For flight cards, use fixed height container instead of aspect ratio
    if (isFlightCard) {
      return `${imageClassName} ${
        isString
          ? "w-full h-24 rounded-t-lg rounded-b-none overflow-hidden flex items-center justify-center bg-surface" // Fixed height with centered logo
          : "rounded-t-lg rounded-b-none"
      }`;
    }
    
    // Regular portrait cards use aspect ratio
    return `${imageClassName} ${
      isString
        ? "w-full aspect-[5/3] rounded-t-lg rounded-b-none overflow-hidden"
        : "rounded-t-lg rounded-b-none"
    }`;
  }, [isImageOnly, imageClassName, legacyImage, normalizedOrientation, isFlightCard, isImageCard]);

  const imageAlt = useMemo(() => 
    typeof legacyTitle === "string" ? legacyTitle : "Card image",
    [legacyTitle]
  );

  const isFlightPngImage = useMemo(() => {
    if (!isFlightCard || typeof legacyImage !== "string") return false;

    const trimmed = legacyImage.trim().toLowerCase();
    if (trimmed.startsWith("data:image/png")) return true;

    const withoutQueryOrHash = trimmed.split(/[?#]/)[0];
    return withoutQueryOrHash.endsWith(".png");
  }, [isFlightCard, legacyImage]);

  const computedImageClasses = useMemo(() => {
    if (isFlightCard) {
      return isFlightPngImage
        ? "w-18 h-14 mt-4 object-contain bg-surface "
        : "w-full h-full object-cover";
    }

    if (isImageCard) {
      return "w-auto max-w-full h-auto";
    }

    return "w-full h-full object-cover";
  }, [isFlightCard, isFlightPngImage, isImageCard]);

  const renderImage = useMemo(() => {
    if (!legacyImage) return null;

    if (isLegacyGotalkImage) {
      return (
          <div ref={imageContainerRef} className={`${isImageCard ? 'overflow-visible' : 'overflow-hidden'} ${imageContainerClasses} relative w-full`}>
          <AuthenticatedImage
            src={legacyImage as string}
            alt={imageAlt}
              className={computedImageClasses}
          />
        </div>
      );
    }
       
    if (typeof legacyImage === "string") {
      // If image has failed, show placeholder immediately without trying to load
      if (imageState.hasError || failedUrlsRef.current.has(legacyImage)) {
        return (
          <div ref={imageContainerRef} className={`${isImageCard ? 'overflow-visible' : 'overflow-hidden'} ${imageContainerClasses} relative`}>
            <div className="absolute inset-0 bg-surface-2 flex items-center justify-center">
              <span className="text-text-muted text-sm">No image</span>
            </div>
          </div>
        );
      }
      
      // Skip optimization for Qatar images to preserve quality
      const isQatarImage = legacyImage.includes('visitqatar.com');
      const baseImageUrl =
        imageState.currentUrl && imageState.currentUrl.length > 0
          ? imageState.currentUrl
          : responsiveSources?.primary || legacyImage;
      const imageUrl = isQatarImage ? legacyImage : baseImageUrl;
      // Disable srcSet if image has error to prevent multiple failed requests
      const shouldUseSrcSet =
        !imageState.hasError &&
        !isQatarImage &&
        responsiveSources?.srcSet &&
        !(imageState.currentUrl && imageState.currentUrl.startsWith("blob:"));
      const srcSet = shouldUseSrcSet ? responsiveSources?.srcSet : undefined;
      const sizes = shouldUseSrcSet ? responsiveSources?.sizes : undefined;
      
      return (
        <div ref={imageContainerRef} className={`${isImageCard ? 'overflow-visible' : 'overflow-hidden'} ${imageContainerClasses} relative`}>
          {!imageState.shouldLoad ? (
            <ImageLoadingOverlay
              className="absolute inset-0 bg-surface-2 animate-pulse"
              size={26}
            />
          ) : (
            <>
              {imageState.isLoading && (
                <ImageLoadingOverlay
                  className="absolute inset-0 bg-surface-2/80 backdrop-blur-[1px]"
                  size={32}
                />
              )}
              <img
                src={imageUrl}
                srcSet={srcSet}
                sizes={sizes}
                alt={imageAlt}
                className={`${computedImageClasses} ${
                  imageState.isLoading ? 'opacity-0' : 'opacity-100'
                }`}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={handleImageError}
                onLoad={handleImageLoad}
                style={{ 
                  transition: 'opacity 0.3s ease-in-out',
                  // UPDATED: Conditional object-fit - use contain for flight cards to preserve logos
                  objectFit: isFlightCard ? 'contain' : 'cover',
                }}
              />
              {imageState.hasError && (
                <div className="absolute inset-0 bg-surface-2 flex items-center justify-center">
                  <span className="text-text-muted text-sm">No image</span>
                </div>
              )}
            </>
          )}
        </div>
      );
    }
    return <div className={`overflow-hidden ${imageContainerClasses}`}>{legacyImage}</div>;
  }, [
    legacyImage,
    imageContainerClasses,
    imageAlt,
    isFlightCard,
    isImageCard,
    imageState,
    handleImageError,
    handleImageLoad,
    computedImageClasses,
    responsiveSources,
    isLegacyGotalkImage,
  ]);

  const cardClassName = useMemo(() => {
    const base = "group bg-surface rounded-lg shadow-md overflow-hidden transition duration-300 ease-in-out";
    const hover = "hover:shadow-lg";
    const interactive = onClick ? "cursor-pointer" : "";
    return `${base} ${hover} ${interactive} ${className}`;
  }, [onClick, className]);

  const cardStyle = useMemo(() => ({
    contain: "layout style paint" as const,
    maxWidth: "100%",
    width: "100%",
    height: "100%",
    minHeight: isImageOnly ? "280px" : (isFlightCard ? "160px" : "280px"),
    display: "flex",
    flexDirection: "column" as const,
    flex: "1 1 auto",
    position: "relative" as const,
    zIndex: 1,
    isolation: "isolate" as const,
  }), [isImageOnly, isFlightCard]);

  if ((isImageOnly && legacyImage) || isImageCard) {
    const showImageCardSkeleton = isImageCard && !imageState.shouldLoad;
    return (
      <div
        className={cardClassName}
        onClick={onClick}
        style={{ ...cardStyle, minHeight: "auto", width: isImageCard ? "auto" : "100%" }}
      >
        <div className={`${isImageCard ? "w-auto" : cardClassName} relative`}>
          {showImageCardSkeleton && (
            <div className="w-full max-w-[420px] aspect-square min-w-[220px] rounded-lg bg-surface-2 flex items-center justify-center mx-auto">
              <ImageLoadingOverlay size={34} />
            </div>
          )}
          <div className={showImageCardSkeleton ? "absolute inset-0 opacity-0 pointer-events-none" : ""}>
            {renderImage}
          </div>
        </div>
      </div>
    );
  }

  // Render multi-content card (e.g., flight itinerary with multiple segments)
  if (isMultiContentCard) {
    const firstItem = contentArray[0];
    const totalItems = contentArray.length;
    
    // Check if items are image-only (we only use allImageOnly now)
    
    // For image-only multi-content, show images in a grid
    const allImageOnly = contentArray.every(item => !item.title?.value && !item.description?.value && !item.footer?.value && item.image?.value);
    
    // Special case for Images category cards
    if (isImageCard || allImageOnly) {
      return (
        <div className={cardClassName} onClick={onClick} style={{ ...cardStyle, minHeight: "auto" }}>
          <div className="flex flex-col h-full">
            <div className={`flex flex-wrap gap-1 ${isImageCard ? 'p-0' : 'p-2'}`}>
              {contentArray.map((item, idx) => (
                <div key={idx} className={`flex-1 ${isImageCard ? 'w-full' : 'min-w-[100px]'}`}>
                  {item.image?.value ? (
                    <GridImage
                      src={item.image.value}
                      alt={`image-${idx}`}
                      isImageCard={!!isImageCard}
                    />
                  ) : (
                    <div className="w-full h-full min-h-[82px] flex items-center justify-center text-xs text-text-muted">
                      No image
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    // Flight cards with modal view
    if (isFlightCard) {
      // Extract all unique images from content items
      const allImages = contentArray
        .filter(item => item.image?.value)
        .map(item => item.image!.value);
      const uniqueImages = Array.from(new Set(allImages));
      
      return (
        <>
          {/* Flight card with "View details" button */}
          <div className={cardClassName} onClick={onClick} style={{ ...cardStyle, minHeight: "auto" }}>
            <div className="flex flex-col h-full">
              {/* First item overview */}
              <div className="flex flex-col p-2">
                {/* Show all unique images */}
                {uniqueImages.length > 0 && (
                  <div className="w-full h-24 rounded-t-lg rounded-b-none overflow-hidden flex items-center justify-center bg-surface relative flex-wrap">
                    {uniqueImages.map((imgSrc, idx) => (
                      <div key={idx} className="flex items-center justify-center bg-surface p-1 rounded">
                        <img
                          src={imgSrc}
                          alt={firstItem.title?.value || `Flight ${idx + 1}`}
                          className="w-18 h-14 object-contain"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {firstItem.title?.value && (
                  <h4 className="font-semibold text-xs mb-1 line-clamp-2 text-text-main">
                    {firstItem.title.value}
                  </h4>
                )}
                
                {firstItem.description?.value && (
                  <p className="text-xs mb-1 line-clamp-2 text-text-muted">
                    {firstItem.description.value}
                  </p>
                )}
                
                {firstItem.footer?.value && (
                  <p className="text-xs line-clamp-1 text-text-muted">
                    {firstItem.footer.value}
                  </p>
                )}
              </div>

              {/* View Details Button */}
              {totalItems > 1 && (
                <button
                  onClick={handleOpenModal}
                  className="mt-auto border-t border-border-main p-1.5 w-full text-center hover:bg-surface-2 transition-colors"
                >
                  <p className="font-semibold text-xs text-primary">
                  More details                  </p>
                </button>
              )}
            </div>
          </div>
          
          {/* Flight details modal */}
          <FlightDetailsModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            content={contentArray}
            title={`Flight Details (${totalItems} segments)`}
            key={modalId}
          />
        </>
      );
    }
    
    // Default multi-content card (non-flight)
    // Extract all unique images from content items
    const allImages = contentArray
      .filter(item => item.image?.value)
      .map(item => item.image!.value);
    const uniqueImages = Array.from(new Set(allImages));
    
    return (
      <div className={cardClassName} onClick={onClick} style={{ ...cardStyle, minHeight: "auto" }}>
        <div className="flex flex-col h-full">
          {/* First item overview */}
          <div className="flex flex-col p-3">
            {/* Show all unique images */}
            {uniqueImages.length > 0 && (
              <div className={`mb-2 flex ${isFlightCard ? 'items-center' : 'items-start'} gap-2 flex-wrap`}>
                {uniqueImages.map((imgSrc, idx) => (
                  <div key={idx} className="flex items-center justify-center bg-surface p-1 rounded">
                    <img
                      src={imgSrc}
                      alt={firstItem.title?.value || `Item ${idx + 1}`}
                      className="w-18 h-14 object-contain" // Keep original size for non-flight
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            )}
            
            {firstItem.title?.value && (
              <h4 className="font-semibold text-sm mb-2 line-clamp-2 text-text-main">
                {firstItem.title.value}
              </h4>
            )}
            
            {firstItem.description?.value && (
              <p className="text-xs mb-2 line-clamp-2 text-text-muted">
                {firstItem.description.value}
              </p>
            )}
            
            {firstItem.footer?.value && (
              <p className="text-xs line-clamp-1 text-text-muted">
                {firstItem.footer.value}
              </p>
            )}
          </div>

          {/* Show More Button */}
          {totalItems > 1 && (
            <button
              onClick={handleOpenModal}
              className="mt-auto border-t border-border-main p-2 w-full text-center hover:bg-surface-2 transition-colors"
            >
              <p className="font-semibold text-sm text-primary">
                {/* Show all {totalItems} items */}
                Show more
              </p>
            </button>
          )}
        </div>
        
        {/* Details modal for non-flight cards */}
        <FlightDetailsModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          content={contentArray}
          title={`Details (${totalItems} items)`}
          key={modalId}
        />
      </div>
    );
  }

  // Render single-content card (legacy format)
  return (
    <div className={cardClassName} onClick={onClick} style={cardStyle}>
      <div className={`${normalizedOrientation === "landscape" ? "flex flex-row" : "flex flex-col"} flex-1`}>
        {normalizedOrientation === "landscape" && renderImage}
        {normalizedOrientation === "portrait" && renderImage}

        <div
          className={`${isFlightCard ? "p-2" : "p-4"} flex-grow flex flex-col ${
            !legacyImage ? "rounded-t-lg" : ""
          } ${normalizedOrientation === "landscape" ? "rounded-r-lg" : ""} ${contentClassName}`}
         >
           {legacyTitle && (
             <div
               className={`font-semibold ${
                 isFlightCard ? "mb-1 min-h-[1.5rem]" : "mb-2 min-h-[2.5rem]"
              } flex items-start ${
                typeof legacyTitle === "string" ? "text-sm text-text-main line-clamp-2" : ""
              } ${titleClassName}`}
             >
               {legacyTitle}
             </div>
           )}

           {legacyDescription && (
             <div
               className={`${
                 isFlightCard ? "mb-2 min-h-[2rem]" : "mb-3 min-h-[3rem]"
              } flex items-start ${
                typeof legacyDescription === "string" ? "text-xs text-text-muted line-clamp-3" : ""
              } ${descriptionClassName}`}
             >
               {legacyDescription}
             </div>
           )}

           {legacyFooter && (
             <div
               className={`mt-auto ${
                 isFlightCard ? "pt-1" : "pt-2"
               } border-t border-border-main/40 ${footerClassName}`}
             >
               {typeof legacyFooter === "string" ? (
                 <p className={`text-text-muted text-xs line-clamp-1 ${
                   isFlightCard ? "leading-tight" : ""
                }`}>
                  {legacyFooter}
                </p>
               ) : (
                 legacyFooter
               )}
             </div>
           )}
        </div>
      </div>
    </div>
  );
});

Card.displayName = "Card";

export default Card;
export type { CardProps };