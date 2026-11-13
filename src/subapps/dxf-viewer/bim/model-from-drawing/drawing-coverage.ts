/**
 * ADR-911 — **Αναφορά κάλυψης**: τι από το σχέδιο εξηγήθηκε και τι έμεινε ανεξήγητο.
 *
 * Κανείς από τους μεγάλους δεν το δίνει (το Chief Architect μετατρέπει ό,τι μπορεί και
 * σιωπά για τα υπόλοιπα — «πάντα πολύ καθάρισμα»). Εδώ κάθε γραμμική οντότητα του σχεδίου
 * πέφτει σε ΑΚΡΙΒΩΣ μία από τρεις στήλες, και η λογιστική κλείνει (άγκυρα Α-2):
 *
 *   εξηγημένες + ανεξήγητες + αγνοημένες = όλες
 *
 *   · **εξηγημένη**  — έχει τον ρόλο και είναι ακμή κάποιου ανιχνευμένου ορθογωνίου
 *                      (ό,τι κι αν απέγινε το ορθογώνιο: έτοιμο, απορριφθέν, προς απόφαση).
 *   · **ανεξήγητη**  — έχει τον ρόλο αλλά δεν ανήκει σε κανένα ορθογώνιο. Αυτές φωτίζονται:
 *                      είναι ο τοίχος που ΔΕΝ θα χτιστεί.
 *   · **αγνοημένη**  — δεν έχει τον ρόλο (άλλο χρώμα). Μετριέται, δεν κρίνεται.
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store.
 *
 * @see ./wall-proposal.ts (ο καταναλωτής)
 * @see docs/centralized-systems/reference/adrs/ADR-911-model-from-drawing-assistant.md
 */

import type { Entity } from '../../types/entities';
import { extractLineSegments, type RegionLineSeg } from '../walls/wall-in-region';

export interface DrawingCoverage {
  /** Οντότητες με τον ρόλο που είναι ακμή ανιχνευμένου ορθογωνίου. */
  readonly explainedIds: readonly string[];
  /** Οντότητες με τον ρόλο που δεν ανήκουν σε κανένα ορθογώνιο — προς φωτισμό. */
  readonly unexplainedIds: readonly string[];
  /** Γραμμικές οντότητες χωρίς τον ρόλο (άλλου χρώματος). */
  readonly ignoredCount: number;
  /** Όλες οι γραμμικές οντότητες του σχεδίου = άθροισμα των τριών παραπάνω. */
  readonly totalCount: number;
}

/** Τα διακριτά ids οντοτήτων πίσω από ένα σύνολο τμημάτων (πολυγραμμή = πολλά τμήματα, ένα id). */
function distinctSourceIds(segments: readonly RegionLineSeg[]): Set<string> {
  const ids = new Set<string>();
  for (const s of segments) {
    if (s.id) ids.add(s.id);
  }
  return ids;
}

/**
 * Λογιστική κάλυψης για έναν ρόλο.
 *
 * @param entities      όλες οι οντότητες του σχεδίου
 * @param roleSegments  τα τμήματα των οντοτήτων που έχουν τον ρόλο (ό,τι πήρε ο ανιχνευτής)
 * @param rectSourceIds για ΚΑΘΕ ανιχνευμένο ορθογώνιο (ανεξαρτήτως κατάληξης) τα ids-πηγή των ακμών του, όπως τα έδωσε το
 *                      `rectEdgeSourceIds` με την ίδια ανοχή κόμβων. Δίνονται έτοιμα: ο καλών τα έχει ήδη υπολογίσει για τα
 *                      στοιχεία της πρότασης, και ο δεύτερος υπολογισμός κόστιζε 458 ms (ADR-929 §6.16 #8, μετρημένο).
 */
export function computeDrawingCoverage(
  entities: readonly Entity[],
  roleSegments: readonly RegionLineSeg[],
  rectSourceIds: readonly (readonly (readonly string[])[])[],
): DrawingCoverage {
  const roleIds = distinctSourceIds(roleSegments);
  const explained = new Set<string>();
  for (const perEdge of rectSourceIds) {
    for (const id of perEdge.flat()) explained.add(id);
  }
  const unexplainedIds = [...roleIds].filter((id) => !explained.has(id));
  const totalCount = distinctSourceIds(extractLineSegments(entities)).size;
  return {
    explainedIds: [...explained],
    unexplainedIds,
    ignoredCount: totalCount - roleIds.size,
    totalCount,
  };
}
