/**
 * Line Settings Constants
 * Σταθερές για τις ρυθμίσεις γραμμών
 */

import { UI_COLORS } from '../config/color-config';

// Line type labels
export const LINE_TYPE_LABELS = {
  solid: 'Συνεχής',
  dotted: 'Κουκκίδες',
  dashed: 'Διακεκομμένη',
  'dash-dot': 'Παύλα-Κουκκίδα',
  'dash-dot-dot': 'Παύλα-Κουκκίδα-Κουκκίδα',
  'long-dash': 'Μεγάλη Παύλα',
  'short-dash': 'Μικρή Παύλα',
  'double-dot': 'Διπλή Κουκκίδα',
  custom: 'Προσαρμοσμένη'
} as const;

// Line cap labels
export const LINE_CAP_LABELS = {
  butt: 'Τετράγωνη',
  round: 'Στρογγυλή',
  square: 'Προεκτεταμένη'
} as const;

// Line join labels
export const LINE_JOIN_LABELS = {
  miter: 'Αιχμηρή',
  round: 'Στρογγυλή',
  bevel: 'Λοξή'
} as const;

// Ranges for various settings
export const LINE_WIDTH_RANGE = {
  min: 0.1,
  max: 10.0,
  step: 0.1
} as const;

export const DASH_SCALE_RANGE = {
  min: 0.1,
  max: 5.0,
  step: 0.1
} as const;

export const DASH_OFFSET_RANGE = {
  min: 0,
  max: 50,
  step: 1
} as const;

export const OPACITY_RANGE = {
  min: 0.1,
  max: 1.0,
  step: 0.1
} as const;

// Template category labels (ίδια με το kalo)
export const TEMPLATE_LABELS = {
  engineering: 'Τεχνικά Σχέδια',
  architectural: 'Αρχιτεκτονικά',
  electrical: 'Ηλεκτρολογικά',
  custom: 'Προσαρμοσμένα'
} as const;

export type TemplateCategory = keyof typeof TEMPLATE_LABELS;

// Predefined templates (αντιγραμμένα από dxf-viewer-kalo)
export interface LineTemplate {
  name: string;
  category: TemplateCategory;
  description: string;
  settings: {
    lineType: LineType;
    lineWidth: number;
    color: string;
    opacity: number;
    dashScale: number;
    dashOffset: number;
    lineCap: LineCapStyle;
    lineJoin: LineJoinStyle;
    breakAtCenter: boolean;
    hoverColor: string;
    hoverType: LineType;
    hoverWidth: number;
    hoverOpacity: number;
    finalColor: string;
    finalType: LineType;
    finalWidth: number;
    finalOpacity: number;
    activeTemplate: string | null;
  };
}

