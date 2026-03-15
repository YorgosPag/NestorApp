// ============================================================================
// 🛡️ ENTERPRISE DUPLICATE PREVENTION SERVICE - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ΠΡΟΣΤΑΣΙΑ
// ============================================================================
//
// 🎯 PURPOSE: Enterprise-grade duplicate contact prevention με intelligent algorithms
// 🔗 USED BY: ContactsService, contact creation workflows, import systems
// 🏢 STANDARDS: ISO 9000 data quality, GDPR compliance, enterprise deduplication
//
// ============================================================================

import {
  collection,
  query,
  where,
  getDocs,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Contact, ContactType } from '@/types/contacts';
import { contactConverter } from '@/lib/firestore/converters/contact.converter';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('DuplicatePreventionService');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * 🎯 Duplicate Detection Configuration
 */
export interface DuplicateDetectionConfig {
  /** Ενεργοποίηση strict mode για ακριβή ταύτιση */
  strictMode: boolean;
  /** Tolerance για fuzzy matching (0.0-1.0) */
  fuzzyTolerance: number;
  /** Maximum time window για duplicate detection (milliseconds) */
  timeWindow: number;
  /** Fields που θα χρησιμοποιηθούν για σύγκριση */
  comparisonFields: string[];
  /** Ενεργοποίηση phone number normalization */
  normalizePhones: boolean;
  /** Ενεργοποίηση email normalization */
  normalizeEmails: boolean;
}

/**
 * 🔍 Duplicate Detection Result
 */
export interface DuplicateDetectionResult {
  /** Αν βρέθηκαν duplicates */
  isDuplicate: boolean;
  /** Confidence score (0.0-1.0) */
  confidence: number;
  /** Existing contacts που ταιριάζουν */
  matchingContacts: Contact[];
  /** Λεπτομέρειες matching */
  matchDetails: DuplicateMatchDetail[];
  /** Προτάσεις ενεργειών */
  recommendations: DuplicateRecommendation[];
}

/**
 * 📋 Duplicate Match Detail
 */
export interface DuplicateMatchDetail {
  contactId: string;
  matchedFields: string[];
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'partial';
  details: string;
}

/**
 * 💡 Duplicate Recommendation
 */
export interface DuplicateRecommendation {
  action: 'merge' | 'update' | 'skip' | 'create_anyway';
  reason: string;
  contactId?: string;
}

// ============================================================================
// ENTERPRISE CONFIGURATION
// ============================================================================

/**
 * 🏢 DEFAULT ENTERPRISE CONFIGURATION
 */
export const DEFAULT_DUPLICATE_CONFIG: DuplicateDetectionConfig = {
  strictMode: true,
  fuzzyTolerance: 0.85,
  timeWindow: 5000, // 5 seconds για rapid duplicate detection
  comparisonFields: [
    'firstName', 'lastName', 'companyName', 'serviceName',
    'email', 'phone', 'vatNumber', 'companyVatNumber'
  ],
  normalizePhones: true,
  normalizeEmails: true
};

/**
 * 📱 TYPE-SPECIFIC CONFIGURATIONS
 */
export const TYPE_SPECIFIC_CONFIGS: Record<ContactType, Partial<DuplicateDetectionConfig>> = {
  individual: {
    comparisonFields: ['firstName', 'lastName', 'email', 'phone'],
    strictMode: true,
    fuzzyTolerance: 0.90 // Higher tolerance για individual contacts
  },
  company: {
    comparisonFields: ['companyName', 'vatNumber', 'companyVatNumber', 'email', 'phone'],
    strictMode: true,
    fuzzyTolerance: 0.95 // Very high tolerance για company names
  },
  service: {
    comparisonFields: ['serviceName', 'companyName', 'email', 'phone'],
    strictMode: false,
    fuzzyTolerance: 0.85
  }
};

// ============================================================================
// ENTERPRISE DUPLICATE PREVENTION SERVICE
// ============================================================================

export class DuplicatePreventionService {
  private static readonly COLLECTION = 'contacts';

