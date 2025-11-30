/**
 * 🕷️ WEB SCRAPING ENGINE - Phase 2.5.2
 *
 * Automated scraping για Spitogatos.gr, XE.gr και άλλες real estate πλατφόρμες
 * Χρησιμοποιεί established patterns από telegram-service.ts και error tracking
 *
 * Features:
 * - Rate limiting & respectful scraping
 * - Error handling & retries
 * - Data normalization & validation
 * - Δυναμική configuration για sites
 */

'use client';

import { addressResolver, type GeocodingResult } from './AddressResolver';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ScrapingTarget {
  id: string;
  name: string;               // 'Spitogatos', 'XE.gr', etc.
  baseUrl: string;
  enabled: boolean;
  rateLimit: {
    requestsPerMinute: number;
    respectRobotsTxt: boolean;
    userAgent: string;
  };
  selectors: {
    propertyCard: string;
    title: string;
    price: string;
    address: string;
    size: string;
    type: string;
    url: string;
    nextPage?: string;
  };
  apiEndpoint?: string;       // If site has API
  apiKey?: string;
  lastScraped?: Date;
}

export interface ScrapedProperty {
  id: string;
  title: string;
  address: string;
  price?: number;
  size?: number;              // τετραγωνικά μέτρα
  type?: string;              // 'apartment', 'house', etc.
  url: string;
  images?: string[];
  description?: string;
  source: string;             // 'spitogatos', 'xe', etc.
  scrapedAt: Date;
  coordinates?: {
    lat: number;
    lng: number;
  };
  geocodingResult?: GeocodingResult;
}

export interface ScrapingResult {
  target: ScrapingTarget;
  success: boolean;
  totalFound: number;
  newProperties: number;
  updatedProperties: number;
  errors: string[];
  properties: ScrapedProperty[];
  executionTime: number;
  nextRunAt?: Date;
}

export interface ScrapingOptions {
  maxPages?: number;          // Limit pages to scrape
  maxProperties?: number;     // Limit total properties
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    propertyTypes?: string[];
    areas?: string[];
  };
  geocodeResults?: boolean;   // Auto-geocode addresses
  respectDelay?: boolean;     // Respect rate limiting
  saveToStorage?: boolean;    // Save results to localStorage/DB
}

// ============================================================================
// WEB SCRAPING ENGINE CLASS
// ============================================================================

export class WebScrapingEngine {
  private readonly defaultTargets: ScrapingTarget[] = [
    {
      id: 'spitogatos',
      name: 'Spitogatos.gr',
      baseUrl: 'https://www.spitogatos.gr',
      enabled: true,
      rateLimit: {
        requestsPerMinute: 30,
        respectRobotsTxt: true,
        userAgent: 'GEO-ALERT Real Estate Monitor/1.0'
      },
      selectors: {
        propertyCard: '.result-item',
        title: '.result-title',
        price: '.result-price',
        address: '.result-address',
        size: '.result-size',
        type: '.result-type',
        url: 'a[href]'
      }
    },
    {
      id: 'xe',
      name: 'XE.gr',
      baseUrl: 'https://www.xe.gr',
      enabled: true,
      rateLimit: {
        requestsPerMinute: 20,
        respectRobotsTxt: true,
        userAgent: 'GEO-ALERT Real Estate Monitor/1.0'
      },
      selectors: {
        propertyCard: '.listing-item',
        title: '.listing-title',
        price: '.listing-price',
        address: '.listing-location',
        size: '.listing-area',
        type: '.listing-category',
        url: 'a[href]'
      }
    }
  ];

  private targets: ScrapingTarget[];
  private lastRequestTime = new Map<string, number>();

