/**
 * @fileoverview **Η γραμμή ιστορικού μιας αλλαγής κτιρίου** — ΕΝΑ σημείο για κάθε κλάδο του `PATCH /api/buildings`.
 * @related ADR-195 (Entity Audit Trail) · ADR-332 D29 · `config/audit-tracked-fields.ts` (`BUILDING_TRACKED_FIELDS`)
 * @module api/buildings/_shared/building-update-audit
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-05)**: η γενική διαδρομή του PATCH δεν έγραφε **καμία** ανθρώπινη αλλαγή στο
 * ιστορικό — μόνο το παλιό `logAuditEvent`. Το CHECK 3.17 δεν το έβλεπε, γιατί η γραφή περνά από το
 * `withVersionCheck` (σχήμα που η πύλη δεν αναγνώριζε). Ο κλάδος της αντικειμενικής είχε ήδη δικό του αντίγραφο
 * αυτής της πράξης· τώρα το λένε και οι δύο από εδώ.
 *
 * 🔑 **Η διαφορά κρίνεται απέναντι στο αποθηκευμένο έγγραφο**, όχι από τα κλειδιά του αιτήματος: η αυτόματη
 * αποθήκευση στέλνει **όλα** τα πεδία σε κάθε κύκλο, και μια γραμμή ανά κλειδί θα γέμιζε το ιστορικό φαντάσματα.
 * Καμία διαφορά ⇒ καμία γραμμή.
 *
 * 🔑 **Μία γραμμή ανά αποθήκευση, και το βιβλίο δεν ξαναγράφεται ποτέ.** Η πυκνότητα της αυτόματης αποθήκευσης
 * λύνεται στην **ανάγνωση** (`services/audit/coalesce-edit-sessions.ts`).
 */

import 'server-only';

import { BUILDING_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { AuthContext } from '@/lib/auth';
import { EntityAuditService } from '@/services/entity-audit.service';

export interface BuildingUpdateAuditInput {
  readonly buildingId: string;
  /** Το κτίριο **πριν** τη γραφή. */
  readonly before: Readonly<Record<string, unknown>>;
  /** Ό,τι **γράφτηκε** — μερικό: πεδία που λείπουν δεν κρίνονται. */
  readonly written: Readonly<Record<string, unknown>>;
  readonly ctx: AuthContext;
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Γράφει τη γραμμή ιστορικού της αλλαγής — ή τίποτα, αν δεν άλλαξε παρακολουθούμενο πεδίο.
 *
 * ⚠️ Το βιβλίο είναι του **μισθωτή του εγγράφου**, όχι του καλούντος: ο super admin που διορθώνει κτίριο άλλης
 * εταιρείας γράφει στο ιστορικό **εκείνης**. **Δεν πετά** (`recordChange` καταπίνει και καταγράφει).
 */
export async function recordBuildingUpdate(input: BuildingUpdateAuditInput): Promise<void> {
  const { buildingId, before, written, ctx } = input;
  const changes = await EntityAuditService.diffFieldsWithResolution(
    { ...before },
    { ...written },
    BUILDING_TRACKED_FIELDS,
    {},
  );
  if (changes.length === 0) return;

  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.BUILDING,
    entityId: buildingId,
    entityName: textOf(written.name) ?? textOf(before.name),
    action: 'updated',
    changes,
    performedBy: ctx.uid,
    performedByName: ctx.email ?? null,
    companyId: textOf(before.companyId) ?? ctx.companyId,
  });
}