  /**
   * 🎯 PRIMARY DUPLICATE DETECTION FUNCTION
   *
   * Enterprise-grade duplicate detection με intelligent algorithms
   */
  static async detectDuplicates(
    candidateContact: Partial<Contact>,
    config: Partial<DuplicateDetectionConfig> = {}
  ): Promise<DuplicateDetectionResult> {
    const finalConfig = this.buildConfig(candidateContact.type, config);

    try {
      // 🔍 Phase 1: Exact Match Detection
      const exactMatches = await this.findExactMatches(candidateContact, finalConfig);

      if (exactMatches.length > 0) {
        const exactMatchDetails = exactMatches.flatMap(contact => {
          const contactId = contact.id;
          if (!contactId) return [];
          return [{
            contactId,
            matchedFields: this.getMatchedFields(candidateContact, contact, finalConfig),
            confidence: 1.0,
            matchType: 'exact' as const,
            details: 'Exact match ™¨âŸž¡œ ©œ æ¢˜ «˜ ¡¨å© £˜ §œ›å˜'
          }];
        });
        const exactContactId = exactMatches.find(contact => contact.id)?.id;
        return {
          isDuplicate: true,
          confidence: 1.0,
          matchingContacts: exactMatches,
          matchDetails: exactMatchDetails,
          recommendations: [{
            action: 'update',
            reason: 'Exact duplicate ™¨âŸž¡œ - ©¬¤ ©«á«˜  update «¦¬ existing contact',
            contactId: exactContactId
          }]
        };
      }

      // 🔍 Phase 2: Fuzzy Match Detection (αν enabled)
      if (!finalConfig.strictMode) {
        const fuzzyMatches = await this.findFuzzyMatches(candidateContact, finalConfig);

        if (fuzzyMatches.length > 0) {
          const topMatch = fuzzyMatches[0];
          const confidence = this.calculateConfidence(candidateContact, topMatch, finalConfig);

          if (confidence >= finalConfig.fuzzyTolerance) {
            const fuzzyMatchDetails = fuzzyMatches.slice(0, 3).flatMap(contact => {
              const contactId = contact.id;
              if (!contactId) return [];
              return [{
                contactId,
                matchedFields: this.getMatchedFields(candidateContact, contact, finalConfig),
                confidence: this.calculateConfidence(candidateContact, contact, finalConfig),
                matchType: 'fuzzy' as const,
                details: `Fuzzy match £œ confidence ${(confidence * 100).toFixed(1)}%`
              }];
            });
            const topMatchId = topMatch.id;
            return {
              isDuplicate: true,
              confidence,
              matchingContacts: fuzzyMatches.slice(0, 3), // Top 3 matches
              matchDetails: fuzzyMatchDetails,
              recommendations: [{
                action: confidence > 0.95 ? 'merge' : 'skip',
                reason: ` Ÿ˜¤æ duplicate £œ confidence ${(confidence * 100).toFixed(1)}%`,
                contactId: topMatchId
              }]
            };
          }
        }
      }

      // 🔍 Phase 3: Rapid Duplicate Detection (time window)
      const rapidDuplicates = await this.findRapidDuplicates(candidateContact, finalConfig);

      if (rapidDuplicates.length > 0) {
        const rapidMatchDetails = rapidDuplicates.flatMap(contact => {
          const contactId = contact.id;
          if (!contactId) return [];
          return [{
            contactId,
            matchedFields: ['timestamp', 'basicInfo'],
            confidence: 0.99,
            matchType: 'partial' as const,
            details: 'Rapid duplicate detection - ›ž£ ¦¬¨šå˜ £â©˜ ©œ ¢åš˜ ›œ¬«œ¨æ¢œ§«˜'
          }];
        });
        return {
          isDuplicate: true,
          confidence: 0.99,
          matchingContacts: rapidDuplicates,
          matchDetails: rapidMatchDetails,
          recommendations: [{
            action: 'skip',
            reason: ' Ÿ˜¤æ accidental double-click - ˜§¦­¬šã ›ž£ ¦¬¨šå˜ª duplicate'
          }]
        };
      }

      // ✅ No duplicates found
      return {
        isDuplicate: false,
        confidence: 0.0,
        matchingContacts: [],
        matchDetails: [],
        recommendations: [{
          action: 'create_anyway',
          reason: 'Κανένα duplicate δεν βρέθηκε - ασφαλής δημιουργία νέας επαφής'
        }]
      };

    } catch (error) {
      logger.error('Duplicate detection error', { error });

      // Fail-safe: Allow creation αλλά με warning
      return {
        isDuplicate: false,
        confidence: 0.0,
        matchingContacts: [],
        matchDetails: [],
        recommendations: [{
          action: 'create_anyway',
          reason: 'Duplicate detection failed - επιτρέπουμε δημιουργία με fallback'
        }]
      };
    }
  }

