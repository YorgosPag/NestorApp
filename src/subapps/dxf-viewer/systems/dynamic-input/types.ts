/**
 * Dynamic Input Type Definitions
 *
 * Centralized type exports for external consumers
 */

import type { Point2D, Viewport } from '../../rendering/types/Types';

// Re-export core types
export type { Field, Phase, Point } from './hooks/useDynamicInputState';

// Re-export interface types
export type { 
  FieldValueActions,
  FieldStateActions,
  CoordinateActions,
  PhaseActions,
  InputRefActions,
  ValidationActions,
  FeedbackActions,
  ResetActions
} from './hooks/interfaces';

// Component prop types
export interface DynamicInputOverlayProps {
  className?: string;
  isActive?: boolean;
  cursorPosition?: Point2D | null;
  viewport?: Viewport;
  activeTool?: string;
  canvasRect?: DOMRect | null;
  mouseWorldPosition?: Point2D | null;
  tempPoints?: Point2D[] | null; // For multi-point tools like polyline/polygon
}

export interface DynamicInputFieldProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  disabled?: boolean;
  isActive?: boolean;
  isAnchored?: boolean;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  fieldType?: 'coordinate' | 'angle' | 'length' | 'radius' | 'diameter';
}
