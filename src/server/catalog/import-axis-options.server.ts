import 'server-only';

/**
 * **Νέες τιμές άξονα από τον έλεγχο εισαγωγής** (ADR-923 §5.5.2 Β7) — ορχήστρωση πάνω σε υπάρχοντες δρόμους, κανένας νέος δρόμος εγγραφής:
 *
 * 1. Κρίνει **στη μνήμη**: η πρόταση εκκρεμεί, η ιδιότητα είναι άξονας `select` του σχήματος, οι νέες τιμές στέκουν (`withAxisOptions`),
 *    και **μία** γραμμή του πίνακα λύνεται σε τιμή για κάθε παραλλαγή με το μελλοντικό σχήμα (`axisLineOf`). Τα κείμενα τα διαβάζει από
 *    το PDF ο ίδιος· δεν εμπιστεύεται τον πελάτη.
 * 2. Γράφει τις επιλογές **μόνο** μέσω του γραφέα ιδιοτήτων (`updateCatalogAttribute`, CHECK 3.106: CAS, ξαναεπικύρωση οικογενειών).
 * 3. Δένει τη γραμμή με απόφαση `axis` μέσω του `setImportLine`: ίδιος αγωγός, ίδιος κριτής, οι διορθώσεις του Β6 επανεφαρμόζονται.
 *
 * 🔑 **Ιδεμπότητο**: επιλογές που υπάρχουν ήδη ίδιες δεν ξαναγράφονται. Διακοπή μετά το βήμα 2 ⇒ το ξανάπατημα κάνει μόνο το 3.
 * 🔑 Άρνηση ⇒ **τίποτα** δεν γράφεται και επιστρέφεται ο λόγος (`ImportLineRefusal`), όπως στην απόφαση γραμμής.
 * @module server/catalog/import-axis-options.server
 */

import type { AuthContext } from '@/lib/auth';
import { axisLineOf, withAxisOptions } from '@/subapps/catalog/import/axis-options-from-review';
import { tableLineTexts } from '@/subapps/catalog/import/page-table-reading';
import { attributeDefinitionSchema } from '@/subapps/catalog/schema/zod/attribute.schema';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import type { ImportBatchDefinition } from '@/subapps/catalog/types/catalog-import';
import type { AddImportAxisOptionsRequest, SetImportLineResult } from '@/subapps/catalog/types/catalog-import-requests';
import { updateCatalogAttribute } from './attribute-writer.server';
import { readOwned, runCatalogReadOnly } from './catalog-store.server';
import { assertPurposeAuthority, type StoredImportBatch } from './import-batch-writer.server';
import { setImportLine } from './import-page-reinterpret.server';
import { readBatchProposals, readImportBatchDetail } from './import-reads.server';
import { groupKeyOf, pageBasis, readBatchSchema, refuse, tableOf, type Judged } from './import-table-rebuild.server';

interface AxisPlan {
  readonly line: number;
  /** `null` = καμία νέα επιλογή: μόνο δέσιμο. */
  readonly next: CatalogAttributeDefinition | null;
}

async function openBatch(ctx: AuthContext, id: string, request: AddImportAxisOptionsRequest): Promise<Judged<StoredImportBatch>> {
  const batch = await runCatalogReadOnly(ctx, (scope) => readOwned<ImportBatchDefinition>(scope, 'importBatch', id));
  await assertPurposeAuthority(ctx, batch.target.purpose);
  if (batch.target.purpose !== 'attributes' || !batch.pages?.done.includes(request.page)) return refuse('lineUnknown');
  const proposal = (await readBatchProposals(ctx, id)).find((candidate) => candidate.groupKey === groupKeyOf(request.page, request.table));
  if (!proposal) return refuse('lineUnknown');
  return proposal.status === 'pending' ? { ok: true, value: batch } : refuse('proposalClosed');
}

/** Ο άξονας, ως **ορισμός** (το σχήμα της διαδρομής πετά το περίβλημα της εγγραφής), μόνο αν είναι `select` άξονας του σχήματος. */
async function axisAttribute(ctx: AuthContext, batch: StoredImportBatch, attributeId: string): Promise<Judged<CatalogAttributeDefinition>> {
  const schema = await readBatchSchema(ctx, batch);
  const isAxis = (schema?.scheme?.levels ?? []).some((level) => level.axisAttributeIds.includes(attributeId));
  const stored = schema?.attributes.get(attributeId);
  if (!isAxis || stored === undefined || stored.type !== 'select') return refuse('lineUnknown');
  const parsed = attributeDefinitionSchema.safeParse(stored);
  return parsed.success ? { ok: true, value: parsed.data } : refuse('axisOptionsInvalid');
}

/** Βήμα 1: όλα κρίνονται πριν γραφτεί οτιδήποτε. */
async function planAxis(ctx: AuthContext, id: string, request: AddImportAxisOptionsRequest): Promise<Judged<AxisPlan>> {
  const opened = await openBatch(ctx, id, request);
  if (!opened.ok) return opened;
  const attribute = await axisAttribute(ctx, opened.value, request.attributeId);
  if (!attribute.ok) return attribute;
  const plan = withAxisOptions(attribute.value, request.options);
  if (plan.issues.size > 0) return refuse('axisOptionsInvalid');
  const page = await pageBasis(ctx, opened.value, request.page);
  if (!page.ok) return page;
  const basis = tableOf(page.value, request.table);
  if (!basis.ok) return basis;
  const choice = axisLineOf(plan.next, tableLineTexts(basis.value.table, basis.value.answer.variantsIn));
  if (choice.kind !== 'found') return refuse(choice.kind === 'missing' ? 'axisLineMissing' : 'axisLineAmbiguous');
  return { ok: true, value: { line: choice.line, next: plan.added.length > 0 ? plan.next : null } };
}

/** `POST /api/catalog/imports/[id]/axis-options` — νέες τιμές άξονα + δέσιμο της γραμμής τους, χωρίς AI. */
export async function addImportAxisOptions(ctx: AuthContext, id: string, request: AddImportAxisOptionsRequest): Promise<SetImportLineResult> {
  const planned = await planAxis(ctx, id, request);
  if (!planned.ok) return { view: await readImportBatchDetail(ctx, id), outcome: { kind: 'refused', reason: planned.reason } };
  const { line, next } = planned.value;
  if (next !== null) await updateCatalogAttribute(ctx, request.attributeId, request.expectedRevision, next);
  return setImportLine(ctx, id, { page: request.page, table: request.table, line, decision: { kind: 'axis', attributeId: request.attributeId }, bind: null });
}
