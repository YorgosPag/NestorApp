'use client';

/**
 * ADR-581 §12 — Optional AI intent hook for «Αντιγραφή Ιδιοτήτων» (flag-gated).
 *
 * When `USE_AI_MATCH_PROPERTIES` is OFF this returns a disabled no-op — the
 * deterministic dialog works exactly as before, zero AI code paths run.
 *
 * When ON, `planIntent(message)` POSTs the NL instruction + the currently offered
 * roles to `/api/dxf-ai/match`, and maps the validated intent (role strings only,
 * ADR-185) into a `Set<SemanticRole>` for the deterministic checklist. Client
 * re-validates defensively before touching the applier.
 */

import { useCallback, useState } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import { USE_AI_MATCH_PROPERTIES } from '../../config/feature-flags';
import type { SemanticRole } from '../../systems/match-properties';
import {
  computeSelectedRolesFromIntent,
  matchIntentSchema,
  type MatchAiRequest,
  type MatchAiResponse,
} from '../../ai-assistant/match-tool-definitions';

export interface MatchAiContext {
  readonly offeredRoles: readonly SemanticRole[];
  readonly sourceType: string | null;
  readonly targetTypes: readonly string[];
}

export interface UseMatchAiResult {
  readonly enabled: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  /** Resolves to the selected-role set, or `null` on failure. */
  readonly planIntent: (message: string, ctx: MatchAiContext) => Promise<Set<SemanticRole> | null>;
}

export function useMatchAi(): UseMatchAiResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planIntent = useCallback(
    async (message: string, ctx: MatchAiContext): Promise<Set<SemanticRole> | null> => {
      if (!USE_AI_MATCH_PROPERTIES) return null;
      const trimmed = message.trim();
      if (trimmed.length === 0 || ctx.offeredRoles.length === 0) return null;

      setLoading(true);
      setError(null);
      try {
        const payload: MatchAiRequest = {
          message: trimmed,
          offeredRoles: ctx.offeredRoles as string[],
          sourceType: ctx.sourceType,
          targetTypes: ctx.targetTypes,
        };
        const res = await fetch(API_ROUTES.DXF_AI.MATCH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }
        const data = (await res.json()) as MatchAiResponse;
        // Defence in depth: the route already validated, but never trust the wire.
        const parsed = matchIntentSchema.safeParse(data.intent);
        if (!parsed.success) throw new Error('Invalid AI plan');
        return computeSelectedRolesFromIntent(ctx.offeredRoles as string[], parsed.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AI request failed');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { enabled: USE_AI_MATCH_PROPERTIES, loading, error, planIntent };
}
