'use client';

/**
 * ADR-370 Phase 5 — Always-on host που πιέζει stair entities από το active scene
 * στο `Bim3DEntitiesStore` (3D viewer feed).
 *
 * Mirror του `SlabPersistenceHost` pattern, αλλά χωρίς full Firestore persistence
 * hook — η αμφίδρομη συγχρόνιση των stairs με Firestore γίνεται ήδη από το
 * `StairAdvancedPanelHost` (selection-driven, ADR-358 Phase 8). Αυτό το host
 * τρέχει μόνο για να μεταβιβάζει το current scene snapshot στο 3D store ώστε ο
 * 3D viewer toggle να εμφανίζει stairs άμεσα.
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 */

import React from 'react';
import type { SceneModel } from '../types/scene';
import type { StairEntity } from '../bim/types/stair-types';
import { isStairEntity } from '../types/entities';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

export interface StairPersistenceHostProps {
  readonly currentScene: SceneModel | null;
}

export function StairPersistenceHost({
  currentScene,
}: StairPersistenceHostProps): React.ReactElement | null {
  React.useEffect(() => {
    const stairs = (currentScene?.entities.filter(isStairEntity) ?? []) as readonly StairEntity[];
    useBim3DEntitiesStore.getState().setStairs(stairs);
  }, [currentScene]);

  return null;
}
