'use client';

/**
 * IFC Export Host (ADR-369 §Q8.3)
 *
 * Listens for `bim:ifc-export-requested` on the EventBus, resolves the
 * full Project + Buildings + Floors triple, builds an IFC4 STEP21 byte
 * buffer via `IfcExporter`, and triggers a browser download. Mirrors
 * `PsetEditorHost` / `SlabOpeningStackHost` lifecycle — zero high-freq
 * subscriptions (CHECK 6B/6C compliant, ADR-040).
 *
 * Q8.3 scope is *foundation only*: spatial hierarchy + units. Element
 * geometry (Q8.4) and Property Sets (Q8.5) are plugged in via the
 * `entitySerializer` hook on `IfcExportParams` — to be wired in a
 * follow-up commit.
 */

import React, { useEffect, useRef } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';

import type { Project } from '@/types/project';
import type { Building } from '@/types/building/contracts';
import type { FloorDocument, FloorsListResponse } from '@/app/api/floors/floors.types';

import { EventBus } from '../systems/events/EventBus';
import { IfcExporter } from '@/services/ifc/ifc-exporter.service';
import { CombinedEntitySerializer } from '@/services/ifc/serializers';
import { loadBimScenesForProject } from '@/services/ifc/ifc-bim-scene-loader';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';

// ─── Component ────────────────────────────────────────────────────────────────

export function IfcExportHost(): React.ReactElement | null {
  const notifications = useNotifications();
  const { t } = useTranslation(['dxf-viewer-shell']);
  const { buildings: firestoreBuildings } = useFirestoreBuildings();

  // Latest-value ref so the EventBus handler always sees current data
  // without re-binding on every Firestore tick (anti-stale-snapshot, ADR-040).
  const stateRef = useRef({ firestoreBuildings, notifications, t });
  useEffect(() => {
    stateRef.current = { firestoreBuildings, notifications, t };
  });

  useEffect(() => {
    return EventBus.on('bim:ifc-export-requested', async (payload) => {
      const { firestoreBuildings: currentBuildings, notifications: notif, t: tr } = stateRef.current;
      const { projectId, buildingIds } = payload;

      if (!projectId) {
        notif.warning(tr('ifcExport.error.noProject'));
        return;
      }

      try {
        const project = await loadProject(projectId);
        const buildings = filterBuildings(currentBuildings, projectId, buildingIds);
        if (buildings.length === 0) {
          notif.warning(tr('ifcExport.error.noBuildings'));
          return;
        }
        const floors = await loadFloorsForBuildings(buildings);
        const scenes = await loadBimScenesForProject(projectId, floors);

        const exporter = new IfcExporter();
        const result = exporter.exportProject({
          project,
          buildings,
          floors,
          scenes,
          entitySerializer: new CombinedEntitySerializer(),
          includePsets: payload.includePsets ?? true,
        });

        const blob = new Blob([result.bytes as BlobPart], { type: 'application/x-step' });
        triggerExportDownload({ blob, filename: result.fileName });

        notif.success(tr('ifcExport.success'), {
          content: `${result.entityCount} ${tr('ifcExport.entityCountLabel')}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        notif.error(tr('ifcExport.error.failed'), { content: message });
      }
    });
  }, []);

  return null;
}

// ─── Loaders ─────────────────────────────────────────────────────────────────

async function loadProject(projectId: string): Promise<Project> {
  const project = await apiClient.get<Project>(API_ROUTES.PROJECTS.BY_ID(projectId));
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }
  return project;
}

function filterBuildings(
  all: readonly Building[],
  projectId: string,
  buildingIds?: readonly string[],
): Building[] {
  const projectBuildings = all.filter((b) => b.projectId === projectId);
  if (!buildingIds || buildingIds.length === 0) return projectBuildings;
  const wanted = new Set(buildingIds);
  return projectBuildings.filter((b) => wanted.has(b.id));
}

async function loadFloorsForBuildings(
  buildings: readonly Building[],
): Promise<FloorDocument[]> {
  const results = await Promise.all(
    buildings.map((b) =>
      apiClient
        .get<FloorsListResponse>(`${API_ROUTES.FLOORS.LIST}?buildingId=${b.id}`)
        .catch(() => null),
    ),
  );
  const floors: FloorDocument[] = [];
  for (const res of results) {
    if (res && res.success) floors.push(...res.floors);
  }
  return floors;
}

