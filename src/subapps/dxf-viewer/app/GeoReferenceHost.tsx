'use client';

/**
 * ADR-650 M10 — hydration lifecycle owner for the project geo-reference (renders `null`).
 *
 * Mounted in `DxfViewerTopBar` (always-on). On `projectId` change it does a one-shot
 * read of `projects/{id}.basePoint`/`northRotation` (ADR-369) and pushes the runtime
 * {@link setGeoReference} so the topo render path projects the terrain (ΕΓΣΑ world) into
 * the building's LOCAL frame — the plan «κάθεται» on the ground on EVERY storey. When a
 * project is NOT geo-referenced (or projectId is absent) the store is cleared to `null`
 * (identity → renders unchanged). Zero high-frequency subscriptions (CHECK 6B/6C).
 *
 * @see ../systems/geo-referencing/geo-reference-persistence.ts — loadProjectGeoReference
 * @see ../systems/geo-referencing/geo-reference-store.ts — the runtime SSoT
 */

import * as React from 'react';
import { loadProjectGeoReference } from '../systems/geo-referencing/geo-reference-persistence';
import { setGeoReference } from '../systems/geo-referencing/geo-reference-store';

export interface GeoReferenceHostProps {
  readonly projectId: string | null | undefined;
}

export function GeoReferenceHost({ projectId }: GeoReferenceHostProps): React.ReactElement | null {
  React.useEffect(() => {
    if (!projectId) {
      setGeoReference(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const geo = await loadProjectGeoReference(projectId);
        if (!cancelled) setGeoReference(geo);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[GeoReferenceHost] hydrate failed', err);
        if (!cancelled) setGeoReference(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return null;
}