  /**
   * 🔍 Find Exact Matches
   */
  private static async findExactMatches(
    candidateContact: Partial<Contact>,
    config: DuplicateDetectionConfig
  ): Promise<Contact[]> {
    const colRef = collection(db, this.COLLECTION).withConverter(contactConverter);
    const matches: Contact[] = [];

    // Query για κάθε comparison field
    for (const field of config.comparisonFields) {
      const value = this.normalizeValue(candidateContact[field as keyof Contact], field, config);

      if (!value || value.trim() === '') continue;

      try {
        // CROSS-TYPE VAT CHECK: vatNumber queries run WITHOUT type filter
        // to catch duplicates across individual/company/service contacts.
        // All other fields use type-scoped queries as before.
        const isVatField = field === 'vatNumber' || field === 'companyVatNumber';

        const constraints = isVatField
          ? [where(field, '==', value), limit(5)]
          : [where(field, '==', value), where('type', '==', candidateContact.type), limit(5)];

        const q = query(colRef, ...constraints);

        const snapshot = await getDocs(q);
        const fieldMatches = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        matches.push(...fieldMatches);
      } catch (error) {
        // Ignore query errors και continue
        logger.warn(`Query error for field ${field}`, { error });
      }
    }

    // Remove duplicates και return unique contacts
    return this.deduplicateMatches(matches);
  }

  /**
   * 🔍 Find Fuzzy Matches (simplified version)
   */
  private static async findFuzzyMatches(
    candidateContact: Partial<Contact>,
    config: DuplicateDetectionConfig
  ): Promise<Contact[]> {
    // For now, same as exact matches
    // TODO: Implement proper fuzzy matching με string similarity
    return this.findExactMatches(candidateContact, config);
  }

  /**
   * ⚡ Find Rapid Duplicates (time-based)
   */
  private static async findRapidDuplicates(
    candidateContact: Partial<Contact>,
    config: DuplicateDetectionConfig
  ): Promise<Contact[]> {
    const colRef = collection(db, this.COLLECTION).withConverter(contactConverter);
    const cutoffTime = Timestamp.fromMillis(Date.now() - config.timeWindow);

    try {
      const q = query(
        colRef,
        where('type', '==', candidateContact.type),
        where('createdAt', '>=', cutoffTime),
        limit(10)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.warn('Rapid duplicate detection error', { error });
      return [];
    }
  }

  /**
   * 🏗️ Build Configuration
   */
  private static buildConfig(
    contactType: ContactType | undefined,
    customConfig: Partial<DuplicateDetectionConfig>
  ): DuplicateDetectionConfig {
    const typeConfig = contactType ? TYPE_SPECIFIC_CONFIGS[contactType] : {};
    return {
      ...DEFAULT_DUPLICATE_CONFIG,
      ...typeConfig,
      ...customConfig
    };
  }

  /**
   * 🧹 Normalize Value
   */
  private static normalizeValue(
    value: unknown,
    field: string,
    config: DuplicateDetectionConfig
  ): string | null {
    if (!value) return null;

    const strValue = String(value).trim();

    if (field === 'phone' && config.normalizePhones) {
      return this.normalizePhone(strValue);
    }

    if (field === 'email' && config.normalizeEmails) {
      return this.normalizeEmail(strValue);
    }

    return strValue.toLowerCase();
  }

  /**
   * 📱 Normalize Phone Number
   */
  private static normalizePhone(phone: string): string {
    return phone
      .replace(/\s+/g, '')
      .replace(/[^\d+]/g, '')
      .replace(/^00/, '+')
      .toLowerCase();
  }

  /**
   * 📧 Normalize Email
   */
  private static normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * 🔍 Get Matched Fields
   */
  private static getMatchedFields(
    candidate: Partial<Contact>,
    existing: Contact,
    config: DuplicateDetectionConfig
  ): string[] {
    const matched: string[] = [];

    for (const field of config.comparisonFields) {
      const candidateValue = this.normalizeValue(candidate[field as keyof Contact], field, config);
      const existingValue = this.normalizeValue(existing[field as keyof Contact], field, config);

      if (candidateValue && existingValue && candidateValue === existingValue) {
        matched.push(field);
      }
    }

    return matched;
  }

  /**
   * 🧮 Calculate Confidence Score
   */
  private static calculateConfidence(
    candidate: Partial<Contact>,
    existing: Contact,
    config: DuplicateDetectionConfig
  ): number {
    const matchedFields = this.getMatchedFields(candidate, existing, config);
    return matchedFields.length / config.comparisonFields.length;
  }

  /**
   * 🔧 Remove Duplicate Matches
   */
  private static deduplicateMatches(matches: Contact[]): Contact[] {
    const seen = new Set<string>();
    return matches.filter(contact => {
      if (!contact.id) return false;
      if (seen.has(contact.id)) return false;
      seen.add(contact.id);
      return true;
    });
  }
}