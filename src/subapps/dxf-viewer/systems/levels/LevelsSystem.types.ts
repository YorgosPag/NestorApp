import * as React from 'react';
import type {
  Level,
  FloorplanDoc,
  ImportWizardState,
  LevelSystemSettings,
} from './config';

/**
 * Public props of the LevelsSystem provider component.
 *
 * @enterprise
 * These props are consumed by the DXF viewer host to bootstrap the levels
 * subsystem (initial state, Firestore wiring, lifecycle callbacks).
 */
export interface LevelsSystemProps {
  children: React.ReactNode;
  initialLevels?: Level[];
  initialFloorplans?: Record<string, FloorplanDoc>;
  initialCurrentLevelId?: string | null;
  enableFirestore?: boolean;
  firestoreCollection?: string;
  settings?: Partial<LevelSystemSettings>;
  onLevelChange?: (levelId: string | null) => void;
  onFloorplanAdd?: (floorplan: FloorplanDoc) => void;
  onFloorplanRemove?: (floorplanId: string) => void;
  onError?: (error: string) => void;
}

/**
 * Default state for the import wizard, used both on first mount and as the
 * reset target after an import completes or is cancelled.
 */
export const DEFAULT_IMPORT_WIZARD_STATE: ImportWizardState = {
  step: 'level',
};
