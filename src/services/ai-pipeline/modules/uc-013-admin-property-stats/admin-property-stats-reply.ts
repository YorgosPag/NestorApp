/**
 * =============================================================================
 * UC-013 — Η ΑΠΑΝΤΗΣΗ ΣΕ ΚΕΙΜΕΝΟ (ADR-145)
 * =============================================================================
 *
 * 🔴 **Γιατί ξεχωριστό αρχείο, και όχι κόψιμο για να χωρέσει σε 500 γραμμές:**
 * το module απαντά στο *«πώς τρέχει αυτό το βήμα του pipeline;»* (lookup → propose →
 * execute → acknowledge, με Firestore, δικαιώματα και κανάλι απάντησης). Εδώ ζει
 * **άλλη** ερώτηση: *«πώς διαβάζεται αυτό από άνθρωπο;»* — καθαρή μορφοποίηση, καμία
 * είσοδος/έξοδος, καμία εξάρτηση από `server-only`, άρα **δοκιμάσιμη χωρίς pipeline**.
 *
 * Ο χωρισμός έγινε στο σημείο όπου αλλάζει η ερώτηση· γι' αυτό ταξιδεύουν μαζί εδώ
 * **και** τα σχήματα των στατιστικών: είναι το λεξιλόγιο της απάντησης, όχι της άντλησης.
 *
 * @module services/ai-pipeline/modules/uc-013-admin-property-stats/admin-property-stats-reply
 * @see ADR-145 (Super Admin AI Assistant)
 */

import { getPropertyTypeLabelEL } from '@/constants/property-type-aliases';

// ============================================================================
// ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΗΣ ΑΠΑΝΤΗΣΗΣ
// ============================================================================

export type StatsType = 'properties' | 'contacts' | 'projects' | 'all' | 'property_categories';

const VALID_STATS_TYPES: ReadonlySet<string> = new Set<StatsType>([
  'properties', 'contacts', 'projects', 'all', 'property_categories',
]);

export function isValidStatsType(value: string): value is StatsType {
  return VALID_STATS_TYPES.has(value);
}

export interface ContactStats {
  total: number;
  individuals: number;
  companies: number;
}

export interface ProjectStats {
  total: number;
  names: string[];
}

export interface AggregatePropertyStats {
  total: number;
  sold: number;
  available: number;
  reserved: number;
  other: number;
  /** Breakdown by property type (e.g., apartment: 5, studio: 3) */
  byType: Record<string, number>;
}

export interface ProjectPropertyBreakdown {
  projectId: string;
  projectName: string;
  total: number;
  sold: number;
  available: number;
  reserved: number;
  other: number;
}

/** Ό,τι χρειάζεται η απάντηση για να γραφτεί — τίποτα από το pipeline. */
export interface StatsReplyInput {
  statsType: StatsType;
  projectFilter: string | null;
  totalStats: AggregatePropertyStats | null;
  projectBreakdown: readonly ProjectPropertyBreakdown[];
  contactStats: ContactStats | null;
  projectStats: ProjectStats | null;
}

// ============================================================================
// PROPERTY TYPE LABEL RESOLVER — ADR-287 Batch 11B
// ============================================================================
// Delegates σε SSoT resolver (@/constants/property-type-aliases) για canonical
// Greek labels. Fallback για 'parking' (not a canonical PropertyType) και για
// unknown types (επιστρέφει το raw input όπως είχε πριν).

function resolvePropertyTypeLabel(typeKey: string): string {
  const canonicalLabel = getPropertyTypeLabelEL(typeKey);
  if (canonicalLabel !== null) return canonicalLabel;
  if (typeKey.trim().toLowerCase() === 'parking') return 'Parking';
  return typeKey;
}

/**
 * ⚠️ ADR-584 — **μία** απάντηση στο «πώς γράφεται η ανάλυση ανά τύπο».
 *
 * Δύο καλούντες με **διαφορετικό κατώφλι**, όχι διαφορετική μορφή: η λειτουργία
 * «κατηγορίες» δείχνει την ανάλυση ακόμα και με **έναν** τύπο (είναι το ζητούμενο),
 * ενώ τα γενικά στατιστικά τη δείχνουν μόνο όταν υπάρχει κάτι να **συγκριθεί**.
 * Το κατώφλι είναι η διαφορά — δεύτερο αντίγραφο του σώματος θα ήταν δεύτερη
 * απάντηση στο ίδιο ερώτημα, και θα απέκλινε στην πρώτη αλλαγή ετικέτας.
 *
 * @returns `true` αν γράφτηκε ανάλυση — ο καλών που έχει εναλλακτικό κείμενο το ρωτά.
 */
