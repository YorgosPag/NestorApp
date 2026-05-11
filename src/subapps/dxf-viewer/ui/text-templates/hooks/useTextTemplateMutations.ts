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
 * `content` / `category` and appends `" (copy)"` to its name. The server
 * decides the final unique name (see "Duplicate naming" in the route);
 * for the optimistic UI we use a placeholder name so the row appears
 * immediately.
 */
'use client';

import { useCallback } from 'react';
import type { DxfTextNode } from '@/subapps/dxf-viewer/text-engine/types/text-ast.types';
import type {
  TextTemplate,
  TextTemplateCategory,
} from '@/subapps/dxf-viewer/text-engine/templates';
import { deserializeUserTemplate } from './template-cache';
import type { SerializedUserTextTemplate } from '../shared/serialized-template.types';

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

interface MutateResponse {
  readonly success: boolean;
  readonly template?: SerializedUserTextTemplate;
  readonly error?: string;
  readonly details?: readonly string[];
  readonly code?: string;
}

interface MutationFailure {
  readonly status: number;
  readonly message: string;
  readonly code?: string;
  readonly details?: readonly string[];
}

export class TemplateMutationError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: readonly string[];
  constructor(failure: MutationFailure) {
    super(failure.message);
    this.name = 'TemplateMutationError';
    this.status = failure.status;
    this.code = failure.code;
    this.details = failure.details;
  }
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

async function parseMutateResponse(res: Response): Promise<MutateResponse> {
  try {
    return (await res.json()) as MutateResponse;
  } catch {
    return { success: false, error: `HTTP ${res.status}` };
  }
}

function failureFromResponse(res: Response, body: MutateResponse): MutationFailure {
  return {
    status: res.status,
    message: body.error ?? `Request failed with status ${res.status}`,
    code: body.code,
    details: body.details,
  };
}

export function useTextTemplateMutations(
  { userTemplates, setUserTemplates }: UseMutationsArgs,
): UseTextTemplateMutationsResult {
  const createTemplate = useCallback(
    async (input: CreateTemplateInput): Promise<TextTemplate> => {
      const snapshot = userTemplates;
      const tempId = optimisticId();
      const optimistic: TextTemplate = {
        id: tempId,
        companyId: '__pending__',
        name: input.name,
        category: input.category,
        content: input.content,
        placeholders: [],
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setUserTemplates([...snapshot, optimistic]);
      try {
        const res = await fetch('/api/dxf/text-templates', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const body = await parseMutateResponse(res);
        if (!res.ok || !body.success || !body.template) {
          throw new TemplateMutationError(failureFromResponse(res, body));
        }
        const persisted = deserializeUserTemplate(body.template);
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
        throw new TemplateMutationError({
          status: 404,
          message: `Template ${id} not found in local list`,
        });
      }
      const existing = snapshot[idx];
      const optimistic: TextTemplate = {
        ...existing,
        name: patch.name ?? existing.name,
        category: patch.category ?? existing.category,
        content: patch.content ?? existing.content,
        updatedAt: new Date(),
      };
      const next = snapshot.slice();
      next[idx] = optimistic;
      setUserTemplates(next);
      try {
        const res = await fetch(`/api/dxf/text-templates/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const body = await parseMutateResponse(res);
        if (!res.ok || !body.success || !body.template) {
          throw new TemplateMutationError(failureFromResponse(res, body));
        }
        const persisted = deserializeUserTemplate(body.template);
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
        const res = await fetch(`/api/dxf/text-templates/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const body = await parseMutateResponse(res);
        if (!res.ok || !body.success) {
          throw new TemplateMutationError(failureFromResponse(res, body));
        }
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
