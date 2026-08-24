/**
 * @module hooks
 * @description Centralized hooks exports for DXF Viewer
 */

// ============================================================================
// EXTRACTED HOOKS (from EnterpriseDxfSettingsProvider)
// ============================================================================

// Line Settings Hooks - Centralized Factory (ADR-044)
export {
  useLineSettingsByMode,
  type LineSettingsMode,
  type UseLineSettingsReturn,
} from './useLineSettingsByMode';

// Line Settings Hooks - Legacy Wrappers (backward compatible)
export { useLineDraftSettings } from './useLineDraftSettings';
export { useLineHoverSettings } from './useLineHoverSettings';
export { useLineSelectionSettings } from './useLineSelectionSettings';
export { useLineCompletionSettings } from './useLineCompletionSettings';

// Text Settings Hooks
export { useTextDraftSettings } from './useTextDraftSettings';

// Grip Settings Hooks
export { useGripDraftSettings } from './useGripDraftSettings';

// ============================================================================
// 🏢 ENTERPRISE (2026-01-25): Movement & Selection Hooks
// Phase 1 & 2 of HYBRID_LAYER_MOVEMENT_ARCHITECTURE
// ============================================================================

// Entity Movement Hook (Phase 1)
export { useMoveEntities, useMoveEntity, type UseMoveEntitiesReturn, type MoveOptions } from './useMoveEntities';

// Enhanced Selection Hook (Phase 2)
export { useEnhancedSelection, useSelectAll, type UseEnhancedSelectionReturn } from './useEnhancedSelection';

// ADR-364 §10.5 (2026-07-25): useEntityDrag + useMovementOperations ΔΙΑΓΡΑΦΗΚΑΝ.
// Ήταν barrel-only exports (κανένας πραγματικός καταναλωτής, μηδέν tests) με δικό τους
// window ESC listener — δηλαδή νεκρός κώδικας που φούσκωνε την επιφάνεια του Escape.
// Διάδοχος για το body-drag: systems/drag/EntityBodyDragStore.ts, σωστά στον escape-bus
// (ESC_PRIORITY.BODY_DRAG). Το NUDGE_CONFIG ζει τοπικά στο useKeyboardShortcuts.ts.

// ADR-700 §4 (2026-08-24): useGripMovement/useGripDrag (Grip Movement Hook, Phase 4)
// ΔΙΑΓΡΑΦΗΚΕ. Barrel-only export, μηδέν πραγματικοί καταναλωτές — μόνο η αυτο-αναφορά
// useGripDrag = useGripMovement μέσα στο ίδιο αρχείο. Ο σχολιασμός του ίδιου του αρχείου
// έγραφε ήδη «the live unified grip system uses a separate, richer adapter»: διάδοχος
// systems/grip/ (AllGripsStore, GripArmedStore, grip-scene-manager-adapter.ts). Ο τύπος
// GripType/GripInfo ζει κανονικά στο ./grip-types (κανείς δεν τον έπαιρνε από αυτό το
// barrel — επαληθεύτηκε με grep πριν τη διαγραφή).
