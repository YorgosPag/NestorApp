'use client';

/**
 * Η μπάρα ζουμ του εγγράφου υπεργολαβίας (ADR-928 §5.25): η **κοινή** `DocumentZoomControl` δεμένη στη μηχανή του
 * `DocumentZoomProvider`. Έξω από πάροχο ⇒ τίποτα (έγγραφο χωρίς ζουμ).
 */

import { DocumentZoomControl } from '@/components/shared/media/viewer/DocumentZoomControl';

import { useDocumentZoomEngine, useDocumentZoomSnapshot } from './DocumentZoomContext';
import { PAPER_ZOOM_LIMITS } from './paper-fit';

export function DocumentZoomBar({ className }: { readonly className?: string }) {
  const engine = useDocumentZoomEngine();
  const snapshot = useDocumentZoomSnapshot(engine);
  if (!engine) return null;
  return (
    <DocumentZoomControl
      zoom={snapshot.zoom}
      fitted={snapshot.fitted}
      limits={PAPER_ZOOM_LIMITS}
      onStep={engine.step}
      onZoomTo={engine.zoomTo}
      onFit={engine.fit}
      className={className}
    />
  );
}
