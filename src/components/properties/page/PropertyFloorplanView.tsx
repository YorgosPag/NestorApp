'use client';

/**
 * 🗺️ Η όψη `floorplan` της ενιαίας οθόνης ακινήτων (ADR-840 Σ3): κατάλογος | θεατής μέσων | επιθεωρητής.
 *
 * Ήταν **ολόκληρη σελίδα** (`PropertyManagementPageContent`) με **δεύτερη μηχανή** (`usePublicPropertyViewer`):
 * δική της επιλογή, δικό της ταμπλό, και πληθυσμό μόνο «διαθέσιμων». Τώρα είναι **φακός** της μίας μηχανής —
 * ίδια φίλτρα, ίδια επιλογή (`?selected=`), ίδιο ταμπλό με τις άλλες δύο όψεις.
 *
 * ⚠️ Ο θεατής χρειάζεται μόνο `{ properties, onSelectFloor }` (`ReadOnlyViewerContextProps`) — καμία μεταφορά
 *    δεκάδων πεδίων «για συμβατότητα».
 */

import { ListLayout } from '@/features/read-only-viewer/components/ListLayout';
import { useViewportClass } from '@/hooks/media/useViewportClass';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import type { Property } from '@/types/property-viewer';

interface PropertyFloorplanViewProps {
  isLoading: boolean;
  properties: Property[];
  filteredProperties: Property[];
  selectedPropertyIds: string[];
  hoveredPropertyId: string | null;
  onHoverProperty: (propertyId: string | null) => void;
  onSelectProperty: (propertyId: string, isShiftClick: boolean) => void;
  onSelectFloor: (floorId: string | null) => void;
}

export function PropertyFloorplanView(props: PropertyFloorplanViewProps) {
  const layout = useLayoutClasses();
  /**
   * **Η μία ερώτηση πλάτους του θεατή** — οδηγεί **συμπεριφορά** (πίσω κουμπί, κλείσιμο φύλλου), ποτέ σχήμα
   * (`features/read-only-viewer/viewer-panes.ts`).
   */
  const viewport = useViewportClass();

  return (
    <section className={`flex min-h-0 flex-1 overflow-hidden ${layout.listGapResponsive} ${layout.listPaddingResponsive}`}>
      <ListLayout
        isLoading={props.isLoading}
        filteredProperties={props.filteredProperties}
        selectedPropertyIds={props.selectedPropertyIds}
        handlePolygonSelect={props.onSelectProperty}
        hoveredPropertyId={props.hoveredPropertyId}
        onHoverProperty={props.onHoverProperty}
        viewport={viewport}
        viewerProps={{ properties: props.properties, onSelectFloor: props.onSelectFloor }}
      />
    </section>
  );
}
