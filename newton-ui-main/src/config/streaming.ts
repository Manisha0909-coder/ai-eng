// Streaming configuration for better UX - Production Grade Optimized (Anti-Bouncing)
export const STREAMING_CONFIG = {
  // Throttling settings - Optimized for smooth UI without bouncing
  THROTTLE_DELAY: 150, // ms - Increased to reduce bouncing
  
  // Character buffering settings - Optimized for readability
  BUFFER_THRESHOLD: 12, // characters - Increased for better batching and less bouncing
  BUFFER_TIMEOUT: 250, // ms - Balanced timeout for responsive updates
  
  // Visual settings - Anti-bouncing optimized
  TYPING_ANIMATION_DURATION: 1000, // ms - Reduced to minimize bouncing
  TYPING_DOT_DELAYS: [0, 100, 200], // ms - Adjusted for smoother animation
  
  // Performance settings - Production optimized for stable rendering
  MAX_BUFFER_SIZE: 150, // characters - Increased for better batching
  CLEANUP_DELAY: 150, // ms - Increased for stability
  MIN_UPDATE_INTERVAL: 160, // ms - Increased to reduce React render frequency and eliminate bouncing
  
  // UX improvements - Anti-bouncing focused
  MIN_DISPLAY_CONTENT: 3, // characters - Increased to reduce flickering and bouncing
  THINKING_FALLBACK_DELAY: 600, // ms - Reduced for more responsive feel
  
  // Reasoning display settings
  REASONING_MIN_DISPLAY_TIME: 1500, // ms - Slightly reduced
  
  // Production optimizations - Anti-bouncing features
  CONTENT_DEBOUNCE_DELAY: 120, // ms - Increased to prevent rapid updates causing bouncing
  BATCH_UPDATE_SIZE: 80, // characters - Increased for fewer updates
  SCROLL_THROTTLE_DELAY: 80, // ms - Increased to reduce scroll bouncing
  
  // Frame-based updates for ultra smooth rendering without bouncing
  USE_RAF_UPDATES: true, // Use requestAnimationFrame for updates
  MAX_UPDATES_PER_FRAME: 1, // Reduced to prevent frame overload causing bouncing
  
  // Anti-bouncing specific settings
  DISABLE_LAYOUT_ANIMATIONS: true, // Disable layout animations during streaming
  STABLE_HEIGHT_MODE: true, // Maintain stable heights during streaming
  PREVENT_SCALE_ANIMATIONS: true, // Disable scale animations that cause bouncing
  MINIMIZE_TRANSITIONS: true, // Minimize CSS transitions during streaming
} as const;

// Helper function to get streaming speed based on user preference
export const getStreamingSpeed = (userPreference?: 'fast' | 'normal' | 'slow') => {
  switch (userPreference) {
    case 'fast':
      return {
        throttleDelay: 100,
        bufferThreshold: 6,
        bufferTimeout: 150,
        minUpdateInterval: 120,
      };
    case 'slow':
      return {
        throttleDelay: 250,
        bufferThreshold: 25,
        bufferTimeout: 500,
        minUpdateInterval: 250,
      };
    default: // normal - production optimized for anti-bouncing
      return {
        throttleDelay: STREAMING_CONFIG.THROTTLE_DELAY,
        bufferThreshold: STREAMING_CONFIG.BUFFER_THRESHOLD,
        bufferTimeout: STREAMING_CONFIG.BUFFER_TIMEOUT,
        minUpdateInterval: STREAMING_CONFIG.MIN_UPDATE_INTERVAL,
      };
  }
}; 