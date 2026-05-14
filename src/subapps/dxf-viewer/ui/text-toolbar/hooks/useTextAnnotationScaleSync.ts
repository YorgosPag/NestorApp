'use client';

/**
 * ADR-345 Fase 6 — Annotation scale sync hook.
 *
 * Extracted from TextPropertiesPanelHost to enable reuse in
 * RibbonAnnotationScaleWidget (ADR-345 SSoT). Syncs the per-entity
 * `annotationScales` list from the first selected text entity and
 * provides a command-dispatching `handleScalesChange` callback.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnnotationScale } from '../../../text-engine/types';
import { useTextSelectionStore } from '../../../state/text-toolbar';
import { useCurrentSceneModel } from './useCurrentSceneModel';
import { useDxfTextServices } from './useDxfTextServices';
import { ensureTextNode } from '../../../text-engine/edit';
import { UpdateTextAnnotationScalesCommand } from '../../../core/commands/text/UpdateTextAnnotationScalesCommand';
import { getGlobalCommandHistory } from '../../../core/commands';
import type { AnySceneEntity } from '../../../types/scene';

export interface TextAnnotationScaleSync {
  readonly scales: readonly AnnotationScale[];
  readonly handleScalesChange: (next: readonly AnnotationScale[]) => void;
}

export function useTextAnnotationScaleSync(): TextAnnotationScaleSync {
  const [scales, setScales] = useState<readonly AnnotationScale[]>([]);
  const selectedIds = useTextSelectionStore((s) => s.selectedIds);
  const scene = useCurrentSceneModel();
  const services = useDxfTextServices();

  const prevFirstId = useRef<string | null>(null);
  useEffect(() => {
    const firstId = selectedIds[0] ?? null;
    if (firstId === prevFirstId.current) return;
    prevFirstId.current = firstId;
    if (!firstId || !scene) { setScales([]); return; }
    const byId = new Map<string, AnySceneEntity>();
    for (const e of scene.entities) byId.set(e.id, e);
    const entity = byId.get(firstId);
    if (!entity || (entity.type !== 'text' && entity.type !== 'mtext')) { setScales([]); return; }
    const node = ensureTextNode(entity as unknown as Parameters<typeof ensureTextNode>[0]);
    setScales(node.annotationScales);
  }, [selectedIds, scene]);

  const handleScalesChange = useCallback((next: readonly AnnotationScale[]) => {
    setScales(next);
    if (!services) return;
    const history = getGlobalCommandHistory();
    for (const entityId of selectedIds) {
      const cmd = new UpdateTextAnnotationScalesCommand(
        { entityId, annotationScales: next },
        services.sceneManager,
        services.layerProvider,
        services.auditRecorder,
      );
      history.execute(cmd);
    }
  }, [services, selectedIds]);

  return { scales, handleScalesChange };
}
