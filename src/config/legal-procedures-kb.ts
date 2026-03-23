/**
 * =============================================================================
 * LEGAL PROCEDURES KNOWLEDGE BASE — SSoT for AI Pipeline
 * =============================================================================
 *
 * Static knowledge base of real estate procedures and required documents.
 * Used by the AI agent to answer buyer questions like:
 * "Τι χρειάζομαι για τον συμβολαιογράφο;"
 *
 * Each procedure includes:
 * - keywords for AI matching
 * - required documents with source attribution
 * - storageKey for cross-referencing with files collection
 *
 * @module config/legal-procedures-kb
 * @see SPEC-257G (Knowledge Base — Procedures & Documents)
 * @see ADR-257 (Customer AI Access Control)
 */

// ============================================================================
// TYPES
// ============================================================================

/** Source of a required document */
export type DocumentSource =
  | 'system'          // Available in our system (files collection)
  | 'buyer'           // Buyer must provide
  | 'seller'          // Seller/developer provides
  | 'engineer'        // Engineer/architect provides
  | 'bank'            // Bank provides
  | 'municipality'    // Municipality/government provides
  | 'cadastral_office'; // Κτηματολόγιο

/** A required document within a procedure */
export interface RequiredDocument {
  /** Human-readable name in Greek */
  name: string;
  /** Who provides this document */
  source: DocumentSource;
  /**
   * Search terms to match against files collection (purpose, category, displayName).
   * Used for availability check: if ANY term matches, the document is considered available.
   * Empty array = document NOT in our system (source !== 'system').
   *
   * Values are matched case-insensitively against: file.purpose, file.category, file.displayName
   */
  searchTerms: readonly string[];
}

/** Procedure category */
export const PROCEDURE_CATEGORIES = ['sale', 'finance', 'transfer'] as const;
export type ProcedureCategory = typeof PROCEDURE_CATEGORIES[number];

/** A legal/real estate procedure */
export interface LegalProcedure {
  /** Unique identifier */
  id: string;
  /** Greek title */
  title: string;
  /** Procedure category */
  category: ProcedureCategory;
  /** Search keywords (lowercase Greek) for AI matching */
  keywords: readonly string[];
  /** Required documents */
  requiredDocuments: readonly RequiredDocument[];
  /** Short description */
  description: string;
}

// ============================================================================
// SOURCE LABELS — SSoT for display in AI responses
// ============================================================================

/** Human-readable labels for document sources (Greek) */
export const DOCUMENT_SOURCE_LABELS: Readonly<Record<DocumentSource, string>> = {
  system: 'Διαθέσιμο στο σύστημα',
  buyer: 'Από εσάς (αγοραστής)',
  seller: 'Από τον πωλητή/κατασκευαστή',
  engineer: 'Από τον μηχανικό',
  bank: 'Από την τράπεζα',
  municipality: 'Από τον δήμο',
  cadastral_office: 'Από το κτηματολόγιο',
};

// ============================================================================
// KNOWLEDGE BASE — 4 Core Procedures
// ============================================================================

