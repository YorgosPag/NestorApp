/**
 * ADR-739 Επίπεδο Β — **οι πέντε ρητές καταστάσεις του δεσμού**.
 *
 * Ο κλάδος του κριτηρίου τρέχει τον **πραγματικό** `applyScheduleFilters` του ADR-363, όχι
 * μίμησή του: αν το φιλτράρισμα αλλάξει σημασιολογία, αυτά τα tests πρέπει να το μάθουν.
 */

import { needsAttention, resolveTableRowLink } from '../table-row-link-resolver';
import type { FilterableBimEntity } from '../../schedule/filters';
import type { ScheduleFilterCriteria } from '../../schedule/types';
import type { TableRowLink } from '../../../types/table-row-link';

// ── Εργαλεία ────────────────────────────────────────────────────────────────

function entity(
  id: string,
  kind: string,
  floorId?: string,
  material?: string,
): FilterableBimEntity {
  return {
    id,
    kind,
    ...(floorId !== undefined ? { floorId } : {}),
    geometry: { bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } } },
    params: material !== undefined ? { material } : {},
  };
}

const SCENE: FilterableBimEntity[] = [
  entity('wall_a', 'wall', 'f1', 'beton'),
  entity('wall_b', 'wall', 'f1', 'brick'),
  entity('found_a', 'foundation', 'f0', 'beton'),
];

function ids(entityIds: readonly string[]): TableRowLink {
  return { target: { kind: 'ids', entityIds }, origin: 'manual' };
}

function query(criteria: ScheduleFilterCriteria): TableRowLink {
  return { target: { kind: 'query', criteria }, origin: 'bound' };
}

// ── Ρητή λίστα ──────────────────────────────────────────────────────────────

describe('ρητή λίστα ταυτοτήτων', () => {
  it('όλες ζωντανές ⇒ resolved', () => {
    const r = resolveTableRowLink(ids(['wall_a', 'wall_b']), SCENE);
    expect(r.status).toBe('resolved');
    expect(r.entityIds).toEqual(['wall_a', 'wall_b']);
    expect(r.missingIds).toEqual([]);
  });

  it('η ΣΕΙΡΑ επιλογής του χρήστη διατηρείται', () => {
    expect(resolveTableRowLink(ids(['wall_b', 'wall_a']), SCENE).entityIds).toEqual([
      'wall_b',
      'wall_a',
    ]);
  });

  it('🔴 μερικές χαμένες ⇒ partial — ΚΑΙ οι ζωντανές επιστρέφονται', () => {
    // Το Navisworks καταγράφει τη διαφορά σε στήλη κατάστασης και ρωτά τον χρήστη· δεν
    // «διορθώνει» μόνο του. Σβήνοντας τις ζωντανές θα κρύβαμε δουλειά που ισχύει ακόμη.
    const r = resolveTableRowLink(ids(['wall_a', 'ghost']), SCENE);
    expect(r.status).toBe('partial');
    expect(r.entityIds).toEqual(['wall_a']);
    expect(r.missingIds).toEqual(['ghost']);
  });

  it('όλες χαμένες ⇒ orphan (ΟΧΙ empty — ζήτησε κάτι και δεν το βρήκε)', () => {
    const r = resolveTableRowLink(ids(['ghost_1', 'ghost_2']), SCENE);
    expect(r.status).toBe('orphan');
    expect(r.missingIds).toEqual(['ghost_1', 'ghost_2']);
  });

  it('κενή λίστα ⇒ empty (ΟΧΙ orphan — δεν ζήτησε τίποτα)', () => {
    expect(resolveTableRowLink(ids([]), SCENE).status).toBe('empty');
  });

  it('άδεια σκηνή δεν σπάει — τα πάντα ορφανά', () => {
    expect(resolveTableRowLink(ids(['wall_a']), []).status).toBe('orphan');
  });
});

// ── Κριτήριο ────────────────────────────────────────────────────────────────

describe('κριτήριο — μέσα από τον ΠΡΑΓΜΑΤΙΚΟ applyScheduleFilters', () => {
  it('άξονας ορόφου ⇒ resolved με τους επιζώντες', () => {
    const r = resolveTableRowLink(query({ floorIds: ['f1'] }), SCENE);
    expect(r.status).toBe('resolved');
    expect(r.entityIds).toEqual(['wall_a', 'wall_b']);
  });

  it('σύνθεση αξόνων είναι ΚΑΙ, όχι Ή', () => {
    const r = resolveTableRowLink(query({ floorIds: ['f1'], categories: ['brick'] }), SCENE);
    expect(r.entityIds).toEqual(['wall_b']);
  });

  it('το κριτήριο πιάνει ΝΕΑ οντότητα χωρίς να αγγιχτεί ο πίνακας (search set)', () => {
    // Αυτό ακριβώς δεν μπορεί να κάνει η ρητή λίστα, και είναι ο λόγος ύπαρξης του κλάδου.
    const grown = [...SCENE, entity('wall_c', 'wall', 'f1', 'beton')];
    expect(resolveTableRowLink(query({ floorIds: ['f1'] }), grown).entityIds).toContain('wall_c');
  });

  it('κριτήριο που δεν ταιριάζει πουθενά ⇒ empty, ΧΩΡΙΣ missingIds', () => {
    const r = resolveTableRowLink(query({ floorIds: ['f9'] }), SCENE);
    expect(r.status).toBe('empty');
    expect(r.missingIds).toEqual([]);
  });

  it('ρητά κενός άξονας («κανένας όροφος») ⇒ empty, ΟΧΙ unresolvable', () => {
    // `[]` σε ορισμένο άξονα σημαίνει match-nothing — είναι ερώτημα, και έχει απάντηση.
    expect(resolveTableRowLink(query({ floorIds: [] }), SCENE).status).toBe('empty');
  });

  it('🔴 ΚΕΝΟ κριτήριο ⇒ unresolvable — ΠΟΤΕ «όλο το κτίριο»', () => {
    // Κάθε άξονας `undefined` είναι pass-through στο `passesAllFilters`, άρα `{}` θα
    // επέστρεφε ΟΛΕΣ τις οντότητες: μια απολύτως νόμιμη, γεμάτη λίστα που καμία πύλη δεν
    // πιάνει — και ποσότητες που κανείς δεν ζήτησε.
    const r = resolveTableRowLink(query({}), SCENE);
    expect(r.status).toBe('unresolvable');
    expect(r.entityIds).toEqual([]);
  });

  it('🔴 κριτήριο με ΜΟΝΟ undefined άξονες είναι επίσης κενό', () => {
    expect(resolveTableRowLink(query({ floorIds: undefined }), SCENE).status).toBe('unresolvable');
  });
});

// ── Η μία απάντηση στο «είναι πρόβλημα;» ───────────────────────────────────

describe('needsAttention', () => {
  it.each(['partial', 'orphan', 'unresolvable'] as const)('%s ⇒ ναι', (status) => {
    expect(needsAttention(status)).toBe(true);
  });

  it.each(['resolved', 'empty'] as const)('%s ⇒ όχι', (status) => {
    // Το `empty` δεν είναι πρόβλημα: σήμα σε κάθε νέο πίνακα = θόρυβος = ο γρηγορότερος
    // δρόμος να μάθει ο χρήστης να αγνοεί το σήμα.
    expect(needsAttention(status)).toBe(false);
  });
});
