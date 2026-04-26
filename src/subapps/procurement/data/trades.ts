import type { Trade, TradeCode, TradeGroup } from '../types/trade';

// ============================================================================
// TRADE SEED DATA — 32 trades / 8 groups
// ADR-327 §9 + §17 Q14+15
// relatedAtoeCategories: ΑΤΟΕ codes (OIK-1..OIK-12) per ADR-175 §3.3
// ============================================================================

type TradeSeed = Pick<Trade, 'code' | 'group' | 'labelEl' | 'labelEn' | 'relatedAtoeCategories' | 'defaultUnits' | 'sortOrder'>;

export const TRADE_SEED_DATA: TradeSeed[] = [
  // ── STRUCTURE ───────────────────────────────────────────────────────────────
  { code: 'concrete',      group: 'structure', labelEl: 'Μπετόν / Μπετατζής',             labelEn: 'Concrete',              relatedAtoeCategories: ['OIK-2'],              defaultUnits: ['m³', 'm²'], sortOrder: 10 },
  { code: 'masonry',       group: 'structure', labelEl: 'Τοιχοποιία / Κτίστης',           labelEn: 'Masonry',               relatedAtoeCategories: ['OIK-3'],              defaultUnits: ['m²', 'τεμ'], sortOrder: 20 },
  { code: 'formwork',      group: 'structure', labelEl: 'Ξυλότυπος',                       labelEn: 'Formwork',              relatedAtoeCategories: ['OIK-2'],              defaultUnits: ['m²'], sortOrder: 30 },
  { code: 'reinforcement', group: 'structure', labelEl: 'Σιδεράς / Σιδηροπλέγματα',       labelEn: 'Reinforcement Steel',   relatedAtoeCategories: ['OIK-2', 'OIK-12'],   defaultUnits: ['kg', 'τν'], sortOrder: 40 },

  // ── FRAMES & OPENINGS ────────────────────────────────────────────────────────
  { code: 'aluminum_frames',   group: 'frames', labelEl: 'Αλουμίνια / Κουφώματα Εξωτερικά', labelEn: 'Aluminum Frames',      relatedAtoeCategories: ['OIK-6'], defaultUnits: ['m²', 'τεμ'], sortOrder: 110 },
  { code: 'interior_frames',   group: 'frames', labelEl: 'Εσωτερικά Κουφώματα / Πόρτες',    labelEn: 'Interior Doors/Frames', relatedAtoeCategories: ['OIK-6'], defaultUnits: ['τεμ'], sortOrder: 120 },
  { code: 'glazing',           group: 'frames', labelEl: 'Τζαμαδόρος / Υαλοπίνακες',       labelEn: 'Glazing',              relatedAtoeCategories: ['OIK-6'], defaultUnits: ['m²', 'τεμ'], sortOrder: 130 },
  { code: 'rolling_shutters',  group: 'frames', labelEl: 'Ρολά / Σήτες',                   labelEn: 'Rolling Shutters',     relatedAtoeCategories: ['OIK-6'], defaultUnits: ['m²', 'τεμ'], sortOrder: 140 },

  // ── NETWORKS / MEP ───────────────────────────────────────────────────────────
  { code: 'plumbing',        group: 'networks', labelEl: 'Υδραυλικά',                        labelEn: 'Plumbing',              relatedAtoeCategories: ['OIK-8'],              defaultUnits: ['m', 'τεμ'], sortOrder: 210 },
  { code: 'electrical',      group: 'networks', labelEl: 'Ηλεκτρολογικά',                    labelEn: 'Electrical',            relatedAtoeCategories: ['OIK-9'],              defaultUnits: ['m', 'τεμ', 'σημεία'], sortOrder: 220 },
  { code: 'hvac',            group: 'networks', labelEl: 'Μηχανολογικά / HVAC / Κλιματισμός', labelEn: 'Mechanical / HVAC',    relatedAtoeCategories: ['OIK-8'],              defaultUnits: ['τεμ', 'kW'], sortOrder: 230 },
  { code: 'gas',             group: 'networks', labelEl: 'Φυσικό Αέριο / Εγκατάσταση',       labelEn: 'Gas Installation',      relatedAtoeCategories: ['OIK-8'],              defaultUnits: ['m', 'τεμ'], sortOrder: 240 },
  { code: 'fire_protection', group: 'networks', labelEl: 'Πυρόσβεση / Πυρανίχνευση',         labelEn: 'Fire Protection',       relatedAtoeCategories: ['OIK-8', 'OIK-9'],    defaultUnits: ['τεμ', 'm²'], sortOrder: 250 },
  { code: 'data_telecoms',   group: 'networks', labelEl: 'Δίκτυα Δεδομένων / Τηλεπικοινωνίες', labelEn: 'Data & Telecoms',     relatedAtoeCategories: ['OIK-9'],              defaultUnits: ['m', 'σημεία'], sortOrder: 260 },

  // ── CLADDINGS & COVERINGS ────────────────────────────────────────────────────
  { code: 'tiling',        group: 'claddings', labelEl: 'Πλακάκια / Κεραμικά',            labelEn: 'Tiling',             relatedAtoeCategories: ['OIK-5'],              defaultUnits: ['m²'], sortOrder: 310 },
  { code: 'marble',        group: 'claddings', labelEl: 'Μάρμαρα / Φυσικός Λίθος',        labelEn: 'Marble / Stone',     relatedAtoeCategories: ['OIK-5', 'OIK-11'],   defaultUnits: ['m²', 'm'], sortOrder: 320 },
  { code: 'insulation',    group: 'claddings', labelEl: 'Μονώσεις (Θερμική/Υδρόμονωση)', labelEn: 'Insulation',         relatedAtoeCategories: ['OIK-10'],             defaultUnits: ['m²'], sortOrder: 330 },
  { code: 'waterproofing', group: 'claddings', labelEl: 'Στεγανοποίηση / Ασφαλτικά',     labelEn: 'Waterproofing',      relatedAtoeCategories: ['OIK-10'],             defaultUnits: ['m²'], sortOrder: 340 },
  { code: 'gypsum',        group: 'claddings', labelEl: 'Γυψοκαρτές / Οροφές',            labelEn: 'Drywall / Ceilings', relatedAtoeCategories: ['OIK-3', 'OIK-4'],    defaultUnits: ['m²'], sortOrder: 350 },

  // ── FINISHING ────────────────────────────────────────────────────────────────
  { code: 'painting',      group: 'finishing', labelEl: 'Ελαιοχρωματισμοί / Βαφές', labelEn: 'Painting',      relatedAtoeCategories: ['OIK-7'],              defaultUnits: ['m²'], sortOrder: 410 },
  { code: 'plastering',    group: 'finishing', labelEl: 'Σοβατίσματα',               labelEn: 'Plastering',    relatedAtoeCategories: ['OIK-4'],              defaultUnits: ['m²'], sortOrder: 420 },
  { code: 'woodwork',      group: 'finishing', labelEl: 'Ξυλουργικά / Έπιπλα',      labelEn: 'Woodwork',      relatedAtoeCategories: ['OIK-6', 'OIK-5', 'OIK-11'], defaultUnits: ['m²', 'τεμ'], sortOrder: 430 },
  { code: 'flooring_wood', group: 'finishing', labelEl: 'Ξύλινα Δάπεδα / Parquet',  labelEn: 'Wood Flooring', relatedAtoeCategories: ['OIK-5'],              defaultUnits: ['m²'], sortOrder: 440 },

  // ── EXTERNAL ─────────────────────────────────────────────────────────────────
  { code: 'roofing',      group: 'external', labelEl: 'Στέγη / Κεραμοσκεπή',                labelEn: 'Roofing',       relatedAtoeCategories: ['OIK-10'],             defaultUnits: ['m²'], sortOrder: 510 },
  { code: 'landscaping',  group: 'external', labelEl: 'Διαμόρφωση Εξωτερικών Χώρων',        labelEn: 'Landscaping',   relatedAtoeCategories: ['OIK-1'],              defaultUnits: ['m²', 'τεμ'], sortOrder: 520 },
  { code: 'facade',       group: 'external', labelEl: 'Πρόσοψη / Εξωτερική Μόνωση (ETICS)', labelEn: 'Facade / ETICS', relatedAtoeCategories: ['OIK-4', 'OIK-10'],   defaultUnits: ['m²'], sortOrder: 530 },

  // ── SPECIAL ──────────────────────────────────────────────────────────────────
  { code: 'elevator', group: 'special', labelEl: 'Ανελκυστήρας',                     labelEn: 'Elevator',                relatedAtoeCategories: ['OIK-12'],             defaultUnits: ['τεμ'], sortOrder: 610 },
  { code: 'prefab',   group: 'special', labelEl: 'Προκατασκευή / Μεταλλικές Κατ.', labelEn: 'Prefab / Metal Structures', relatedAtoeCategories: ['OIK-12'],             defaultUnits: ['τν', 'm²'], sortOrder: 620 },
  { code: 'pool',     group: 'special', labelEl: 'Πισίνα / Υδατοδεξαμενή',          labelEn: 'Pool',                    relatedAtoeCategories: ['OIK-2', 'OIK-8'],    defaultUnits: ['τεμ', 'm³'], sortOrder: 630 },

  // ── SERVICES / LOGISTICS ─────────────────────────────────────────────────────
  { code: 'materials_general', group: 'services', labelEl: 'Υλικά (Γενικά)',                  labelEn: 'General Materials',       relatedAtoeCategories: [],    defaultUnits: ['τεμ', 'kg', 'm'], sortOrder: 710 },
  { code: 'equipment_rental',  group: 'services', labelEl: 'Ενοικίαση Εξοπλισμού / Γερανοί', labelEn: 'Equipment Rental',        relatedAtoeCategories: [],    defaultUnits: ['ημ', 'ώρ'], sortOrder: 720 },
  { code: 'demolition',        group: 'services', labelEl: 'Κατεδάφιση / Εκσκαφή',           labelEn: 'Demolition / Excavation', relatedAtoeCategories: ['OIK-1'], defaultUnits: ['m³', 'm²', 'τν'], sortOrder: 730 },
];

