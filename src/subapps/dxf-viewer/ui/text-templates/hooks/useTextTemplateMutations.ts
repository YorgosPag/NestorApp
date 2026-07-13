/**
 * ADR-344 Phase 7.D — CRUD mutations with optimistic UI.
 *
 * Each mutation:
 *   1. Snapshots the current user-template list.
 *   2. Applies the optimistic change locally (instant feedback — N.7 Google).
 *   3. Performs the network call.
 *   4. On success, swaps the optimistic placeholder for the canonical
 *      server-side document (correct id / timestamps / placeholders).
 *   5. On failure, restores the original snapshot and surfaces the error.
 *
 * `duplicate` is a thin wrapper over `create` that copies the source's
 * `content` / `category` and appends `" (copy)"` to its name.
 *
 * ⚠️ ADR-651 Φάση Θ: το **σύρμα** (fetch + error mapping) δεν ζει πια εδώ — μετακόμισε στον
 * κοινό `text-template-api.ts`, τον οποίο μοιράζεται με τη **βιβλιοθήκη πινακίδας** (N.18:
 * ένα σετ HTTP wrappers, όχι δύο). Εδώ μένει ΜΟΝΟ η optimistic σημασιολογία του manager.
 */
'use client';

import { useCallback } from 'react';
import type { DxfTextNode } from '@/subapps/dxf-viewer/text-engine/types/text-ast.types';
import type {
  TextTemplate,
  TextTemplateCategory,
} from '@/subapps/dxf-viewer/text-engine/templates';
import {
  TextTemplateApiError,
  apiCreateTextTemplate,
  apiDeleteTextTemplate,
  apiUpdateTextTemplate,
} from '@/subapps/dxf-viewer/text-engine/templates/text-template-api';

/** Το σφάλμα του manager ΕΙΝΑΙ το σφάλμα του api client — ένας τύπος, ένα `instanceof`. */
export { TextTemplateApiError as TemplateMutationError };

export interface CreateTemplateInput {
  readonly name: string;
  readonly category: TextTemplateCategory;
  readonly content: DxfTextNode;
}

export interface UpdateTemplatePatch {
  readonly name?: string;
  readonly category?: TextTemplateCategory;
  readonly content?: DxfTextNode;
}

interface UseMutationsArgs {
  readonly userTemplates: readonly TextTemplate[];
  readonly setUserTemplates: (next: readonly TextTemplate[]) => void;
}

export interface UseTextTemplateMutationsResult {
  readonly createTemplate: (input: CreateTemplateInput) => Promise<TextTemplate>;
  readonly updateTemplate: (id: string, patch: UpdateTemplatePatch) => Promise<TextTemplate>;
  readonly deleteTemplate: (id: string) => Promise<void>;
  readonly duplicateTemplate: (source: TextTemplate) => Promise<TextTemplate>;
}

const OPTIMISTIC_PREFIX = 'optimistic_';

function optimisticId(): string {
  return `${OPTIMISTIC_PREFIX}${Math.random().toString(36).slice(2, 11)}`;
}

/** Η προσωρινή γραμμή που βλέπει ο χρήστης όσο ταξιδεύει το POST. */
function optimisticTemplate(input: CreateTemplateInput): TextTemplate {
  const now = new Date();
  return {
    id: optimisticId(),
    companyId: '__pending__',
    name: input.name,
    category: input.category,
    content: input.content,
    placeholders: [],
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function useTextTemplateMutations(
  { userTemplates, setUserTemplates }: UseMutationsArgs,
): UseTextTemplateMutationsResult {
  const createTemplate = useCallback(
    async (input: CreateTemplateInput): Promise<TextTemplate> => {
      const snapshot = userTemplates;
      setUserTemplates([...snapshot, optimisticTemplate(input)]);
      try {
        const persisted = await apiCreateTextTemplate(input);
        setUserTemplates(snapshot.concat(persisted));
        return persisted;
      } catch (err) {
        setUserTemplates(snapshot);
        throw err;
      }
    },
    [userTemplates, setUserTemplates],
  );

  const updateTemplate = useCallback(
    async (id: string, patch: UpdateTemplatePatch): Promise<TextTemplate> => {
      const snapshot = userTemplates;
      const idx = snapshot.findIndex((t) => t.id === id);
      if (idx < 0) {
        throw new TextTemplateApiError(404, `Template ${id} not found in local list`);
      }
      const existing = snapshot[idx];
      const next = snapshot.slice();
      next[idx] = {
        ...existing,
        name: patch.name ?? existing.name,
        category: patch.category ?? existing.category,
        content: patch.content ?? existing.content,
        updatedAt: new Date(),
      };
      setUserTemplates(next);
      try {
        const persisted = await apiUpdateTextTemplate(id, patch);
        const reconciled = snapshot.slice();
        reconciled[idx] = persisted;
        setUserTemplates(reconciled);
        return persisted;
      } catch (err) {
        setUserTemplates(snapshot);
        throw err;
      }
    },
    [userTemplates, setUserTemplates],
  );

  const deleteTemplate = useCallback(
    async (id: string): Promise<void> => {
      const snapshot = userTemplates;
      setUserTemplates(snapshot.filter((t) => t.id !== id));
      try {
        await apiDeleteTextTemplate(id);
      } catch (err) {
        setUserTemplates(snapshot);
        throw err;
      }
    },
    [userTemplates, setUserTemplates],
  );

  const duplicateTemplate = useCallback(
    async (source: TextTemplate): Promise<TextTemplate> => {
      return createTemplate({
        name: `${source.name} (copy)`,
        category: source.category,
        content: source.content,
      });
    },
    [createTemplate],
  );

  return { createTemplate, updateTemplate, deleteTemplate, duplicateTemplate };
}
