/**
 * =============================================================================
 * LaborComplianceService — CRUD for EFKA Insurance Classes & Contribution Rates
 * =============================================================================
 *
 * Reads/writes labor compliance configuration (28 insurance classes KPK 781,
 * contribution rates) to/from Firestore `settings/labor_compliance`.
 *
 * Falls back to hardcoded defaults from contracts.ts when no Firestore
 * document exists yet.
 *
 * @module services/labor-compliance/labor-compliance-service
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';
import type { InsuranceClass, ContributionRates, LaborComplianceConfig } from '@/components/projects/ika/contracts';
import {
  DEFAULT_INSURANCE_CLASSES,
  DEFAULT_CONTRIBUTION_RATES,
  DEFAULT_LABOR_COMPLIANCE_CONFIG,
} from '@/components/projects/ika/contracts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('LaborComplianceService');

// ============================================================================
// DOCUMENT INTERFACE
// ============================================================================

/** Full Firestore document structure for settings/labor_compliance */
export interface LaborComplianceDocument {
  /** Active year (e.g. 2025) */
  activeYear: number;
  /** 28 insurance classes (KPK 781) */
  insuranceClasses: InsuranceClass[];
  /** Employer + employee contribution rates */
  contributionRates: ContributionRates;
  /** ISO date of last update */
  lastUpdated: string;
  /** User ID who last updated */
  updatedBy: string;
  /** EFKA circular reference (e.g. "ΕΦΚΑ Εγκύκλιος 39/2024") */
  sourceCircular: string | null;
  /** Effective date (ISO, e.g. "2025-01-01") */
  effectiveDate: string;
}

// ============================================================================
// VALIDATION
// ============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const EXPECTED_CLASS_COUNT = 28;

/**
 * Validates an array of 28 insurance classes.
 */
