/**
 * =============================================================================
 * LEGAL PROCEDURES KNOWLEDGE BASE — όψη του καταλόγου δικαιολογητικών (AI Pipeline)
 * =============================================================================
 *
 * Απαντά σε ερωτήσεις αγοραστή όπως «Τι χρειάζομαι για τον συμβολαιογράφο;».
 *
 * 🔁 ADR-901 §2 Ε-Α (2026-10-02): εδώ ζούσε **δεύτερος** κατάλογος εγγράφων — ονόματα
 *    σκληροκωδικοποιημένα στα ελληνικά και διαθεσιμότητα με ασαφή αναζήτηση κειμένου
 *    (`searchTerms`) σε έως 100 αρχεία της εταιρείας. Πλέον είναι **λεπτή όψη**:
 *    - οι διαδικασίες και οι γραμμές τους → `src/config/conveyance-checklist/` (ο ΕΝΑΣ κατάλογος)
 *    - τα κείμενα → `locales/el/conveyance.json` (i18n SSoT)
 *    - η διαθεσιμότητα → ο ίδιος συλλέκτης/matcher με την υπόθεση μεταβίβασης
 *      (`knowledge-base-handler.ts`)
 *
 * @module config/legal-procedures-kb
 * @see SPEC-257G (Knowledge Base — Procedures & Documents)
 * @see ADR-257 (Customer AI Access Control)
 * @see ADR-901 (υπόθεση μεταβίβασης — ο κατάλογος)
 */

import elConveyance from '@/i18n/locales/el/conveyance.json';
import { lookupLocaleString } from '@/i18n/locale-key-lookup';
import { CONVEYANCE_PROCEDURES, itemsForProcedure } from '@/config/conveyance-checklist/catalog';
import type { ChecklistItem, ChecklistProvider, ProcedureCategory } from '@/config/conveyance-checklist/types';

// ============================================================================
// TYPES
// ============================================================================

/** Ποιος παρέχει ένα έγγραφο — το λεξιλόγιο του καταλόγου. */
export type DocumentSource = ChecklistProvider;

/** Ένα απαιτούμενο έγγραφο μιας διαδικασίας (γραμμή του καταλόγου). */
interface RequiredDocument {
  readonly itemId: string;
  /** Ελληνικό όνομα — από το `conveyance.json` (ο agent απαντά στα ελληνικά). */
  readonly name: string;
  readonly source: DocumentSource;
  readonly item: ChecklistItem;
}

export interface LegalProcedure {
  readonly id: string;
  readonly title: string;
  readonly category: ProcedureCategory;
  readonly keywords: readonly string[];
  readonly requiredDocuments: readonly RequiredDocument[];
  readonly description: string;
}

// ============================================================================
// LABELS — από το i18n SSoT (καμία ελληνική λέξη σε κώδικα)
// ============================================================================

function labelOf(key: string): string {
  return lookupLocaleString(elConveyance, key) ?? key;
}

/** Ετικέτες πηγής εγγράφου για τις απαντήσεις του agent. */
export const DOCUMENT_SOURCE_LABELS: Readonly<Record<DocumentSource, string>> = elConveyance.sources;

/** «Διαθέσιμο στο σύστημα» — όταν βρέθηκε αρχείο-τεκμήριο. */
export const AVAILABLE_IN_SYSTEM_LABEL: string = elConveyance.sources.available;

// ============================================================================
// KNOWLEDGE BASE — όψη των διαδικασιών του καταλόγου
// ============================================================================

const LEGAL_PROCEDURES: readonly LegalProcedure[] = CONVEYANCE_PROCEDURES.map((procedure) => ({
  id: procedure.id,
  title: labelOf(`procedures.${procedure.id}.title`),
  description: labelOf(`procedures.${procedure.id}.description`),
  category: procedure.category,
  keywords: procedure.keywords,
  requiredDocuments: itemsForProcedure(procedure).map((item) => ({
    itemId: item.id,
    name: labelOf(item.labelKey),
    source: item.provider,
    item,
  })),
}));

// ============================================================================
// SEARCH HELPER — Keyword matching
// ============================================================================

/**
 * Search procedures by keyword(s). Returns matching procedures sorted by relevance.
 * Performs case-insensitive substring matching on the keywords array.
 *
 * @param query - Search query (may contain multiple words)
 * @returns Matching procedures with match score
 */
export function searchProcedures(
  query: string
): Array<{ procedure: LegalProcedure; matchScore: number }> {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 2);

  if (queryWords.length === 0) return [];

  const results: Array<{ procedure: LegalProcedure; matchScore: number }> = [];

  for (const procedure of LEGAL_PROCEDURES) {
    let matchScore = 0;

    for (const queryWord of queryWords) {
      for (const keyword of procedure.keywords) {
        if (keyword.includes(queryWord) || queryWord.includes(keyword)) {
          matchScore += 2;
        }
      }
      if (procedure.title.toLowerCase().includes(queryWord)) {
        matchScore += 1;
      }
      if (procedure.description.toLowerCase().includes(queryWord)) {
        matchScore += 0.5;
      }
    }

    if (matchScore > 0) {
      results.push({ procedure, matchScore });
    }
  }

  return results.sort((a, b) => b.matchScore - a.matchScore);
}
