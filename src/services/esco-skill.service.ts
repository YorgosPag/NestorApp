/**
 * ============================================================================
 * ESCO Skill Search Service (ADR-132)
 * ============================================================================
 *
 * Αναζήτηση δεξιοτήτων ESCO από τη μνήμη Firestore, από τον πελάτη.
 *
 * ⚠️ **Η ΜΗΧΑΝΗ ΔΕΝ ΖΕΙ ΕΔΩ.** Μέχρι τις 2026-08-26 αυτό το αρχείο ήταν
 * **παράλληλο δίδυμο** του `esco.service.ts`: το CHECK 3.28 μέτρησε **τρεις**
 * κλώνους *(65 · 89 · 77 tokens)* — ερώτημα, φιλτράρισμα, βαθμολόγηση,
 * ταξινόμηση, LRU. Ό,τι πραγματικά διέφερε ήταν **η συλλογή και ο τύπος**.
 * Πλέον το κοινό ζει στο `@/lib/esco/token-search` και εδώ μένει **μόνο** το
 * λεξιλόγιο των δεξιοτήτων. ⛔ Μην ξαναγράψεις εδώ ερώτημα Firestore.
 *
 * @module services/esco-skill.service
 * @see src/lib/esco/token-search.ts
 * @see src/types/contacts/esco-types.ts
 */

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('EscoSkillService');

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  EscoSkill,
  EscoSkillDocument,
  EscoSkillSearchParams,
  EscoSkillSearchResult,
  EscoSkillSearchResponse,
  EscoLanguage,
} from '@/types/contacts/esco-types';

// SSoT: Collection name from centralized config
import { COLLECTIONS } from '@/config/firestore-collections';
import { searchEscoByTokens, clearEscoSearchCache } from '@/lib/esco/token-search';

const ESCO_SKILLS_COLLECTION = COLLECTIONS.ESCO_SKILLS_CACHE;

/** Μέγιστα αποτελέσματα ανά ερώτημα. */
const DEFAULT_SEARCH_LIMIT = 20;

// ============================================================================
// ESCO SKILL SERVICE
// ============================================================================

export class EscoSkillService {
  /**
   * Firestore document → domain shape.
   *
   * Κεντρικοποιήθηκε (N.0.2): η ίδια χαρτογράφηση ζούσε **δύο** φορές
   * *(αναζήτηση / ανάκτηση με URI)*.
   */
  private static mapSkill(data: EscoSkillDocument): EscoSkill {
    return {
      uri: data.uri,
      preferredLabel: data.preferredLabel,
      alternativeLabels: data.alternativeLabels
        ? { el: data.alternativeLabels.el ?? [], en: data.alternativeLabels.en ?? [] }
        : undefined,
    };
  }

  /** Η ετικέτα στη γλώσσα του ερωτήματος. */
  private static labelOf(skill: EscoSkill, language: EscoLanguage): string {
    return language === 'el' ? skill.preferredLabel.el : skill.preferredLabel.en;
  }

  /**
   * Αναζήτηση δεξιοτήτων ESCO με κείμενο.
   *
   * ⚠️ Οι δεξιότητες **δεν έχουν** κωδικό ISCO *(είναι δια-επαγγελματικές)*,
   * γι' αυτό δεν δίνεται `secondaryKeyMatches` — και το αντίστοιχο σκαλοπάτι
   * της κλίμακας απλώς δεν παίζει.
   */
  static async searchSkills(params: EscoSkillSearchParams): Promise<EscoSkillSearchResponse> {
    const { query: searchQuery, language, limit: resultLimit = DEFAULT_SEARCH_LIMIT } = params;

    const outcome = await searchEscoByTokens<EscoSkillDocument, EscoSkill>({
      collectionPath: ESCO_SKILLS_COLLECTION,
      cacheNamespace: 'skill',
      rawQuery: searchQuery,
      language,
      limit: resultLimit,
      toItem: EscoSkillService.mapSkill,
      labelOf: EscoSkillService.labelOf,
    });

    const results: EscoSkillSearchResult[] = outcome.hits.map((hit) => ({
      skill: hit.item,
      score: hit.score,
      matchedField: hit.matchedField === 'alternativeLabel' ? 'alternativeLabel' : 'preferredLabel',
    }));

    return { results, total: outcome.total, query: searchQuery, language };
  }

  /**
   * Μία δεξιότητα από το URI της.
   */
  static async getSkillByUri(uri: string): Promise<EscoSkill | null> {
    if (!uri) return null;

    try {
      const match = uri.match(/\/([a-f0-9-]+)$/i);
      if (!match) return null;

      const docSnap = await getDoc(doc(db, ESCO_SKILLS_COLLECTION, match[1]));
      if (!docSnap.exists()) return null;

      return EscoSkillService.mapSkill(docSnap.data() as EscoSkillDocument);
    } catch (error) {
      logger.error('Get skill by URI error', { error });
      return null;
    }
  }

  /**
   * Καθαρίζει τη μνήμη αναζήτησης.
   *
   * ⚠️ Η μνήμη είναι πλέον **κοινή** για επαγγέλματα και δεξιότητες *(με
   * διακριτό namespace)*, οπότε αυτό καθαρίζει και τις δύο. Διατηρείται ως
   * μέθοδος επειδή το `EscoService.clearCache()` τη ζητά.
   */
  static clearCache(): void {
    clearEscoSearchCache();
  }
}
