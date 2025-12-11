// ============================================================================
// 📊 ENTERPRISE ANALYTICS SERVICE - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΔΙΑΧΕΙΡΙΣΗ ANALYTICS
// ============================================================================
//
// 🎯 PURPOSE: Single source για ΟΛΕΣ τις analytics & tracking operations
// 🔗 REPLACES: Scattered UTM logic από share-utils.ts + tracking functions
// 🏢 STANDARDS: Enterprise analytics layer, centralized tracking, GDPR compliance
//
// 📋 FEATURES UNIFIED:
// - UTM parameter generation & management
// - Share event tracking & analytics
// - URL parameter handling
// - Social media campaign tracking
// - Performance metrics collection
//
// ============================================================================

import { type SocialPlatformType } from './platform-config';

// ============================================================================
// ANALYTICS SERVICE TYPE DEFINITIONS
// ============================================================================

/**
 * 📊 UTM Parameters - Standard Interface
 *
 * Standard UTM parameters για marketing campaign tracking
 */
export interface UtmParameters {
  /** Traffic source (e.g., 'facebook', 'email', 'direct') */
  source: string;
  /** Marketing medium (e.g., 'social', 'email', 'cpc', 'organic') */
  medium: string;
  /** Campaign name (e.g., 'spring_sale', 'product_launch') */
  campaign: string;
  /** Campaign content (optional, για A/B testing) */
  content?: string;
  /** Campaign term (optional, για paid search) */
  term?: string;
}

/**
 * 🎯 Share Analytics Event
 *
 * Event data για social sharing analytics
 */
export interface ShareAnalyticsEvent {
  /** Event timestamp */
  timestamp: string;
  /** Shared content type */
  contentType: 'property' | 'photo' | 'article' | 'profile' | 'general';
  /** Content identifier */
  contentId: string;
  /** Sharing platform */
  platform: SocialPlatformType;
  /** Share method used */
  method: 'native_share' | 'external_url' | 'clipboard' | 'email';
  /** Share result */
  success: boolean;
  /** Error message (if failed) */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * 📈 Campaign Configuration
 *
 * Configuration για marketing campaigns
 */
export interface CampaignConfig {
  /** Campaign identifier */
  id: string;
  /** Campaign name */
  name: string;
  /** Default UTM parameters */
  defaultUtm: UtmParameters;
  /** Campaign tags για categorization */
  tags?: string[];
  /** Campaign start date */
  startDate?: Date;
  /** Campaign end date */
  endDate?: Date;
  /** Campaign status */
  status: 'draft' | 'active' | 'paused' | 'completed';
}

/**
 * 🔗 Enhanced URL Generation Options
 *
 * Options για URL generation με analytics
 */
export interface UrlGenerationOptions {
  /** Base UTM parameters */
  utm?: Partial<UtmParameters>;
  /** Additional query parameters */
  additionalParams?: Record<string, string>;
  /** Force production domain για social sharing */
  forceProductionDomain?: boolean;
  /** Custom domain override */
  customDomain?: string;
  /** Include tracking pixel */
  includeTracking?: boolean;
  /** Campaign configuration */
  campaign?: string | CampaignConfig;
}

/**
 * 📊 Analytics Summary
 *
 * Summary data για analytics reporting
 */
export interface AnalyticsSummary {
  /** Total share events */
  totalShares: number;
  /** Successful shares */
  successfulShares: number;
  /** Failed shares */
  failedShares: number;
  /** Success rate percentage */
  successRate: number;
  /** Platform breakdown */
  platformBreakdown: Record<SocialPlatformType, number>;
  /** Content type breakdown */
  contentTypeBreakdown: Record<string, number>;
  /** Time period */
  period: {
    start: Date;
    end: Date;
  };
}

// ============================================================================
// ENTERPRISE ANALYTICS SERVICE - MAIN CLASS
// ============================================================================

/**
 * 🏢 Enterprise Analytics Service
 *
 * Single source για όλες τις analytics & tracking operations
 * Replaces scattered analytics functions across multiple files
 */
export class AnalyticsService {

