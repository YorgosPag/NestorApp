'use client';

/**
 * ADR-662 Φάση 2β (Δρόμος Γ) Stage C — sidebar «Ιδιότητες» tab για την επιλεγμένη
 * τοπογραφική επιφάνεια (`type:'topo-surface'`). Mounted από τον `BimPropertiesRouter`
 * όταν το primary-selected entity είναι επιφάνεια. Mirror του `ImagePropertiesTab`
 * (non-BIM object inspector).
 *
 * Big-player (Revit Toposolid «Type Properties» / Civil 3D «Surface Properties» /
 * ArchiCAD Mesh Settings / C4D Attribute Manager): οι ιδιότητες εμφάνισης του εδάφους
 * είναι **object-bound** — φαίνονται ΜΟΝΟ με επιλεγμένη επιφάνεια. Εδώ γίνεται
 * **reuse** των υπαρχόντων section components — `Terrain3DSection` (ανάγλυφο σε 3Δ:
 * εμφάνιση/υψομετρικό στυλ + διαφάνειες επιφάνειας/ισοϋψών) + `TopoPointLabelsSection`
 * (ετικέτες Ζ / αρ.-κωδικός / Χ,Υ ορίου). ΙΔΙΑ persisted stores (`terrain-3d-store`,
 * `topo-point-label-store`) — ΚΑΝΕΝΑ νέο store, καμία διπλή γραμμή κατάστασης· η αλλαγή
 * εδώ ενημερώνει live το ίδιο SSoT με το (καταργούμενο Φ4) αριστερό `TopographyPanel`.
 *
 * @see ../image-advanced-panel/ImagePropertiesTab.tsx — το mirror template
 * @see ../panels/topography/Terrain3DSection.tsx · ../panels/topography/TopoPointLabelsSection.tsx
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isTopoSurfaceEntity } from '../../types/entities';
import type { TopoSurfaceEntity } from '../../types/topo-surface';
import { Terrain3DSection } from '../panels/topography/Terrain3DSection';
import { TopoPointLabelsSection } from '../panels/topography/TopoPointLabelsSection';
import type { SceneModel } from '../../types/scene';

export interface TopoSurfacePropertiesTabProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
}

export function TopoSurfacePropertiesTab({
  primarySelectedId,
  currentScene,
}: TopoSurfacePropertiesTabProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');

  const surface = React.useMemo<TopoSurfaceEntity | null>(() => {
    if (!primarySelectedId || !currentScene) return null;
    const entity = currentScene.entities.find((e) => e.id === primarySelectedId);
    return entity && isTopoSurfaceEntity(entity) ? entity : null;
  }, [primarySelectedId, currentScene]);

  if (!surface) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        {t('topoSurfaceAdvancedPanel.emptyState')}
      </p>
    );
  }

  return (
    <section aria-label={t('topoSurfaceAdvancedPanel.title')} className="flex flex-col gap-3 p-2">
      <Terrain3DSection />
      <TopoPointLabelsSection />
    </section>
  );
}
