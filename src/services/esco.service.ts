/**
 * ============================================================================
 * ESCO Professional Classification Service (ADR-132)
 * ============================================================================
 *
 * Αναζήτηση και ανάκτηση επαγγελμάτων ESCO από τη μνήμη Firestore
 * (`system/esco_cache/occupations`), από τον πελάτη.
 *
 * ⚠️ **Η ΜΗΧΑΝΗ ΑΝΑΖΗΤΗΣΗΣ ΔΕΝ ΖΕΙ ΕΔΩ** *(από 2026-08-26)*. Ήταν **παράλληλο
 * δίδυμο** του `esco-skill.service.ts` — τρεις κλώνοι μετρημένοι από το
 * CHECK 3.28. Το κοινό ζει στο `@/lib/esco/token-search`· εδώ μένει το
 * λεξιλόγιο των **επαγγελμάτων** και το μόνο που τα ξεχωρίζει πραγματικά: ο
 * **κωδικός ISCO** ως δευτερεύον κλειδί αναζήτησης.
 *
 * Usage:
 * ```typescript
 * import { EscoService } from '@/services/esco.service';
 *
 * const results = await EscoService.searchOccupations({
 *   query: 'Μηχαν',
 *   language: 'el',
 *   limit: 10,
 * });
 * ```
 *
 * @module services/esco.service
 * @see src/lib/esco/token-search.ts
 * @see src/types/contacts/esco-types.ts
 */

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('EscoService');

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  EscoOccupation,
  EscoOccupationDocument,
  EscoSearchParams,
  EscoSearchResult,
  EscoSearchResponse,
  EscoLanguage,
  EscoSkillSearchParams,
  EscoSkillSearchResponse,
  EscoSkill,
} from '@/types/contacts/esco-types';
import { EscoSkillService } from './esco-skill.service';
import { searchEscoByTokens, clearEscoSearchCache } from '@/lib/esco/token-search';

// ============================================================================
// CONSTANTS
// ============================================================================

// SSoT: Collection name from centralized config
import { COLLECTIONS } from '@/config/firestore-collections';
const ESCO_COLLECTION = COLLECTIONS.ESCO_CACHE;

/** Μέγιστα αποτελέσματα ανά ερώτημα. */
const DEFAULT_SEARCH_LIMIT = 20;

/** Μέγιστα επαγγέλματα που επιστρέφει η περιήγηση σε ομάδα ISCO. */
const ISCO_GROUP_LIMIT = 100;

/** Ελάχιστο μήκος ομάδας ISCO για να έχει νόημα το ερώτημα. */
const MIN_ISCO_GROUP_LENGTH = 2;

// ============================================================================
// ESCO SERVICE
// ============================================================================

export class EscoService {
  /**
   * Firestore document → domain shape. Κεντρικοποιήθηκε (N.0.2, CHECK 3.28):
   * η ίδια χαρτογράφηση ζούσε τρεις φορές (search / getByUri / getByIscoGroup).
   */
  private static mapOccupation(data: EscoOccupationDocument): EscoOccupation {
    return {
      uri: data.uri,
      iscoCode: data.iscoCode,
      iscoGroup: data.iscoGroup,
      preferredLabel: data.preferredLabel,
      alternativeLabels: data.alternativeLabels
        ? { el: data.alternativeLabels.el ?? [], en: data.alternativeLabels.en ?? [] }
        : undefined,
      description: data.description,
    };
  }

  /** Η ετικέτα στη γλώσσα του ερωτήματος. */
  private static labelOf(occupation: EscoOccupation, language: EscoLanguage): string {
    return language === 'el' ? occupation.preferredLabel.el : occupation.preferredLabel.en;
  }

