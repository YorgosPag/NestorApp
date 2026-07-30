/**
 * Capability Adapters — Barrel (ADR-734 Φάση 2, στρώμα L3)
 *
 * Ένας ορισμός, πολλοί καταναλωτές. Σήμερα: OpenAI Chat Completions.
 * Φάση 3: MCP (`outputSchema` + `structuredContent`) και REST (`withAuth()`).
 *
 * @module services/agent-capability/adapters
 * @see ADR-734 §5.1
 */

export { toOpenAiToolDefinition, toOpenAiToolDefinitions } from './openai-adapter';
