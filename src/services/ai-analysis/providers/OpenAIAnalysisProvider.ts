/**
 * =============================================================================
 * OPENAI ANALYSIS PROVIDER
 * =============================================================================
 *
 * Server-only provider for OpenAI Responses API (text + vision).
 */

import 'server-only';

import {
  AI_ANALYSIS_DEFAULTS,
  AI_MULTI_INTENT_SCHEMA,
  AI_DOCUMENT_CLASSIFY_SCHEMA,
  AI_ANALYSIS_PROMPTS,
} from '@/config/ai-analysis-config';
import {
  ADMIN_TOOL_DEFINITIONS,
  ADMIN_TOOL_SYSTEM_PROMPT,
  mapToolCallToAnalysisResult,
  buildConversationalFallbackResult,
} from '@/config/admin-tool-definitions';
import {
  validateAIAnalysisResult,
  type AIAnalysisResult,
  type DocumentClassifyAnalysis,
} from '@/schemas/ai-analysis';
import type {
  AnalysisInput,
  IAIAnalysisProvider,
  ProviderOptions,
} from './IAIAnalysisProvider';

type OpenAIRequestContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_file'; filename: string; file_data: string };

type OpenAIRequestMessage = {
  role: 'system' | 'user';
  content: OpenAIRequestContent[];
};

interface OpenAIResponsesFormat {
  type: 'json_schema';
  name: string;
  description?: string;
  strict?: boolean;
  schema: Record<string, unknown>;
}

interface OpenAIRequestBody {
  model: string;
  input: OpenAIRequestMessage[];
  text?: {
    format?: OpenAIResponsesFormat;
  };
  tools?: ReadonlyArray<{
    type: 'function';
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    strict: boolean;
  }>;
  tool_choice?: 'auto' | 'none' | 'required';
}

interface OpenAIProviderConfig {
  apiKey: string;
  baseUrl: string;
  textModel: string;
  visionModel: string;
  timeoutMs: number;
  maxRetries: number;
}

interface OpenAIErrorPayload {
  error?: {
    message?: string;
    type?: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractOutputText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const outputText = payload.output_text;
  if (typeof outputText === 'string' && outputText.trim().length > 0) {
    return outputText.trim();
  }

  const output = payload.output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!isRecord(item)) continue;
    if (item.type !== 'message') continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;

    for (const entry of content) {
      if (!isRecord(entry)) continue;
      if (entry.type !== 'output_text') continue;
      const text = entry.text;
      if (typeof text === 'string' && text.trim().length > 0) {
        return text.trim();
      }
    }
  }

  return null;
}

function buildFallbackResult(input: AnalysisInput, model: string): AIAnalysisResult {
  const timestamp = new Date().toISOString();

  if (input.kind === 'message_intent') {
    return {
      kind: 'message_intent',
      aiModel: model,
      analysisTimestamp: timestamp,
      confidence: AI_ANALYSIS_DEFAULTS.FALLBACK_CONFIDENCE,
      needsTriage: AI_ANALYSIS_DEFAULTS.FALLBACK_NEEDS_TRIAGE,
      extractedEntities: {},
      intentType: AI_ANALYSIS_DEFAULTS.FALLBACK_INTENT,
      rawMessage: input.messageText,
    };
  }

  return {
    kind: 'document_classify',
    aiModel: model,
    analysisTimestamp: timestamp,
    confidence: AI_ANALYSIS_DEFAULTS.FALLBACK_CONFIDENCE,
    needsTriage: AI_ANALYSIS_DEFAULTS.FALLBACK_NEEDS_TRIAGE,
    extractedEntities: {},
    documentType: AI_ANALYSIS_DEFAULTS.FALLBACK_DOCUMENT,
  };
}

function buildMessageIntentPrompt(input: AnalysisInput): string {
  if (input.kind !== 'message_intent') return '';

  const context = input.context
    ? `Context: ${JSON.stringify(input.context)}`
    : 'Context: {}';

  return [
    'Return JSON only using the schema.',
    `Message: ${input.messageText}`,
    context,
  ].join('\n');
}