  /**
   * Αναζήτηση επαγγελμάτων ESCO με κείμενο.
   *
   * Χρησιμοποιεί `array-contains` πάνω στα προϋπολογισμένα `searchTokens*`, που
   * γράφει ο εισαγωγέας με **τον ίδιο** τοκενιστή *(`@/lib/esco/search-tokens`)*.
   *
   * 🔑 Ο **κωδικός ISCO** είναι το δευτερεύον κλειδί: όποιος πληκτρολογήσει
   * `2142` βρίσκει τον πολιτικό μηχανικό, χωρίς να ξέρει την ετικέτα.
   */
  static async searchOccupations(params: EscoSearchParams): Promise<EscoSearchResponse> {
    const { query: searchQuery, language, limit: resultLimit = DEFAULT_SEARCH_LIMIT } = params;

    const outcome = await searchEscoByTokens<EscoOccupationDocument, EscoOccupation>({
      collectionPath: ESCO_COLLECTION,
      cacheNamespace: 'occupation',
      rawQuery: searchQuery,
      language,
      limit: resultLimit,
      toItem: EscoService.mapOccupation,
      labelOf: EscoService.labelOf,
      // ⚠️ `?? ''` επειδή το πεδίο μπορεί να λείπει σε παλιό έγγραφο της μνήμης·
      // ο εισαγωγέας πλέον γράφει πάντα συμβολοσειρά (κενή = «κανένας κωδικός»).
      secondaryKeyMatches: (data, rawQuery) => (data.iscoCode ?? '').startsWith(rawQuery),
    });

    const results: EscoSearchResult[] = outcome.hits.map((hit) => ({
      occupation: hit.item,
      score: hit.score,
      matchedField: hit.matchedField === 'secondaryKey' ? 'iscoCode' : hit.matchedField,
    }));

    return { results, total: outcome.total, query: searchQuery, language };
  }

  /**
   * Ένα επάγγελμα ESCO από το URI του.
   */
  static async getOccupationByUri(uri: string): Promise<EscoOccupation | null> {
    if (!uri) return null;

    try {
      const match = uri.match(/\/([a-f0-9-]+)$/i);
      if (!match) return null;

      const docSnap = await getDoc(doc(db, ESCO_COLLECTION, match[1]));
      if (!docSnap.exists()) return null;

      return EscoService.mapOccupation(docSnap.data() as EscoOccupationDocument);
    } catch (error) {
      logger.error('Get by URI error', { error });
      return null;
    }
  }

  /**
   * Όλα τα επαγγέλματα μιας **ελάσσονος ομάδας** ISCO-08 *(3 ψηφία)*.
   *
   * ⚠️ Το `iscoGroup` το γράφει ο εισαγωγέας με το `iscoMinorGroupOf` — η ίδια
   * ανάλυση και στα δύο άκρα *(βλ. `ISCO_MINOR_GROUP_LENGTH`)*.
   */
  static async getOccupationsByIscoGroup(
    iscoGroup: string,
    language: EscoLanguage = 'el',
  ): Promise<EscoOccupation[]> {
    if (!iscoGroup || iscoGroup.length < MIN_ISCO_GROUP_LENGTH) return [];

    try {
      const snapshot = await getDocs(
        query(
          // companyId: N/A — public ESCO taxonomy (system/esco_cache/occupations),
          // shared across all tenants
          collection(db, ESCO_COLLECTION),
          where('iscoGroup', '==', iscoGroup),
          orderBy(`preferredLabel.${language}`),
          firestoreLimit(ISCO_GROUP_LIMIT),
        ),
      );

      return snapshot.docs.map((docSnap) =>
        EscoService.mapOccupation(docSnap.data() as EscoOccupationDocument),
      );
    } catch (error) {
      logger.error('Get by ISCO group error', { error });
      return [];
    }
  }

  // ========================================================================
  // ESCO SKILLS — Delegated to EscoSkillService (ADR-132, ADR-065 Phase 6)
  // ========================================================================

  /** @see EscoSkillService.searchSkills */
  static searchSkills(params: EscoSkillSearchParams): Promise<EscoSkillSearchResponse> {
    return EscoSkillService.searchSkills(params);
  }

  /** @see EscoSkillService.getSkillByUri */
  static getSkillByUri(uri: string): Promise<EscoSkill | null> {
    return EscoSkillService.getSkillByUri(uri);
  }

  /**
   * Καθαρίζει τη μνήμη αναζήτησης (επαγγέλματα **και** δεξιότητες).
   *
   * ⚠️ Είναι **μία** μνήμη πλέον, με namespace ανά λεξιλόγιο.
   */
  static clearCache(): void {
    clearEscoSearchCache();
  }
}
