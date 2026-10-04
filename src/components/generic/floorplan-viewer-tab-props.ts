/**
 * Τα props του legacy `FloorplanViewerTab` — εξήχθησαν από τον `UniversalTabsRenderer` (N.7.1).
 *
 * Οι δύο καρτέλες (`floorplan` · `parking-floorplan`) διαφέρουν **μόνο** στο ποια κάτοψη και ποιες
 * ενέργειες διαβάζουν· ήταν γραμμένες δύο φορές, πεδίο προς πεδίο (CHECK 3.28).
 *
 * @module components/generic/floorplan-viewer-tab-props
 */

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('UniversalTabsRenderer');

/** Ολόκληρο το FloorplanData (υποστηρίζει σκηνή DXF και εικόνα PDF), όχι μόνο το `.scene`. */
interface FloorplanPayload {
  fileType?: 'dxf' | 'pdf';
  scene?: unknown;
  pdfImageUrl?: string | null;
  pdfDimensions?: { width: number; height: number } | null;
  fileName?: string;
  timestamp?: number;
}

type FloorplanKind = 'Project' | 'Parking';

/** Ό,τι δίνει ο γονέας — μία κάτοψη και δύο ενέργειες **ανά είδος**. */
type FloorplanAdditionalData = {
  [K in FloorplanKind as `${Uncapitalize<K>}Floorplan`]?: FloorplanPayload | null;
} & {
  [K in FloorplanKind as `onAdd${K}Floorplan` | `onEdit${K}Floorplan`]?: () => void;
};

/** Η τιμή της καρτέλας → ποιο είδος κάτοψης δείχνει. */
const FLOORPLAN_KIND_BY_TAB: Readonly<Record<string, FloorplanKind>> = {
  floorplan: 'Project',
  'parking-floorplan': 'Parking',
};

export interface FloorplanViewerTabProps {
  floorplanData?: FloorplanPayload | null;
  onAddFloorplan?: () => void;
  onEditFloorplan?: () => void;
}

/** `{}` για κάθε καρτέλα που δεν είναι `FloorplanViewerTab`. */
export function floorplanViewerTabProps(
  tab: { readonly component?: string; readonly value: string },
  additionalData: object,
  entityId: string,
): FloorplanViewerTabProps {
  const kind = tab.component === 'FloorplanViewerTab' ? FLOORPLAN_KIND_BY_TAB[tab.value] : undefined;
  if (!kind) return {};
  const source = additionalData as FloorplanAdditionalData;
  const label = kind.toLowerCase();
  return {
    floorplanData: kind === 'Project' ? source.projectFloorplan : source.parkingFloorplan,
    onAddFloorplan: source[`onAdd${kind}Floorplan`] ?? (() => {
      logger.info(`Add ${label} floorplan for project`, { projectId: entityId });
    }),
    onEditFloorplan: source[`onEdit${kind}Floorplan`] ?? (() => {
      logger.info(`Edit ${label} floorplan for project`, { projectId: entityId });
    }),
  };
}