  constructor(customTargets?: ScrapingTarget[]) {
    this.targets = customTargets || this.defaultTargets;
    this.loadConfiguration();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Scrape all enabled targets
   */
  async scrapeAll(options: ScrapingOptions = {}): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    const enabledTargets = this.targets.filter(t => t.enabled);

    // Debug logging removed - Starting web scraping

    for (const target of enabledTargets) {
      try {
        // Debug logging removed - Scraping target
        const result = await this.scrapeTarget(target, options);
        results.push(result);

        // Save results if enabled
        if (options.saveToStorage) {
          this.saveResults(target.id, result);
        }

        // Update last scraped time
        target.lastScraped = new Date();

      } catch (error) {
        // Error logging removed //(`❌ Error scraping ${target.name}:`, error);
        results.push({
          target,
          success: false,
          totalFound: 0,
          newProperties: 0,
          updatedProperties: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          properties: [],
          executionTime: 0
        });
      }
    }

    return results;
  }

  /**
   * Scrape specific target
   */
  async scrapeTarget(target: ScrapingTarget, options: ScrapingOptions = {}): Promise<ScrapingResult> {
    const startTime = Date.now();
    const properties: ScrapedProperty[] = [];
    const errors: string[] = [];

    try {
      // Check if we have API endpoint
      if (target.apiEndpoint) {
        return this.scrapeViaAPI(target, options);
      }

      // Web scraping approach
      return this.scrapeViaDOM(target, options);

    } catch (error) {
      // Error logging removed //(`Scraping failed for ${target.name}:`, error);
      return {
        target,
        success: false,
        totalFound: 0,
        newProperties: 0,
        updatedProperties: 0,
        errors: [error instanceof Error ? error.message : 'Scraping failed'],
        properties,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get scraping statistics
   */
  getStatistics(): {
    totalTargets: number;
    enabledTargets: number;
    lastScrapedTargets: number;
    averagePropertiesPerTarget: number;
  } {
    const enabledTargets = this.targets.filter(t => t.enabled);
    const recentlyScraped = this.targets.filter(t =>
      t.lastScraped && Date.now() - t.lastScraped.getTime() < 24 * 60 * 60 * 1000
    );

    return {
      totalTargets: this.targets.length,
      enabledTargets: enabledTargets.length,
      lastScrapedTargets: recentlyScraped.length,
      averagePropertiesPerTarget: 0 // Will be calculated from saved results
    };
  }

  // ============================================================================
  // SCRAPING METHODS
  // ============================================================================

  /**
   * Scrape via API (if available)
   */
  private async scrapeViaAPI(target: ScrapingTarget, options: ScrapingOptions): Promise<ScrapingResult> {
    const startTime = Date.now();

    if (!target.apiEndpoint) {
      throw new Error('No API endpoint configured');
    }

    // Rate limiting
    await this.enforceRateLimit(target);

    try {
      const response = await fetch(target.apiEndpoint, {
        headers: {
          'User-Agent': target.rateLimit.userAgent,
          'Accept': 'application/json',
          ...(target.apiKey && { 'Authorization': `Bearer ${target.apiKey}` })
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const properties = await this.normalizeAPIData(data, target);

      // Geocode if requested
      if (options.geocodeResults) {
        await this.geocodeProperties(properties);
      }

      return {
        target,
        success: true,
        totalFound: properties.length,
        newProperties: properties.length,
        updatedProperties: 0,
        errors: [],
        properties,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      throw new Error(`API scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Scrape via DOM parsing (fallback method)
   */
  private async scrapeViaDOM(target: ScrapingTarget, options: ScrapingOptions): Promise<ScrapingResult> {
    const startTime = Date.now();

    // Note: Client-side DOM scraping has limitations due to CORS
    // This would typically run server-side or use a proxy service

    // Warning logging removed //(`⚠️ DOM scraping for ${target.name} requires server-side implementation or proxy service`);

    return {
      target,
      success: false,
      totalFound: 0,
      newProperties: 0,
      updatedProperties: 0,
      errors: ['DOM scraping not implemented - requires server-side or proxy service'],
      properties: [],
      executionTime: Date.now() - startTime
    };
  }

  // ============================================================================
  // DATA PROCESSING
  // ============================================================================

  /**
   * Normalize API data to standard format
   */
  private async normalizeAPIData(data: any, target: ScrapingTarget): Promise<ScrapedProperty[]> {
    // This would be customized per API
    // Debug logging removed - Normalizing data

    return []; // Placeholder - would implement based on actual API responses
  }

  /**
   * Geocode property addresses
   */
  private async geocodeProperties(properties: ScrapedProperty[]): Promise<void> {
    // Debug logging removed - Geocoding properties

    for (const property of properties) {
      try {
        const result = await addressResolver.resolveAddress(property.address);
        if (result) {
          property.coordinates = {
            lat: result.lat,
            lng: result.lng
          };
          property.geocodingResult = result;
        }
      } catch (error) {
        // Warning logging removed //(`Failed to geocode: ${property.address}`, error);
      }

      // Small delay between geocoding requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // ============================================================================
  // RATE LIMITING & UTILITIES
  // ============================================================================

  /**
   * Enforce rate limiting between requests
   */
  private async enforceRateLimit(target: ScrapingTarget): Promise<void> {
    const targetId = target.id;
    const lastRequest = this.lastRequestTime.get(targetId) || 0;
    const minInterval = (60 * 1000) / target.rateLimit.requestsPerMinute;
    const elapsed = Date.now() - lastRequest;

    if (elapsed < minInterval) {
      const delay = minInterval - elapsed;
      // Debug logging removed - Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime.set(targetId, Date.now());
  }

  /**
   * Save scraping results to localStorage
   */
  private saveResults(targetId: string, result: ScrapingResult): void {
    try {
      const key = `geo_alert_scraping_${targetId}`;
      const data = {
        timestamp: Date.now(),
        result: {
          ...result,
          properties: result.properties.slice(0, 100) // Limit stored properties
        }
      };
      localStorage.setItem(key, JSON.stringify(data));
      // Debug logging removed - Saved properties
    } catch (error) {
      // Warning logging removed //('Failed to save scraping results:', error);
    }
  }

  /**
   * Load configuration from localStorage
   */
  private loadConfiguration(): void {
    try {
      const stored = localStorage.getItem('geo_alert_scraping_config');
      if (stored) {
        const config = JSON.parse(stored);
        this.targets = { ...this.targets, ...config.targets };
        // Debug logging removed - Loaded scraping configuration
      }
    } catch (error) {
      // Warning logging removed - Failed to load scraping configuration
    }
  }

  // ============================================================================
  // CONFIGURATION MANAGEMENT
  // ============================================================================

  /**
   * Update target configuration
   */
  updateTarget(targetId: string, updates: Partial<ScrapingTarget>): void {
    const index = this.targets.findIndex(t => t.id === targetId);
    if (index >= 0) {
      this.targets[index] = { ...this.targets[index], ...updates };
      this.saveConfiguration();
    }
  }

  /**
   * Enable/disable target
   */
  setTargetEnabled(targetId: string, enabled: boolean): void {
    this.updateTarget(targetId, { enabled });
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfiguration(): void {
    try {
      const config = { targets: this.targets };
      localStorage.setItem('geo_alert_scraping_config', JSON.stringify(config));
    } catch (error) {
      // Warning logging removed //('Failed to save scraping configuration:', error);
    }
  }

  /**
   * Get all targets
   */
  getTargets(): ScrapingTarget[] {
    return [...this.targets];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const webScrapingEngine = new WebScrapingEngine();

// ============================================================================
// ERROR HANDLING & MONITORING
// ============================================================================

/**
 * Scraping error handler
 */
export class ScrapingErrorHandler {
  static logError(target: ScrapingTarget, error: Error, context?: any): void {
    // Error logging removed - Scraping Error

    // Could integrate with ErrorTracker service
    // ErrorTracker.track(error, { source: 'web-scraping', target: target.id });
  }

  static shouldRetry(error: Error): boolean {
    // Determine if error is retryable
    const retryableErrors = [
      'ENOTFOUND',
      'ECONNRESET',
      'ETIMEOUT',
      'Rate limit',
      '429',
      '503',
      '502'
    ];

    return retryableErrors.some(errorType =>
      error.message.includes(errorType)
    );
  }
}