  // ============================================================================
  // UTM PARAMETER MANAGEMENT
  // ============================================================================

  /**
   * 🔗 Generate Shareable URL με UTM Parameters - CORE METHOD
   *
   * REPLACES: generateShareableURL από share-utils.ts
   * Enhanced με enterprise features και proper domain handling
   *
   * @param baseUrl - Base URL path (e.g., '/properties/123')
   * @param options - URL generation options
   * @returns Complete shareable URL με UTM parameters
   */
  static generateShareableUrl(baseUrl: string, options: UrlGenerationOptions = {}): string {
    try {
      // Determine domain
      const domain = this.getTargetDomain(options);

      // Create URL object
      const url = new URL(baseUrl, domain);

      // Add UTM parameters
      if (options.utm) {
        this.addUtmParametersToUrl(url, options.utm);
      }

      // Add additional parameters
      if (options.additionalParams) {
        Object.entries(options.additionalParams).forEach(([key, value]) => {
          if (value) {
            url.searchParams.set(key, value);
          }
        });
      }

      // Add campaign parameters αν campaign specified
      if (options.campaign) {
        this.addCampaignParametersToUrl(url, options.campaign);
      }

      // Add tracking parameters αν enabled
      if (options.includeTracking) {
        this.addTrackingParametersToUrl(url);
      }

      return url.toString();

    } catch (error) {
      console.warn('Failed to generate shareable URL:', error);
      return baseUrl;
    }
  }

  /**
   * 🎯 Add UTM Parameters to URL
   *
   * Helper method για adding UTM parameters
   */
  static addUtmParametersToUrl(url: URL, utm: Partial<UtmParameters>): void {
    if (utm.source) url.searchParams.set('utm_source', utm.source);
    if (utm.medium) url.searchParams.set('utm_medium', utm.medium);
    if (utm.campaign) url.searchParams.set('utm_campaign', utm.campaign);
    if (utm.content) url.searchParams.set('utm_content', utm.content);
    if (utm.term) url.searchParams.set('utm_term', utm.term);
  }

  /**
   * 🏢 Get Target Domain για Sharing
   *
   * REPLACES: Domain logic από share-utils.ts
   * Smart domain detection για optimal sharing
   */
  static getTargetDomain(options: UrlGenerationOptions = {}): string {
    // Custom domain override
    if (options.customDomain) {
      return options.customDomain;
    }

    // Force production για social media sharing
    if (options.forceProductionDomain !== false) {
      const productionDomain = 'https://nestor-app.vercel.app';

      // Check αν είμαστε σε development environment
      if (typeof window !== 'undefined') {
        const currentOrigin = window.location.origin;
        return currentOrigin.includes('localhost') ? productionDomain : currentOrigin;
      }

      return productionDomain;
    }

    // Default: current domain (αν available)
    return typeof window !== 'undefined' ? window.location.origin : 'https://nestor-app.vercel.app';
  }

  /**
   * 📊 Add Campaign Parameters to URL
   *
   * Adds campaign-specific parameters
   */
  static addCampaignParametersToUrl(url: URL, campaign: string | CampaignConfig): void {
    if (typeof campaign === 'string') {
      url.searchParams.set('campaign_id', campaign);
    } else {
      url.searchParams.set('campaign_id', campaign.id);
      url.searchParams.set('campaign_name', campaign.name);

      // Add campaign UTM as defaults
      this.addUtmParametersToUrl(url, campaign.defaultUtm);
    }
  }

  /**
   * 🔍 Add Tracking Parameters to URL
   *
   * Adds tracking parameters για analytics
   */
  static addTrackingParametersToUrl(url: URL): void {
    const trackingId = this.generateTrackingId();
    url.searchParams.set('tracking_id', trackingId);
    url.searchParams.set('shared', 'true');
    url.searchParams.set('share_timestamp', Date.now().toString());
  }

