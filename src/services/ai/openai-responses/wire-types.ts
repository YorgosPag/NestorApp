/**
 * =============================================================================
 * OPENAI RESPONSES API — WIRE PROTOCOL TYPES (SSoT)
 * =============================================================================
 *
 * The `/responses` request/response shapes, declared once. Before this module
 * the same five interfaces were re-declared verbatim in three clients
 * (accounting document analyzer, procurement quote analyzer, ai-analysis
 * provider) — a wire protocol that drifts per-copy is a production incident
 * waiting for the next OpenAI API change.
 *
 * This module is **client-safe**: types only, zero runtime, zero imports.
 * Chat Completions (`/chat/completions`) is a DIFFERENT protocol and does not
 * belong here — see `services/ai-pipeline/agentic-openai-client.ts`.
 *
 * @module services/ai/openai-responses/wire-types
 * @see ADR-294 — SSoT Ratchet (module `openai-provider`)
 * @see ADR-373 §D5 — AI Auto-Fill Architecture
 */

/** One content part of a Responses-API message. */
export type ResponsesContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail?: ResponsesImageDetail }
  | { type: 'input_file'; filename: string; file_data: string };

/**
 * How much of an image the model sees (and bills). `original` keeps the full
 * resolution on the patch-based families that support it; small print on a
 * scanned drawing is unreadable at `high` (ADR-929 Φ3).
 */
export type ResponsesImageDetail = 'low' | 'high' | 'original' | 'auto';

/** Reasoning budget of the reasoning-capable families; `none` disables it where supported. */
export type ResponsesReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high';

export interface ResponsesMessage {
  role: 'system' | 'user';
  content: ResponsesContent[];
}

/**
 * Structured-output format. Responses API takes `name`/`strict`/`schema`
 * directly in `format` — NOT nested inside a `json_schema` key the way the
 * Chat Completions API does.
 */
export interface ResponsesJsonSchemaFormat {
  type: 'json_schema';
  name: string;
  description?: string;
  strict?: boolean;
  schema: Record<string, unknown>;
}

/** Function-tool declaration (ADR-145 admin tool calling). */
export interface ResponsesTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: boolean;
}

export interface ResponsesRequestBody {
  model: string;
  input: ResponsesMessage[];
  text?: {
    format?: ResponsesJsonSchemaFormat;
  };
  tools?: ReadonlyArray<ResponsesTool>;
  tool_choice?: 'auto' | 'none' | 'required';
  reasoning?: { effort: ResponsesReasoningEffort };
}

export interface ResponsesErrorPayload {
  error?: {
    message?: string;
    type?: string;
  };
}
