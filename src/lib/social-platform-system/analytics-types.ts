/**
 * Analytics Service Type Definitions
 *
 * Extracted from analytics-service.ts (ADR-065 Phase 6).
 *
 * @module lib/social-platform-system/analytics-types
 */

import { type SocialPlatformType } from './platform-config';

// ============================================================================
// ANALYTICS SERVICE TYPE DEFINITIONS
// ============================================================================

/**
 * UTM Parameters - Standard Interface
 */
export interface UtmParameters {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

/**
 * Share Analytics Event
 */
export interface ShareAnalyticsEvent {
  timestamp: string;
  contentType: 'property' | 'photo' | 'article' | 'profile' | 'general';
  contentId: string;
  platform: SocialPlatformType;
  method: 'native_share' | 'external_url' | 'clipboard' | 'email';
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Campaign Configuration
 */
export interface CampaignConfig {
  id: string;
  name: string;
  defaultUtm: UtmParameters;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  status: 'draft' | 'active' | 'paused' | 'completed';
}

/**
 * Enhanced URL Generation Options
 */
export interface UrlGenerationOptions {
  utm?: Partial<UtmParameters>;
  additionalParams?: Record<string, string>;
  forceProductionDomain?: boolean;
  customDomain?: string;
  includeTracking?: boolean;
  campaign?: string | CampaignConfig;
}

/**
 * Analytics Summary
 */
export interface AnalyticsSummary {
  totalShares: number;
  successfulShares: number;
  failedShares: number;
  successRate: number;
  platformBreakdown: Record<SocialPlatformType, number>;
  contentTypeBreakdown: Record<string, number>;
  period: {
    start: Date;
    end: Date;
  };
}
