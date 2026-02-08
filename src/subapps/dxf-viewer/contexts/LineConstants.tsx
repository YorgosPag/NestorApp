/**
 * Line Settings Constants
 * Σταθερές για τις ρυθμίσεις γραμμών
 *
 * @version 2.0.0 (Enterprise Cleanup)
 * @migration 2026-01-01: Removed duplicate type definitions - now uses centralized settings-core/types.ts
 * @see settings-core/types.ts for canonical LineType, LineCapStyle, LineJoinStyle
 */

import { UI_COLORS } from '../config/color-config';
// ✅ ENTERPRISE: Use centralized types from settings-core (no duplicates!)
import type { LineType, LineCapStyle, LineJoinStyle } from '../settings-core/types';
// 🏢 ENTERPRISE: i18n support
import type { TFunction } from 'i18next';

// 🏢 ENTERPRISE: i18n key mapping for line types
const LINE_TYPE_I18N_KEYS: Record<LineType, string> = {
  solid: 'solid',
  dashed: 'dashed',
  dotted: 'dotted',
  'dash-dot': 'dashDot',
  'dash-dot-dot': 'dashDotDot'
} as const;

// 🏢 ENTERPRISE: Get translated line type label
export const getLineTypeLabel = (type: LineType, t: TFunction): string => {
  const key = LINE_TYPE_I18N_KEYS[type];
  return t(`lineSettings.types.${key}`);
};

// 🏢 ENTERPRISE: Get translated line cap label
export const getLineCapLabel = (cap: LineCapStyle, t: TFunction): string => {
  return t(`lineSettings.caps.${cap}`);
};

// 🏢 ENTERPRISE: Get translated line join label
export const getLineJoinLabel = (join: LineJoinStyle, t: TFunction): string => {
  return t(`lineSettings.joins.${join}`);
};

// 🏢 ENTERPRISE: Get translated template category label
export const getTemplateCategoryLabel = (category: string, t: TFunction): string => {
  return t(`lineSettings.categories.${category}`);
};

// ✅ ENTERPRISE: Line type labels (legacy - use getLineTypeLabel for i18n)
// Canonical types: 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'dash-dot-dot'
export const LINE_TYPE_LABELS: Record<LineType, string> = {
  solid: 'Συνεχής',
  dashed: 'Διακεκομμένη',
  dotted: 'Κουκκίδες',
  'dash-dot': 'Παύλα-Κουκκίδα',
  'dash-dot-dot': 'Παύλα-Κουκκίδα-Κουκκίδα'
} as const;

// Line cap labels (legacy - use getLineCapLabel for i18n)
export const LINE_CAP_LABELS = {
  butt: 'Τετράγωνη',
  round: 'Στρογγυλή',
  square: 'Προεκτεταμένη'
} as const;

// Line join labels (legacy - use getLineJoinLabel for i18n)
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

// Template category labels (legacy - use getTemplateCategoryLabel for i18n)
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
  nameKey?: string;
  category: TemplateCategory;
  description: string;
  descriptionKey?: string;
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
    nameKey: 'lineSettings.templates.mainLine.name',
    category: 'engineering',
    description: 'Συνεχόμενη γραμμή για κύρια στοιχεία',
    descriptionKey: 'lineSettings.templates.mainLine.description',
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
    nameKey: 'lineSettings.templates.centerLine.name',
    category: 'engineering',
    description: 'Παύλες-τελείες για άξονες συμμετρίας',
    descriptionKey: 'lineSettings.templates.centerLine.description',
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
    nameKey: 'lineSettings.templates.hiddenLine.name',
    category: 'engineering',
    description: 'Διακεκομμένη γραμμή για κρυφά στοιχεία',
    descriptionKey: 'lineSettings.templates.hiddenLine.description',
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
    nameKey: 'lineSettings.templates.dimensions.name',
    category: 'engineering',
    description: 'Λεπτή γραμμή για διαστάσεις',
    descriptionKey: 'lineSettings.templates.dimensions.description',
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
    nameKey: 'lineSettings.templates.wall.name',
    category: 'architectural',
    description: 'Παχιά γραμμή για τοίχους',
    descriptionKey: 'lineSettings.templates.wall.description',
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
    nameKey: 'lineSettings.templates.furniture.name',
    category: 'architectural',
    description: 'Μεσαία γραμμή για έπιπλα',
    descriptionKey: 'lineSettings.templates.furniture.description',
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
    nameKey: 'lineSettings.templates.auxiliary.name',
    category: 'architectural',
    description: 'Διακεκομμένες γραμμές κατασκευής',
    descriptionKey: 'lineSettings.templates.auxiliary.description',
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
    nameKey: 'lineSettings.templates.cables.name',
    category: 'electrical',
    description: 'Συνεχόμενες γραμμές για καλώδια',
    descriptionKey: 'lineSettings.templates.cables.description',
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
    nameKey: 'lineSettings.templates.signals.name',
    category: 'electrical',
    description: 'Παύλες-τελείες για σήματα',
    descriptionKey: 'lineSettings.templates.signals.description',
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
    nameKey: 'lineSettings.templates.grounding.name',
    category: 'electrical',
    description: 'Διπλές τελείες για γείωση',
    descriptionKey: 'lineSettings.templates.grounding.description',
    settings: {
      // ✅ ENTERPRISE FIX: Changed from 'double-dot' to 'dash-dot-dot' (canonical type)
      lineType: 'dash-dot-dot',
      lineWidth: 1.5,
      color: UI_COLORS.MEASUREMENT_TEXT,
      opacity: 0.85,
      dashScale: 1.1,
      dashOffset: 0,
      lineCap: 'round',
      lineJoin: 'round',
      breakAtCenter: false,
      hoverColor: UI_COLORS.SNAP_DEFAULT,
      hoverType: 'dash-dot-dot',
      hoverWidth: 1.8,
      hoverOpacity: 0.9,
      finalColor: UI_COLORS.BRIGHT_GREEN,
      finalType: 'dash-dot-dot',
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
export function getTemplateLabel(template: LineTemplate, t: TFunction): string {
  return template.nameKey ? t(template.nameKey) : template.name;
}

export function getTemplateDescription(template: LineTemplate, t: TFunction): string {
  return template.descriptionKey ? t(template.descriptionKey) : template.description;
}
