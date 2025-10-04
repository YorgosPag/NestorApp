/**
 * SHARED TYPES
 * Κοινοί τύποι που χρησιμοποιούνται σε όλο το project
 * Consolidated from multiple duplicate definitions
 */

export interface Point2D {
  x: number;
  y: number;
}


// Common geometry types
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Color and style types
export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface StyleProps {
  stroke?: string;
  fill?: string;
  lineWidth?: number;
  opacity?: number;
}

// Shared entity operation interfaces
export interface EntityOperations {
  onEntityToggle?: (entityId: string, visible: boolean) => void;
  onEntityDelete?: (entityId: string) => void;
  onEntityColorChange?: (entityId: string, color: string) => void;
  onEntityRename?: (entityId: string, newName: string) => void;
}

export interface ColorGroupOperations {
  onColorGroupToggle?: (colorGroupName: string, layersInGroup: string[], visible: boolean) => void;
  onColorGroupDelete?: (colorGroupName: string, layersInGroup: string[]) => void;
  onColorGroupColorChange?: (colorGroupName: string, layersInGroup: string[], color: string) => void;
  onColorGroupRename?: (oldColorGroupName: string, newColorGroupName: string, layersInGroup: string[]) => void;
}

// Re-export Point2D as Point for backward compatibility
export type Point = Point2D;