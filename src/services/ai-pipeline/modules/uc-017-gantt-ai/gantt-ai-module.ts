/**
 * =============================================================================
 * UC-017: GANTT AI MODULE — ADR-034 §12
 * =============================================================================
 *
 * AI integration for the Gantt Construction Chart. Routes to 6 AI features:
 *   FAST  — delay_prediction, natural_language (heuristic, no AI call)
 *   QUALITY — risk_assessment, auto_scheduling, resource_optimization (OpenAI)
 *   VISION  — photo_progress (OpenAI Vision)
 *
 * @module services/ai-pipeline/modules/uc-017-gantt-ai
 * @see ADR-034 §12 (UC-017 specification)
 */

import 'server-only';

import { PIPELINE_PROTOCOL_CONFIG } from '@/config/ai-pipeline-config';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { sendChannelReply, extractChannelIds } from '../../shared/channel-reply-dispatcher';
import { PipelineIntentType } from '@/types/ai-pipeline';
import type {
  IUCModule,
  PipelineContext,
  Proposal,
  ExecutionResult,
  AcknowledgmentResult,
  PipelineIntentTypeValue,
} from '@/types/ai-pipeline';

import type { GanttAIFeature, GanttAILookupData } from './gantt-ai-types';
import { fetchGanttScheduleData } from './gantt-data-fetcher';
import { predictDelays } from './analyzers/delay-predictor';
import { handleNLQuery } from './analyzers/nl-query-handler';
import { assessRisks } from './analyzers/risk-assessor';
import { autoSchedule } from './analyzers/auto-scheduler';
import { optimizeResources } from './analyzers/resource-optimizer';
import { analyzePhotoProgress } from './analyzers/photo-progress-analyzer';
import { formatGanttAIReply, buildGanttAISummary } from './gantt-ai-formatter';

const logger = createModuleLogger('UC_017_GANTT_AI');

// ─── Feature Detection ───────────────────────────────────────────────────────

const FEATURE_PATTERNS: Array<{ patterns: string[]; feature: GanttAIFeature }> = [
  { feature: 'delay_prediction',     patterns: ['πρόβλεψη', 'καθυστέρηση', 'θα καθυστερήσει', 'delay'] },
  { feature: 'risk_assessment',      patterns: ['ρίσκο', 'κίνδυνο', 'risk', 'επικίνδυν'] },
  { feature: 'auto_scheduling',      patterns: ['χρονοδρομολόγ', 'βέλτιστη σειρά', 'schedule', 'προγραμματισμό'] },
  { feature: 'resource_optimization',patterns: ['πόρ', 'εργατικ', 'resource', 'βελτιστοποίηση'] },
  { feature: 'photo_progress',       patterns: ['φωτογραφ', 'photo', 'εικόνα', 'site photo'] },
];

function detectFeature(
  contentText: string,
  entities: Record<string, string | undefined>
): GanttAIFeature {
  if (entities.ganttFeature) return entities.ganttFeature as GanttAIFeature;

  const normalized = contentText.toLowerCase();
  for (const { patterns, feature } of FEATURE_PATTERNS) {
    if (patterns.some(p => normalized.includes(p))) return feature;
  }
  return 'natural_language';
}

// ─── Module ──────────────────────────────────────────────────────────────────

export class GanttAIModule implements IUCModule {
  readonly moduleId = 'UC-017';
  readonly displayName = 'Gantt AI: Έλεγχος Κατασκευής';
  readonly handledIntents: readonly PipelineIntentTypeValue[] = [
    PipelineIntentType.ADMIN_GANTT_AI,
  ];
  readonly requiredRoles: readonly string[] = [];

  // ── Step 3: LOOKUP ──

