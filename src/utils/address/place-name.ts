/**
 * @fileoverview **ΕΝΑ ΟΝΟΜΑ ΤΟΠΟΥ, ΜΙΑ ΚΑΝΟΝΙΚΗ ΜΟΡΦΗ** — ADR-332 D27 Βήμα Β (Β7).
 * @module utils/address/place-name
 *
 * 🔴 **Δύο αντίγραφα του ίδιου κανόνα, και είχαν ήδη αποκλίνει** (μετρημένο 2026-09-10):
 * - `app/api/geocoding/reverse/route.ts` → `cleanNominatimName`, δηλωμένο στο ίδιο του το σχόλιο
 *   ως *«Server-side duplicate of address-helpers.stripAdminPrefix (cannot import client code)»*.
 * - `types/project/address-helpers.ts` → `stripAdminPrefix`.
 *
 * Η «αδυναμία εισαγωγής» **δεν ίσχυε**: και τα δύο είναι καθαρές συναρτήσεις, και αυτό το module
 * δεν εισάγει τίποτα του περιηγητή. Και η απόκλιση ήταν πραγματική:
 * - η `/i` ταιριάζει «ΔΗΜΟΣ» με «δημος», αλλά **όχι** το «Δημοτική» (ή) με το «ΔΗΜΟΤΙΚΗ» (Η) —
 *   ο τόνος δεν είναι ζήτημα πεζών/κεφαλαίων. Το ένα αντίγραφο έπιανε μόνο κεφαλαία, το άλλο μόνο πεζά·
 * - **μόνο** το ένα αναδίπλωνε την παύλα ⇒ «Ελευθέριο-Κορδελιό → Ελευθέριο Κορδελιό» φαινόταν
 *   **αλλαγή** στον διάλογο συρσίματος (ADR-332 D27, «Ανοιχτό 6»).
 *
 * 🔑 Εδώ η σύγκριση γίνεται **χωρίς τόνους και πεζοκεφαλαία** (`normalizeGreekText`), κατά
 * **ολόκληρες λέξεις**, και η **γραφή** (παύλα, κενά) χωρίζεται ρητά από το **όνομα**.
 */

import { normalizeGreekText } from '@/utils/greek-text';

/**
 * Τα διοικητικά προθέματα, **χωρίς τόνους**, ως λέξεις. Τα διπλά πριν από τα μονά, ώστε το
 * «Δημοτική Ενότητα» να μη διαβαστεί ποτέ ως «Δήμος» + υπόλοιπο.
 */
const ADMIN_PREFIXES: readonly (readonly string[])[] = [
  ['αποκεντρωμενη', 'διοικηση'],
  ['περιφερειακη', 'ενοτητα'],
  ['δημοτικη', 'ενοτητα'],
  ['δημοτικη', 'κοινοτητα'],
  ['τοπικη', 'κοινοτητα'],
  ['περιφερεια'],
  ['δημος'],
];

/**
 * Αφαιρεί το διοικητικό πρόθεμα: «Δήμος Λαγκαδά» / «ΔΗΜΟΣ ΛΑΓΚΑΔΑ» → «Λαγκαδά» / «ΛΑΓΚΑΔΑ».
 *
 * ⚠️ **Μόνο στην αρχή και μόνο ολόκληρες λέξεις**: το «Δημοσθένους 5» δεν χάνει τίποτα.
 * ⚠️ Όνομα που είναι **μόνο** πρόθεμα («Δήμος») μένει αυτούσιο — ένα κενό όνομα θα ήταν χειρότερο.
 */
export function stripGreekAdminPrefix(name: string): string {
  const words = name.trim().split(/\s+/);
  const folded = words.map((word) => normalizeGreekText(word));
  for (const prefix of ADMIN_PREFIXES) {
    if (words.length > prefix.length && prefix.every((part, i) => folded[i] === part)) {
      return words.slice(prefix.length).join(' ');
    }
  }
  return name.trim();
}

/** Η **γραφή**, όχι το όνομα: παύλα ⇄ κενό, πολλαπλά κενά, κενά στα άκρα. */
export function foldPlaceName(name: string): string {
  return name.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Η κανονική μορφή ονόματος από τον πάροχο — χωρίς πρόθεμα, χωρίς παύλες (ό,τι έκανε το `cleanNominatimName`). */
export function cleanPlaceName(name: string): string {
  return foldPlaceName(stripGreekAdminPrefix(foldPlaceName(name)));
}
