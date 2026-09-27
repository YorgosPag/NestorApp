/**
 * @fileoverview **Ο ΧΩΡΟΣ ΕΝΟΣ ΣΗΜΕΙΟΥ** — κανονικοποίηση (ό,τι γράφεται και ό,τι διαβάζεται) και **η ΜΙΑ απάντηση** στο
 * «πώς λέγεται αυτό το σημείο;» (ADR-884 Φ2στ · §4.12). Καθαρό: καμία μετάφραση εδώ — ο καλών μεταφράζει τον τύπο.
 * @related `constants/spatial-tour-vocabulary.ts` (`TOUR_ROOM_TYPES` — η ρίζα) · `tour-graph-edit.ts` (`nameNode`) ·
 *   `spatial-tour-from-document.ts` (ανάγνωση) · `components/spatial-tour/viewer/useRoomLabels.ts` (μετάφραση)
 * @module lib/spatial-tour/tour-room
 *
 * 🏆 **Όπως οι μεγάλοι**: Matterport — τύπος από κλειστό λεξιλόγιο + `label` που υπερισχύει· Revit/ArchiCAD — όνομα χώρου.
 * 🏆 **Πάνω από τους μεγάλους**: η **αρίθμηση** («Υπνοδωμάτιο 1 / 2») **παράγεται** μόνο όταν ο ίδιος τύπος επαναλαμβάνεται
 *   στον ίδιο όροφο — δεν αποθηκεύεται, άρα δεν παλιώνει όταν σβηστεί ή προστεθεί σημείο.
 */

import {
  isTourRoomType,
  TOUR_ROOM_LABEL_MAX,
  TOUR_ROOM_MAX_TYPES,
  type TourRoomType,
} from '@/constants/spatial-tour-vocabulary';
import type { TourNode, TourRoom } from '@/types/spatial-tour';

/** Ό,τι στέλνει η οθόνη (και ό,τι βρίσκεται στο έγγραφο) πριν κανονικοποιηθεί. */
export interface TourRoomInput {
  readonly types: readonly unknown[];
  readonly label: unknown;
}

/**
 * **Η ΜΙΑ κανονικοποίηση**: τύποι γνωστοί, μοναδικοί, με τη σειρά τους, έως `TOUR_ROOM_MAX_TYPES`· όνομα χωρίς κενά
 * άκρων, κενό ⇒ `null`. Επιστρέφει `null` για **άκυρο** (άγνωστος τύπος · κανένας τύπος · όνομα πολύ μακρύ).
 */
export function normalizeTourRoom(input: TourRoomInput): TourRoom | null {
  if (!input.types.every(isTourRoomType)) return null;
  const types = [...new Set(input.types as readonly TourRoomType[])];
  if (types.length === 0 || types.length > TOUR_ROOM_MAX_TYPES) return null;
  if (input.label !== null && typeof input.label !== 'string') return null;
  const label = typeof input.label === 'string' ? input.label.trim() : '';
  if (label.length > TOUR_ROOM_LABEL_MAX) return null;
  return { types, label: label === '' ? null : label, source: 'manual' };
}

/** Ίδιος χώρος; — για το «unchanged» του γραφέα (ιδεμποτία). */
export function sameTourRoom(a: TourRoom | null | undefined, b: TourRoom | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.label === b.label && a.source === b.source && a.types.length === b.types.length
    && a.types.every((type, i) => type === b.types[i]);
}

/** Πώς εμφανίζεται ένα σημείο — ο καλών μεταφράζει (`types`) ή δείχνει αυτούσιο (`label`). */
export type TourRoomDisplay =
  | { readonly kind: 'label'; readonly text: string }
  | { readonly kind: 'types'; readonly types: readonly TourRoomType[]; readonly ordinal: number | null };

const typesKey = (room: TourRoom) => room.types.join('+');

/**
 * **Η ΜΙΑ απάντηση** «πώς λέγεται;» — `null` ⇒ ο χώρος δεν δηλώθηκε (ο καλών δείχνει «Σημείο N»). `levelNodes` = τα
 * σημεία του **ίδιου ορόφου** με τη σειρά τους: από εκεί η αρίθμηση όμοιων χώρων χωρίς όνομα.
 */
export function tourRoomDisplay(node: TourNode, levelNodes: readonly TourNode[]): TourRoomDisplay | null {
  const room = node.room ?? null;
  if (room === null) return null;
  if (room.label !== null) return { kind: 'label', text: room.label };
  const key = typesKey(room);
  const alike = levelNodes.filter((n) => n.room && n.room.label === null && typesKey(n.room) === key);
  return { kind: 'types', types: room.types, ordinal: alike.length > 1 ? alike.findIndex((n) => n.id === node.id) + 1 : null };
}
