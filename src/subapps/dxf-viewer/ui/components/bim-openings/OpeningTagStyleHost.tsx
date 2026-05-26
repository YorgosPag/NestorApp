'use client';

/**
 * ADR-376 Phase C.2 — Opening Tag Style dialog host.
 *
 * Lifecycle owner για `opening-tag-style-service`:
 *   1. On `projectId` change → fetch `projects/{id}.openingTagStyle` once,
 *      hydrate service (sets resolved style + emits to renderer).
 *   2. Wire `setPersister` σε `updateProjectWithPolicy` so the service's
 *      debounced 200 ms write lands στο same Firestore document.
 *   3. Listen σε `bim:opening-tag-style-requested` EventBus → open dialog.
 *
 * Mounted as React.Suspense leaf σε `DxfViewerContent.tsx` — mirror του
 * `RenumberOpeningsHost` pattern (ADR-376 Phase B.1).
 *
 * ADR-040: leaf-only DOM listener, no orchestrator subscriptions, no
 * high-frequency state reads. Firestore I/O bounded to project-switch events
 * + user-driven debounce writes.
 */

import * as React from 'react';
import { doc, getDoc } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import { markAllCanvasDirty } from '../../../rendering/core/frame-scheduler-api';
import { EventBus } from '../../../systems/events/EventBus';
import {
  getOpeningTagStyleService,
  type OpeningTagStyle,
} from '../../../bim/services/opening-tag-style-service';
import { OpeningTagStyleDialog } from './OpeningTagStyleDialog';

export interface OpeningTagStyleHostProps {
  readonly projectId: string | null | undefined;
}

export function OpeningTagStyleHost(
  props: OpeningTagStyleHostProps,
): React.ReactElement | null {
  const { projectId } = props;
  const [open, setOpen] = React.useState(false);

  // Hydration + persister wiring on projectId change. One-shot getDoc — no
  // real-time subscription (style edits are rare, cross-tab sync not critical).
  React.useEffect(() => {
    if (!projectId) return;
    const service = getOpeningTagStyleService();
    let cancelled = false;

    (async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
        if (cancelled) return;
        const data = snap.exists() ? (snap.data() as { openingTagStyle?: OpeningTagStyle | null }) : {};
        service.hydrate(projectId, { openingTagStyle: data.openingTagStyle ?? null });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[OpeningTagStyleHost] hydrate failed', err);
        if (!cancelled) service.hydrate(projectId, { openingTagStyle: null });
      }
    })();

    service.setPersister(async (id, style) => {
      await updateProjectWithPolicy({
        projectId: id,
        updates: { openingTagStyle: style },
      });
    });

    return () => {
      cancelled = true;
      service.setPersister(null);
    };
  }, [projectId]);

  // Ensure any style mutation (ribbon or dialog) immediately repaints the canvas.
  React.useEffect(() => getOpeningTagStyleService().subscribe(markAllCanvasDirty), []);

  // EventBus listener — ribbon button → open dialog.
  React.useEffect(() => {
    return EventBus.on('bim:opening-tag-style-requested', () => {
      if (projectId) setOpen(true);
    });
  }, [projectId]);

  if (!projectId) return null;

  return <OpeningTagStyleDialog open={open} onOpenChange={setOpen} />;
}
