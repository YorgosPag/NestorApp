/**
 * Hover Configuration
 * Centralized configuration for consistent hover behavior styling
 */

export interface HoverConfig {
  colors: {
    distance: string;
    angle: string;
    area: string;
  };
  fonts: {
    distance: string;
    angle: string;
    area: string;
  };
  offsets: {
    gripAvoidance: number;
    arcRadius: number;
    textFromArc: number;
  };
  lineStyle: {
    dashPattern: number[];
  };
}

// Configuration based on existing polyline styling
export const HOVER_CONFIG: HoverConfig = {
  colors: {
    distance: '#00AA00',  // Green - from existing distance labels
    angle: '#ffaa00',     // Orange - from existing angle arcs
    area: '#00ff00'       // Bright green - from existing area labels
  },
  fonts: {
    distance: '11px Arial',  // From PolylineRenderer
    angle: '11px Arial',     // From PolylineRenderer  
    area: '14px Arial'       // From PolylineRenderer
  },
  offsets: {
    gripAvoidance: 20,    // From LineRenderer
    arcRadius: 30,        // From PolylineRenderer
    textFromArc: 20       // From PolylineRenderer
  },
  lineStyle: {
    dashPattern: [5, 5]   // From PolylineRenderer
  }
};