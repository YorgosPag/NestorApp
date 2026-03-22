/**
 * 🏠 TELEGRAM BOT TYPE CATALOG
 *
 * Centralized property type definitions with synonyms for Telegram bot.
 * Replaces hardcoded keywords in detect.ts and type mapping in criteria.ts.
 *
 * @enterprise PR1 - Zero hardcoded strings centralization
 * @created 2026-01-13
 */

// 🏢 Direct Greek labels for Telegram buttons (i18n keys don't resolve in API routes)
const TELEGRAM_LABELS: Record<string, string> = {
  apartment: 'Διαμέρισμα',
  studio: 'Στούντιο',
  maisonette: 'Μεζονέτα',
  shop: 'Κατάστημα',
  office: 'Γραφείο',
  storage: 'Αποθήκη',
};

// ============================================================================
// TYPES
// ============================================================================

export interface TypeCatalogEntry {
  /** Canonical type value (matches database) */
  canonical: string;
  /** Display label in Greek */
  labelEl: string;
  /** Display label in English */
  labelEn: string;
  /** Synonyms that map to this type (lowercase, for matching) */
  synonyms: string[];
  /** Category for grouping */
  category: 'residential' | 'commercial' | 'industrial';
  /** Emoji for display */
  emoji: string;
  /** Is this type active/available */
  isActive: boolean;
}

export interface KeywordCatalogEntry {
  /** The keyword */
  keyword: string;
  /** Category of keyword */
  category: 'property' | 'action' | 'filter' | 'location';
  /** Weight for scoring (higher = more important) */
  weight: number;
}

// ============================================================================
// PROPERTY TYPE CATALOG
// ============================================================================

/**
 * Centralized property type catalog with Greek synonyms
 * Maps user input variations to canonical database values
 */
export const TELEGRAM_TYPE_CATALOG: TypeCatalogEntry[] = [
  {
    canonical: 'apartment',
    labelEl: TELEGRAM_LABELS.apartment,
    labelEn: 'Apartment',
    synonyms: [
      'διαμέρισμα', 'διαμερίσματα', 'διαμερισμα', 'διαμερισματα',
      'apartment', 'apartments', 'flat', 'flats',
      'ρετιρέ', 'ρετιρε', 'penthouse'
    ],
    category: 'residential',
    emoji: '🏠',
    isActive: true
  },
  {
    canonical: 'studio',
    labelEl: TELEGRAM_LABELS.studio,
    labelEn: 'Studio',
    synonyms: [
      'στούντιο', 'στουντιο', 'studio', 'studios',
      'γκαρσονιέρα', 'γκαρσονιερα', 'garsoniera',
      'bedsit', 'μονοκατοικία μικρή'
    ],
    category: 'residential',
    emoji: '🏡',
    isActive: true
  },
  {
    canonical: 'maisonette',
    labelEl: TELEGRAM_LABELS.maisonette,
    labelEn: 'Maisonette',
    synonyms: [
      'μεζονέτα', 'μεζονετα', 'μεζονέτες', 'μεζονετες',
      'maisonette', 'maisonettes', 'maisonete',
      'διώροφο', 'διοροφο', 'duplex'
    ],
    category: 'residential',
    emoji: '🏘️',
    isActive: true
  },
  {
    canonical: 'shop',
    labelEl: TELEGRAM_LABELS.shop,
    labelEn: 'Shop',
    synonyms: [
      'κατάστημα', 'καταστημα', 'καταστήματα', 'καταστηματα',
      'shop', 'shops', 'store', 'stores',
      'μαγαζί', 'μαγαζι', 'εμπορικό', 'εμπορικο',
      'retail', 'επαγγελματικός χώρος'
    ],
    category: 'commercial',
    emoji: '🏪',
    isActive: true
  },
  {
    canonical: 'office',
    labelEl: TELEGRAM_LABELS.office,
    labelEn: 'Office',
    synonyms: [
      'γραφείο', 'γραφειο', 'γραφεία', 'γραφεια',
      'office', 'offices',
      'επαγγελματικός', 'επαγγελματικος'
    ],
    category: 'commercial',
    emoji: '🏢',
    isActive: true
  },
  {
    canonical: 'storage',
    labelEl: TELEGRAM_LABELS.storage,
    labelEn: 'Storage',
    synonyms: [
      'αποθήκη', 'αποθηκη', 'αποθήκες', 'αποθηκες',
      'storage', 'warehouse',
      'βοηθητικός χώρος'
    ],
    category: 'commercial',
    emoji: '📦',
    isActive: true
  }
];

// ============================================================================
// SEARCH KEYWORDS CATALOG
// ============================================================================

/**
 * Keywords that indicate a property search intent
 * Replaces hardcoded list in detect.ts
 */