  async lookup(ctx: PipelineContext): Promise<Record<string, unknown>> {
    const entities = ctx.understanding?.entities ?? {};
    const contentText = ctx.intake.normalized.contentText;
    const feature = detectFeature(contentText, entities);
    const buildingId = (entities.buildingId as string) ?? null;
    const photoUrls = parsePhotoUrls(ctx);

    logger.info('UC-017 LOOKUP', {
      requestId: ctx.requestId,
      feature,
      buildingId: buildingId ?? '(company-wide)',
    });

    const data: GanttAILookupData = {
      feature,
      buildingId,
      companyId: ctx.companyId,
      phases: [],
      tasks: [],
      resourceAssignments: [],
      nlQuery: contentText,
      photoUrls,
      delayPredictions: [],
      risks: [],
      scheduleSuggestions: [],
      resourceConflicts: [],
      nlResult: null,
      photoResult: null,
      analyzerError: null,
    };

    try {
      if (feature !== 'photo_progress') {
        const schedule = await fetchGanttScheduleData(ctx.companyId, buildingId, ctx.requestId);
        data.phases = schedule.phases;
        data.tasks = schedule.tasks;
        data.resourceAssignments = schedule.resourceAssignments;
      }

      await runAnalyzer(feature, data);
    } catch (error) {
      data.analyzerError = getErrorMessage(error);
      logger.error('UC-017 LOOKUP: analyzer failed', {
        requestId: ctx.requestId,
        feature,
        error: data.analyzerError,
      });
    }

    return data as unknown as Record<string, unknown>;
  }

  // ── Step 4: PROPOSE ──

  async propose(ctx: PipelineContext): Promise<Proposal> {
    const data = ctx.lookupData as unknown as GanttAILookupData | undefined;
    const summary = data ? buildGanttAISummary(data) : 'Gantt AI ανάλυση';

    return {
      messageId: ctx.intake.id,
      suggestedActions: [
        {
          type: 'gantt_ai_reply',
          params: {
            lookupData: data ?? null,
            channel: ctx.intake.channel,
            telegramChatId: (ctx.intake.rawPayload.chatId as string) ?? null,
          },
        },
      ],
      requiredApprovals: [],
      autoApprovable: true,
      summary,
      schemaVersion: PIPELINE_PROTOCOL_CONFIG.SCHEMA_VERSION,
    };
  }

  // ── Step 6: EXECUTE ──

  async execute(ctx: PipelineContext): Promise<ExecutionResult> {
    try {
      const actions = ctx.approval?.modifiedActions ?? ctx.proposal?.suggestedActions ?? [];
      const action = actions.find(a => a.type === 'gantt_ai_reply');

      if (!action) {
        return { success: false, sideEffects: [], error: 'No gantt_ai_reply action found' };
      }

      const data = action.params.lookupData as GanttAILookupData | null;
      const replyText = data ? formatGanttAIReply(data) : '❌ Δεν βρέθηκαν δεδομένα Gantt.';

      const replyResult = await sendChannelReply({
        channel: ctx.intake.channel,
        ...extractChannelIds(ctx),
        subject: `Gantt AI: ${data?.feature ?? 'ανάλυση'}`,
        textBody: replyText,
        requestId: ctx.requestId,
      });

      return {
        success: true,
        sideEffects: replyResult.success
          ? [`reply_sent:${replyResult.messageId ?? 'unknown'}`]
          : [`reply_failed:${replyResult.error ?? 'unknown'}`],
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('UC-017 EXECUTE: Failed', { requestId: ctx.requestId, error: errorMessage });
      return { success: false, sideEffects: [], error: errorMessage };
    }
  }

  // ── Step 7: ACKNOWLEDGE ──

  async acknowledge(ctx: PipelineContext): Promise<AcknowledgmentResult> {
    const replySent = ctx.executionResult?.sideEffects?.some(
      (se: string) => se.startsWith('reply_sent:')
    ) ?? false;
    return { sent: replySent, channel: ctx.intake.channel };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

// ─── Analyzer Router ─────────────────────────────────────────────────────────

async function runAnalyzer(feature: GanttAIFeature, data: GanttAILookupData): Promise<void> {
  switch (feature) {
    case 'delay_prediction':
      data.delayPredictions = predictDelays(data.phases, data.tasks);
      break;

    case 'natural_language':
      data.nlResult = handleNLQuery(data.nlQuery ?? '', data.phases, data.tasks);
      break;

    case 'risk_assessment':
      data.risks = await assessRisks(data.phases, data.tasks);
      break;

    case 'auto_scheduling':
      data.scheduleSuggestions = await autoSchedule(data.phases, data.tasks);
      break;

    case 'resource_optimization':
      data.resourceConflicts = await optimizeResources(data.tasks, data.resourceAssignments);
      break;

    case 'photo_progress':
      data.photoResult = await analyzePhotoProgress(data.photoUrls);
      break;
  }
}

function parsePhotoUrls(ctx: PipelineContext): string[] {
  const attachments = ctx.intake.normalized.attachments ?? [];
  return attachments
    .filter(a => a.contentType.startsWith('image/') && a.storageUrl)
    .map(a => a.storageUrl!)
    .filter(url => url.startsWith('https://'));
}
