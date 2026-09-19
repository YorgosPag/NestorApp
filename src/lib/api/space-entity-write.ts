/**
 * =============================================================================
 * Η ΓΡΑΦΗ ενός PATCH χώρου — σύνθεση πεδίων + ίχνος ιστορικού (καθαρό)
 * =============================================================================
 *
 * Οι δύο αποφάσεις του PATCH θέσης/αποθήκης που δεν χρειάζονται Firestore, βγαλμένες από τον
 * `server-only` handler ώστε να ελέγχονται σε απλό jest (ίδιος λόγος με το
 * `space-entity-fields.ts`):
 *
 * 1. **Τι γράφεται** — κοινά πεδία + ειδικά της οντότητας + **εμπορικά**, που κρίνονται απέναντι
 *    στο αποθηκευμένο (`mapSpaceCommercialFields`, ADR-777 §8.60.18). Μια άρνηση επιστρέφεται
 *    **πριν** αγγιχτεί οτιδήποτε.
 * 2. **Τι λέει το ιστορικό** — η διαφορά από το **ένα** μητρώο πεδίων της οντότητας.
 *
 * @module lib/api/space-entity-write
 * @see ADR-777 §8.60.18 · ADR-195 (entity audit) · ADR-696 (space-entity route SSoT)
 */

import { mapSpaceCommercialFields, SPACE_COMMERCIAL_REJECTION_MESSAGE } from '@/lib/api/space-commercial-fields';
import { mapCommonSpaceFields, type SpaceDisplayField } from '@/lib/api/space-entity-fields';
import { getTrackedFieldsForEntityAuditType } from '@/config/audit-tracked-fields';
import { diffTrackedFields } from '@/lib/audit/audit-diff';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';

/** Ό,τι χρειάζεται η σύνθεση από τη ρύθμιση της διαδρομής. */
export interface SpaceWriteConfig<TBody> {
  readonly displayField: SpaceDisplayField;
  readonly mapExtraFields: (body: TBody) => Record<string, unknown>;
}

/** Το σχέδιο της γραφής — ή η άρνηση, με τον κωδικό HTTP της. */
export type SpaceWritePlan =
  | { readonly kind: 'write'; readonly updateData: Record<string, unknown> }
  | { readonly kind: 'rejected'; readonly status: 400 | 409; readonly message: string };

/** Σώμα + αποθηκευμένο έγγραφο → τα πεδία της γραφής (ή η άρνηση). */
export function planSpaceWrite<TBody extends Record<string, unknown>>(
  cfg: SpaceWriteConfig<TBody>,
  body: TBody,
  existing: Readonly<Record<string, unknown>>,
): SpaceWritePlan {
  const commercial = mapSpaceCommercialFields(body, existing);
  if (commercial.kind === 'rejected') {
    return {
      kind: 'rejected',
      status: commercial.status,
      message: SPACE_COMMERCIAL_REJECTION_MESSAGE[commercial.reason],
    };
  }
  return {
    kind: 'write',
    updateData: {
      ...mapCommonSpaceFields(body, cfg.displayField),
      ...cfg.mapExtraFields(body),
      ...(commercial.kind === 'write' ? commercial.fields : {}),
    },
  };
}

/** Τα πεδία που αλλάζουν «κατάσταση» — το φίλτρο «κατάσταση» του Ιστορικού τα ξεχωρίζει. */
const STATUS_FIELDS: ReadonlySet<string> = new Set(['status', 'commercialStatus', 'operationalStatus']);

/** Το ίχνος μιας γραφής: οι αλλαγές και η ενέργεια — ή `null` όταν δεν άλλαξε τίποτα. */
export interface SpaceAuditEntry {
  readonly changes: readonly AuditFieldChange[];
  readonly action: AuditAction;
}

/**
 * Η διαφορά **πριν → μετά** από το μητρώο της οντότητας (`parking` · `storage`).
 *
 * ⚠️ Το `buildingId` **εξαιρείται**: το καταγράφει ήδη το `linkEntity` (ADR-239) — δύο γραμμές
 * για μία πράξη θα ήταν διπλομέτρηση. 🔑 Ιδεμπότητα: καμία αλλαγή ⇒ `null`, καμία γραμμή.
 */
export function spaceAuditEntry(
  entityKind: 'parking' | 'storage',
  existing: Readonly<Record<string, unknown>>,
  updateData: Readonly<Record<string, unknown>>,
): SpaceAuditEntry | null {
  const tracked = getTrackedFieldsForEntityAuditType(entityKind) ?? {};
  const fields = Object.fromEntries(Object.entries(tracked).filter(([field]) => field !== 'buildingId'));
  const changes = diffTrackedFields({ ...existing }, { ...updateData }, fields);
  if (changes.length === 0) return null;
  const action: AuditAction = changes.some((c) => STATUS_FIELDS.has(c.field)) ? 'status_changed' : 'updated';
  return { changes, action };
}