export const TELEGRAM_KEYWORD_CATALOG: KeywordCatalogEntry[] = [
  // Property type keywords (high weight)
  { keyword: 'ακίνητο', category: 'property', weight: 10 },
  { keyword: 'ακινητο', category: 'property', weight: 10 },
  { keyword: 'ακίνητα', category: 'property', weight: 10 },
  { keyword: 'ακινητα', category: 'property', weight: 10 },
  { keyword: 'property', category: 'property', weight: 10 },
  { keyword: 'σπίτι', category: 'property', weight: 8 },
  { keyword: 'σπιτι', category: 'property', weight: 8 },
  { keyword: 'κατοικία', category: 'property', weight: 8 },
  { keyword: 'κατοικια', category: 'property', weight: 8 },

  // Action keywords (medium weight)
  { keyword: 'αγορά', category: 'action', weight: 7 },
  { keyword: 'αγορα', category: 'action', weight: 7 },
  { keyword: 'ενοικίαση', category: 'action', weight: 7 },
  { keyword: 'ενοικιαση', category: 'action', weight: 7 },
  { keyword: 'πώληση', category: 'action', weight: 7 },
  { keyword: 'πωληση', category: 'action', weight: 7 },
  { keyword: 'αναζήτηση', category: 'action', weight: 6 },
  { keyword: 'αναζητηση', category: 'action', weight: 6 },
  { keyword: 'ψάχνω', category: 'action', weight: 6 },
  { keyword: 'ψαχνω', category: 'action', weight: 6 },
  { keyword: 'θέλω', category: 'action', weight: 5 },
  { keyword: 'θελω', category: 'action', weight: 5 },
  { keyword: 'search', category: 'action', weight: 6 },
  { keyword: 'find', category: 'action', weight: 6 },
  { keyword: 'buy', category: 'action', weight: 7 },
  { keyword: 'rent', category: 'action', weight: 7 },

  // Filter keywords (medium weight)
  { keyword: 'τιμή', category: 'filter', weight: 5 },
  { keyword: 'τιμη', category: 'filter', weight: 5 },
  { keyword: 'ευρώ', category: 'filter', weight: 4 },
  { keyword: 'ευρω', category: 'filter', weight: 4 },
  { keyword: 'κάτω από', category: 'filter', weight: 5 },
  { keyword: 'κατω απο', category: 'filter', weight: 5 },
  { keyword: 'μέχρι', category: 'filter', weight: 5 },
  { keyword: 'μεχρι', category: 'filter', weight: 5 },
  { keyword: 'δωμάτια', category: 'filter', weight: 4 },
  { keyword: 'δωματια', category: 'filter', weight: 4 },
  { keyword: 'τετραγωνικά', category: 'filter', weight: 4 },
  { keyword: 'τμ', category: 'filter', weight: 4 },
  { keyword: 'under', category: 'filter', weight: 5 },
  { keyword: 'below', category: 'filter', weight: 5 },
  { keyword: 'rooms', category: 'filter', weight: 4 }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get canonical type from user input (synonym matching)
 */
export function getCanonicalType(input: string): string | null {
  const normalizedInput = input.toLowerCase().trim();

  for (const entry of TELEGRAM_TYPE_CATALOG) {
    if (!entry.isActive) continue;

    // Check direct match
    if (entry.canonical === normalizedInput) {
      return entry.canonical;
    }

    // Check synonyms
    for (const synonym of entry.synonyms) {
      if (normalizedInput.includes(synonym)) {
        return entry.canonical;
      }
    }
  }

  return null;
}

/**
 * Get type entry by canonical value
 */
export function getTypeEntry(canonical: string): TypeCatalogEntry | null {
  return TELEGRAM_TYPE_CATALOG.find(entry => entry.canonical === canonical) || null;
}

/**
 * Get all active type entries
 */
export function getActiveTypes(): TypeCatalogEntry[] {
  return TELEGRAM_TYPE_CATALOG.filter(entry => entry.isActive);
}

/**
 * Get types by category
 */
export function getTypesByCategory(category: TypeCatalogEntry['category']): TypeCatalogEntry[] {
  return TELEGRAM_TYPE_CATALOG.filter(entry => entry.isActive && entry.category === category);
}

/**
 * Check if text contains property search keywords
 * Returns score based on keyword weights
 */
export function getSearchScore(text: string): number {
  const normalizedText = text.toLowerCase();
  let score = 0;

  // Check type catalog synonyms (high score for type matches)
  for (const entry of TELEGRAM_TYPE_CATALOG) {
    if (!entry.isActive) continue;
    for (const synonym of entry.synonyms) {
      if (normalizedText.includes(synonym)) {
        score += 15; // High score for type match
        break; // Only count once per type
      }
    }
  }

  // Check keyword catalog
  for (const entry of TELEGRAM_KEYWORD_CATALOG) {
    if (normalizedText.includes(entry.keyword)) {
      score += entry.weight;
    }
  }

  return score;
}

/**
 * Check if text is a property search query (threshold-based)
 */
export function isPropertySearchQuery(text: string, threshold: number = 10): boolean {
  return getSearchScore(text) >= threshold;
}

/**
 * Get all keywords as flat array (for simple matching)
 */
export function getAllKeywords(): string[] {
  const keywords: string[] = [];

  // Add all synonyms from type catalog
  for (const entry of TELEGRAM_TYPE_CATALOG) {
    if (entry.isActive) {
      keywords.push(...entry.synonyms);
    }
  }

  // Add all keywords from keyword catalog
  for (const entry of TELEGRAM_KEYWORD_CATALOG) {
    keywords.push(entry.keyword);
  }

  return [...new Set(keywords)]; // Remove duplicates
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  TELEGRAM_TYPE_CATALOG,
  TELEGRAM_KEYWORD_CATALOG,
  getCanonicalType,
  getTypeEntry,
  getActiveTypes,
  getTypesByCategory,
  getSearchScore,
  isPropertySearchQuery,
  getAllKeywords
};
