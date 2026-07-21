/**
 * ADR-195 / ADR-684 — regression guard για την «desync» κλάση bug.
 *
 * Ρίζα του bug (mep-fitting, foundation και — ADR-684 — imported-mesh/furniture/generic-solid): ένας
 * audit-client POST-άρει `entityType: X`, αλλά το `X` λείπει από το `ENTITY_COLLECTION_MAP` του route
 * → 400 «Invalid entityType» → `.catch(()=>{})` → **σιωπηλή απώλεια ιστορικού**. Κανένα test δεν το
 * έπιανε. Αυτό το test κλειδώνει ότι ΚΑΘΕ BIM audit entityType είναι εγγεγραμμένος + δείχνει σε
 * υπαρκτή collection — έτσι «μετά το push δουλεύει» το εγγυάται το CI, όχι η ελπίδα.
 */

import {
  ENTITY_COLLECTION_MAP,
  VALID_ENTITY_TYPES,
  SUBCOLLECTION_ENTITY_TYPES,
} from '../audit-entity-collection-map';
import { COLLECTIONS } from '../firestore-collections';

/**
 * Κάθε BIM/floorplan entityType που έχει audit-client (POST-άρει στο /api/audit-trail/record).
 * Προσθέτοντας νέο BIM audit-client → πρόσθεσέ το ΚΑΙ εδώ ΚΑΙ στο `ENTITY_COLLECTION_MAP`· αλλιώς
 * αυτό το test κοκκινίζει (ο σκοπός του — να μη ξανασυμβεί σιωπηλό 400).
 */
const BIM_AUDIT_ENTITY_TYPES = [
  'wall', 'opening', 'slab', 'slab-opening', 'column', 'beam', 'stair', 'roof',
  'mep-fixture', 'mep-system', 'electrical-panel', 'mep-segment', 'mep-manifold',
  'mep-fitting', 'foundation', 'furniture', 'imported-mesh', 'generic-solid',
] as const;

describe('audit entity collection map — desync guard', () => {
  it('κάθε BIM audit entityType είναι εγγεγραμμένος (αλλιώς σιωπηλό 400)', () => {
    for (const t of BIM_AUDIT_ENTITY_TYPES) {
      expect(VALID_ENTITY_TYPES.has(t)).toBe(true);
    }
  });

  it('τα ADR-684 entities δείχνουν στις σωστές top-level collections', () => {
    expect(ENTITY_COLLECTION_MAP['generic-solid']).toBe(COLLECTIONS.FLOORPLAN_GENERIC_SOLIDS);
    expect(ENTITY_COLLECTION_MAP['imported-mesh']).toBe(COLLECTIONS.FLOORPLAN_IMPORTED_MESHES);
    expect(ENTITY_COLLECTION_MAP['furniture']).toBe(COLLECTIONS.FLOORPLAN_FURNITURE);
    // Top-level, ΟΧΙ subcollection — ο route τα διαβάζει με `db.collection(name).doc(id)`.
    for (const t of ['generic-solid', 'imported-mesh', 'furniture']) {
      expect(SUBCOLLECTION_ENTITY_TYPES.has(t)).toBe(false);
    }
  });

  it('κάθε τιμή του χάρτη είναι υπαρκτό, μη-κενό collection name (κανένα typo/undefined)', () => {
    const validCollections = new Set(Object.values(COLLECTIONS));
    for (const [entityType, collection] of Object.entries(ENTITY_COLLECTION_MAP)) {
      expect(typeof collection).toBe('string');
      expect(collection && validCollections.has(collection)).toBeTruthy();
      expect(entityType.length).toBeGreaterThan(0);
    }
  });

  it('VALID_ENTITY_TYPES είναι ΑΚΡΙΒΩΣ τα κλειδιά του χάρτη (SSoT, καμία παράλληλη λίστα)', () => {
    expect([...VALID_ENTITY_TYPES].sort()).toEqual(Object.keys(ENTITY_COLLECTION_MAP).sort());
  });

  it('κάθε subcollection type υπάρχει και στον χάρτη', () => {
    for (const t of SUBCOLLECTION_ENTITY_TYPES) {
      expect(VALID_ENTITY_TYPES.has(t)).toBe(true);
    }
  });
});
