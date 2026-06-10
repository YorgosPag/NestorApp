'use client';

/**
 * ADR-436 Slice 1 — Always-on host που τροφοδοτεί το 3D store με τις θεμελιώσεις
 * του ενεργού scene (renders `null`).
 *
 * Mounted στο `DxfViewerTopBar`. Mirror του 3D-push effect του
 * `ColumnPersistenceHost`: όποτε αλλάζει το `currentScene`, σπρώχνει τα
 * `FoundationEntity` στο `Bim3DEntitiesStore` (→ `BimSceneLayer.syncFoundations`).
 *
 * NOTE (Slice 1 scope): η Firestore persistence (subscribe / auto-save / delete /
 * audit / collection / rules+indexes deploy) ΔΕΝ είναι εδώ — μπαίνει στο
 * **Slice 1-persist** (mirror του `useColumnPersistence`), ώστε ο deploy tail
 * (rules/indexes, ADR-298 CHECK 3.16) να γίνει χωριστά. Το draw→2D→3D
 * browser-verify δουλεύει από το in-memory scene + αυτό το push.
 *
 * Zero high-frequency subscriptions — CHECK 6B/6C compliant.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §5.3
 */

import React from 'react';
import type { SceneModel } from '../types/scene';
import { isFoundationEntity } from '../types/entities';
import { useBim3DEntitiesStore } from '../bim-3d/stores/Bim3DEntitiesStore';

export interface FoundationPersistenceHostProps {
  readonly currentScene: SceneModel | null;
}

export function FoundationPersistenceHost({
  currentScene,
}: FoundationPersistenceHostProps): React.ReactElement | null {
  React.useEffect(() => {
    const foundations = currentScene?.entities.filter(isFoundationEntity) ?? [];
    useBim3DEntitiesStore.getState().setFoundations(foundations);
  }, [currentScene]);

  return null;
}
