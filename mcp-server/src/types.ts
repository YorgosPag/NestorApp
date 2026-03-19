/**
 * MCP Firestore Server — Type Definitions
 *
 * Enterprise types for the custom MCP server.
 * Zero `any`, zero `@ts-ignore`.
 */

// ============================================================================
// CREDENTIAL TYPES
// ============================================================================

export interface ServiceAccountCredential {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export type CredentialSource = 'B64' | 'JSON' | 'FILE' | 'ADC' | 'NONE';

// ============================================================================
// QUERY TYPES
// ============================================================================

export type FirestoreOperator =
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'in'
  | 'not-in'
  | 'array-contains'
  | 'array-contains-any';

export interface QueryFilter {
  field: string;
  operator: FirestoreOperator;
  value: string | number | boolean | string[] | number[] | (string | number)[];
}

export interface QueryOrderBy {
  field: string;
  direction: 'asc' | 'desc';
}

// ============================================================================
// ACCESS CONTROL TYPES
// ============================================================================

export type OperationType = 'read' | 'write' | 'delete';

export interface AccessDecision {
  allowed: boolean;
  reason: string;
}

// ============================================================================
// AUDIT TYPES
// ============================================================================

export interface AuditEntry {
  ts: string;
  op: string;
  collection: string;
  documentId?: string;
  path?: string;
  filters?: QueryFilter[];
  fieldsChanged?: string[];
  resultCount?: number;
  ms: number;
  blocked?: boolean;
  reason?: string;
}

// ============================================================================
// STORAGE ACCESS CONTROL TYPES
// ============================================================================

export type StorageOperation = 'read' | 'write' | 'delete';

export interface StorageAccessDecision {
  allowed: boolean;
  reason: string;
}

// ============================================================================
// TOOL RESULT TYPE
// ============================================================================

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// ============================================================================
// SCHEMA TYPES (mirrors firestore-schema-map.ts)
// ============================================================================

export interface CollectionSchema {
  description: string;
  fields: Record<string, string>;
  relationships?: Record<string, string>;
}
