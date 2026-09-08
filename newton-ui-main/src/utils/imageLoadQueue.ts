/**
 * Image Loading Queue Manager
 * Limits concurrent image requests to prevent rate limiting
 */


type QueueItem = {
  url: string;
  resolve: (url: string) => void;
  reject: (error: Error) => void;
};

class ImageLoadQueue {
  private queue: QueueItem[] = [];
  private activeRequests = 0;
  private maxConcurrent = 3; // Load 3 images in batches
  private loadedImages = new Set<string>();
  private urlCache = new Map<string, string>(); // Cache for originalUrl -> displayableUrl
  private successfulImages: string[] = []; // Cache of successfully loaded images
  private maxCachedImages = 5; // Keep last 5 successful images as fallbacks
  private retryDelays = new Map<string, number>(); // Track retry delays for each URL

  /**
   * Add an image URL to the loading queue
   */
  async loadImage(url: string): Promise<string> {
    // If already loaded, return cached URL
    if (this.urlCache.has(url)) {
      return this.urlCache.get(url)!;
    }

    return new Promise<string>((resolve, reject) => {
      this.queue.push({ url, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process the queue and load images in batches of 3
   */
  private processQueue() {
    // Process up to maxConcurrent (3) images at a time
    while (this.activeRequests < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        const isGoogleImage = item.url.includes('googleusercontent.com');
        // Add a longer delay between Google image requests to avoid rate limiting
        // Google Images rate limits aggressively, so we need more spacing
        if (isGoogleImage) {
          // Increment activeRequests before setTimeout to prevent concurrent processing
          this.activeRequests++;
          setTimeout(() => {
            // Decrement and then load (loadImageInternal will increment again)
            this.activeRequests--;
            this.loadImageInternal(item);
          }, 2000); // 2 second delay between Google image requests - mimics human browsing speed
        } else {
          this.loadImageInternal(item);
        }
      }
    }
  }

  /**
   * Internal method to load a single image
   */
  private async loadImageInternal(item: QueueItem) {
    this.activeRequests++;
    
    try {
      const displayableUrl = await this.preloadImage(item.url);
      this.loadedImages.add(item.url);
      this.urlCache.set(item.url, displayableUrl);
      
      // Clear retry delay on success
      this.retryDelays.delete(item.url);
      
      // Add to successful images cache
      this.addSuccessfulImage(item.url);
      
      item.resolve(displayableUrl);
    } catch (error) {
      // Check if it's a 429 error (rate limit)
      const errorMessage = (error as Error).message || '';
      const is429Error = errorMessage.includes('429') || errorMessage.includes('Too Many Requests');
      const isGoogleImage = item.url.includes('googleusercontent.com');
      
      if (is429Error && isGoogleImage) {
        // For 429 errors, add back to queue with delay
        const currentDelay = this.retryDelays.get(item.url) || 1000;
        const nextDelay = Math.min(currentDelay * 2, 10000); // Exponential backoff, max 10s
        this.retryDelays.set(item.url, nextDelay);
        
        setTimeout(() => {
          this.queue.push(item);
          this.processQueue();
        }, currentDelay);
      } else {
        item.reject(error as Error);
      }
    } finally {
      this.activeRequests--;
      // Process next image in queue
      this.processQueue();
    }
  }

  /**
   * Add a successfully loaded image to the cache
   */
  private addSuccessfulImage(url: string) {
    // Remove if already exists to update position
    this.successfulImages = this.successfulImages.filter(img => img !== url);
    
    // Add to beginning
    this.successfulImages.unshift(url);
    
    // Keep only max cached images
    if (this.successfulImages.length > this.maxCachedImages) {
      this.successfulImages = this.successfulImages.slice(0, this.maxCachedImages);
    }
  }

  /**
   * Preload an image by creating an Image object
   */
  private preloadImage(url: string): Promise<string> {
    if (url.includes('/files/')) {
      return this.preloadGotalkImage(url);
    }
    
    // Special handling for Google Images URLs to handle CORS issues
    if (url.includes('googleusercontent.com')) {
      return this.preloadGoogleImage(url);
    }
    
    // Standard image preloading for other URLs
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => resolve(url);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      
      img.src = url;
    });
  }
  
  /**
   * Preload a Gotalk image using fetch with cookie-based authentication
   * Authentication is handled via httpOnly cookies sent automatically with credentials: "include"
   */
  private preloadGotalkImage(url: string): Promise<string> {
    // Create a new URL object to handle the URL properly
    const imageUrl = new URL(url);
    
    // Use fetch with credentials to send httpOnly cookies automatically
    // No Authorization header needed - authentication is handled via cookies
    return fetch(imageUrl.toString(), {
      method: 'GET',
      credentials: 'include'
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load image: ${url} (${response.status})`);
      }
      
      // For images, we need to create a blob URL to display them
      return response.blob().then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        
        // We need to preload this object URL to ensure it's cached
        return new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            resolve(objectUrl);
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`Failed to load blob image: ${url}`))
          };
          img.src = objectUrl;
        });
      });
    });
  }
  
  /**
   * Preload a Google Images URL - use direct Image loading without CORS to mimic browser behavior
   * This avoids rate limiting that occurs with fetch/CORS requests
   * When you open a URL directly in a browser tab, it doesn't use CORS, so we mimic that behavior
   */
  private preloadGoogleImage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use Image element directly WITHOUT crossOrigin to mimic browser behavior
      // This works exactly like opening the URL directly in a browser tab
      // Setting crossOrigin='anonymous' triggers CORS checks which Google rate-limits differently
      const img = new Image();
      let isResolved = false;
      
      // Set referrerPolicy to 'no-referrer' to bypass hotlink protection
      // This prevents sending Origin/Referer headers that Google Images might reject
      if ('referrerPolicy' in img) {
        (img as any).referrerPolicy = 'no-referrer';
      }
      
      img.onload = () => {
        if (!isResolved) {
          isResolved = true;
          resolve(url);
        }
      };
      
      img.onerror = () => {
        if (!isResolved) {
          isResolved = true;
          // If Image load fails, it might be a 429 or network error
          // Since we can't detect status codes from Image.onerror, we reject
          // The retry logic in loadImageInternal will handle 429 errors
          reject(new Error(`Failed to load Google image: ${url}`));
        }
      };
      
      // Load without crossOrigin - this is the key difference from fetch/CORS approach
      img.src = url;
    });
  }
  
  /**
   * Clear the queue and reset state
   */
  clear() {
    this.queue = [];
    this.activeRequests = 0;
    this.loadedImages.clear();
    this.urlCache.clear();
  }

  /**
   * Get a random successful image as fallback
   */
  getFallbackImage(): string | null {
    if (this.successfulImages.length === 0) {
      return null;
    }
    // Return a random image from successful cache
    const randomIndex = Math.floor(Math.random() * this.successfulImages.length);
    return this.successfulImages[randomIndex];
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      loadedCount: this.loadedImages.size,
      cachedFallbacks: this.successfulImages.length,
    };
  }
}

// Export singleton instance
export const imageLoadQueue = new ImageLoadQueue();

