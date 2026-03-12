/**
 * @fileoverview Barrel exports — Firestore Query Service (ADR-214 Phase 1)
 * @description Import everything from `@/services/firestore`
 */

// --- Service (singleton) ---
export { firestoreQueryService } from './firestore-query.service';

// --- Error classes (re-exported, no duplication) ---
export { AuthorizationError, QueryExecutionError } from './firestore-query.service';

// --- Auth context ---
export { requireAuthContext } from './auth-context';

// --- Tenant config ---
export { getTenantConfig, resolveTenantValue } from './tenant-config';

// --- Types ---
export type {
  TenantContext,
  TenantIsolationMode,
  TenantFieldConfig,
  QueryOptions,
  SubscribeOptions,
  CreateOptions,
  UpdateOptions,
  QueryResult,
  IFirestoreQueryService,
} from './firestore-query.types';