export const LEGAL_PROCEDURES: readonly LegalProcedure[] = [

  // ── 1. Οριστικό Συμβόλαιο (Final Contract) ──
  {
    id: 'final_contract',
    title: 'Οριστικό Συμβόλαιο Αγοραπωλησίας',
    category: 'sale',
    keywords: [
      'συμβόλαιο', 'συμβολαιογράφος', 'συμβολαιογράφο', 'αγοραπωλησία',
      'οριστικό', 'αγορά', 'υπογραφή', 'μεταβίβαση κυριότητας',
    ],
    requiredDocuments: [
      { name: 'Τοπογραφικό διάγραμμα', source: 'system', searchTerms: ['topographic', 'study-topographic', 'τοπογραφικ'] },
      { name: 'Οικοδομική άδεια', source: 'system', searchTerms: ['permit', 'οικοδομικ', 'άδεια'] },
      { name: 'Βεβαίωση μηχανικού (Ν.4495/2017)', source: 'engineer', searchTerms: [] },
      { name: 'Πιστοποιητικό Ενεργειακής Απόδοσης (ΠΕΑ)', source: 'system', searchTerms: ['energy', 'study-energy-cert', 'ενεργειακ', 'πεα'] },
      { name: 'Φορολογική ενημερότητα', source: 'buyer', searchTerms: [] },
      { name: 'Κτηματολογικό φύλλο', source: 'system', searchTerms: ['cadastral', 'study-cadastre', 'κτηματολογ'] },
      { name: 'Βεβαίωση ΕΝΦΙΑ', source: 'seller', searchTerms: [] },
      { name: 'Πιστοποιητικό μη οφειλής ΤΑΠ', source: 'municipality', searchTerms: [] },
    ],
    description: 'Υπογράφεται ενώπιον συμβολαιογράφου. Μεταβιβάζει κυριότητα ακινήτου.',
  },

  // ── 2. Προσύμφωνο (Preliminary Contract) ──
  {
    id: 'preliminary_contract',
    title: 'Προσύμφωνο Αγοραπωλησίας',
    category: 'sale',
    keywords: [
      'προσύμφωνο', 'κράτηση', 'δέσμευση', 'αρραβώνας', 'προκαταβολή',
    ],
    requiredDocuments: [
      { name: 'Ταυτότητα / Διαβατήριο', source: 'buyer', searchTerms: [] },
      { name: 'ΑΦΜ', source: 'buyer', searchTerms: [] },
      { name: 'Εκκαθαριστικό εφορίας', source: 'buyer', searchTerms: [] },
    ],
    description: 'Δεσμευτική συμφωνία πριν το οριστικό συμβόλαιο. Συνήθως συνοδεύεται από προκαταβολή.',
  },

  // ── 3. Στεγαστικό Δάνειο (Bank Loan) ──
  {
    id: 'bank_loan',
    title: 'Αίτηση Στεγαστικού Δανείου',
    category: 'finance',
    keywords: [
      'δάνειο', 'τράπεζα', 'στεγαστικό', 'δανεισμός', 'χρηματοδότηση', 'mortgage',
    ],
    requiredDocuments: [
      { name: 'Εκκαθαριστικό εφορίας (2 τελευταία)', source: 'buyer', searchTerms: [] },
      { name: 'Βεβαίωση εργοδότη / εισοδήματος', source: 'buyer', searchTerms: [] },
      { name: 'Μισθοδοτικές καταστάσεις (6 μηνών)', source: 'buyer', searchTerms: [] },
      { name: 'Εκτίμηση ακινήτου', source: 'bank', searchTerms: [] },
      { name: 'Προσύμφωνο αγοραπωλησίας', source: 'system', searchTerms: ['προσύμφωνο', 'preliminary', 'contracts'] },
      { name: 'Τοπογραφικό', source: 'system', searchTerms: ['topographic', 'study-topographic', 'τοπογραφικ'] },
      { name: 'Οικοδομική άδεια', source: 'system', searchTerms: ['permit', 'οικοδομικ', 'άδεια'] },
    ],
    description: 'Αίτηση σε τράπεζα για στεγαστικό δάνειο. Η τράπεζα ζητά εκτίμηση ακινήτου.',
  },

  // ── 4. Μεταβίβαση μετά Εξόφληση (Property Transfer) ──
  {
    id: 'property_transfer',
    title: 'Μεταβίβαση Ακινήτου (μετά εξόφληση)',
    category: 'transfer',
    keywords: [
      'μεταβίβαση', 'εξόφληση', 'εξοφλητήριο', 'κτηματολόγιο', 'τελική μεταβίβαση',
    ],
    requiredDocuments: [
      { name: 'Εξοφλητήριο', source: 'system', searchTerms: ['εξοφλητήριο', 'payment', 'receipt'] },
      { name: 'Οριστικό συμβόλαιο', source: 'system', searchTerms: ['συμβόλαιο', 'contracts', 'final'] },
      { name: 'Πιστοποιητικό κτηματολογίου', source: 'cadastral_office', searchTerms: [] },
      { name: 'Πιστοποιητικό μη οφειλής ΤΑΠ', source: 'municipality', searchTerms: [] },
    ],
    description: 'Τελική μεταβίβαση μετά την πλήρη εξόφληση. Καταχωρείται στο κτηματολόγιο.',
  },
] as const;

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
      // Check keywords
      for (const keyword of procedure.keywords) {
        if (keyword.includes(queryWord) || queryWord.includes(keyword)) {
          matchScore += 2;
        }
      }
      // Check title
      if (procedure.title.toLowerCase().includes(queryWord)) {
        matchScore += 1;
      }
      // Check description
      if (procedure.description.toLowerCase().includes(queryWord)) {
        matchScore += 0.5;
      }
    }

    if (matchScore > 0) {
      results.push({ procedure, matchScore });
    }
  }

  // Sort by relevance (highest first)
  return results.sort((a, b) => b.matchScore - a.matchScore);
}
