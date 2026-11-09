/**
 * =============================================================================
 * Η ΟΥΡΑ ΜΕΣΩΝ ΜΙΑΣ ΠΑΡΤΙΔΑΣ — ποιες διευθύνσεις, με ποιους ρόλους, σε ποια κατάσταση (ADR-934 §5.2.2 Μ-β4)
 * =============================================================================
 *
 * 🔑 **Η ουρά ΔΕΝ αποθηκεύεται**: είναι η ένωση των κανονικών URI που ζητούν οι **ζωντανές** προτάσεις (σε εκκρεμότητα ή
 *   εφαρμοσμένες· όχι οι απορριφθείσες), ενωμένη με τα έγγραφα λήψης. Νέα χαρτογράφηση που αλλάζει τις προτάσεις αλλάζει και
 *   την ουρά, χωρίς δεύτερη πηγή αλήθειας να παλιώσει.
 * 🔑 **Ο server κατεβάζει ΜΟΝΟ ό,τι είναι εδώ** — ποτέ αυθαίρετο URL από τον πελάτη (όχι ενισχυτής SSRF).
 * 🔑 **Μία λήψη ανά διεύθυνση**: ίδιο URI σε δύο γραμμές ή με δύο ρόλους ⇒ μία λήψη, οι ρόλοι ενώνονται (σειρά λεξιλογίου).
 * ⛔ **ΚΑΘΑΡΟ** — καμία βάση, κανένα δίκτυο.
 *
 * @module subapps/catalog/import/import-asset-queue
 */

import type { ExtractedAsset, ExtractedGroup, ImportProposalDefinition } from '../types/catalog-import';
import type { ImportAssetFetchDefinition, ImportAssetView } from '../types/catalog-media';
import { CATALOG_ASSET_ROLES, type CatalogAssetRole } from '../vocabulary/asset-roles';

/** Μία διεύθυνση που ζητά η παρτίδα. */
export interface ImportAssetRequest {
  readonly uri: string;
  /** Σε σειρά λεξιλογίου — ο **πρώτος** κρίνει το περιεχόμενο της λήψης. */
  readonly roles: readonly CatalogAssetRole[];
  /** Το πρώτο όνομα αρχείου που δήλωσε η πηγή (σε σειρά διεύθυνσης). */
  readonly filename: string | null;
}

/** Οι προτάσεις που ζητούν ακόμη τα μέσα τους: η απορριφθείσα είναι απόφαση «όχι». */
const LIVE_PROPOSAL = (proposal: Pick<ImportProposalDefinition, 'status'>): boolean => proposal.status !== 'rejected';

function assetsOf(group: ExtractedGroup): readonly ExtractedAsset[] {
  return [...(group.assets ?? []), ...group.rows.flatMap((row) => row.assets ?? [])];
}

const roleOrder = (role: CatalogAssetRole): number => CATALOG_ASSET_ROLES.indexOf(role);

/** Η ουρά: μία γραμμή ανά κανονικό URI, ταξινομημένη (σταθερή σειρά σε κάθε ανάγνωση). */
export function importAssetRequestsOf(proposals: readonly Pick<ImportProposalDefinition, 'status' | 'extracted'>[]): ImportAssetRequest[] {
  const byUri = new Map<string, { roles: Set<CatalogAssetRole>; filename: string | null }>();
  for (const proposal of proposals.filter(LIVE_PROPOSAL)) {
    for (const asset of assetsOf(proposal.extracted)) {
      const entry = byUri.get(asset.uri) ?? { roles: new Set<CatalogAssetRole>(), filename: null };
      entry.roles.add(asset.role);
      entry.filename = entry.filename ?? asset.filename;
      byUri.set(asset.uri, entry);
    }
  }
  return [...byUri.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([uri, entry]) => ({ uri, roles: [...entry.roles].sort((a, b) => roleOrder(a) - roleOrder(b)), filename: entry.filename }));
}

/** Μίσθωση που έληξε = κανείς δεν κατεβάζει πια: η διεύθυνση είναι ξανά στην ουρά. */
const leaseLive = (stored: Pick<ImportAssetFetchDefinition, 'status' | 'leaseUntil'>, now: number): boolean =>
  stored.status === 'fetching' && (stored.leaseUntil ?? 0) > now;

/** Η γραμμή της οθόνης για μία διεύθυνση. */
export function importAssetViewOf(request: ImportAssetRequest, stored: ImportAssetFetchDefinition | null, now: number): ImportAssetView {
  const base = { uri: request.uri, roles: request.roles, filename: request.filename };
  if (stored === null) return { ...base, status: 'queued', attempts: 0, failure: null, verdict: null, content: null, transport: null };
  const status = stored.status === 'fetching' && !leaseLive(stored, now) ? 'queued' : stored.status;
  return { ...base, status, attempts: stored.attempts, failure: stored.failure, verdict: stored.verdict, content: stored.content, transport: stored.transport };
}

/**
 * **Τι κάνει μια αίτηση λήψης** πάνω στην κατάσταση της διεύθυνσης:
 *   • `settled` — έτοιμη, ή αποτυχημένη χωρίς ρητή «Ξαναδοκιμή»: επιστρέφεται ως έχει (ιδεμπότητο· το διπλό κλικ δεν ξανακατεβάζει)·
 *   • `inFlight` — κάποιος άλλος κατεβάζει τώρα (ζωντανή μίσθωση)·
 *   • `claim` — καμία λήψη, ληγμένη μίσθωση, ή ρητή «Ξαναδοκιμή» αποτυχημένης.
 */
export type ImportAssetClaim = 'settled' | 'inFlight' | 'claim';

export function importAssetClaimOf(stored: ImportAssetFetchDefinition | null, now: number, retry: boolean): ImportAssetClaim {
  if (stored === null) return 'claim';
  if (stored.status === 'ready') return 'settled';
  if (stored.status === 'failed') return retry ? 'claim' : 'settled';
  return leaseLive(stored, now) ? 'inFlight' : 'claim';
}
