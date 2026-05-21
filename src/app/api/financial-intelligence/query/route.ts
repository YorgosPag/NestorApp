/**
 * =============================================================================
 * Financial Intelligence Query API — SPEC-242E D3 NL Financial Query
 * =============================================================================
 *
 * POST /api/financial-intelligence/query
 *
 * Accepts a natural language financial question + chat history.
 * Runs a focused 3-iteration tool-calling loop with the 6 financial tools.
 * Returns the AI answer in Greek + optional chart data.
 *
 * @module api/financial-intelligence/query
 * @see ADR-242 SPEC-242E, ADR-171
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { ApiError, apiSuccess, type ApiSuccessResponse } from '@/lib/api/ApiErrorHandler';
import { withHighRateLimit } from '@/lib/middleware/with-rate-limit';
import { AI_ANALYSIS_DEFAULTS } from '@/config/ai-analysis-config';
import { getFinancialQueryToolDefinitions } from '@/services/ai-pipeline/tools/agentic-tool-definitions';
import {
  getPortfolioSummaryForQuery,
  getProjectFinancialDetails,
  getDebtMaturitySchedule,
  getBudgetVarianceForQuery,
  calculateScenarioNPVForQuery,
  compareHedgingStrategiesForQuery,
} from '@/services/ai-pipeline/tools/financial-query-tools';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FinancialQueryRoute');

const MAX_ITERATIONS = 3;
const TIMEOUT_MS = 30_000;

export const dynamic = 'force-dynamic';

// =============================================================================
// TYPES
// =============================================================================

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  message: string;
  history?: ChatHistoryMessage[];
}

interface ChartDataPoint {
  label: string;
  value: number;
}

interface QueryApiData {
  answer: string;
  suggestedChart: 'bar' | 'line' | null;
  chartData: ChartDataPoint[] | null;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const SYSTEM_PROMPT = `Είσαι οικονομικός αναλυτής για ελληνική εταιρεία ανάπτυξης ακινήτων.
Απάντα σε ερωτήσεις σχετικά με το portfolio έργων, δάνεια, κόστη και οικονομικές επιδόσεις.
Πάντα απάντα στα Ελληνικά. Να είσαι συνοπτικός και ακριβής με αριθμούς.
Αν η απάντησή σου περιέχει πολλά συγκρίσιμα δεδομένα κατάλληλα για γράφημα, προσέθεσε στο τέλος JSON σε νέα γραμμή:
CHART:{"type":"bar","data":[{"label":"Όνομα","value":123},...]}
Χρησιμοποίησε "bar" για συγκρίσεις, "line" για χρονοσειρές.`;

// =============================================================================
// TOOL EXECUTION
// =============================================================================

async function executeTool(
  name: string,
  rawArgs: string,
  companyId: string
): Promise<string> {
  const args = safeJsonParse<Record<string, unknown>>(rawArgs, {});

  try {
    switch (name) {
      case 'get_portfolio_summary': {
        const data = await getPortfolioSummaryForQuery(companyId);
        return JSON.stringify(data);
      }
      case 'get_project_financial_details': {
        const projectId = String(args.projectId ?? '');
        const data = await getProjectFinancialDetails(companyId, projectId);
        return JSON.stringify(data ?? { error: 'Project not found' });
      }
      case 'get_debt_maturity_schedule': {
        const entries = await getDebtMaturitySchedule(companyId);
        return JSON.stringify(entries);
      }
      case 'get_budget_variance': {
        const projectId = String(args.projectId ?? '');
        const analysis = await getBudgetVarianceForQuery(projectId);
        return JSON.stringify(analysis ?? { error: 'No data' });
      }
      case 'calculate_scenario_npv': {
        const npv = calculateScenarioNPVForQuery({
          salePrice: Number(args.salePrice ?? 0),
          cashFlows: (args.cashFlows as Array<{ amount: number; date: string }>) ?? [],
          discountRate: Number(args.discountRate ?? 0),
        });
        return JSON.stringify({ npv });
      }
      case 'compare_hedging_strategies': {
        const result = compareHedgingStrategiesForQuery({
          notional: Number(args.notional ?? 0),
          currentRate: Number(args.currentRate ?? 0),
          termYears: Number(args.termYears ?? 1),
        });
        return JSON.stringify(result);
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: String(err) });
  }
}

// =============================================================================
// CHART EXTRACTION
// =============================================================================

function extractChart(text: string): { answer: string; suggestedChart: 'bar' | 'line' | null; chartData: ChartDataPoint[] | null } {
  const chartMarker = '\nCHART:';
  const idx = text.indexOf(chartMarker);

  if (idx === -1) {
    return { answer: text.trim(), suggestedChart: null, chartData: null };
  }

  const answer = text.slice(0, idx).trim();
  const chartJson = text.slice(idx + chartMarker.length).trim();
  const parsed = safeJsonParse<{ type: 'bar' | 'line'; data: ChartDataPoint[] }>(chartJson, null as unknown as { type: 'bar' | 'line'; data: ChartDataPoint[] });

  if (!parsed?.data || !Array.isArray(parsed.data)) {
    return { answer, suggestedChart: null, chartData: null };
  }

  return { answer, suggestedChart: parsed.type ?? 'bar', chartData: parsed.data };
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export const POST = withHighRateLimit(
  withAuth<ApiSuccessResponse<QueryApiData>>(
    async (req: NextRequest, ctx: AuthContext, _cache: PermissionCache) => {
      const body = await req.json() as RequestBody;

      if (!body.message || typeof body.message !== 'string' || body.message.trim().length === 0) {
        throw new ApiError(400, 'message is required');
      }
      if (body.message.length > 1000) {
        throw new ApiError(400, 'message too long (max 1000 chars)');
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new ApiError(500, 'AI not configured');

      const model = AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL;
      const baseUrl = AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL;
      const tools = getFinancialQueryToolDefinitions();

      // Build message history (last 6 entries to control context size)
      const history: OpenAIMessage[] = (body.history ?? [])
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const messages: OpenAIMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: body.message.trim() },
      ];

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        // Tool-calling loop (max 3 iterations)
        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, tools, tool_choice: 'auto' }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new ApiError(502, `AI error (${response.status}): ${errText.slice(0, 200)}`);
          }

          const payload = await response.json() as {
            choices?: Array<{ message: { role: 'assistant'; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }; finish_reason: string }>;
          };

          const choice = payload.choices?.[0];
          if (!choice) throw new ApiError(502, 'Empty AI response');

          messages.push({ role: 'assistant', content: choice.message.content, tool_calls: choice.message.tool_calls });

          // No tool calls or done → extract final answer
          if (!choice.message.tool_calls?.length || choice.finish_reason === 'stop') {
            const finalText = choice.message.content ?? '';
            const result = extractChart(finalText);
            logger.info('Financial query answered', { companyId: ctx.companyId, iter });
            clearTimeout(timeout);
            return apiSuccess<QueryApiData>(result);
          }

          // Execute tool calls and feed results back
          const toolResults = await Promise.all(
            choice.message.tool_calls.map(async tc => ({
              role: 'tool' as const,
              tool_call_id: tc.id,
              content: await executeTool(tc.function.name, tc.function.arguments, ctx.companyId),
            }))
          );
          messages.push(...toolResults);
        }

        // Max iterations reached — return whatever the last assistant said
        const lastMsg = [...messages].reverse().find(m => m.role === 'assistant');
        const fallbackText = (typeof lastMsg?.content === 'string' ? lastMsg.content : '') ?? '';
        clearTimeout(timeout);
        return apiSuccess<QueryApiData>(extractChart(fallbackText));

      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    }
  )
);
