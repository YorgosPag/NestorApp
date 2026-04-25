import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// TRADE GROUPS
// ============================================================================

export const TRADE_GROUP_CODES = [
  'structure',
  'frames',
  'networks',
  'claddings',
  'finishing',
  'external',
  'special',
  'services',
] as const;

export type TradeGroup = typeof TRADE_GROUP_CODES[number];

export const TRADE_GROUP_META: Record<TradeGroup, { labelEl: string; labelEn: string }> = {
  structure:  { labelEl: 'Σκελετός',               labelEn: 'Structure' },
  frames:     { labelEl: 'Κουφώματα',              labelEn: 'Frames & Openings' },
  networks:   { labelEl: 'Δίκτυα (Η/Μ)',           labelEn: 'Networks / MEP' },
  claddings:  { labelEl: 'Επενδύσεις',             labelEn: 'Claddings & Coverings' },
  finishing:  { labelEl: 'Φινίρισμα',              labelEn: 'Finishing' },
  external:   { labelEl: 'Εξωτερικά',              labelEn: 'External Works' },
  special:    { labelEl: 'Ειδικές Εγκαταστάσεις', labelEn: 'Special Works' },
  services:   { labelEl: 'Υπηρεσίες / Logistics', labelEn: 'Services / Logistics' },
};

// ============================================================================
// TRADE CODES (32 trades)
// ============================================================================

export const TRADE_CODES = [
  // Structure (4)
  'concrete', 'masonry', 'formwork', 'reinforcement',
  // Frames (4)
  'aluminum_frames', 'interior_frames', 'glazing', 'rolling_shutters',
  // Networks / MEP (6)
  'plumbing', 'electrical', 'hvac', 'gas', 'fire_protection', 'data_telecoms',
  // Claddings (5)
  'tiling', 'marble', 'insulation', 'waterproofing', 'gypsum',
  // Finishing (4)
  'painting', 'plastering', 'woodwork', 'flooring_wood',
  // External (3)
  'roofing', 'landscaping', 'facade',
  // Special (3)
  'elevator', 'prefab', 'pool',
  // Services (3)
  'materials_general', 'equipment_rental', 'demolition',
] as const;

export type TradeCode = typeof TRADE_CODES[number];

// ============================================================================
// TRADE ENTITY
// ============================================================================

export interface Trade {
  id: string;
  code: TradeCode;
  group: TradeGroup;
  labelEl: string;
  labelEn: string;
  relatedAtoeCategories: string[];
  defaultUnits: string[];
  isActive: boolean;
  sortOrder: number;
  companyId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CustomTrade = Omit<Trade, 'code'> & {
  code: string;
  isCustom: true;
};

export interface TradeFilters {
  group?: TradeGroup;
  isActive?: boolean;
  search?: string;
}
