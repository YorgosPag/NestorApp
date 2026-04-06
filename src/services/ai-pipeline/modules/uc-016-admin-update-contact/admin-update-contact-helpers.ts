/**
 * =============================================================================
 * UC-016: ADMIN UPDATE CONTACT — Helper Functions
 * =============================================================================
 *
 * Extracted from admin-update-contact-module.ts (ADR-065 Phase 6).
 * Field detection, value extraction, and contact name parsing.
 *
 * @module services/ai-pipeline/modules/uc-016-admin-update-contact/helpers
 */

import { extractPhoneFromText, extractEmailFromText, extractVatFromText } from '@/lib/validation/phone-validation';

// ============================================================================
// FIELD KEYWORD MAPPING
// ============================================================================

export interface FieldMapping {
  field: string;
  firestoreField: string;
  greekLabel: string;
  keywords: readonly string[];
}

export const FIELD_KEYWORDS: readonly FieldMapping[] = [
  { field: 'phone', firestoreField: 'phone', greekLabel: 'Τηλέφωνο', keywords: ['τηλεφωνο', 'τηλ', 'κινητο', 'phone', 'tel', 'mobile'] },
  { field: 'email', firestoreField: 'email', greekLabel: 'Email', keywords: ['email', 'mail', 'ηλεκτρονικο', 'μειλ'] },
  { field: 'vatNumber', firestoreField: 'vatNumber', greekLabel: 'ΑΦΜ', keywords: ['αφμ', 'afm', 'vat', 'α.φ.μ.'] },
  { field: 'profession', firestoreField: 'profession', greekLabel: 'Επάγγελμα', keywords: ['επαγγελμα', 'δουλεια', 'profession', 'εργασια'] },
  { field: 'birthDate', firestoreField: 'birthDate', greekLabel: 'Ημερομηνία γέννησης', keywords: ['γεννηση', 'ημερομηνια γεννησης', 'birthday', 'birth'] },
  { field: 'fatherName', firestoreField: 'fatherName', greekLabel: 'Πατρώνυμο', keywords: ['πατρωνυμο', 'ονομα πατερα', 'πατερας'] },
  { field: 'taxOffice', firestoreField: 'taxOffice', greekLabel: 'ΔΟΥ', keywords: ['δου', 'εφορια', 'δ.ο.υ.', 'tax office'] },
  { field: 'address', firestoreField: 'address', greekLabel: 'Διεύθυνση', keywords: ['διευθυνση', 'address', 'οδος', 'δρομος'] },
  { field: 'registrationNumber', firestoreField: 'registrationNumber', greekLabel: 'Αριθμός ΓΕΜΗ', keywords: ['γεμη', 'αριθμος μητρωου', 'registration'] },
  { field: 'legalForm', firestoreField: 'legalForm', greekLabel: 'Νομική μορφή', keywords: ['νομικη μορφη', 'legal form', 'μορφη'] },
  { field: 'employer', firestoreField: 'employer', greekLabel: 'Εργοδότης', keywords: ['εργοδοτης', 'employer'] },
  { field: 'position', firestoreField: 'position', greekLabel: 'Θέση', keywords: ['θεση', 'ρολος', 'position', 'role'] },
  { field: 'idNumber', firestoreField: 'idNumber', greekLabel: 'Αριθμός Ταυτότητας', keywords: ['ταυτοτητα', 'αδτ', 'adt', 'id number', 'αριθμο ταυτοτητας', 'αριθμος ταυτοτητας', 'δελτιο ταυτοτητας'] },
] as const;

// ============================================================================
// ACTION DETECTION
// ============================================================================

/** Action mode: add/update value, or remove/clear it */
export type UpdateAction = 'set' | 'remove';

/** Keywords that indicate a REMOVE/DELETE operation */
const REMOVE_KEYWORDS: readonly string[] = [
  'αφαίρεσε', 'αφαιρεσε', 'αφαιρέσεις', 'αφαιρεσεις',
  'σβήσε', 'σβησε', 'διέγραψε', 'διεγραψε',
  'βγάλε', 'βγαλε', 'αφαίρεση', 'αφαιρεση',
  'διαγραφή', 'διαγραφη', 'remove', 'delete', 'clear',
];

/** Detect if the message asks to REMOVE a field */
export function detectRemoveAction(message: string): boolean {
  const lower = message.toLowerCase();
  return REMOVE_KEYWORDS.some(kw => lower.includes(kw));
}

// ============================================================================
// ACCENT STRIPPING
// ============================================================================

