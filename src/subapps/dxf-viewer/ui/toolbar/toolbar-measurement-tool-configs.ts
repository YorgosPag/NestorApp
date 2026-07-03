import type { MeasurementTool, MeasurementToolConfig } from './types';

// Extracted from `types.ts` to keep that file under the Google 500-line limit (SRP:
// pure measurement-tool data catalog). Re-exported from `types.ts` for backward compat.
export const MEASUREMENT_TOOL_CONFIGS: Record<MeasurementTool, MeasurementToolConfig> = {
  'measure-distance': {
    id: 'measure-distance',
    name: 'Απόσταση',
    icon: 'Ruler',
    shortcut: 'D',
    description: 'Μέτρηση απόστασης μεταξύ 2 σημείων',
    requiredPoints: 2
  },
  // 🏢 ENTERPRISE (2026-01-27): Continuous distance measurement
  'measure-distance-continuous': {
    id: 'measure-distance-continuous',
    name: 'Συνεχόμενη Απόσταση',
    icon: 'Ruler',
    shortcut: 'D',
    description: 'Συνεχόμενη μέτρηση απόστασης (πολλαπλά σημεία)',
    requiredPoints: 2
  },
  'measure-area': {
    id: 'measure-area',
    name: 'Εμβαδό',
    icon: 'Square',
    shortcut: 'A',
    description: 'Μέτρηση εμβαδού πολυγώνου (3+ σημεία)',
    requiredPoints: 3
  },
  'auto-measure-area': {
    id: 'auto-measure-area',
    name: 'Αυτόματο Εμβαδό',
    icon: 'ScanLine',
    shortcut: '',
    description: 'Κλικ εντός κλειστού πολυγώνου — αυτόματος υπολογισμός',
    requiredPoints: 1
  },
  'measure-angle': {
    id: 'measure-angle',
    name: 'Γωνία',
    icon: 'AngleIcon',
    shortcut: 'T',
    description: 'Μέτρηση γωνίας (3 σημεία)',
    requiredPoints: 3
  },
  'measure-radius': {
    id: 'measure-radius',
    name: 'Ακτίνα',
    icon: 'Circle',
    description: 'Μέτρηση ακτίνας κύκλου',
    requiredPoints: 2
  },
  'measure-perimeter': {
    id: 'measure-perimeter',
    name: 'Περίμετρος',
    icon: 'Pentagon',
    description: 'Μέτρηση περιμέτρου σχήματος',
    requiredPoints: 2
  },
  // ✅ ENTERPRISE FIX: Add missing angle measurement tool configs
  'measure-angle-line-arc': {
    id: 'measure-angle-line-arc',
    name: 'Γωνία Γραμμή-Τόξο',
    icon: 'AngleLineArcIcon',
    shortcut: 'T',
    description: 'Μέτρηση γωνίας μεταξύ γραμμής και τόξου',
    requiredPoints: 3
  },
  'measure-angle-two-arcs': {
    id: 'measure-angle-two-arcs',
    name: 'Γωνία Δύο Τόξων',
    icon: 'AngleTwoArcsIcon',
    shortcut: 'T',
    description: 'Μέτρηση γωνίας μεταξύ δύο τόξων',
    requiredPoints: 3
  },
  'measure-angle-measuregeom': {
    id: 'measure-angle-measuregeom',
    name: 'Γωνία MeasureGeom',
    icon: 'AngleMeasureGeomIcon',
    shortcut: 'T',
    description: 'Μέτρηση γωνίας με MEASUREGEOM (χωρίς διάσταση)',
    requiredPoints: 3
  },
  'measure-angle-constraint': {
    id: 'measure-angle-constraint',
    name: 'Παραμετρικό Constraint Γωνίας',
    icon: 'AngleConstraintIcon',
    shortcut: 'T',
    description: 'Παραμετρικό angle constraint',
    requiredPoints: 3
  }
};
