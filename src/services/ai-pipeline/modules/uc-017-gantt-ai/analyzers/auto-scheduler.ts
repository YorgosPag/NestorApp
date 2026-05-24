/**
 * @fileoverview QUALITY-tier auto-scheduler for UC-017 (ADR-034 §12)
 * Calls OpenAI to suggest optimal task sequencing based on dependencies,
 * statuses, and resource constraints.
 */

import 'server-only';

import { generateText } from 'ai';
import { getOpenAIProvider } from '@/services/ai/openai-provider';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import type { ScheduleSuggestion } from '../gantt-ai-types';

const logger = createModuleLogger('UC_017_AUTO_SCHEDULER');

const SYSTEM_PROMPT = `You are a construction project scheduler. Given the current schedule and dependencies, suggest the optimal task sequencing.
Return ONLY valid JSON array:
[{ "taskId": string, "taskName": string, "suggestedStartDate": "YYYY-MM-DD", "suggestedEndDate": "YYYY-MM-DD", "rationale": string, "priority": number }]
Priority 1 = highest. Greek for rationale. Max 10 suggestions. Focus on tasks that are delayed, blocked, or have unresolved dependencies.`;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate auto-scheduling suggestions using OpenAI QUALITY tier.
 * Falls back to empty array on AI failure.
 */
export async function autoSchedule(
  phases: ConstructionPhase[],
  tasks: ConstructionTask[]
): Promise<ScheduleSuggestion[]> {
  const actionableTasks = tasks.filter(t => t.status !== 'completed');
  if (actionableTasks.length === 0) return [];

  try {
    const prompt = buildSchedulePrompt(phases, actionableTasks);
    const openai = getOpenAIProvider();

    const { text } = await generateText({
      model: openai(AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 1000,
    });

    return parseScheduleResponse(text, actionableTasks);
  } catch (error) {
    logger.warn('UC-017 auto-schedule failed', { error: getErrorMessage(error) });
    return [];
  }
}

// ─── Internal ────────────────────────────────────────────────────────────────

function buildSchedulePrompt(phases: ConstructionPhase[], tasks: ConstructionTask[]): string {
  const phaseMap = new Map(phases.map(p => [p.id, p.name]));
  const today = nowISO().slice(0, 10);

  const taskLines = tasks.slice(0, 40).map(t =>
    `[${t.id}] "${t.name}" (phase:${phaseMap.get(t.phaseId) ?? t.phaseId}) ` +
    `status=${t.status} progress=${t.progress}% ` +
    `planned=${t.plannedStartDate}→${t.plannedEndDate}` +
    (t.dependencies?.length ? ` deps=[${t.dependencies.join(',')}]` : '')
  ).join('\n');

  return `TODAY: ${today}\n\nTASKS:\n${taskLines}\n\nSuggest optimal scheduling for non-completed tasks.`;
}

function parseScheduleResponse(text: string, tasks: ConstructionTask[]): ScheduleSuggestion[] {
  const validTaskIds = new Set(tasks.map(t => t.id));

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const parsed = safeJsonParse<ScheduleSuggestion[]>(jsonMatch[0]);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(item => isValidSuggestion(item) && validTaskIds.has(item.taskId))
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .slice(0, 10);
}

function isValidSuggestion(item: unknown): item is ScheduleSuggestion {
  if (typeof item !== 'object' || item === null) return false;
  const s = item as Record<string, unknown>;
  return (
    typeof s.taskId === 'string' &&
    typeof s.taskName === 'string' &&
    typeof s.suggestedStartDate === 'string' &&
    typeof s.suggestedEndDate === 'string' &&
    typeof s.rationale === 'string' &&
    typeof s.priority === 'number'
  );
}