  /**
   * 🆔 Generate Tracking ID
   *
   * Generates unique tracking identifier
   */
  static generateTrackingId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `share_${timestamp}_${random}`;
  }

  // ============================================================================
  // SHARE EVENT TRACKING
  // ============================================================================

  /**
   * 📊 Track Share Event - MAIN TRACKING METHOD
   *
   * REPLACES: trackShareEvent από share-utils.ts
   * Enhanced με detailed event data και proper analytics integration
   */
  static trackShareEvent(
    platform: SocialPlatformType,
    contentType: ShareAnalyticsEvent['contentType'],
    contentId: string,
    method: ShareAnalyticsEvent['method'] = 'external_url',
    success: boolean = true,
    metadata?: Record<string, any>
  ): void {
    const event: ShareAnalyticsEvent = {
      timestamp: new Date().toISOString(),
      contentType,
      contentId,
      platform,
      method,
      success,
      metadata
    };

    // Store event locally (για development/debugging)
    this.storeEventLocally(event);

    // Send to analytics service αν available
    this.sendToAnalyticsService(event);

    // Send to Google Analytics αν available
    this.sendToGoogleAnalytics(event);

    // Debug logging
    console.log('📊 Share Event Tracked:', event);
  }

  /**
   * 💾 Store Event Locally
   *
   * Stores events locally για development και backup
   */
  static storeEventLocally(event: ShareAnalyticsEvent): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const storageKey = 'social_platform_analytics';
        const existing = localStorage.getItem(storageKey);
        const events = existing ? JSON.parse(existing) : [];

        events.push(event);

        // Keep only last 100 events
        if (events.length > 100) {
          events.splice(0, events.length - 100);
        }

