/**
 * ADR-652 M2 — Block geometry blob: (de)serialisation του «αρχείου» ενός block.
 *
 * Το Firestore doc `block_library/{blockId}` κρατά ΜΟΝΟ metadata (bounds/provenance/
 * license). Η γεωμετρία ζει ως ξεχωριστό αντικείμενο στο Storage — ακριβώς όπως ο Revit
 * κρατά την οικογένεια σε `.rfa` και ο ArchiCAD το αντικείμενο σε `.gsm`, με τον κατάλογο
 * να δείχνει προς αυτά (όριο 1MB/doc + ADR-040: δεν φορτώνουμε γεωμετρία για να δείξουμε
 * μια κάρτα στο palette).
 *
 * ΚΑΜΙΑ νέα αναπαράσταση γεωμετρίας: το blob κρατά τα ΙΔΙΑ BLOCK-LOCAL `Entity[]` που
 * κρατά ο in-session ορισμός (`InSessionBlockDef.localMembers`) — δηλαδή ό,τι ακριβώς
 * παράγει το import (`createBlockInstance`). Το μόνο που αφαιρείται είναι το transient UI
 * flag `selected` (κατάσταση συνεδρίας, όχι γεωμετρία).
 *
 * Pure module (μηδέν Firebase deps) ώστε να είναι unit-testable χωρίς harness — ίδιο
 * μοτίβο με το `services/dxf-scene-json.ts` (`parseAndValidateScene`).
 *
 * @see ./block-geometry-storage.ts — το Storage IO που το χρησιμοποιεί
 * @see ../../services/dxf-scene-json.ts — το ίδιο parse+validate συμβόλαιο για σκηνές
 */

import type { Entity } from '../../types/entities';
import type { BlockBoundsMm } from './block-library-types';

/** Έκδοση σχήματος blob — bump ΜΟΝΟ σε breaking αλλαγή του entity contract. */
export const BLOCK_GEOMETRY_BLOB_VERSION = 1;

/** Το σχήμα του αποθηκευμένου αντικειμένου (self-describing: φέρει name + bounds). */
export interface BlockGeometryBlob {
  readonly version: number;
  readonly name: string;
  readonly boundsMm: BlockBoundsMm;
  readonly entities: readonly Entity[];
}

export interface SerializeBlockGeometryInput {
  readonly name: string;
  readonly boundsMm: BlockBoundsMm;
  readonly localMembers: readonly Entity[];
}

/** Καθαρίζει transient UI state — η επιλογή είναι κατάσταση συνεδρίας, όχι γεωμετρία. */
function toPersistedMember(member: Entity): Entity {
  return { ...member, selected: false } as Entity;
}

/** BLOCK-LOCAL members + bounds → JSON κείμενο έτοιμο για upload. */
export function serializeBlockGeometry(input: SerializeBlockGeometryInput): string {
  const blob: BlockGeometryBlob = {
    version: BLOCK_GEOMETRY_BLOB_VERSION,
    name: input.name,
    boundsMm: input.boundsMm,
    entities: input.localMembers.map(toPersistedMember),
  };
  return JSON.stringify(blob);
}

/**
 * JSON κείμενο → validated {@link BlockGeometryBlob}. Επιστρέφει `null` σε άκυρο JSON,
 * άγνωστη/μελλοντική έκδοση, ή blob χωρίς γεωμετρία (ένα block χωρίς members ΔΕΝ είναι
 * τοποθετήσιμο — καλύτερα να λείπει από το palette παρά να τοποθετεί το τίποτα).
 */
export function parseBlockGeometryBlob(text: string): BlockGeometryBlob | null {
  try {
    const parsed = JSON.parse(text) as Partial<BlockGeometryBlob> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== BLOCK_GEOMETRY_BLOB_VERSION) return null;

    const entities = parsed.entities;
    if (!Array.isArray(entities) || entities.length === 0) return null;

    const bounds = parsed.boundsMm;
    if (!bounds || typeof bounds.minX !== 'number' || typeof bounds.maxX !== 'number') return null;
    if (typeof bounds.minY !== 'number' || typeof bounds.maxY !== 'number') return null;

    const name = typeof parsed.name === 'string' ? parsed.name : '';
    if (!name) return null;

    return {
      version: BLOCK_GEOMETRY_BLOB_VERSION,
      name,
      boundsMm: bounds,
      entities: entities as readonly Entity[],
    };
  } catch {
    return null;
  }
}
