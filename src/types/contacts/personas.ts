import { nowISO } from '@/lib/date-local';
import type { TradeCode } from '@/subapps/procurement/types/trade';

/**
 * ============================================================================
 * 🎭 CONTACT PERSONA SYSTEM — Role-Based Dynamic Fields
 * ============================================================================
 *
 * SAP Business Partner pattern: Κάθε φυσικό πρόσωπο μπορεί να έχει 1+
 * "Ιδιότητες/Personas". Κάθε persona ενεργοποιεί conditional sections
 * με τα αντίστοιχα πεδία μόνο.
 *
 * @see ADR-121 Contact Persona System
 * @see docs/centralized-systems/reference/adrs/ADR-121-contact-persona-system.md
 */

// ============================================================================
// PERSONA TYPE DEFINITIONS
// ============================================================================

/**
 * Available persona types for individual contacts.
 * Each persona activates a conditional section with role-specific fields.
 */
export type PersonaType =
  | 'construction_worker'    // Εργάτης Οικοδομής (ΕΦΚΑ/ΙΚΑ πεδία)
  | 'engineer'               // Μηχανικός (ΤΕΕ μητρώο, ειδικότητα)
  | 'accountant'             // Λογιστής (ΟΕΕ αριθμός)
  | 'lawyer'                 // Δικηγόρος (ΔΣ μητρώο)
  | 'property_owner'         // Ιδιοκτήτης Ακινήτων
  | 'client'                 // Πελάτης/Αγοραστής
  | 'supplier'               // Προμηθευτής
  | 'notary'                 // Συμβολαιογράφος
  | 'real_estate_agent';     // Μεσίτης

/** Persona lifecycle status */
export type PersonaStatus = 'active' | 'inactive';

/**
 * All available persona types as a constant array.
 * Used by PersonaSelector component for rendering.
 */
export const ALL_PERSONA_TYPES: readonly PersonaType[] = [
  'construction_worker',
  'engineer',
  'accountant',
  'lawyer',
  'property_owner',
  'client',
  'supplier',
  'notary',
  'real_estate_agent',
] as const;

// ============================================================================
// ENGINEER SPECIALTY TYPES
// ============================================================================

/** ΤΕΕ-recognized engineering specialties */
export type EngineerSpecialty =
  | 'civil'                  // Πολιτικός Μηχανικός
  | 'architect'              // Αρχιτέκτονας Μηχανικός
  | 'mechanical'             // Μηχανολόγος Μηχανικός
  | 'electrical'             // Ηλεκτρολόγος Μηχανικός
  | 'surveyor'               // Τοπογράφος Μηχανικός
  | 'chemical'               // Χημικός Μηχανικός
  | 'mining';                // Μεταλλειολόγος Μηχανικός

/** ΤΕΕ license classes */
export type EngineerLicenseClass = 'A' | 'B' | 'C' | 'D';

// ============================================================================
// CLIENT CATEGORIES
// ============================================================================

/** Client category for business classification */
export type ClientCategory =
  | 'residential'            // Κατοικία
  | 'commercial'             // Εμπορικό
  | 'industrial'             // Βιομηχανικό
  | 'public_sector'          // Δημόσιος τομέας
  | 'other';                 // Άλλο

/** Preferred contact method */
export type PreferredContactMethod =
  | 'phone'
  | 'email'
  | 'in_person'
  | 'messaging';

// ============================================================================
// SUPPLIER CATEGORIES
// ============================================================================

/** Supplier category for construction industry */
export type SupplierCategory =
  | 'materials'              // Υλικά κατασκευής
  | 'equipment'              // Εξοπλισμός
  | 'subcontractor'          // Υπεργολάβος
  | 'services'               // Υπηρεσίες
  | 'other';                 // Άλλο

// ============================================================================
// BASE PERSONA DATA
// ============================================================================

/** Common fields shared by all persona types */
interface BasePersonaData {
  personaType: PersonaType;
  status: PersonaStatus;
  activatedAt: string;           // ISO date string
  deactivatedAt: string | null;
  notes: string | null;
}

// ============================================================================
// PER-PERSONA INTERFACES (Discriminated Union Members)
// ============================================================================

