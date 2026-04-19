/**
 * Enterprise Analytics Service
 *
 * Types extracted to analytics-types.ts (ADR-065 Phase 6).
 *
 * @module lib/social-platform-system/analytics-service
 */

import { generateShareId } from '@/services/enterprise-id.service';
import { safeGetItem, safeSetItem, safeRemoveItem, STORAGE_KEYS } from '@/lib/storage/safe-storage';

import { type SocialPlatformType } from './platform-config';
import { createModuleLogger } from '@/lib/telemetry';

import type {
  UtmParameters,
  ShareAnalyticsEvent,
  CampaignConfig,
  UrlGenerationOptions,
  AnalyticsSummary,
} from './analytics-types';
import { nowISO } from '@/lib/date-local';

// Re-export types for backward compatibility
export type {
  UtmParameters,
  ShareAnalyticsEvent,
  CampaignConfig,
  UrlGenerationOptions,
  AnalyticsSummary,
} from './analytics-types';

const logger = createModuleLogger('analytics-service');

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
      logger.warn('Failed to generate shareable URL', { error });
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
    return generateShareId();
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
    metadata?: Record<string, unknown>
  ): void {
    const event: ShareAnalyticsEvent = {
      timestamp: nowISO(),
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
    logger.info('Share Event Tracked', { event });
  }

  /**
   * 💾 Store Event Locally
   *
   * Stores events locally για development και backup
   */
  static storeEventLocally(event: ShareAnalyticsEvent): void {
    try {
      // ADR-209: centralized safe-storage
      const events = safeGetItem<ShareAnalyticsEvent[]>(STORAGE_KEYS.SOCIAL_PLATFORM_ANALYTICS, []);
      events.push(event);

      // Keep only last 100 events
      if (events.length > 100) {
        events.splice(0, events.length - 100);
      }

      safeSetItem(STORAGE_KEYS.SOCIAL_PLATFORM_ANALYTICS, events);
    } catch (error) {
      logger.warn('Failed to store analytics event locally', { error });
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
      logger.info('Analytics service event', { event });
    } catch (error) {
      logger.warn('Failed to send event to analytics service', { error });
    }
  }

  /**
   * 📈 Send to Google Analytics
   *
   * Sends events to Google Analytics 4
   */
  // 🏢 ENTERPRISE: Type for Google Analytics gtag function
  static sendToGoogleAnalytics(event: ShareAnalyticsEvent): void {
    try {
      // Check αν Google Analytics is available
      type GtagFunction = (command: string, action: string, params: Record<string, unknown>) => void;
      interface WindowWithGtag extends Window {
        gtag?: GtagFunction;
      }
      const win = typeof window !== 'undefined' ? window as WindowWithGtag : null;

      if (win?.gtag) {
        win.gtag('event', 'share', {
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
      logger.warn('Failed to send event to Google Analytics', { error });
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
      // ADR-209: centralized safe-storage
      return safeGetItem<ShareAnalyticsEvent[]>(STORAGE_KEYS.SOCIAL_PLATFORM_ANALYTICS, []);
    } catch (error) {
      logger.warn('Failed to retrieve stored events', { error });
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
      // ADR-209: centralized safe-storage
      safeRemoveItem(STORAGE_KEYS.SOCIAL_PLATFORM_ANALYTICS);
    } catch (error) {
      logger.warn('Failed to clear stored events', { error });
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

// Canonical SSoT: @/lib/share-utils (generateShareableURL / trackShareEvent).
// Former class-backed wrappers were dead (no barrel consumers) and diverged
// from share-utils impl; redirecting preserves the index.ts API surface while
// collapsing CHECK 3.18 duplicate exports (ADR-314 Phase C.5.47).
export { generateShareableURL, trackShareEvent } from '@/lib/share-utils';

// ============================================================================
// EXPORTS - CLEAN ENTERPRISE API
// ============================================================================

export default AnalyticsService;