function pushTypeBreakdown(
  lines: string[],
  byType: Record<string, number>,
  minEntries: number,
): boolean {
  const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  if (typeEntries.length < minEntries) return false;

  lines.push('');
  lines.push('Ανά τύπο:');
  for (const [typeName, count] of typeEntries) {
    lines.push(`  ${resolvePropertyTypeLabel(typeName)}: ${count}`);
  }
  return true;
}

// ============================================================================
// ΟΙ ΤΡΕΙΣ ΕΝΟΤΗΤΕΣ
// ============================================================================

function pushContactStats(lines: string[], stats: ContactStats): void {
  lines.push('Στατιστικά επαφών:');
  lines.push('');
  lines.push(`Σύνολο: ${stats.total}`);
  lines.push(`  Φυσικά πρόσωπα: ${stats.individuals}`);
  lines.push(`  Εταιρείες: ${stats.companies}`);
}

function pushProjectStats(lines: string[], stats: ProjectStats): void {
  lines.push('Στατιστικά έργων:');
  lines.push('');
  lines.push(`Σύνολο: ${stats.total}`);
  for (const name of stats.names) {
    lines.push(`  • ${name}`);
  }
}

function pushCategoryBreakdown(lines: string[], stats: AggregatePropertyStats): void {
  lines.push('Κατηγορίες ακινήτων:');
  lines.push('');
  lines.push(`Σύνολο: ${stats.total}`);

  if (!pushTypeBreakdown(lines, stats.byType, 1)) {
    lines.push('');
    lines.push('Δεν βρέθηκαν καταχωρημένοι τύποι.');
  }
}

function pushStandardPropertyStats(
  lines: string[],
  stats: AggregatePropertyStats,
  projectFilter: string | null,
  projectBreakdown: readonly ProjectPropertyBreakdown[],
): void {
  lines.push(
    projectFilter
      ? `Στατιστικά ακινήτων (φίλτρο: "${projectFilter}"):`
      : 'Στατιστικά ακινήτων:',
  );
  lines.push('');
  lines.push(`Σύνολο: ${stats.total}`);
  lines.push(`  Πωλημένα: ${stats.sold}`);
  lines.push(`  Διαθέσιμα: ${stats.available}`);
  if (stats.reserved > 0) lines.push(`  Κρατημένα: ${stats.reserved}`);
  if (stats.other > 0) lines.push(`  Λοιπά: ${stats.other}`);

  // Ανάλυση ανά τύπο μόνο όταν υπάρχει κάτι να συγκριθεί
  pushTypeBreakdown(lines, stats.byType, 2);

  if (projectBreakdown.length > 1) {
    lines.push('');
    lines.push('Ανά έργο:');
    for (const proj of projectBreakdown) {
      lines.push(`  ${proj.projectName}: ${proj.total} (${proj.sold} πωλ., ${proj.available} διαθ.)`);
    }
  }
}

// ============================================================================
// Η ΑΠΑΝΤΗΣΗ
// ============================================================================

/**
 * Γράφει την απάντηση των στατιστικών ως απλό κείμενο.
 *
 * Οι ενότητες μπαίνουν με τη σειρά επαφές → έργα → ακίνητα, χωρισμένες με κενή
 * γραμμή **μόνο όταν προηγείται κάτι** — γι' αυτό το κενό γράφεται από τον καλούντα
 * και όχι από κάθε ενότητα: μια ενότητα δεν ξέρει αν είναι η πρώτη.
 */
export function formatStatsReply(input: StatsReplyInput): string {
  const { statsType, totalStats, projectBreakdown, projectFilter, contactStats, projectStats } = input;
  const lines: string[] = [];

  const wantsProperties =
    statsType === 'properties' || statsType === 'all' || statsType === 'property_categories';

  if (contactStats && (statsType === 'contacts' || statsType === 'all')) {
    pushContactStats(lines, contactStats);
  }

  if (projectStats && (statsType === 'projects' || statsType === 'all')) {
    if (lines.length > 0) lines.push('');
    pushProjectStats(lines, projectStats);
  }

  if (totalStats && wantsProperties) {
    if (lines.length > 0) lines.push('');
    if (statsType === 'property_categories') {
      pushCategoryBreakdown(lines, totalStats);
    } else {
      pushStandardPropertyStats(lines, totalStats, projectFilter, projectBreakdown);
    }
  }

  if (lines.length === 0) {
    lines.push('Δεν βρέθηκαν στοιχεία.');
  }

  return lines.join('\n');
}
