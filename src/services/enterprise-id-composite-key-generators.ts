/**
 * ENTERPRISE ID — ΣΥΝΘΕΤΑ ΚΛΕΙΔΙΑ + ΚΑΘΑΡΟΙ ΑΝΑΓΝΩΣΤΕΣ
 *
 * Extracted from `enterprise-id-class.ts` when that file crossed the N.7.1 500-line
 * ceiling (2026-09-02) — a **split, not a trim**, the same move that already produced
 * `enterprise-id-bim-generators.ts` and `enterprise-id-public-registry-generators.ts`.
 *
 * Composition model — abstract base chain, not a mixin:
 *
 *   BimEntityIdGenerators        (ADR-363 drawing entities)
 *     ↑ extends
 *   PublicRegistryIdGenerators   (ADR-777 level Α + offers)
 *     ↑ extends
 *   CompositeKeyIdGenerators     (this file)
 *     ↑ extends
 *   EnterpriseIdService          (owns the engine: retry loop, cache, stats)
 *
 * 🔑 **Γιατί ΑΥΤΑ τα δύο και όχι όποιες 50 γραμμές έφταναν στο όριο**: όλα όσα ζουν εδώ
 * είναι **χωρίς κατάσταση**. Οι σύνθετοι κατασκευαστές κλειδιών ζουν στο
 * `./enterprise-id-composite-keys` και οι αναγνώστες στο `./enterprise-id-parse`· αυτή η
 * κλάση είναι **μόνο η δημόσια επιφάνεια** πάνω τους. Η μηχανή *(βρόχος επανάληψης,
 * λανθάνουσα μνήμη, στατιστικά)* μένει ακέραιη στην `EnterpriseIdService` — δηλαδή το
 * κόψιμο πέρασε από **σύνορο που ήδη υπήρχε**, όχι από τη μέση μιας ευθύνης.
 *
 * @module services/enterprise-id-composite-key-generators
 * @version 1.0.0
 */

import type { EnterpriseId } from './enterprise-id-prefixes';
import {
  aiUsageDocKey,
  chatHistoryDocKey,
  ownershipRevisionKey,
  ownershipTableKey,
  queryStrategyDocKey,
  userPreferencesKey,
  vendorLogoFileKey,
} from './enterprise-id-composite-keys';
import {
  enterpriseIdType,
  isValidEnterpriseId,
  parseEnterpriseId,
} from './enterprise-id-parse';
import { PublicRegistryIdGenerators } from './enterprise-id-public-registry-generators';

export abstract class CompositeKeyIdGenerators extends PublicRegistryIdGenerators {
  // --- Deterministic Composite Key Generators ---
  // Public surface only; the pure builders live in `./enterprise-id-composite-keys`
  // (N.7.1 — καμία κατάσταση εδώ: ο βρόχος επανάληψης, η μνήμη και τα στατιστικά
  // μένουν στην `EnterpriseIdService`, που είναι και ο μόνος κάτοχός τους).

  generateAiUsageDocId(channel: string, userId: string, month: string): string {
    return aiUsageDocKey(channel, userId, month);
  }

  generateQueryStrategyDocId(collection: string, failedFilters: string[]): string {
    return queryStrategyDocKey(collection, failedFilters);
  }

  generateChatHistoryDocId(channel: string, senderId: string): string {
    return chatHistoryDocKey(channel, senderId);
  }

  generateOwnershipTableId(projectId: string): string {
    return ownershipTableKey(projectId);
  }

  generateUserPreferencesId(userId: string, companyId: string): string {
    return userPreferencesKey(userId, companyId);
  }

  generateOwnershipRevisionId(version: number): string {
    return ownershipRevisionKey(version);
  }

  generateVendorLogoFileId(quoteId: string): string {
    return vendorLogoFileKey(quoteId);
  }

  // --- Utility Methods (pure readers) ---

  // Pure readers live in `./enterprise-id-parse` — no instance state involved.

  parseId(enterpriseId: string): Partial<EnterpriseId> | null {
    return parseEnterpriseId(enterpriseId);
  }

  validateId(id: string): boolean {
    return isValidEnterpriseId(id);
  }

  getIdType(id: string): string | null {
    return enterpriseIdType(id);
  }

  isLegacyId(id: string): boolean {
    return !isValidEnterpriseId(id);
  }
}