export const LINE_TEMPLATES: LineTemplate[] = [
  // Engineering Templates
  {
    name: 'Κύρια Γραμμή',
    category: 'engineering',
    description: 'Συνεχόμενη γραμμή για κύρια στοιχεία',
    settings: {
      lineType: 'solid',
      lineWidth: 1.5,
      color: UI_COLORS.BLACK,
      opacity: 1.0,
      dashScale: 1.0,
      dashOffset: 0,
      lineCap: 'butt',
      lineJoin: 'miter',
      breakAtCenter: false,
      hoverColor: UI_COLORS.SNAP_DEFAULT,
      hoverType: 'solid',
      hoverWidth: 2.0,
      hoverOpacity: 0.8,
      finalColor: UI_COLORS.BUTTON_PRIMARY,
      finalType: 'solid',
      finalWidth: 1.8,
      finalOpacity: 1.0,
      activeTemplate: 'engineering'
    }
  },
  {
    name: 'Κεντρική Γραμμή',
    category: 'engineering',
    description: 'Παύλες-τελείες για άξονες συμμετρίας',
    settings: {
      lineType: 'dash-dot',
      lineWidth: 0.8,
      color: UI_COLORS.MEDIUM_GRAY,
      opacity: 0.8,
      dashScale: 1.2,
      dashOffset: 0,
      lineCap: 'butt',
      lineJoin: 'miter',
      breakAtCenter: false,
      hoverColor: UI_COLORS.SNAP_DEFAULT,
      hoverType: 'dash-dot',
      hoverWidth: 1.2,
      hoverOpacity: 0.9,
      finalColor: UI_COLORS.MEDIUM_GRAY,
      finalType: 'dash-dot',
      finalWidth: 1.0,
      finalOpacity: 0.9,
      activeTemplate: 'engineering'
    }
  },
  {
    name: 'Κρυφή Γραμμή',
    category: 'engineering',
    description: 'Διακεκομμένη γραμμή για κρυφά στοιχεία',
    settings: {
      lineType: 'dashed',
      lineWidth: 1.0,
      color: UI_COLORS.MEDIUM_GRAY,
      opacity: 0.7,
      dashScale: 0.8,
      dashOffset: 0,
      lineCap: 'butt',
      lineJoin: 'miter',
      breakAtCenter: false,
      hoverColor: UI_COLORS.SNAP_DEFAULT,
      hoverType: 'dashed',
      hoverWidth: 1.5,
      hoverOpacity: 0.8,
      finalColor: UI_COLORS.LIGHT_GRAY,
      finalType: 'dashed',
      finalWidth: 1.2,
      finalOpacity: 0.8,
      activeTemplate: 'engineering'
    }
  },
  {
    name: 'Διαστάσεις',
    category: 'engineering',
    description: 'Λεπτή γραμμή για διαστάσεις',
    settings: {
      lineType: 'solid',
      lineWidth: 0.5,
      color: UI_COLORS.BUTTON_PRIMARY,
      opacity: 0.9,
      dashScale: 1.0,
      dashOffset: 0,
      lineCap: 'round',
      lineJoin: 'round',
      breakAtCenter: false,
      hoverColor: UI_COLORS.SNAP_DEFAULT,
      hoverType: 'solid',
      hoverWidth: 0.8,
      hoverOpacity: 0.9,
      finalColor: UI_COLORS.BUTTON_PRIMARY,
      finalType: 'solid',
      finalWidth: 0.6,
      finalOpacity: 1.0,
      activeTemplate: 'engineering'
    }
  },

  // Architectural Templates
  {
    name: 'Τοίχος',
    category: 'architectural',
    description: 'Παχιά γραμμή για τοίχους',
    settings: {
      lineType: 'solid',
      lineWidth: 2.5,
      color: UI_COLORS.BLACK,
      opacity: 1.0,
      dashScale: 1.0,
      dashOffset: 0,
      lineCap: 'square',
      lineJoin: 'miter',
      breakAtCenter: false,
      hoverColor: UI_COLORS.SNAP_DEFAULT,
      hoverType: 'solid',
      hoverWidth: 3.0,
      hoverOpacity: 0.8,
      finalColor: UI_COLORS.DARK_BACKGROUND,
      finalType: 'solid',
      finalWidth: 2.5,
      finalOpacity: 1.0,
      activeTemplate: 'architectural'
    }
  },
  {
    name: 'Έπιπλα',
    category: 'architectural',
    description: 'Μεσαία γραμμή για έπιπλα',
    settings: {
      lineType: 'solid',
      lineWidth: 1.2,
      color: UI_COLORS.DARK_BACKGROUND,
      opacity: 0.85,
      dashScale: 1.0,
      dashOffset: 0,
      lineCap: 'round',
      lineJoin: 'round',
      breakAtCenter: false,
      hoverColor: UI_COLORS.SNAP_DEFAULT,
      hoverType: 'solid',
      hoverWidth: 1.8,
      hoverOpacity: 0.9,
      finalColor: UI_COLORS.MEDIUM_GRAY,
      finalType: 'solid',
      finalWidth: 1.4,
      finalOpacity: 0.9,
      activeTemplate: 'architectural'
    }
  },
  {
    name: 'Βοηθητικές',
    category: 'architectural',
    description: 'Διακεκομμένες γραμμές κατασκευής',
    settings: {
      lineType: 'dashed',
      lineWidth: 0.8,
      color: UI_COLORS.LIGHT_GRAY,
      opacity: 0.6,
      dashScale: 1.5,
      dashOffset: 0,
      lineCap: 'butt',
      lineJoin: 'miter',
      breakAtCenter: false,
      hoverColor: UI_COLORS.SNAP_DEFAULT,
      hoverType: 'dashed',
      hoverWidth: 1.2,
      hoverOpacity: 0.8,
      finalColor: UI_COLORS.LIGHT_GRAY_ALT,
      finalType: 'dashed',
      finalWidth: 1.0,
      finalOpacity: 0.7,
      activeTemplate: 'architectural'
    }
  },

  // Electrical Templates
  {
    name: 'Καλώδια',
    category: 'electrical',
    description: 'Συνεχόμενες γραμμές για καλώδια',
    settings: {
      lineType: 'solid',
      lineWidth: 1.8,
      color: UI_COLORS.SELECTED_RED,
      opacity: 0.95,
      dashScale: 1.0,
      dashOffset: 0,
      lineCap: 'round',
      lineJoin: 'round',
      breakAtCenter: false,
      hoverColor: UI_COLORS.SNAP_DEFAULT,
      hoverType: 'solid',
      hoverWidth: 2.2,
      hoverOpacity: 0.9,
      finalColor: UI_COLORS.SELECTED_RED,
      finalType: 'solid',
      finalWidth: 2.0,
      finalOpacity: 1.0,
      activeTemplate: 'electrical'
    }
  },
  {
    name: 'Σήματα',
    category: 'electrical',
    description: 'Παύλες-τελείες για σήματα',
    settings: {
      lineType: 'dash-dot',
      lineWidth: 1.0,
      color: UI_COLORS.BLUE_DEFAULT,
      opacity: 0.9,
      dashScale: 0.9,
      dashOffset: 0,
      lineCap: 'butt',
      lineJoin: 'miter',
      breakAtCenter: false,
      hoverColor: UI_COLORS.SNAP_DEFAULT,
      hoverType: 'dash-dot',
      hoverWidth: 1.4,
      hoverOpacity: 0.9,
      finalColor: UI_COLORS.BUTTON_PRIMARY,
      finalType: 'dash-dot',
      finalWidth: 1.2,
      finalOpacity: 1.0,
      activeTemplate: 'electrical'
    }
  },
  {
    name: 'Γείωση',
    category: 'electrical',
    description: 'Διπλές τελείες για γείωση',
    settings: {
      lineType: 'double-dot',
      lineWidth: 1.5,
      color: UI_COLORS.MEASUREMENT_TEXT,
      opacity: 0.85,
      dashScale: 1.1,
      dashOffset: 0,
      lineCap: 'round',
      lineJoin: 'round',
      breakAtCenter: false,
      hoverColor: UI_COLORS.SNAP_DEFAULT,
      hoverType: 'double-dot',
      hoverWidth: 1.8,
      hoverOpacity: 0.9,
      finalColor: UI_COLORS.BRIGHT_GREEN,
      finalType: 'double-dot',
      finalWidth: 1.6,
      finalOpacity: 0.9,
      activeTemplate: 'electrical'
    }
  }
];

// Helper function to get templates by category
export function getTemplatesByCategory(category: TemplateCategory): LineTemplate[] {
  return LINE_TEMPLATES.filter(template => template.category === category);
}

// Helper function to get template by name
export function getTemplateByName(name: string): LineTemplate | undefined {
  return LINE_TEMPLATES.find(template => template.name === name);
}