/**
 * Εργάτης Οικοδομής — ΕΦΚΑ/ΙΚΑ fields
 * Connects with IKA Labor Compliance System (ADR-090)
 */
export interface ConstructionWorkerPersona extends BasePersonaData {
  personaType: 'construction_worker';
  /** ΑΜ ΙΚΑ — Αριθμός Μητρώου ΙΚΑ */
  ikaNumber: string | null;
  /** Ασφαλιστική κλάση (1-28) — KPK 781 */
  insuranceClassId: number | null;
  /** Τριετίες εργασίας */
  triennia: number | null;
  /** Ημερομίσθιο (€) */
  dailyWage: number | null;
  /** Κωδικός ειδικότητας ΕΦΚΑ */
  specialtyCode: string | null;
  /** Ημερομηνία εγγραφής ΕΦΚΑ */
  efkaRegistrationDate: string | null;
}

/**
 * Μηχανικός — ΤΕΕ registry fields
 */
export interface EngineerPersona extends BasePersonaData {
  personaType: 'engineer';
  /** Αριθμός Μητρώου ΤΕΕ */
  teeRegistryNumber: string | null;
  /** Ειδικότητα μηχανικού */
  engineerSpecialty: EngineerSpecialty | null;
  /** Τάξη πτυχίου (A, B, C, D) */
  licenseClass: EngineerLicenseClass | null;
  /** Αριθμός ΠΤΔΕ (Πανελλήνια Τράπεζα Δεδομένων Εργοληπτών) */
  ptdeNumber: string | null;
}

/**
 * Λογιστής — ΟΕΕ fields
 */
export interface AccountantPersona extends BasePersonaData {
  personaType: 'accountant';
  /** Αριθμός μητρώου ΟΕΕ (Οικονομικό Επιμελητήριο Ελλάδος) */
  oeeNumber: string | null;
  /** Τάξη λογιστή (Α, Β, Γ, Δ) */
  accountingClass: string | null;
}

/**
 * Δικηγόρος — Δικηγορικός Σύλλογος fields
 */
export interface LawyerPersona extends BasePersonaData {
  personaType: 'lawyer';
  /** Αριθμός μητρώου Δικηγορικού Συλλόγου */
  barAssociationNumber: string | null;
  /** Δικηγορικός Σύλλογος (π.χ. ΔΣΑ, ΔΣΘ) */
  barAssociation: string | null;
}

/**
 * Ιδιοκτήτης Ακινήτων
 * Ενεργοποιεί σύνδεση ακινήτων/κτιρίων
 */
export interface PropertyOwnerPersona extends BasePersonaData {
  personaType: 'property_owner';
  /** Αριθμός ιδιοκτησιών */
  propertyCount: number | null;
  /** Σημειώσεις ιδιοκτησίας */
  ownershipNotes: string | null;
}

/**
 * Πελάτης/Αγοραστής
 */
export interface ClientPersona extends BasePersonaData {
  personaType: 'client';
  /** Ημερομηνία εγγραφής ως πελάτης */
  clientSince: string | null;
}

/**
 * Προμηθευτής
 */
export interface SupplierPersona extends BasePersonaData {
  personaType: 'supplier';
  /** Κατηγορία προμηθευτή */
  supplierCategory: SupplierCategory | null;
  /** Όροι πληρωμής (ημέρες) */
  paymentTermsDays: number | null;
  /** Ειδικότητες trades — ADR-327 §9.3. Backward-compatible: legacy supplierCategory παραμένει */
  tradeSpecialties: TradeCode[];
}

/**
 * Συμβολαιογράφος
 */
export interface NotaryPersona extends BasePersonaData {
  personaType: 'notary';
  /** Αριθμός μητρώου Συμβολαιογραφικού Συλλόγου */
  notaryRegistryNumber: string | null;
  /** Περιφέρεια Συμβολαιογραφικού Συλλόγου */
  notaryDistrict: string | null;
}

/**
 * Μεσίτης Ακινήτων
 */
export interface RealEstateAgentPersona extends BasePersonaData {
  personaType: 'real_estate_agent';
  /** Αριθμός αδείας μεσίτη (ΓΕ.ΜΗ.) */
  licenseNumber: string | null;
  /** Μεσιτικό γραφείο */
  agency: string | null;
}

