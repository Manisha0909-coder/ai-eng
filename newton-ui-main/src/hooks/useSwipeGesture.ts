import { useEffect, useRef, RefObject, useCallback } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  minSwipeDistance?: number;
  edgeThreshold?: number;
  enabled?: boolean;
}

/**
 * Detects if the device is a mobile device (iOS or Android)
 * with comprehensive error handling
 */
const isMobileDevice = (): boolean => {
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }
    
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /ipad|tablet|playbook|silk/i.test(userAgent);
    const isTouchDevice = 
      ('ontouchstart' in window) || 
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
      ((navigator as any).msMaxTouchPoints && (navigator as any).msMaxTouchPoints > 0);
    
    return (isMobile || isTablet) && isTouchDevice;
  } catch (error) {
    console.warn('Error detecting mobile device, defaulting to false:', error);
    return false;
  }
};

/**
 * Custom hook for handling swipe gestures on mobile devices
 * Optimized with useCallback to prevent re-renders
 */
export const useSwipeGesture = (
  elementRef: RefObject<HTMLElement>,
  options: SwipeGestureOptions
) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    minSwipeDistance = 50,
    edgeThreshold = 100,
    enabled = true,
  } = options;

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isSwipingRef = useRef(false);

  // Memoize handlers to prevent unnecessary re-renders
  const handleTouchStart = useCallback((e: TouchEvent) => {
    try {
      if (!e.touches || e.touches.length === 0) return;
      
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      isSwipingRef.current = false;
    } catch (error) {
      console.warn('Error in touch start:', error);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    try {
      if (!touchStartRef.current || !e.touches || e.touches.length === 0) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Mark as swiping if more horizontal than vertical
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        isSwipingRef.current = true;
      }
    } catch (error) {
      console.warn('Error in touch move:', error);
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    try {
      if (!touchStartRef.current || !isSwipingRef.current) {
        touchStartRef.current = null;
        isSwipingRef.current = false;
        return;
      }

      if (!e.changedTouches || e.changedTouches.length === 0) {
        touchStartRef.current = null;
        isSwipingRef.current = false;
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      // Calculate velocity with zero-division protection
      const velocity = deltaTime > 0 ? Math.abs(deltaX) / deltaTime : 0;

      // Check if it's a horizontal swipe
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Swipe right
        if (deltaX > minSwipeDistance && velocity > 0.3) {
          // Only trigger if started near the left edge (for opening sidebar)
          if (touchStartRef.current.x <= edgeThreshold) {
            onSwipeRight?.();
          }
        }
        // Swipe left
        else if (deltaX < -minSwipeDistance && velocity > 0.3) {
          onSwipeLeft?.();
        }
      }

      touchStartRef.current = null;
      isSwipingRef.current = false;
    } catch (error) {
      console.warn('Error in touch end:', error);
      touchStartRef.current = null;
      isSwipingRef.current = false;
    }
  }, [minSwipeDistance, edgeThreshold, onSwipeLeft, onSwipeRight]);

  useEffect(() => {
    // Only enable on mobile devices
    if (!enabled || !isMobileDevice()) {
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    try {
      // Add event listeners with passive flag for better scroll performance
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchmove', handleTouchMove, { passive: true });
      element.addEventListener('touchend', handleTouchEnd, { passive: true });

      // Cleanup function
      return () => {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
      };
    } catch (error) {
      console.warn('Error setting up swipe gesture listeners:', error);
      return () => {};
    }
  }, [enabled, elementRef, handleTouchStart, handleTouchMove, handleTouchEnd]);
};

export { isMobileDevice };