export const TRADE_BY_CODE: Partial<Record<TradeCode, TradeSeed>> = Object.fromEntries(
  TRADE_SEED_DATA.map((t) => [t.code, t])
) as Partial<Record<TradeCode, TradeSeed>>;

export const TRADES_BY_GROUP: Record<TradeGroup, TradeSeed[]> = {
  structure:  TRADE_SEED_DATA.filter((t) => t.group === 'structure'),
  frames:     TRADE_SEED_DATA.filter((t) => t.group === 'frames'),
  networks:   TRADE_SEED_DATA.filter((t) => t.group === 'networks'),
  claddings:  TRADE_SEED_DATA.filter((t) => t.group === 'claddings'),
  finishing:  TRADE_SEED_DATA.filter((t) => t.group === 'finishing'),
  external:   TRADE_SEED_DATA.filter((t) => t.group === 'external'),
  special:    TRADE_SEED_DATA.filter((t) => t.group === 'special'),
  services:   TRADE_SEED_DATA.filter((t) => t.group === 'services'),
};

// ============================================================================
// ΑΤΟΕ ↔ TRADE MAPPING HELPERS (pure, no async, client-safe)
// ADR-327 P5-BOQ + P5-ATOE
// ============================================================================

// Primary trade for each ΑΤΟΕ category code (OIK-1..OIK-12 per ADR-175 §3.3)
const ATOE_TO_PRIMARY_TRADE: Partial<Record<string, TradeCode>> = {
  'OIK-1':  'demolition',
  'OIK-2':  'concrete',
  'OIK-3':  'masonry',
  'OIK-4':  'plastering',
  'OIK-5':  'tiling',
  'OIK-6':  'aluminum_frames',
  'OIK-7':  'painting',
  'OIK-8':  'plumbing',
  'OIK-9':  'electrical',
  'OIK-10': 'insulation',
  'OIK-11': 'woodwork',
  'OIK-12': 'reinforcement',
};

/** Returns ΑΤΟΕ category codes related to a trade (from seed data). Client-safe. */
export function getAtoeCodesForTrade(tradeCode: TradeCode): string[] {
  return TRADE_BY_CODE[tradeCode]?.relatedAtoeCategories ?? [];
}

/** Returns the primary trade code for an ΑΤΟΕ category, or null if unknown. Client-safe. */
export function getTradeCodeForAtoeCategory(atoeCode: string): TradeCode | null {
  return ATOE_TO_PRIMARY_TRADE[atoeCode] ?? null;
}
