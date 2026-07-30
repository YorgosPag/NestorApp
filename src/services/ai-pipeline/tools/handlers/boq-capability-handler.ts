/**
 * =============================================================================
 * BOQ CAPABILITY HANDLER — η γέφυρα πράκτορα → Capability Registry (ADR-734 Φ3)
 * =============================================================================
 *
 * Ο in-app πράκτορας μιλά σε `ToolHandler` (Strategy pattern του
 * `agentic-tool-executor`). Τα επτά εργαλεία επιμετρήσεων ζουν στο Capability
 * Registry (L2). Αυτός ο handler είναι το **μόνο** σημείο επαφής των δύο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΔΕΝ ΚΑΝΕΙ — ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΣΗΜΑΝΤΙΚΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Δεν ελέγχει ορίσματα, δεν επιβάλλει πολιτική, δεν αγγίζει tenant isolation,
 * δεν χτίζει φακέλους VQE. Όλα αυτά τα κάνει το `registry.invoke()`, με
 * καθορισμένη σειρά και με πιάσιμο κάθε εξαίρεσης (ADR-734 §5.2). Αν ο handler
 * «βοηθούσε» με δικούς του ελέγχους, θα υπήρχαν **δύο** σημεία επιβολής — και
 * το δεύτερο θα σάπιζε.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ ΑΠΟΤΕΛΕΣΜΑ ΔΕΝ ΠΕΡΙΚΟΠΤΕΤΑΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Οι υπόλοιποι handlers περνούν τα δεδομένα τους από `truncateResult()`. Εδώ
 * **απαγορεύεται**: μια περικομμένη λίστα επιμετρήσεων που ο πράκτορας αθροίζει
 * νομίζοντας ότι είναι πλήρης παράγει **λάθος αριθμό**, όχι λειψή εμφάνιση —
 * σφάλμα τιμής, όχι μορφής. Το όριο επιβάλλεται αλλού και σωστά: το
 * `boq_search_items` επιστρέφει `INVALID_ARGUMENT` πάνω από 200 γραμμές αντί να
 * κόψει (ADR-734 §7.2 #4). Περικοπή θα κατέστρεφε επίσης τον φάκελο VQE, που
 * οφείλει να συμμορφώνεται με το δηλωμένο `outputSchema`.
 *
 * @module services/ai-pipeline/tools/handlers/boq-capability-handler
 * @see ADR-734 §5.2 (μοναδική πύλη), §7 (τα εργαλεία), §8.3 (Φάση 3)
 */

import 'server-only';

import type { BOQCategory, BOQItem, BOQSummary } from '@/types/boq';
import type { BOQSearchFilters, BOQStats } from '@/services/measurements/contracts';
import type { IBOQReadService } from '@/services/measurements/boq-read-contract';
import { getBoqAdminReadService } from '@/services/measurements/admin/boq-admin-read-service';
import {
  type CapabilityContext,
  type CapabilityRegistry,
} from '@/services/agent-capability/registry';
import { createBoqCapabilityRegistry } from '@/services/agent-capability/capabilities/boq';
import { toOpenAiToolDefinitions } from '@/services/agent-capability/adapters';
import type { AgenticToolDefinition } from '../agentic-tool-definitions';
import type { AgenticContext, ToolHandler, ToolResult } from '../executor-shared';
import { logger } from '../executor-shared';

/**
 * Τεμπέλης προώθηση προς το admin service.
 *
 * ⚠️ Ο handler κατασκευάζεται κατά τη **φόρτωση** του executor, ενώ το admin
 * service χρειάζεται διαπιστευτήρια Firebase. Αν το singleton λυνόταν στον
 * κατασκευαστή, μια απλή εισαγωγή του module σε περιβάλλον χωρίς
 * διαπιστευτήρια (π.χ. build step) θα έριχνε. Εδώ η σύνδεση λύνεται στην πρώτη
 * **κλήση**, δηλαδή όταν υπάρχει πραγματικό αίτημα.
 *
 * Οι έξι μέθοδοι γράφονται ρητά και όχι με proxy: ο τύπος `IBOQReadService`
 * επιβάλλει την πληρότητα σε χρόνο μεταγλώττισης, ενώ ένα `Proxy` θα την
 * ανέβαλλε σε χρόνο εκτέλεσης.
 */