/**
 * Strip accents from Greek text for keyword matching.
 */
function stripAccents(text: string): string {
  const map: Record<string, string> = {
    'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
    'ΐ': 'ι', 'ΰ': 'υ', 'ϊ': 'ι', 'ϋ': 'υ',
    'Ά': 'α', 'Έ': 'ε', 'Ή': 'η', 'Ί': 'ι', 'Ό': 'ο', 'Ύ': 'υ', 'Ώ': 'ω',
  };
  return text.replace(/[άέήίόύώΐΰϊϋΆΈΉΊΌΎΏ]/g, ch => map[ch] ?? ch);
}

// ============================================================================
// FIELD DETECTION
// ============================================================================

/**
 * Detect which field the admin wants to update based on keywords in the message.
 */
export function detectField(message: string): FieldMapping | null {
  const normalized = stripAccents(message.toLowerCase());

  for (const mapping of FIELD_KEYWORDS) {
    for (const keyword of mapping.keywords) {
      const normalizedKeyword = stripAccents(keyword.toLowerCase());
      if (normalized.includes(normalizedKeyword)) {
        return mapping;
      }
    }
  }

  return null;
}

// ============================================================================
// VALUE EXTRACTION
// ============================================================================

/**
 * Extract the value for a detected field from the raw message.
 * Uses centralized extraction for phone/email/VAT (ADR-212).
 */
export function extractFieldValue(message: string, fieldMapping: FieldMapping): string | null {
  const field = fieldMapping.field;

  if (field === 'phone') {
    return extractPhoneFromText(message);
  }

  if (field === 'email') {
    return extractEmailFromText(message);
  }

  if (field === 'vatNumber') {
    return extractVatFromText(message);
  }

  return extractGenericValue(message, fieldMapping.keywords);
}

/**
 * Generic value extractor: finds the value that appears after a keyword.
 *
 * Strategies:
 * 1. "keyword: value" → take everything after ':'
 * 2. "keyword Ονομα: value" → take everything after ':'
 * 3. "keyword value στον/στη Ονομα" → take text between keyword and στον/στη
 */
function extractGenericValue(message: string, keywords: readonly string[]): string | null {
  const normalized = stripAccents(message.toLowerCase());

  for (const keyword of keywords) {
    const normalizedKeyword = stripAccents(keyword.toLowerCase());
    const idx = normalized.indexOf(normalizedKeyword);
    if (idx === -1) continue;

    const afterKeyword = message.substring(idx + keyword.length).trim();

    const colonIdx = afterKeyword.indexOf(':');
    if (colonIdx !== -1) {
      const value = afterKeyword.substring(colonIdx + 1).trim();
      const cleanedValue = value
        .replace(/\s+(?:στον|στη|στο|για τον|για τη|του|της)\s+.*$/i, '')
        .trim();
      if (cleanedValue) return cleanedValue;
    }

    const cleanedAfter = afterKeyword
      .replace(/^[:\s]+/, '')
      .replace(/\s+(?:στον|στη|στο|για τον|για τη|του|της)\s+.*$/i, '')
      .replace(/[,;]+\s*$/, '')
      .trim();

    if (cleanedAfter) return cleanedAfter;
  }

  return null;
}

// ============================================================================
// CONTACT NAME EXTRACTION
// ============================================================================

/**
 * Extract the contact name from the message.
 *
 * Common patterns:
 * - "Πρόσθεσε τηλέφωνο 697... στον Νέστορα" → "Νέστορα"
 * - "Βάλε ΑΦΜ 123456789 στον Παγώνη" → "Παγώνη"
 * - "Επάγγελμα Νέστορα: Μηχανικός" → "Νέστορα"
 * - "ΑΦΜ 123456789" → null (will use session)
 */
export function extractContactName(
  message: string,
  fieldMapping: FieldMapping | null,
  value: string | null
): string | null {
  const prepositionMatch = message.match(
    /(?:στον|στη|στο|για τον|για τη|του|της)\s+(.+?)(?:\s*$|[,;.])/i
  );
  if (prepositionMatch) {
    const name = prepositionMatch[1].trim();
    if (name && name.length > 0) return name;
  }

  if (fieldMapping) {
    for (const keyword of fieldMapping.keywords) {
      const regex = new RegExp(keyword + '\\s+([\\p{L}]+(?:\\s+[\\p{L}]+)?)\\s*:', 'iu');
      const match = message.match(regex);
      if (match) {
        return match[1].trim();
      }
    }
  }

  return null;
}
