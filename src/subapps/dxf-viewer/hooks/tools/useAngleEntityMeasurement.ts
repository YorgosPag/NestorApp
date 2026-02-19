/**
 * USE ANGLE ENTITY MEASUREMENT — Entity-picking hook for angle measurement tools
 *
 * Handles 3 entity-picking variants:
 * - `measure-angle-constraint`: LINE + LINE → angle between two lines
 * - `measure-angle-line-arc`: LINE + ARC → angle between line and arc tangent
 * - `measure-angle-two-arcs`: ARC + ARC → angle between two arc tangents
 *
 * Pattern: Same 2-step entity picking as useLinePerpendicular / useLineParallel
 *
 * State machine:
 *   idle → step-0 (waiting 1st entity) → step-1 (waiting 2nd entity) → calculate → reset
 *
 * @module hooks/tools/useAngleEntityMeasurement
 */

import { useState, useCallback, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity, AngleMeasurementEntity, LineEntity, ArcEntity } from '../../types/entities';
import { isLineEntity, isArcEntity, generateEntityId } from '../../types/entities';
import {
  angleBetweenLines,
  angleBetweenLineAndArc,
  angleBetweenTwoArcs,
  type AngleMeasurementResult,
} from '../../utils/angle-entity-math';

// ============================================================================
// TYPES
// ============================================================================

/** Which angle measurement variant is active */
export type AngleEntityVariant =
  | 'measure-angle-constraint'
  | 'measure-angle-line-arc'
  | 'measure-angle-two-arcs';

/** Internal state */
interface AngleEntityState {
  isActive: boolean;
  variant: AngleEntityVariant | null;
  /** Step 0 = waiting 1st entity, Step 1 = waiting 2nd entity */
  currentStep: 0 | 1;
  /** First selected entity data */
  firstEntity: SelectedEntityData | null;
  /** First entity click point (for arc projection) */
  firstClickPoint: Point2D | null;
  error: string | null;
}

/** Minimal data stored for a selected entity */
interface SelectedEntityData {
  entityId: string;
  entityType: 'line' | 'arc';
  /** Line start/end OR arc center/radius/angles */
  line?: Pick<LineEntity, 'start' | 'end'>;
  arc?: Pick<ArcEntity, 'center' | 'radius' | 'startAngle' | 'endAngle' | 'counterclockwise'>;
}

export interface UseAngleEntityMeasurementProps {
  /** Callback when measurement entity is created */
  onMeasurementCreated?: (entity: AngleMeasurementEntity) => void;
}

export interface UseAngleEntityMeasurementReturn {
  /** Current state */
  isActive: boolean;
  /** Current step: 0 = waiting 1st entity, 1 = waiting 2nd entity */
  currentStep: 0 | 1;
  /** Whether tool is waiting for entity selection (either step) */
  isWaitingForEntitySelection: boolean;
  /** Activate tool for a specific variant */
  activate: (variant: AngleEntityVariant) => void;
  /** Deactivate tool */
  deactivate: () => void;
  /** Handle entity click — returns true if entity was accepted */
  onEntityClick: (entity: AnySceneEntity, clickPoint: Point2D) => boolean;
  /** Check if a given entity type is acceptable for the current step */
  acceptsEntityType: (entityType: string) => boolean;
  /** Get highlighted entity IDs for visual feedback */
  getHighlightedEntityIds: () => string[];
  /** Status text for UI prompt */
  getStatusText: () => string;
  /** Reset selection (start over) */
  reset: () => void;
  /** Current error message */
  error: string | null;
}

// ============================================================================
// ENTITY TYPE VALIDATION PER VARIANT
// ============================================================================

/** What entity types each step accepts for each variant */
const VARIANT_ACCEPTS: Record<AngleEntityVariant, { step0: ReadonlySet<string>; step1: ReadonlySet<string> }> = {
  'measure-angle-constraint': {
    step0: new Set(['line']),
    step1: new Set(['line']),
  },
  'measure-angle-line-arc': {
    step0: new Set(['line']),
    step1: new Set(['arc']),
  },
  'measure-angle-two-arcs': {
    step0: new Set(['arc']),
    step1: new Set(['arc']),
  },
};

/** Prompt text per variant per step */
const VARIANT_PROMPTS: Record<AngleEntityVariant, { step0: string; step1: string }> = {
  'measure-angle-constraint': {
    step0: 'Επιλέξτε 1η γραμμή',
    step1: 'Επιλέξτε 2η γραμμή',
  },
  'measure-angle-line-arc': {
    step0: 'Επιλέξτε γραμμή',
    step1: 'Επιλέξτε τόξο',
  },
  'measure-angle-two-arcs': {
    step0: 'Επιλέξτε 1ο τόξο',
    step1: 'Επιλέξτε 2ο τόξο',
  },
};

// ============================================================================
// HOOK
// ============================================================================

const INITIAL_STATE: AngleEntityState = {
  isActive: false,
  variant: null,
  currentStep: 0,
  firstEntity: null,
  firstClickPoint: null,
  error: null,
};

