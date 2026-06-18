/**
 * Slab structural diagnostics (ADR-498).
 *
 * Revit-grade προειδοποίηση όταν μια **πλάκα-πρόβολος** (1 φέρουσα δοκός, ADR-498) είναι
 * **πολύ λεπτή** για το άνοιγμα προβόλου της: έλεγχος λειτουργικότητας (βέλος) μέσω του
 * λόγου L/d (EC2 §7.4.2 Table 7.4N· πρόβολος K=0.4). Λύνει το σιωπηλό «πέρασμα» αδύνατων
 * προβόλων (π.χ. 5m πρόβολος σε πλάκα 200mm → `hasCodeViolations:false`).
 *
 * Mirror του `checkBeamUnsupportedEnd` (ADR-486): ο πρόβολος είναι **έγκυρο** στατικό σύστημα
 * — εδώ ΔΕΝ ελέγχουμε συνδεσιμότητα αλλά **επάρκεια πάχους**. Συντηρητικά: warning ΜΟΝΟ όταν
 * L/d > όριο (αλλιώς σιωπηλό). Pure — provider arg, zero React/DOM/Firestore.
 *
 * @see ../loads/slab-beam-support.ts — computeSlabSupportConditions (η τοπολογία προβόλου)
 * @see ./organism-checks.ts — checkBeamUnsupportedEnd (το pattern mirror)
 * @see ../footing-design/footing-design-checks.ts — runFootingDesignChecks (ίδιος runner)
 * @see docs/centralized-systems/reference/adrs/ADR-498-cantilever-slab-design.md
 */

import type { Entity } from '../../../types/entities';
import { isSlabEntity } from '../../../types/entities';
import type { StructuralCodeProvider } from '../codes/structural-code-types';
import type { StructuralDiagnostic } from './structural-organism-types';
import { computeSlabSupportConditions } from '../loads/slab-beam-support';
import { buildSlabFoundationSectionContext } from '../section-context';
import { footingEffectiveDepthMm } from '../codes/suggest-reinforcement';

/** i18n key prefix (ns `dxf-viewer-shell`) — κοινό με τα υπόλοιπα structural διαγνωστικά. */
const MSG = 'structuralOrganism.diagnostics';

/**
 * Έλεγχοι σχεδιασμού πλάκας πάνω στα entities της σκηνής (ADR-498). Pure — απαιτεί τον
 * code provider (όρια L/d + cover). Slice 1: cantilever slab too-thin (έλεγχος βέλους).
 * Κενό όταν δεν υπάρχουν πλάκες-πρόβολοι.
 */
export function runSlabChecks(
  entities: readonly Entity[],
  provider: StructuralCodeProvider,
): StructuralDiagnostic[] {
  const conditions = computeSlabSupportConditions(entities);
  if (conditions.size === 0) return [];
  const out: StructuralDiagnostic[] = [];

  for (const e of entities) {
    if (!isSlabEntity(e)) continue;
    const cond = conditions.get(e.id);
    if (!cond || cond.supportType !== 'cantilever') continue;

    const ctx = buildSlabFoundationSectionContext(e, cond);
    if (ctx.kind !== 'suspended') continue; // εδαφόπλακες δεν λειτουργούν ως πρόβολοι
    const spanMm = ctx.cantileverSpanMm ?? 0;
    const limit = provider.slabSpanDepthLimit(ctx);
    const cover = provider.slabFoundationReinforcementLimits(ctx).nominalCoverMm;
    const dEffMm = footingEffectiveDepthMm(ctx.thicknessMm, cover);
    if (spanMm <= 0 || limit <= 0 || dEffMm <= 0) continue;

    const ldRatio = spanMm / dEffMm;
    if (ldRatio <= limit) continue; // αρκετά παχιά → έγκυρος πρόβολος (σιωπηλό, mirror δοκαριού)

    out.push({
      id: `cantileverSlabTooThin:${e.id}`,
      code: 'cantileverSlabTooThin',
      severity: 'warning',
      messageKey: `${MSG}.cantileverSlabTooThin`,
      primaryEntityId: e.id,
      entityIds: [e.id],
      messageParams: {
        span: (spanMm / 1000).toFixed(2),
        thickness: Math.round(ctx.thicknessMm),
        ldRatio: Math.round(ldRatio),
        ldLimit: Math.round(limit),
      },
    });
  }
  return out;
}