function buildDocumentPrompt(input: AnalysisInput): string {
  if (input.kind !== 'document_classify') return '';

  const filename = input.filename ? `Filename: ${input.filename}` : 'Filename: unknown';
  const mimeType = input.mimeType ? `MIME: ${input.mimeType}` : 'MIME: unknown';
  const sizeBytes = input.sizeBytes ? `Size: ${input.sizeBytes} bytes` : 'Size: unknown';

  return [
    'Return JSON only using the schema.',
    filename,
    mimeType,
    sizeBytes,
    typeof input.content === 'string' ? `Text: ${input.content}` : 'Binary content provided.',
  ].join('\n');
}

function detectImageMime(mimeType?: string): boolean {
  return Boolean(mimeType && mimeType.startsWith('image/'));
}

function buildFileDataBuffer(buffer: Buffer, mimeType?: string): string {
  const base64 = buffer.toString('base64');
  if (!mimeType) {
    return base64;
  }
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Strip null values from an object recursively.
 * OpenAI strict mode returns null for optional fields.
 * Zod schemas expect those fields to be omitted instead.
 */
function stripNullValues(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null) continue;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = stripNullValues(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function shouldRetryWithoutStructuredOutput(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('json_schema') ||
    message.includes('response_format') ||
    message.includes('text.format')
  );
}

export class OpenAIAnalysisProvider implements IAIAnalysisProvider {
  readonly name = 'openai-provider';
  readonly version: string;

  private readonly config: OpenAIProviderConfig;

  constructor(config: OpenAIProviderConfig) {
    this.config = config;
    this.version = config.textModel;
  }

  async analyze(input: AnalysisInput, options?: ProviderOptions): Promise<AIAnalysisResult> {
    const model = input.kind === 'document_classify'
      ? this.config.visionModel
      : this.config.textModel;

    const prompt = input.kind === 'document_classify'
      ? buildDocumentPrompt(input)
      : buildMessageIntentPrompt(input);

    // ADR-145: Use admin-specific prompt when sender is a verified super admin
    const isAdminCommand = input.kind === 'message_intent' && input.context?.isAdminCommand === true;
    const systemPrompt = input.kind === 'document_classify'
      ? AI_ANALYSIS_PROMPTS.DOCUMENT_CLASSIFY_SYSTEM
      : AI_ANALYSIS_PROMPTS.MULTI_INTENT_SYSTEM;

    const content: OpenAIRequestContent[] = [
      { type: 'input_text', text: prompt },
    ];

    if (input.kind === 'document_classify' && Buffer.isBuffer(input.content)) {
      if (detectImageMime(input.mimeType)) {
        content.push({
          type: 'input_image',
          image_url: buildFileDataBuffer(input.content, input.mimeType),
        });
      } else {
        content.push({
          type: 'input_file',
          filename: input.filename || 'document',
          file_data: input.content.toString('base64'),
        });
      }
    }

    // ── ADR-145: Admin commands use tool calling (function calling) ──
    // AI selects the appropriate tool and extracts ALL params semantically.
    // Conversational replies come as plain text (no tool call → no 2nd API call).
    if (isAdminCommand) {
      const toolRequest: OpenAIRequestBody = {
        model,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: ADMIN_TOOL_SYSTEM_PROMPT }],
          },
          {
            role: 'user',
            content,
          },
        ],
        tools: ADMIN_TOOL_DEFINITIONS,
        tool_choice: 'auto',
      };

      let toolResponsePayload: unknown;
      try {
        toolResponsePayload = await this.executeRequest(toolRequest, options);
      } catch (error) {
        // If tool calling fails, fall back to structured output
        if (error instanceof Error) {
          const fallbackResult = buildFallbackResult(input, model);
          return fallbackResult;
        }
        throw error;
      }

      // Extract function_call items from response.output
      const outputArray = isRecord(toolResponsePayload)
        && Array.isArray((toolResponsePayload as Record<string, unknown>).output)
        ? (toolResponsePayload as Record<string, unknown>).output as Array<Record<string, unknown>>
        : [];

      const functionCalls = outputArray.filter(
        (item) => isRecord(item) && item.type === 'function_call'
      );

      if (functionCalls.length > 0) {
        // AI called a tool — map to pipeline result
        return mapToolCallToAnalysisResult(
          functionCalls[0] as { type: string; name?: string; call_id?: string; arguments?: string },
          model
        );
      }

      // No tool called → conversational reply (text output)
      const textReply = extractOutputText(toolResponsePayload);
      if (textReply) {
        return buildConversationalFallbackResult(textReply, model);
      }

      return buildFallbackResult(input, model);
    }

    // ── Non-admin: structured output with JSON schema ──
    const jsonSchema = input.kind === 'document_classify'
      ? AI_DOCUMENT_CLASSIFY_SCHEMA
      : AI_MULTI_INTENT_SCHEMA;

    // Responses API: name/strict/schema go directly in format (NOT nested in json_schema)
    const request: OpenAIRequestBody = {
      model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }],
        },
        {
          role: 'user',
          content,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: jsonSchema.name,
          description: jsonSchema.description,
          strict: jsonSchema.strict,
          schema: jsonSchema.schema,
        },
      },
    };

    let responsePayload: unknown;

    try {
      responsePayload = await this.executeRequest(request, options);
    } catch (error) {
      if (!shouldRetryWithoutStructuredOutput(error)) {
        throw error;
      }

      const fallbackRequest: OpenAIRequestBody = {
        ...request,
        text: undefined,
      };
      responsePayload = await this.executeRequest(fallbackRequest, options);
    }
    const outputText = extractOutputText(responsePayload);

    if (!outputText) {
      return buildFallbackResult(input, model);
    }

    try {
      const parsed = JSON.parse(outputText) as Record<string, unknown>;
      // OpenAI strict mode returns null for optional fields — strip them
      // so Zod .optional() validation passes cleanly
      const normalized = stripNullValues(parsed);
      const validated = validateAIAnalysisResult(normalized);
      return validated;
    } catch {
      return buildFallbackResult(input, model);
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config.apiKey) return false;

    try {
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async executeRequest(
    request: OpenAIRequestBody,
    options?: ProviderOptions
  ): Promise<unknown> {
    const timeoutMs = options?.timeoutMs ?? this.config.timeoutMs;
    const maxRetries = options?.maxRetries ?? this.config.maxRetries;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${this.config.baseUrl}/responses`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => ({}))) as OpenAIErrorPayload;
          const message = errorPayload.error?.message || `OpenAI error (${response.status})`;
          throw new Error(message);
        }

        return await response.json();
      } catch (error) {
        if (attempt >= maxRetries) {
          throw error;
        }
        attempt += 1;
      }
    }

    throw new Error('OpenAI request failed');
  }
}

export function createOpenAIProvider(): IAIAnalysisProvider | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const config: OpenAIProviderConfig = {
    apiKey,
    baseUrl: AI_ANALYSIS_DEFAULTS.OPENAI.BASE_URL,
    textModel: AI_ANALYSIS_DEFAULTS.OPENAI.TEXT_MODEL,
    visionModel: AI_ANALYSIS_DEFAULTS.OPENAI.VISION_MODEL,
    timeoutMs: AI_ANALYSIS_DEFAULTS.OPENAI.TIMEOUT_MS,
    maxRetries: AI_ANALYSIS_DEFAULTS.OPENAI.MAX_RETRIES,
  };

  return new OpenAIAnalysisProvider(config);
}

export function normalizeDocumentAnalysis(
  result: AIAnalysisResult
): DocumentClassifyAnalysis | null {
  if (result.kind !== 'document_classify') return null;
  return result;
}
