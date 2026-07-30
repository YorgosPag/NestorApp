/**
 * Capability Adapters — Barrel (στρώμα L3)
 *
 * Ένας ορισμός, πολλοί καταναλωτές: **OpenAI** Chat Completions (in-app
 * πράκτορας, Φάση 2) και **MCP** `Tool`/`CallToolResult` (εξωτερικοί clients,
 * Φάση 3). Καμία από τις δύο μορφές δεν συντηρεί δικό της ορισμό εργαλείου —
 * και οι δύο παράγονται από το registry (ADR-734 §5.2).
 *
 * @module services/agent-capability/adapters
 * @see ADR-734 §5.1
 */

export { toOpenAiToolDefinition, toOpenAiToolDefinitions } from './openai-adapter';
export { toMcpCallToolResult, toMcpTool, toMcpTools } from './mcp-adapter';
export { MCP_PROTOCOL_VERSION } from './mcp-protocol-types';
export type {
  McpCallToolResult,
  McpTextContent,
  McpTool,
  McpToolAnnotations,
} from './mcp-protocol-types';
