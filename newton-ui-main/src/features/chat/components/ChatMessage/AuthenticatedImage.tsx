import axios from "axios";
import { FileText } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { fileUrl } from "@/utils/fileStaticPath";
import {
  getFetchUrlForImage,
  imageBlobUrlCache,
  inflightImageRequests,
} from "./utils";
import type { AuthenticatedImageProps } from "./types";

const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  src,
  alt,
  className,
  staticPath,
  fallbackSrc,
  onLoad,
}) => {
  const fileFetchUrl = useMemo(
    () => (staticPath ? fileUrl(staticPath) : ""),
    [staticPath],
  );

  // Initialize imageSrc - but don't use direct URLs for authenticated endpoints
  // If src is a blob URL or data URL, use it; otherwise start empty for auth URLs
  const initialSrc =
    src &&
    (src.startsWith("blob:") ||
      src.startsWith("data:") ||
      !src.includes("/files/"))
      ? src
      : "";
  const [imageSrc, setImageSrc] = useState<string>(initialSrc);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const isMountedRef = useRef(true);
  const lastKeyRef = useRef<string | null>(null);
  const triedAuthFetchRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    // If the provided src is already a blob (local preview), just use it without fetching
    if (src && src.startsWith("blob:")) {
      setImageSrc(src);
      setLoading(false);
      return () => {
        // Revoke only local blob URLs we directly received via src
        if (src.startsWith("blob:")) {
          URL.revokeObjectURL(src);
        }
        isMountedRef.current = false;
      };
    }

    const fetchWithCache = async () => {
      // If there's no static path at all, fall back to provided src (could be data URL)
      // But only if it's not an authenticated URL
      if (!staticPath || !fileFetchUrl) {
        if (src && !src.includes("/files/")) {
          setImageSrc(src);
          setLoading(false);
        } else {
          // If src is an auth URL but no staticPath, we can't fetch it
          setError(true);
          setLoading(false);
        }
        return;
      }

      // Build cache key; in dev use same-origin path for backend document/file URLs to avoid CORS
      const key = getFetchUrlForImage(fileFetchUrl);
      lastKeyRef.current = key;

      // Serve from cache if available
      const cached = imageBlobUrlCache.get(key);
      if (cached) {
        setImageSrc(cached);
        setLoading(false);
        return;
      }

      // Dedupe in-flight requests
      let request = inflightImageRequests.get(key);
      if (!request) {
        request = (async () => {
          const response = await axios.get(key, {
            responseType: "blob",
            withCredentials: true,
          });
          const imageBlob = new Blob([response.data], {
            type: response.headers["content-type"] || "image/png",
          });
          const blobUrl = URL.createObjectURL(imageBlob);
          imageBlobUrlCache.set(key, blobUrl);
          return blobUrl;
        })().finally(() => {
          inflightImageRequests.delete(key);
        });
        inflightImageRequests.set(key, request);
      }

      try {
        setLoading(true);
        setError(false);
        const blobUrl = await request;
        if (!isMountedRef.current) return;
        setImageSrc(blobUrl);
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(true);
        // Only use fallback if it's not an authenticated URL
        const fallback = fallbackSrc || src;
        if (fallback && !fallback.includes("/files/")) {
          setImageSrc(fallback);
        } else {
          // Keep imageSrc empty to prevent browser from trying to load auth URL
          setImageSrc("");
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    // Check if URL requires authentication (file routes under /files/)
    const requiresAuth = staticPath?.includes("/files/");

    // If URL requires auth, skip direct load and use authenticated fetch immediately
    // Otherwise, try direct load first and fallback to auth fetch on error
    if (fileFetchUrl && !requiresAuth) {
      const directUrl = getFetchUrlForImage(fileFetchUrl);
      lastKeyRef.current = directUrl;
      setImageSrc(directUrl);
      setLoading(false);
      triedAuthFetchRef.current = false; // reset for this src
    } else if (fileFetchUrl && requiresAuth) {
      fetchWithCache();
    } else {
      fetchWithCache();
    }

    return () => {
      // Do not revoke cached blob URLs; they are reused across components
      isMountedRef.current = false;
    };
  }, [src, staticPath, fallbackSrc, fileFetchUrl]);

  if (loading) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gray-700/50`}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error && !fallbackSrc) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gray-700/50 text-gray-400`}
      >
        <FileText className="w-8 h-8" />
        <span className="ml-2 text-sm">Image failed to load</span>
      </div>
    );
  }

  // Determine if the URL requires authentication
  const requiresAuth = staticPath?.includes("/files/");

  // Build the src URL - NEVER use direct URLs for authenticated endpoints
  // Only use blob URLs or non-auth URLs
  const getImageSrc = () => {
    // If we have a blob URL or already fetched imageSrc, use it
    if (
      imageSrc &&
      (imageSrc.startsWith("blob:") || !imageSrc.includes("/files/"))
    ) {
      return imageSrc;
    }

    // If URL requires auth and we don't have a blob URL yet, return empty string
    // This prevents the browser from trying to load the image without auth
    if (requiresAuth && (!imageSrc || imageSrc.includes("/files/"))) {
      return ""; // Empty string prevents browser from making request
    }

    // For non-auth URLs, construct the direct URL (VITE_API_BASE_URL via fileUrl)
    if (fileFetchUrl && !requiresAuth) {
      return getFetchUrlForImage(fileFetchUrl);
    }

    // Fallback to provided src or fallbackSrc (but only if not auth URL)
    const fallback = fallbackSrc || src;
    if (fallback && !fallback.includes("/files/")) {
      return fallback;
    }

    return "";
  };

  const finalImageSrc = getImageSrc();

  // If we don't have a valid src and it requires auth, show loading
  if ((!finalImageSrc || finalImageSrc === "") && requiresAuth && loading) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gray-700/50`}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  // Don't render img tag if we don't have a valid src
  if (!finalImageSrc || finalImageSrc === "") {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gray-700/50`}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <img
      src={finalImageSrc}
      alt={alt}
      className={className}
      onLoad={(e) => {
        setLoading(false);
        try {
          onLoad?.(e);
        } catch {}
      }}
      onError={async () => {
        // If direct URL fails, fallback once to authenticated blob fetch
        if (!triedAuthFetchRef.current && fileFetchUrl) {
          triedAuthFetchRef.current = true;

          // Trigger cached auth fetch path
          const key = getFetchUrlForImage(fileFetchUrl);
          const cached = imageBlobUrlCache.get(key);
          if (cached) {
            setImageSrc(cached);
            return;
          }
          // Minimal inline fetch using the existing cache/dedupe maps
          let request = inflightImageRequests.get(key);
          if (!request) {
            request = (async () => {
              const response = await axios.get(key, {
                responseType: "blob",
                withCredentials: true,
              });
              const imageBlob = new Blob([response.data], {
                type: response.headers["content-type"] || "image/png",
              });
              const blobUrl = URL.createObjectURL(imageBlob);
              imageBlobUrlCache.set(key, blobUrl);
              return blobUrl;
            })().finally(() => {
              inflightImageRequests.delete(key);
            });
            inflightImageRequests.set(key, request);
          }
          request
            .then((blobUrl) => {
              if (blobUrl) setImageSrc(blobUrl);
            })
            .catch(() => {
              if (fallbackSrc && imageSrc !== fallbackSrc)
                setImageSrc(fallbackSrc);
            });
          return;
        }
        if (fallbackSrc && imageSrc !== fallbackSrc) setImageSrc(fallbackSrc);
      }}
    />
  );
};

export default AuthenticatedImage;
