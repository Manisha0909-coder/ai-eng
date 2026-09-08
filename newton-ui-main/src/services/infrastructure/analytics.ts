export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: number;
}

export interface AnalyticsService {
  track: (event: AnalyticsEvent) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  page: (name: string, properties?: Record<string, unknown>) => void;
}

class AnalyticsServiceImpl implements AnalyticsService {
  private userId: string | null = null;
  private events: AnalyticsEvent[] = [];

  track(event: AnalyticsEvent): void {
    const enrichedEvent = {
      ...event,
      timestamp: event.timestamp || Date.now(),
      userId: this.userId,
    };

    this.events.push(enrichedEvent);
    this.logEvent();
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    this.userId = userId;
    this.track({
      name: 'identify',
      properties: traits,
    });
  }

  page(name: string, properties?: Record<string, unknown>): void {
    this.track({
      name: 'page_view',
      properties: {
        page_name: name,
        ...properties,
      },
    });
  }

  private logEvent(): void {
    if (process.env.NODE_ENV === 'development') {
    }
    // Here you would typically send the event to your analytics service
    // For example: Google Analytics, Mixpanel, etc.
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }
}

export const analyticsService = new AnalyticsServiceImpl();

export const trackEvent = (name: string, properties?: Record<string, unknown>): void => {
  analyticsService.track({ name, properties });
};

export const trackError = (error: Error, context?: Record<string, unknown>): void => {
  analyticsService.track({
    name: 'error',
    properties: {
      error_message: error.message,
      error_stack: error.stack,
      ...context,
    },
  });
};

export const trackModelUsage = (model: string, success: boolean, error?: string): void => {
  analyticsService.track({
    name: 'model_usage',
    properties: {
      model,
      success,
      error,
    },
  });
};

export const trackFileUpload = (fileType: string, size: number, success: boolean, error?: string): void => {
  analyticsService.track({
    name: 'file_upload',
    properties: {
      file_type: fileType,
      file_size: size,
      success,
      error,
    },
  });
};

export const trackUserAction = (action: string, properties?: Record<string, unknown>): void => {
  analyticsService.track({
    name: 'user_action',
    properties: {
      action,
      ...properties,
    },
  });
}; 