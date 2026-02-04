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
  AI_ANALYSIS_JSON_SCHEMA,
  AI_ANALYSIS_PROMPTS,
} from '@/config/ai-analysis-config';
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

interface OpenAIRequestBody {
  model: string;
  input: OpenAIRequestMessage[];
  text?: {
    format?: {
      type: 'json_schema';
      json_schema: Record<string, unknown>;
    };
  };
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

    const systemPrompt = input.kind === 'document_classify'
      ? AI_ANALYSIS_PROMPTS.DOCUMENT_CLASSIFY_SYSTEM
      : AI_ANALYSIS_PROMPTS.MESSAGE_INTENT_SYSTEM;

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
          json_schema: AI_ANALYSIS_JSON_SCHEMA,
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
      const parsed = JSON.parse(outputText) as unknown;
      const validated = validateAIAnalysisResult(parsed);
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
