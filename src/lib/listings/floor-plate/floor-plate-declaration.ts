/**
 * @fileoverview **Η ΔΗΛΩΣΗ ΜΕ ΥΠΟΓΡΑΦΗ ΑΝΑ ΟΡΟΦΟ** — «διαχειρίζομαι όλες τις μονάδες αυτού του ορόφου» (ADR-907 §11.7).
 * @related services/listings/floor-plate-declaration.service (ο ΕΝΑΣ γραφέας) · services/listings/floor-plate.reader
 * @module lib/listings/floor-plate/floor-plate-declaration
 *
 * Ζει στο έγγραφο του **ορόφου** (`floors/{id}.publishedFloorPlate`): μία δήλωση αφορά όλες τις αγγελίες του ορόφου,
 * και ο όροφος είναι το μόνο έγγραφο που τις ενώνει. Καμία νέα συλλογή ⇒ καμία αλλαγή κανόνων.
 *
 * ⚠️ **Καθαρό module** — καμία I/O. Ο δίσκος δεν είναι έμπιστος: η ανάγνωση ξαναχτίζει τη δήλωση πεδίο προς πεδίο.
 */

import { normalizeToISO } from '@/lib/date-local';
import { isPlainRecord } from '@/lib/type-guards';

import type { FloorPlateCurationRefusal } from './floor-plate-curation';
import type { FloorPlateImageRefusal } from './floor-plate-image';

/** Το πεδίο της δήλωσης στο έγγραφο του ορόφου. */
export const FLOOR_PLATE_DECLARATION_FIELD = 'publishedFloorPlate';

export interface FloorPlateDeclaration {
  /** Το `files/{id}` της εικόνας του ορόφου που ο άνθρωπος **ονόμασε**. */
  readonly fileId: string;
  /** Ποιος υπέγραψε (uid). */
  readonly declaredBy: string;
  /** ISO — πότε υπέγραψε. */
  readonly declaredAt: string;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * **Υπάρχει υπογεγραμμένη δήλωση σε αυτόν τον όροφο;** — `null` για κάθε άλλη απάντηση.
 *
 * 🔑 Δήλωση χωρίς υπογράφοντα ή χωρίς αναγνώσιμη στιγμή **δεν είναι δήλωση**: η απόφαση του Giorgio είναι «ποιος, πότε,
 * στο ιστορικό» — ένα σκέτο `fileId` που έγραψε κάποιος με το χέρι δεν ανοίγει τον όροφο στο κοινό.
 */
export function readFloorPlateDeclaration(floor: Readonly<Record<string, unknown>>): FloorPlateDeclaration | null {
  const raw = floor[FLOOR_PLATE_DECLARATION_FIELD];
  if (!isPlainRecord(raw)) return null;

  const declaredAt = normalizeToISO(raw.declaredAt);
  if (!nonEmpty(raw.fileId) || !nonEmpty(raw.declaredBy) || declaredAt === null) return null;

  return { fileId: raw.fileId, declaredBy: raw.declaredBy, declaredAt };
}

/** Ό,τι λέει η πόρτα σε **κάθε** απάντησή της για τη δήλωση που ισχύει μετά την πράξη — `null` όταν ο όροφος δεν έχει. */
export interface FloorPlateDeclarationStanding {
  readonly declaration: FloorPlateDeclaration | null;
}

/**
 * Η απάντηση της **ανάγνωσης** (`GET`) — ό,τι χρειάζεται η οθόνη του χώρου για να δείξει «ποιος, πότε» (ADR-907 §11.10).
 *
 * 🔑 Το `mayDeclare` το απαντά ο **διακομιστής**, από τον ΕΝΑ τόπο (`mayChangePublication`): η οθόνη δεν μαντεύει
 * δικαίωμα, δείχνει ή δεν δείχνει κουμπιά.
 */
export interface FloorPlateDeclarationStatus extends FloorPlateDeclarationStanding {
  readonly floorId: string;
  readonly mayDeclare: boolean;
}

/**
 * **Γιατί ο όροφος δεν βγαίνει στο κοινό** — το κλειστό λεξιλόγιο που ταξιδεύει από τον διακομιστή ως τον άνθρωπο που
 * υπογράφει. Οι αρνήσεις της εικόνας και της επιμέλειας περνούν **αυτούσιες**· εδώ προστίθενται μόνο όσες αφορούν τον
 * όροφο ως σύνολο.
 *
 * 🔑 Ζει στο `lib` και όχι στον αναγνώστη (`server-only`): η οθόνη της δήλωσης οφείλει να μεταφράσει **κάθε** τιμή με
 * εξαντλητικό `Record` — νέα άρνηση χωρίς πρόταση για τον άνθρωπο δεν μεταγλωττίζεται.
 */
export type FloorPlateRefusal =
  | FloorPlateCurationRefusal
  | FloorPlateImageRefusal
  | 'floor-missing'
  | 'not-declared'
  | 'no-frame'
  | 'too-many-units';

/** Ο κωδικός της άρνησης στο σύρμα — το `why` και το `overlayId` ταξιδεύουν στη **ρίζα** του ίδιου σώματος (`./floor-plate-refusal`). */
export const FLOOR_PLATE_REFUSED_CODE = 'FLOOR_PLATE_REFUSED';
