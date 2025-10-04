/**
 * Legacy Pro Snap Engine - Migrated to V2 Architecture
 * This file now only exports the global V2 instance for backward compatibility
 */

// ✅ Global instance for legacy compatibility using V2 system
import { ProSnapEngineV2 } from './ProSnapEngineV2';
export const snapSystem = new ProSnapEngineV2();