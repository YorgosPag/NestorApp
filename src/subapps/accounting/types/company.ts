/**
 * @fileoverview Accounting Subapp — Company Profile Types
 * @description Τύποι για το προφίλ επιχείρησης και ρύθμιση λογιστικού (M-001 Company Setup)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-000 §2 Company Data
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { InvoiceSeries } from './invoice';
import type { EntityType, Partner } from './entity';

// ============================================================================
// ΚΑΔ — Κωδικοί Αριθμοί Δραστηριότητας
// ============================================================================

/** Εγγραφή ΚΑΔ (Κωδικός Αριθμός Δραστηριότητας) */
export interface KadEntry {
  /** Κωδικός ΚΑΔ (π.χ. "71112000") */
  code: string;
  /** Περιγραφή δραστηριότητας (π.χ. "Υπηρεσίες αρχιτεκτόνων για κτίρια") */
  description: string;
  /** Τύπος: κύρια ή δευτερεύουσα */
  type: 'primary' | 'secondary';
  /** Ημερομηνία έναρξης (ISO 8601) */
  activeFrom: string;
}

// ============================================================================
// COMPANY PROFILE BASE — Κοινά πεδία για όλες τις μορφές
// ============================================================================

/**
 * Κοινά πεδία προφίλ επιχείρησης
 *
 * Firestore path: `accounting_settings/company_profile`
 * Χρησιμοποιείται ως βάση για discriminated union.
 */
interface CompanyProfileBase {
  // ── Βασικά Στοιχεία ─────────────────────────────────────────────────────
  /** Νομική μορφή επιχείρησης */
  entityType: EntityType;
  /** Επωνυμία επιχείρησης */
  businessName: string;
  /** Επάγγελμα (π.χ. "Αρχιτέκτονας Μηχανικός") */
  profession: string;
  /** ΑΦΜ (9 ψηφία) */
  vatNumber: string;
  /** ΔΟΥ */
  taxOffice: string;

  // ── Διεύθυνση ───────────────────────────────────────────────────────────
  /** Οδός & αριθμός */
  address: string;
  /** Πόλη */
  city: string;
  /** Ταχυδρομικός κώδικας */
  postalCode: string;

  // ── Επικοινωνία ─────────────────────────────────────────────────────────
  /** Τηλέφωνο */
  phone: string | null;
  /** Email */
  email: string | null;
  /** Website */
  website: string | null;

  // ── ΚΑΔ ─────────────────────────────────────────────────────────────────
  /** Κύρια δραστηριότητα */
  mainKad: KadEntry;
  /** Δευτερεύουσες δραστηριότητες */
  secondaryKads: KadEntry[];

  // ── Φορολογικά ──────────────────────────────────────────────────────────
  /** Κατηγορία βιβλίων: Β' Απλογραφικά ή Γ' Διπλογραφικά */
  bookCategory: 'simplified' | 'double_entry';
  /** Καθεστώς ΦΠΑ: Κανονικό ή Απαλλαγμένο */
  vatRegime: 'normal' | 'exempt';
  /** Μήνας λήξης φορολογικού έτους (12 = Δεκέμβριος) */
  fiscalYearEnd: number;
  /** Νόμισμα (πάντα EUR για Ελλάδα) */
  currency: 'EUR';

  // ── Σειρές Τιμολογίων ──────────────────────────────────────────────────
  /** Σειρές αρίθμησης τιμολογίων */
  invoiceSeries: InvoiceSeries[];

  // ── Metadata ────────────────────────────────────────────────────────────
  /** Ημερομηνία δημιουργίας (ISO 8601) */
  createdAt: string;
  /** Ημερομηνία τελευταίας ενημέρωσης (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// SOLE PROPRIETOR — Ατομική Επιχείρηση
// ============================================================================

export interface SoleProprietorProfile extends CompanyProfileBase {
  entityType: 'sole_proprietor';
  /** Κατηγορία ασφαλιστικών εισφορών (1η–6η) */
  efkaCategory: 1 | 2 | 3 | 4 | 5 | 6;
}

// ============================================================================
// OE — Ομόρρυθμη Εταιρεία (General Partnership)
// ============================================================================

export interface OECompanyProfile extends CompanyProfileBase {
  entityType: 'oe';
  /** Αριθμός ΓΕΜΗ */
  gemiNumber: string | null;
  /** Εταίροι ΟΕ */
  partners: Partner[];
}

// ============================================================================
// DISCRIMINATED UNION — CompanyProfile
// ============================================================================

/**
 * Discriminated union: CompanyProfile
 *
 * Ατομική vs ΟΕ (extensible: +ΕΠΕ, +ΑΕ στο μέλλον).
 * Backward compatibility: docs χωρίς entityType → 'sole_proprietor' στο repository.
 */
export type CompanyProfile = SoleProprietorProfile | OECompanyProfile;

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input για δημιουργία/ενημέρωση company setup
 * Εξαιρεί auto-generated πεδία (timestamps)
 */
export type CompanySetupInput = Omit<CompanyProfile, 'createdAt' | 'updatedAt'>;