export function useAngleEntityMeasurement(
  props: UseAngleEntityMeasurementProps
): UseAngleEntityMeasurementReturn {
  const { onMeasurementCreated } = props;

  const [state, setState] = useState<AngleEntityState>(INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Activate / Deactivate ───────────────────────────────────────────

  const activate = useCallback((variant: AngleEntityVariant) => {
    setState({
      isActive: true,
      variant,
      currentStep: 0,
      firstEntity: null,
      firstClickPoint: null,
      error: null,
    });
  }, []);

  const deactivate = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: 0,
      firstEntity: null,
      firstClickPoint: null,
      error: null,
    }));
  }, []);

  // ── Entity type checking ────────────────────────────────────────────

  const acceptsEntityType = useCallback((entityType: string): boolean => {
    const s = stateRef.current;
    if (!s.isActive || !s.variant) return false;

    const accepts = VARIANT_ACCEPTS[s.variant];
    if (s.currentStep === 0) return accepts.step0.has(entityType);
    return accepts.step1.has(entityType);
  }, []);

  // ── Entity click handler ────────────────────────────────────────────

  const onEntityClick = useCallback((entity: AnySceneEntity, clickPoint: Point2D): boolean => {
    const s = stateRef.current;
    if (!s.isActive || !s.variant) return false;

    const entityType = entity.type;

    // Validate entity type for current step
    const accepts = VARIANT_ACCEPTS[s.variant];
    const currentAccepts = s.currentStep === 0 ? accepts.step0 : accepts.step1;

    if (!currentAccepts.has(entityType)) {
      const expected = Array.from(currentAccepts).join(' ή ');
      setState(prev => ({
        ...prev,
        error: `Αναμένεται: ${expected.toUpperCase()}`,
      }));
      return false;
    }

    // Extract entity data
    const entityData = extractEntityData(entity);
    if (!entityData) return false;

    // ── Step 0: Store first entity and advance ─────────────────────
    if (s.currentStep === 0) {
      setState(prev => ({
        ...prev,
        firstEntity: entityData,
        firstClickPoint: clickPoint,
        currentStep: 1,
        error: null,
      }));
      return true;
    }

    // ── Step 1: Calculate angle and create measurement entity ──────
    if (s.currentStep === 1 && s.firstEntity) {
      const result = calculateAngle(s.variant, s.firstEntity, s.firstClickPoint, entityData, clickPoint);

      if (!result) {
        setState(prev => ({
          ...prev,
          error: 'Δεν ήταν δυνατός ο υπολογισμός γωνίας',
        }));
        return false;
      }

      // Create angle measurement entity
      const measurementEntity: AngleMeasurementEntity = {
        id: generateEntityId(),
        type: 'angle-measurement',
        vertex: result.vertex,
        point1: result.point1,
        point2: result.point2,
        angle: result.angleDeg,
        visible: true,
        layer: '0',
        measurement: true,
      };

      onMeasurementCreated?.(measurementEntity);

      // Reset for next measurement (stay active in same variant)
      setState(prev => ({
        ...prev,
        currentStep: 0,
        firstEntity: null,
        firstClickPoint: null,
        error: null,
      }));

      return true;
    }

    return false;
  }, [onMeasurementCreated]);

  // ── Highlighted entities ─────────────────────────────────────────

  const getHighlightedEntityIds = useCallback((): string[] => {
    const s = stateRef.current;
    if (!s.firstEntity) return [];
    return [s.firstEntity.entityId];
  }, []);

  // ── Status text ──────────────────────────────────────────────────

  const getStatusText = useCallback((): string => {
    const s = stateRef.current;
    if (!s.isActive || !s.variant) return '';

    if (s.error) return `⚠️ ${s.error}`;

    const prompts = VARIANT_PROMPTS[s.variant];
    return s.currentStep === 0 ? prompts.step0 : prompts.step1;
  }, []);

  // ── Return ───────────────────────────────────────────────────────

  return {
    isActive: state.isActive,
    currentStep: state.currentStep,
    isWaitingForEntitySelection: state.isActive,
    activate,
    deactivate,
    onEntityClick,
    acceptsEntityType,
    getHighlightedEntityIds,
    getStatusText,
    reset,
    error: state.error,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/** Extract relevant data from a scene entity */
function extractEntityData(entity: AnySceneEntity): SelectedEntityData | null {
  if (isLineEntity(entity)) {
    return {
      entityId: entity.id,
      entityType: 'line',
      line: { start: entity.start, end: entity.end },
    };
  }

  if (isArcEntity(entity)) {
    return {
      entityId: entity.id,
      entityType: 'arc',
      arc: {
        center: entity.center,
        radius: entity.radius,
        startAngle: entity.startAngle,
        endAngle: entity.endAngle,
        counterclockwise: entity.counterclockwise,
      },
    };
  }

  return null;
}

/** Calculate angle based on variant and two selected entities */
function calculateAngle(
  variant: AngleEntityVariant,
  first: SelectedEntityData,
  firstClickPoint: Point2D | null,
  second: SelectedEntityData,
  secondClickPoint: Point2D
): AngleMeasurementResult | null {
  switch (variant) {
    case 'measure-angle-constraint': {
      if (!first.line || !second.line) return null;
      return angleBetweenLines(first.line, second.line);
    }

    case 'measure-angle-line-arc': {
      if (!first.line || !second.arc) return null;
      return angleBetweenLineAndArc(first.line, second.arc, secondClickPoint);
    }

    case 'measure-angle-two-arcs': {
      if (!first.arc || !second.arc || !firstClickPoint) return null;
      return angleBetweenTwoArcs(first.arc, firstClickPoint, second.arc, secondClickPoint);
    }

    default:
      return null;
  }
}
