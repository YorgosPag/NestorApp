/**
 * ENTERPRISE ID TYPES — the shapes of a generated id and of the generator config.
 *
 * Split from `enterprise-id-prefixes.ts` (N.7.1 SRP): that module is the prefix
 * DATA; this one holds the TYPES that describe what the generator produces.
 * `EnterpriseIdPrefix` stays beside the constant because it is DERIVED from it.
 */

import type { EnterpriseIdPrefix } from './enterprise-id-prefixes';

/** Enterprise ID interface for type safety */
export interface EnterpriseId {
  readonly id: string;
  readonly prefix: EnterpriseIdPrefix;
  readonly uuid: string;
  readonly timestamp: number;
}

/** ID generation configuration */
export interface IdGenerationConfig {
  maxRetries: number;
  enableLogging: boolean;
  enableCache: boolean;
  cacheSize: number;
}
