/**
 * @fileoverview QUALITY-tier risk assessor for UC-017 (ADR-034 §12)
 * Calls OpenAI to identify critical path risks, blocked dependencies,
 * resource conflicts, and schedule overruns.
 */

import 'server-only';

import { generateText } from 'ai';
import { getOpenAIProvider } from '@/services/ai/openai-provider';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import type { RiskItem } from '../gantt-ai-types';

const logger = createModuleLogger('UC_017_RISK_ASSESSOR');

const SYSTEM_PROMPT = `You are a construction project risk analyst. Analyze the given schedule data and return ONLY valid JSON.
Return an array of risk items with this exact schema:
[{ "type": "overdue_task"|"blocked_dependency"|"resource_conflict"|"critical_path", "description": string, "affectedPhaseIds": string[], "severity": "low"|"medium"|"high"|"critical", "recommendation": string }]
Greek language for description and recommendation. Max 8 items. If no risks, return [].`;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Assess schedule risks using OpenAI QUALITY tier.
 * Falls back to empty array on AI failure.
 */
export async function assessRisks(
  phases: ConstructionPhase[],
  tasks: ConstructionTask[]
): Promise<RiskItem[]> {
  if (phases.length === 0) return [];

  try {
    const prompt = buildRiskPrompt(phases, tasks);
    const openai = getOpenAIProvider();

    const { text } = await generateText({
      model: openai(AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 800,
    });

    return parseRiskResponse(text, phases);
  } catch (error) {
    logger.warn('UC-017 risk assessment failed', { error: getErrorMessage(error) });
    return [];
  }
}

// ─── Internal ────────────────────────────────────────────────────────────────

function buildRiskPrompt(phases: ConstructionPhase[], tasks: ConstructionTask[]): string {
  const phaseSummary = phases.map(p =>
    `[${p.id}] ${p.name}: status=${p.status}, progress=${p.progress}%, ` +
    `planned=${p.plannedStartDate}→${p.plannedEndDate}` +
    (p.delayReason ? `, delayReason=${p.delayReason}` : '')
  ).join('\n');

  const taskSummary = tasks.slice(0, 50).map(t =>
    `[${t.id}] ${t.name} (phase:${t.phaseId}): status=${t.status}, progress=${t.progress}%` +
    (t.dependencies?.length ? `, deps=[${t.dependencies.join(',')}]` : '')
  ).join('\n');

  return `PHASES:\n${phaseSummary}\n\nTASKS (first 50):\n${taskSummary}\n\nIdentify all schedule risks.`;
}

function parseRiskResponse(text: string, phases: ConstructionPhase[]): RiskItem[] {
  const validPhaseIds = new Set(phases.map(p => p.id));

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const parsed = safeJsonParse<RiskItem[]>(jsonMatch[0], []);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(item => isValidRiskItem(item))
    .map(item => ({
      ...item,
      affectedPhaseIds: item.affectedPhaseIds.filter(id => validPhaseIds.has(id)),
    }))
    .slice(0, 8);
}

function isValidRiskItem(item: unknown): item is RiskItem {
  if (typeof item !== 'object' || item === null) return false;
  const r = item as Record<string, unknown>;
  return (
    typeof r.type === 'string' &&
    typeof r.description === 'string' &&
    typeof r.severity === 'string' &&
    typeof r.recommendation === 'string' &&
    Array.isArray(r.affectedPhaseIds)
  );
}
