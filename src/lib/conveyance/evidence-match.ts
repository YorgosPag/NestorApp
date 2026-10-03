/**
 * =============================================================================
 * Conveyance — αντιστοίχιση γραμμής καταλόγου ↔ αρχείων (ADR-901 §2 Ε-Β)
 * =============================================================================
 *
 * 🔴 Το `FileRecord.entryPointId` **δεν γράφεται ποτέ** (μετρημένο 2026-10-02). Ό,τι
 *    αποθηκεύεται σε κάθε αρχείο είναι `(entityType, entityId, purpose)`. Άρα η γραμμή
 *    καταλόγου αντιστοιχίζεται μέσω του **entry point** (`findEntryPoint`) στο ζεύγος
 *    `(entityType, purpose)` — ποτέ με ασαφή αναζήτηση ονόματος (το παλιό `searchTerms`
 *    του AI KB).
 *
 * ⚠️ Το `purpose: 'permit'` το μοιράζονται `unit-permit` (property) και `building-permit`
 *    (project): χωρίς το επίπεδο οντότητας η αντιστοίχιση θα ήταν λάθος.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, ασφαλές σε server/client/tests.
 *
 * @module lib/conveyance/evidence-match
 */

import type { EntityType } from '@/config/domain-constants';
import { findEntryPoint } from '@/config/upload-entry-points/queries';
import type { EvidenceLevel, EvidenceMatcher } from '@/config/conveyance-checklist/types';
import type { EvidenceFile } from '@/types/conveyance-case';

/** Σε ποιους τύπους οντότητας ζουν τα αρχεία κάθε επιπέδου. */
export const LEVEL_ENTITY_TYPES: Readonly<Record<EvidenceLevel, readonly EntityType[]>> = {
  property: ['property'],
  appurtenance: ['parking_spot', 'storage'],
  building: ['building'],
  project: ['project'],
  seller_contact: ['contact'],
  buyer_contact: ['contact'],
  // Φ4.4 — ο προσωπικός χώρος του επαγγελματία για την υπόθεση· φτάνει εδώ ΜΟΝΟ με transmittal (Α24).
  contribution: ['conveyance_case'],
};

/** Το κλειδί αντιστοίχισης `level|entityType|purpose`. */
function matchKey(level: EvidenceLevel, entityType: string, purpose: string): string {
  return `${level}|${entityType}|${purpose}`;
}

/**
 * Τα κλειδιά `(level, entityType, purpose)` που ικανοποιούν έναν matcher. Entry point που
 * δεν υπάρχει σε κανέναν τύπο του επιπέδου **δεν** δίνει κλειδί — το πιάνει η άγκυρα Α7
 * (`conveyance-checklist-catalog.test.ts`), όχι η εκτέλεση.
 */
function matcherKeys(matcher: EvidenceMatcher): readonly string[] {
  const keys: string[] = [];
  for (const entryPointId of matcher.entryPointIds) {
    for (const entityType of LEVEL_ENTITY_TYPES[matcher.level]) {
      const entryPoint = findEntryPoint(entityType, entryPointId);
      if (entryPoint) keys.push(matchKey(matcher.level, entityType, entryPoint.purpose));
    }
  }
  return keys;
}

/** Τα αρχεία που ικανοποιούν τους matchers μιας γραμμής — νεότερο πρώτο. */
export function filesForMatchers(
  matchers: readonly EvidenceMatcher[],
  evidence: readonly EvidenceFile[],
): readonly EvidenceFile[] {
  const wanted = new Set(matchers.flatMap(matcherKeys));
  return evidence
    .filter((file) => wanted.has(matchKey(file.level, file.entityType, file.purpose)))
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Αποτύπωμα έκδοσης αρχείου — αλλάζει σε νέα αναθεώρηση ή επεξεργασία. */
export function fileFingerprint(fileId: string, revision: number | null, updatedAt: string | null): string {
  return `${fileId}:${revision ?? 0}:${updatedAt ?? ''}`;
}