// ============================================================================
// DISCRIMINATED UNION
// ============================================================================

/**
 * Union of all persona data types.
 * Discriminated by `personaType` field.
 */
export type PersonaData =
  | ConstructionWorkerPersona
  | EngineerPersona
  | AccountantPersona
  | LawyerPersona
  | PropertyOwnerPersona
  | ClientPersona
  | SupplierPersona
  | NotaryPersona
  | RealEstateAgentPersona;

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isConstructionWorkerPersona(
  persona: PersonaData
): persona is ConstructionWorkerPersona {
  return persona.personaType === 'construction_worker';
}

export function isEngineerPersona(
  persona: PersonaData
): persona is EngineerPersona {
  return persona.personaType === 'engineer';
}

export function isAccountantPersona(
  persona: PersonaData
): persona is AccountantPersona {
  return persona.personaType === 'accountant';
}

export function isLawyerPersona(
  persona: PersonaData
): persona is LawyerPersona {
  return persona.personaType === 'lawyer';
}

export function isPropertyOwnerPersona(
  persona: PersonaData
): persona is PropertyOwnerPersona {
  return persona.personaType === 'property_owner';
}

export function isClientPersona(
  persona: PersonaData
): persona is ClientPersona {
  return persona.personaType === 'client';
}

export function isSupplierPersona(
  persona: PersonaData
): persona is SupplierPersona {
  return persona.personaType === 'supplier';
}

export function isNotaryPersona(
  persona: PersonaData
): persona is NotaryPersona {
  return persona.personaType === 'notary';
}

export function isRealEstateAgentPersona(
  persona: PersonaData
): persona is RealEstateAgentPersona {
  return persona.personaType === 'real_estate_agent';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Find active persona of a specific type from personas array.
 */
export function findActivePersona<T extends PersonaData>(
  personas: PersonaData[] | undefined,
  personaType: T['personaType']
): T | undefined {
  return personas?.find(
    (p): p is T => p.personaType === personaType && p.status === 'active'
  );
}

/**
 * Get all active persona types from a personas array.
 */
export function getActivePersonaTypes(
  personas: PersonaData[] | undefined
): PersonaType[] {
  return (personas ?? [])
    .filter(p => p.status === 'active')
    .map(p => p.personaType);
}

/**
 * Create a default persona data object for a given type.
 * All fields start as null for progressive data entry.
 */
export function createDefaultPersonaData(personaType: PersonaType): PersonaData {
  const base: BasePersonaData = {
    personaType,
    status: 'active',
    activatedAt: nowISO(),
    deactivatedAt: null,
    notes: null,
  };

  switch (personaType) {
    case 'construction_worker':
      return {
        ...base,
        personaType: 'construction_worker',
        ikaNumber: null,
        insuranceClassId: null,
        triennia: null,
        dailyWage: null,
        specialtyCode: null,
        efkaRegistrationDate: null,
      };
    case 'engineer':
      return {
        ...base,
        personaType: 'engineer',
        teeRegistryNumber: null,
        engineerSpecialty: null,
        licenseClass: null,
        ptdeNumber: null,
      };
    case 'accountant':
      return {
        ...base,
        personaType: 'accountant',
        oeeNumber: null,
        accountingClass: null,
      };
    case 'lawyer':
      return {
        ...base,
        personaType: 'lawyer',
        barAssociationNumber: null,
        barAssociation: null,
      };
    case 'property_owner':
      return {
        ...base,
        personaType: 'property_owner',
        propertyCount: null,
        ownershipNotes: null,
      };
    case 'client':
      return {
        ...base,
        personaType: 'client',
        clientSince: null,
      };
    case 'supplier':
      return {
        ...base,
        personaType: 'supplier',
        supplierCategory: null,
        paymentTermsDays: null,
      };
    case 'notary':
      return {
        ...base,
        personaType: 'notary',
        notaryRegistryNumber: null,
        notaryDistrict: null,
      };
    case 'real_estate_agent':
      return {
        ...base,
        personaType: 'real_estate_agent',
        licenseNumber: null,
        agency: null,
      };
  }
}
