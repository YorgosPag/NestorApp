'use client';

/**
 * ADR-375 Phase B.3 — BIM View Template Service.
 *
 * Client-side CRUD + apply/detach/propagate operations for reusable BIM render
 * settings presets, persisted to Firestore `dxf_viewer_view_templates`.
 *
 * Architecture:
 *   - Writes: direct client `setDoc` / `updateDoc` / `deleteDoc` with
 *     enterprise IDs (`generateViewTemplateId` — prefix `vtmpl_`). Mirrors the
 *     ADR-358 `floorplan_stairs` pattern: top-level collection, companyId-
 *     scoped, rules-enforced.
 *   - Reads: `firestoreQueryService.subscribe('DXF_VIEWER_VIEW_TEMPLATES', …)`.
 *     Tenant constraint applied automatically (default `companyId` config).
 *   - Apply to level: `updateDxfLevelWithPolicy` — copies the template's
 *     settings into `Level.bimRenderSettings` AND sets `appliedViewTemplateId`.
 *   - Detach: nulls `appliedViewTemplateId`, keeps `bimRenderSettings` as the
 *     final snapshot (Revit "remove from template" behavior).
 *   - Edit propagation: caller-driven client-side fan-out — after `update()`
 *     resolves, the caller invokes `propagateToLinkedLevels(template, levels)`
 *     to re-apply the new settings to every level whose
 *     `appliedViewTemplateId === template.id`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-375 §5 Phase B.3
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateViewTemplateId } from '@/services/enterprise-id.service';
import { firestoreQueryService } from '@/services/firestore';
import { updateDxfLevelWithPolicy } from '@/services/dxf-level-mutation-gateway';
import { nowISO } from '@/lib/date-local';
import type { BimRenderSettings } from '../config/bim-render-settings-types';
import type {
  ApplyViewTemplateInput,
  CreateViewTemplateInput,
  DetachViewTemplateInput,
  UpdateViewTemplateInput,
  ViewTemplate,
} from '../config/view-template-types';
import type { Level } from '../systems/levels/config';

// ── Helpers ────────────────────────────────────────────────────────────────

function docRef(templateId: string) {
  return doc(db, COLLECTIONS.DXF_VIEWER_VIEW_TEMPLATES, templateId);
}

function nowIso(): string {
  return nowISO();
}

// ── Subscribe ──────────────────────────────────────────────────────────────

/**
 * Subscribe to all `view_templates` visible to the current tenant.
 * Tenant filter (`companyId == effective`) is auto-applied by
 * `firestoreQueryService` per ADR-355.
 */
export function subscribeViewTemplates(
  onChange: (templates: ViewTemplate[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return firestoreQueryService.subscribe<ViewTemplate>(
    'DXF_VIEWER_VIEW_TEMPLATES',
    (result) => {
      const docs = result.documents as unknown as ViewTemplate[];
      onChange(docs);
    },
    (err) => onError?.(err),
  );
}

// ── Create / Update / Delete ───────────────────────────────────────────────

export async function createViewTemplate(
  input: CreateViewTemplateInput,
  ctx: { companyId: string; userId: string },
): Promise<ViewTemplate> {
  const id = generateViewTemplateId();
  const ref = docRef(id);
  const now = nowIso();
  const data: ViewTemplate = {
    id,
    companyId: ctx.companyId,
    name: input.name,
    description: input.description,
    settings: input.settings,
    createdBy: ctx.userId,
    createdAt: now,
    updatedAt: now,
  };
  // Firestore serverTimestamp() for audit fields — separate write keys, the
  // client-visible ISO strings above are echoed back via the snapshot.
  await setDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return data;
}

export async function updateViewTemplate(
  input: UpdateViewTemplateInput,
): Promise<void> {
  const { templateId, ...patch } = input;
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description ?? null;
  if (patch.settings !== undefined) update.settings = patch.settings;
  await updateDoc(docRef(templateId), update);
}

export async function deleteViewTemplate(templateId: string): Promise<void> {
  await deleteDoc(docRef(templateId));
}

// ── Apply / Detach ─────────────────────────────────────────────────────────

/**
 * Apply a template to a level: copies the template's settings into the
 * level's `bimRenderSettings` AND sets `appliedViewTemplateId = template.id`.
 *
 * The copy semantics (rather than pure FK) mean: (a) renderers keep reading
 * `Level.bimRenderSettings` exclusively, (b) "detach" is non-destructive —
 * the snapshot stays after the link is broken, (c) template deletion does
 * not orphan the level's render state.
 */
export async function applyViewTemplate(
  input: ApplyViewTemplateInput,
  template: ViewTemplate,
): Promise<void> {
  if (template.id !== input.templateId) {
    throw new Error(
      `applyViewTemplate: template.id (${template.id}) does not match input.templateId (${input.templateId})`,
    );
  }
  await updateDxfLevelWithPolicy({
    payload: {
      levelId: input.levelId,
      bimRenderSettings: template.settings,
      appliedViewTemplateId: template.id,
    },
  });
}

/**
 * Detach a level from any currently-applied template. `bimRenderSettings`
 * is preserved (so the level keeps the visual state at detach time); only
 * the FK is nulled.
 */
export async function detachViewTemplate(
  input: DetachViewTemplateInput,
): Promise<void> {
  await updateDxfLevelWithPolicy({
    payload: {
      levelId: input.levelId,
      appliedViewTemplateId: null,
    },
  });
}

// ── Propagation ────────────────────────────────────────────────────────────

/**
 * After a template is edited, re-apply its new settings to every level
 * currently linked via `appliedViewTemplateId === template.id`.
 *
 * Returns the count of levels updated. Errors during fan-out are surfaced
 * via `Promise.allSettled` so a single failure doesn't abort the batch;
 * callers may inspect the returned `failures` array.
 */
export async function propagateToLinkedLevels(
  template: ViewTemplate,
  allLevels: readonly Level[],
): Promise<{ updated: number; failures: unknown[] }> {
  const linked = allLevels.filter((l) => l.appliedViewTemplateId === template.id);
  if (linked.length === 0) return { updated: 0, failures: [] };

  const results = await Promise.allSettled(
    linked.map((level) =>
      updateDxfLevelWithPolicy({
        payload: {
          levelId: level.id,
          bimRenderSettings: template.settings,
        },
      }),
    ),
  );

  const failures = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => r.reason);

  return { updated: results.length - failures.length, failures };
}

// ── Direct list (one-shot read; useful for tests / debugging) ──────────────

/**
 * One-shot read of all templates for the given company. Production code
 * should use `subscribeViewTemplates` for real-time updates.
 */
export async function listViewTemplatesOnce(companyId: string): Promise<ViewTemplate[]> {
  const q = query(
    collection(db, COLLECTIONS.DXF_VIEWER_VIEW_TEMPLATES),
    where('companyId', '==', companyId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ViewTemplate);
}

// ── Compose helper: apply settings as ad-hoc snapshot (no template) ────────

/**
 * Mirrors the "Save As Template" UX path: takes a name + existing snapshot
 * and creates a new template seeded from it. Named `saveBimSettingsAsViewTemplate`
 * (rather than `saveCurrentAsTemplate`) to avoid colliding with the
 * `layer-state-system` SSoT registry token of the same shape.
 */
export async function saveBimSettingsAsViewTemplate(
  name: string,
  settings: BimRenderSettings,
  ctx: { companyId: string; userId: string },
  description?: string,
): Promise<ViewTemplate> {
  return createViewTemplate({ name, description, settings }, ctx);
}