        localStorage.setItem(storageKey, JSON.stringify(events));
      }
    } catch (error) {
      console.warn('Failed to store analytics event locally:', error);
    }
  }

  /**
   * 🚀 Send to Analytics Service
   *
   * Sends events to centralized analytics service
   */
  static async sendToAnalyticsService(event: ShareAnalyticsEvent): Promise<void> {
    try {
      // This would integrate με your analytics API
      // await fetch('/api/analytics/share-event', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event)
      // });

      // For now, just log
      console.log('Analytics service event:', event);
    } catch (error) {
      console.warn('Failed to send event to analytics service:', error);
    }
  }

  /**
   * 📈 Send to Google Analytics
   *
   * Sends events to Google Analytics 4
   */
  static sendToGoogleAnalytics(event: ShareAnalyticsEvent): void {
    try {
      // Check αν Google Analytics is available
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'share', {
          method: event.platform,
          content_type: event.contentType,
          item_id: event.contentId,
          custom_method: event.method,
          success: event.success,
          event_category: 'social_sharing',
          event_label: `${event.platform}_${event.contentType}`,
          value: event.success ? 1 : 0
        });
      }

      // Alternative: Check για other analytics providers
      // Facebook Pixel, Google Tag Manager, etc.
    } catch (error) {
      console.warn('Failed to send event to Google Analytics:', error);
    }
  }

  // ============================================================================
  // ANALYTICS REPORTING
  // ============================================================================

  /**
   * 📊 Get Analytics Summary
   *
   * Generates analytics summary από stored events
   */
  static getAnalyticsSummary(startDate?: Date, endDate?: Date): AnalyticsSummary {
    const events = this.getStoredEvents();

    // Filter by date range
    const filteredEvents = events.filter(event => {
      const eventDate = new Date(event.timestamp);
      if (startDate && eventDate < startDate) return false;
      if (endDate && eventDate > endDate) return false;
      return true;
    });

    // Calculate summary
    const totalShares = filteredEvents.length;
    const successfulShares = filteredEvents.filter(e => e.success).length;
    const failedShares = totalShares - successfulShares;
    const successRate = totalShares > 0 ? Math.round((successfulShares / totalShares) * 100) : 0;

    // Platform breakdown
    const platformBreakdown: Record<string, number> = {};
    filteredEvents.forEach(event => {
      platformBreakdown[event.platform] = (platformBreakdown[event.platform] || 0) + 1;
    });

    // Content type breakdown
    const contentTypeBreakdown: Record<string, number> = {};
    filteredEvents.forEach(event => {
      contentTypeBreakdown[event.contentType] = (contentTypeBreakdown[event.contentType] || 0) + 1;
    });

    return {
      totalShares,
      successfulShares,
      failedShares,
      successRate,
      platformBreakdown: platformBreakdown as Record<SocialPlatformType, number>,
      contentTypeBreakdown,
      period: {
        start: startDate || (filteredEvents.length > 0 ? new Date(filteredEvents[0].timestamp) : new Date()),
        end: endDate || new Date()
      }
    };
  }

  /**
   * 📋 Get Stored Events
   *
   * Retrieves events από local storage
   */
  static getStoredEvents(): ShareAnalyticsEvent[] {
    try {
      if (typeof localStorage !== 'undefined') {
        const storageKey = 'social_platform_analytics';
        const stored = localStorage.getItem(storageKey);
        return stored ? JSON.parse(stored) : [];
      }
      return [];
    } catch (error) {
      console.warn('Failed to retrieve stored events:', error);
      return [];
    }
  }

  /**
   * 🧹 Clear Stored Events
   *
   * Clears local analytics storage
   */
  static clearStoredEvents(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('social_platform_analytics');
      }
    } catch (error) {
      console.warn('Failed to clear stored events:', error);
    }
  }

  // ============================================================================
  // CAMPAIGN MANAGEMENT
  // ============================================================================

  /**
   * 📊 Generate Campaign UTM
   *
   * Generates standardized UTM parameters για campaigns
   */
  static generateCampaignUtm(
    source: string,
    campaignName: string,
    contentType?: string
  ): UtmParameters {
    return {
      source: source.toLowerCase().replace(/\s+/g, '_'),
      medium: this.inferMediumFromSource(source),
      campaign: campaignName.toLowerCase().replace(/\s+/g, '_'),
      content: contentType || undefined
    };
  }

  /**
   * 🎯 Infer Medium από Source
   *
   * Smart medium inference από source
   */
  static inferMediumFromSource(source: string): string {
    const lowerSource = source.toLowerCase();

    if (lowerSource.includes('facebook') || lowerSource.includes('twitter') ||
        lowerSource.includes('linkedin') || lowerSource.includes('instagram')) {
      return 'social';
    }

    if (lowerSource.includes('email') || lowerSource.includes('newsletter')) {
      return 'email';
    }

    if (lowerSource.includes('google') || lowerSource.includes('search')) {
      return 'organic';
    }

    if (lowerSource.includes('ad') || lowerSource.includes('paid')) {
      return 'cpc';
    }

    return 'referral';
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS - BACKWARDS COMPATIBILITY
// ============================================================================

/**
 * 🔗 Generate Shareable URL - Function Export
 *
 * BACKWARDS COMPATIBLE με existing share-utils.ts code
 */
export const generateShareableURL = (
  baseUrl: string,
  utmParams: UtmParameters,
  additionalParams?: Record<string, string>
): string => {
  return AnalyticsService.generateShareableUrl(baseUrl, {
    utm: utmParams,
    additionalParams
  });
};

/**
 * 📊 Track Share Event - Function Export
 *
 * BACKWARDS COMPATIBLE με existing share-utils.ts code
 */
export const trackShareEvent = (
  platform: string,
  contentType: string,
  contentId: string
): void => {
  AnalyticsService.trackShareEvent(
    platform as SocialPlatformType,
    contentType as ShareAnalyticsEvent['contentType'],
    contentId
  );
};

// ============================================================================
// EXPORTS - CLEAN ENTERPRISE API
// ============================================================================

export default AnalyticsService;