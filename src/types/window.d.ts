export {};

type DebugPoint = {
  x: number;
  y: number;
};

type DebugSnapResult = {
  point: DebugPoint;
  type?: string;
} & Record<string, unknown>;

type DxfTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

type GridVisualSettings = {
  enabled: boolean;
  visible?: boolean;
  style?: string;
  majorGridColor?: string;
  minorGridColor?: string;
  majorGridWeight?: number;
  minorGridWeight?: number;
  size?: number;
};

type GridSettings = {
  visual?: GridVisualSettings;
} & Record<string, unknown>;

type NotificationType = 'info' | 'success' | 'warning' | 'error';

declare global {
  interface Window {
    __DXF_DEBUG__?: boolean;
    dxfDebug?: Record<string, unknown>;
    dxfDebugManager?: Record<string, unknown>;
    __debugSnapResults?: DebugSnapResult[];
    showCopyableNotification?: (message: string, type?: NotificationType) => void;
    __cursorSnapAlignmentDebug?: Record<string, unknown>;
    rulerDebugOverlay?: Record<string, unknown>;
    originMarkersDebug?: Record<string, unknown>;
    lastMouseEvent?: MouseEvent;
    lastMouseUpdate?: number;
    dxfTransform?: DxfTransform;
    __GRID_SETTINGS__?: GridSettings;
    runLayeringWorkflowTest?: () => Promise<unknown>;
    runLayeringWorkflowTestAdvanced?: () => Promise<unknown>;
    runEnterpriseMouseCrosshairTests?: () => unknown;
    startEnterpriseInteractiveTest?: () => unknown;
    inspectDOMElements?: () => void;
    findFloatingPanelAdvanced?: () => HTMLElement | null;
    showDetailedDOMInfo?: () => void;
    testCoordinateReversibility?: () => boolean;
    globalCoordinateCopy?: (key: string) => void;
  }
}