const lazyAdminBoq: IBOQReadService = {
  getByBuilding: (companyId: string, buildingId: string): Promise<BOQItem[]> =>
    getBoqAdminReadService().getByBuilding(companyId, buildingId),
  getById: (id: string): Promise<BOQItem | null> =>
    getBoqAdminReadService().getById(id),
  search: (companyId: string, buildingId: string, filters?: BOQSearchFilters): Promise<BOQItem[]> =>
    getBoqAdminReadService().search(companyId, buildingId, filters),
  getStatistics: (companyId: string, buildingId: string): Promise<BOQStats> =>
    getBoqAdminReadService().getStatistics(companyId, buildingId),
  getCategories: (companyId: string): Promise<BOQCategory[]> =>
    getBoqAdminReadService().getCategories(companyId),
  getBuildingSummary: (companyId: string, buildingId: string): Promise<BOQSummary | null> =>
    getBoqAdminReadService().getBuildingSummary(companyId, buildingId),
};

/**
 * Το registry των επτά εργαλείων BOQ.
 *
 * Χτίζεται μία φορά κατά τη φόρτωση — σκόπιμα: οι έλεγχοι κατασκευής του
 * ADR-734 §5.3/§5.4 (μορφή ονόματος, απαγόρευση παραμέτρου `companyId`,
 * συμφωνία υπόδειξης με πολιτική) **ρίχνουν εδώ**, δηλαδή στο πρώτο import και
 * άρα στο πρώτο test — όχι στο πρώτο αίτημα χρήστη.
 */
const boqRegistry: CapabilityRegistry = createBoqCapabilityRegistry({ boq: lazyAdminBoq });

/**
 * Οι ορισμοί που **βλέπει το μοντέλο** για τα επτά εργαλεία.
 *
 * ⚠️ **Παράγονται** από το registry, δεν γράφονται. Οι 40 προϋπάρχοντες ορισμοί
 * του `agentic-tool-definitions.ts` παραμένουν χειρόγραφοι και ανέγγιχτοι· κάθε
 * νέος περνά από εδώ. Ο φύλακας `agent-capability-registry` του
 * `.ssot-registry.json` μπλοκάρει χειρόγραφο `type: 'function'` σε νέο αρχείο
 * ακριβώς για να μη γίνει αυτό τριπλότυπο (ADR-734 §5.2).
 */
export const BOQ_CAPABILITY_TOOL_DEFINITIONS: readonly AgenticToolDefinition[] =
  toOpenAiToolDefinitions(boqRegistry.list());

/**
 * `AgenticContext` → `CapabilityContext`.
 *
 * ⚠️⚠️ Το `companyId` έρχεται **αποκλειστικά** από εδώ — από το ταυτοποιημένο
 * στρώμα που έχτισε το pipeline — και **ποτέ** από τα ορίσματα του εργαλείου.
 * Το registry ρίχνει κατά τη φόρτωση αν κάποια δυνατότητα τολμήσει να δηλώσει
 * παράμετρο `companyId` (ADR-734 §7, διόρθωση 2). Εδώ κλείνει ο κύκλος: ο
 * πράκτορας δεν έχει καν κανάλι να προτείνει πελάτη.
 *
 * Το `CapabilityContext` είναι σκόπιμα **στενότερο** του `AgenticContext`: το L2
 * δεν επιτρέπεται να δει κανάλι, συνημμένα ή στοιχεία επαφής.
 */
function toCapabilityContext(ctx: AgenticContext): CapabilityContext {
  return {
    companyId: ctx.companyId,
    isAdmin: ctx.isAdmin,
    requestId: ctx.requestId,
  };
}

export class BoqCapabilityHandler implements ToolHandler {
  /** Τα ονόματα **παράγονται** από το registry — καμία χειρόγραφη λίστα. */
  readonly toolNames: readonly string[] = boqRegistry.list().map((capability) => capability.name);

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext,
  ): Promise<ToolResult> {
    const outcome = await boqRegistry.invoke(toolName, args, toCapabilityContext(ctx));

    if (!outcome.ok) {
      logger.warn('BOQ capability rejected', {
        tool: toolName,
        requestId: ctx.requestId,
        code: outcome.error.code,
      });
      return { success: false, error: `${outcome.error.code}: ${outcome.error.message}` };
    }

    return {
      success: true,
      data: outcome.envelope,
      count: outcome.envelope.provenance.sourceItemIds.length,
    };
  }
}