function validateInsuranceClasses(classes: InsuranceClass[]): ValidationResult {
  const errors: string[] = [];

  if (classes.length !== EXPECTED_CLASS_COUNT) {
    errors.push(`Αναμένονται ${EXPECTED_CLASS_COUNT} κλάσεις, βρέθηκαν ${classes.length}`);
  }

  for (let i = 0; i < classes.length; i++) {
    const c = classes[i];
    const label = `Κλάση ${c.classNumber}`;

    if (c.classNumber !== i + 1) {
      errors.push(`${label}: αναμενόταν classNumber ${i + 1}`);
    }
    if (c.minDailyWage < 0) {
      errors.push(`${label}: ελάχιστο ημερομίσθιο < 0`);
    }
    if (c.maxDailyWage <= c.minDailyWage) {
      errors.push(`${label}: μέγιστο ημερομίσθιο πρέπει > ελάχιστο`);
    }
    if (c.imputedDailyWage < c.minDailyWage || c.imputedDailyWage > c.maxDailyWage) {
      // Exception: class 28 has maxDailyWage=999999, imputed can be lower
      if (c.classNumber !== EXPECTED_CLASS_COUNT) {
        errors.push(`${label}: τεκμαρτό ημερομίσθιο εκτός ορίων [${c.minDailyWage}, ${c.maxDailyWage}]`);
      }
    }
    if (c.year < 2000 || c.year > 2100) {
      errors.push(`${label}: μη έγκυρο έτος ${c.year}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates contribution rates (all > 0 and < 100).
 */
function validateContributionRates(rates: ContributionRates): ValidationResult {
  const errors: string[] = [];

  const checkRate = (name: string, value: number) => {
    if (value <= 0 || value >= 100) {
      errors.push(`${name}: ποσοστό ${value}% εκτός ορίων (0, 100)`);
    }
  };

  checkRate('Κύρια Σύνταξη (εργοδότης)', rates.mainPension.employer);
  checkRate('Κύρια Σύνταξη (εργαζόμενος)', rates.mainPension.employee);
  checkRate('Υγεία (εργοδότης)', rates.health.employer);
  checkRate('Υγεία (εργαζόμενος)', rates.health.employee);
  checkRate('Επικουρική (εργοδότης)', rates.supplementary.employer);
  checkRate('Επικουρική (εργαζόμενος)', rates.supplementary.employee);
  checkRate('Ανεργία (εργοδότης)', rates.unemployment.employer);
  checkRate('Ανεργία (εργαζόμενος)', rates.unemployment.employee);
  checkRate('ΙΕΚ (εργοδότης)', rates.iek.employer);
  checkRate('ΙΕΚ (εργαζόμενος)', rates.iek.employee);
  checkRate('Εφάπαξ (εργαζόμενος)', rates.oncePayment.employee);

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// SERVICE
// ============================================================================

/** Returns the Firestore document reference for labor_compliance settings */
function getDocRef() {
  return doc(db, COLLECTIONS.SETTINGS, SYSTEM_DOCS.LABOR_COMPLIANCE_SETTINGS);
}

export const LaborComplianceService = {
  // --------------------------------------------------------------------------
  // READ
  // --------------------------------------------------------------------------

  /**
   * Read the full document from Firestore. Returns null if not yet created.
   */
  async getFullDocument(): Promise<LaborComplianceDocument | null> {
    try {
      const snapshot = await getDoc(getDocRef());
      if (!snapshot.exists()) return null;
      return snapshot.data() as LaborComplianceDocument;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to read labor compliance document', { error: msg });
      throw err;
    }
  },

  /**
   * Read config (insuranceClasses + contributionRates + lastUpdated).
   * Falls back to defaults if no Firestore document.
   */
  async getConfig(): Promise<LaborComplianceConfig> {
    const fullDoc = await this.getFullDocument();
    if (!fullDoc) return DEFAULT_LABOR_COMPLIANCE_CONFIG;
    return {
      insuranceClasses: fullDoc.insuranceClasses,
      contributionRates: fullDoc.contributionRates,
      lastUpdated: fullDoc.lastUpdated,
    };
  },

  // --------------------------------------------------------------------------
  // WRITE
  // --------------------------------------------------------------------------

  /**
   * Save the full configuration to Firestore.
   * Validates before writing — throws if invalid.
   */
  async saveConfig(
    classes: InsuranceClass[],
    rates: ContributionRates,
    metadata: {
      year: number;
      userId: string;
      sourceCircular: string | null;
      effectiveDate: string;
    }
  ): Promise<void> {
    // Validate
    const classValidation = validateInsuranceClasses(classes);
    if (!classValidation.valid) {
      throw new Error(`Validation failed (classes): ${classValidation.errors.join('; ')}`);
    }
    const rateValidation = validateContributionRates(rates);
    if (!rateValidation.valid) {
      throw new Error(`Validation failed (rates): ${rateValidation.errors.join('; ')}`);
    }

    const document: LaborComplianceDocument = {
      activeYear: metadata.year,
      insuranceClasses: classes,
      contributionRates: rates,
      lastUpdated: new Date().toISOString(),
      updatedBy: metadata.userId,
      sourceCircular: metadata.sourceCircular ?? null,
      effectiveDate: metadata.effectiveDate,
    };

    await setDoc(getDocRef(), document);
    logger.info('Labor compliance config saved', {
      year: metadata.year,
      userId: metadata.userId,
      classCount: classes.length,
    });
  },

  // --------------------------------------------------------------------------
  // SEED
  // --------------------------------------------------------------------------

  /**
   * Initialize Firestore with hardcoded defaults.
   * Only writes if document does NOT already exist.
   */
  async seedFromDefaults(userId: string): Promise<boolean> {
    const existing = await this.getFullDocument();
    if (existing) {
      logger.info('Labor compliance document already exists, skipping seed');
      return false;
    }

    await this.saveConfig(
      DEFAULT_INSURANCE_CLASSES,
      DEFAULT_CONTRIBUTION_RATES,
      {
        year: 2025,
        userId,
        sourceCircular: 'ΕΦΚΑ Εγκύκλιος 39/2024',
        effectiveDate: '2025-01-01',
      }
    );
    logger.info('Labor compliance seeded from defaults', { userId });
    return true;
  },

  // --------------------------------------------------------------------------
  // VALIDATION (exposed for UI real-time validation)
  // --------------------------------------------------------------------------

  validateInsuranceClasses,
  validateContributionRates,
} as const;
