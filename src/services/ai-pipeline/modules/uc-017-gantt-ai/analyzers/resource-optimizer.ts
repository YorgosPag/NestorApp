/**
 * @fileoverview QUALITY-tier resource optimizer for UC-017 (ADR-034 §12)
 * Calls OpenAI to detect resource conflicts and suggest optimal allocation.
 */

import 'server-only';

import { generateText } from 'ai';
import { getOpenAIProvider } from '@/services/ai/openai-provider';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import type { ConstructionTask, ConstructionResourceAssignment } from '@/types/building/construction';
import type { ResourceConflict } from '../gantt-ai-types';

const logger = createModuleLogger('UC_017_RESOURCE_OPTIMIZER');

const SYSTEM_PROMPT = `You are a construction resource planner. Analyze resource assignments for conflicts and overallocation.
Return ONLY valid JSON array:
[{ "resourceName": string, "conflictingTaskIds": string[], "overlappingPeriod": string, "suggestion": string }]
Greek for suggestion and overlappingPeriod. Max 6 conflicts. Focus on workers and equipment assigned to overlapping tasks.`;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Detect resource conflicts and suggest optimizations using OpenAI QUALITY tier.
 * Falls back to empty array on AI failure.
 */
export async function optimizeResources(
  tasks: ConstructionTask[],
  assignments: ConstructionResourceAssignment[]
): Promise<ResourceConflict[]> {
  if (assignments.length === 0) return [];

  try {
    const prompt = buildResourcePrompt(tasks, assignments);
    const openai = getOpenAIProvider();

    const { text } = await generateText({
      model: openai(AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 700,
    });

    return parseResourceResponse(text);
  } catch (error) {
    logger.warn('UC-017 resource optimization failed', { error: getErrorMessage(error) });
    return [];
  }
}

// ─── Internal ────────────────────────────────────────────────────────────────

function buildResourcePrompt(
  tasks: ConstructionTask[],
  assignments: ConstructionResourceAssignment[]
): string {
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  const assignmentLines = assignments.slice(0, 60).map(a => {
    const task = taskMap.get(a.taskId);
    const period = task
      ? `${task.plannedStartDate}→${task.plannedEndDate}`
      : 'unknown';
    return `Resource: "${a.resourceName}" (${a.resourceType}) → task:[${a.taskId}] period:${period} hours:${a.allocatedHours}`;
  }).join('\n');

  return `RESOURCE ASSIGNMENTS:\n${assignmentLines}\n\nIdentify conflicts and suggest optimizations.`;
}

function parseResourceResponse(text: string): ResourceConflict[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const parsed = safeJsonParse<ResourceConflict[]>(jsonMatch[0], []);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(isValidConflict)
    .slice(0, 6);
}

function isValidConflict(item: unknown): item is ResourceConflict {
  if (typeof item !== 'object' || item === null) return false;
  const c = item as Record<string, unknown>;
  return (
    typeof c.resourceName === 'string' &&
    Array.isArray(c.conflictingTaskIds) &&
    typeof c.overlappingPeriod === 'string' &&
    typeof c.suggestion === 'string'
  );
}
