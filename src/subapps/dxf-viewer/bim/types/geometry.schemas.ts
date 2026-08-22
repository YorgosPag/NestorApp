/**
 * BIM geometry primitives — **ΤΟ ΕΝΑ** Zod λεξιλόγιο σημείου/πολυγώνου (ADR-789 Φάση Δ).
 *
 * 🔴 **Γιατί υπάρχει**: μέχρι 2026-08-22 ο ΙΔΙΟΣ ορισμός ήταν γραμμένος **20 φορές**
 * (`BimPointSchema`, ένα ανά `*.schemas.ts`) και **3 φορές** (`BimPolygonSchema`, σε
 * `slab` · `roof` · `mep-underfloor`) — **23 αντίγραφα, byte-ταυτόσημα** (επαληθεύτηκε
 * με hash και των 20). Καμία πύλη δεν τα συνέκρινε, άρα διόρθωση στο ένα θα άφηνε τα
 * υπόλοιπα 22 να αποκλίνουν σιωπηλά — το σχήμα του ADR-749.
 *
 * 🔑 **ΤΟ SCHEMA ΕΙΝΑΙ «ΤΙ ΔΕΧΟΜΑΙ», ΟΧΙ «ΤΙ ΓΡΑΦΩ».** Ο τύπος TS ενός αποθηκευμένου
 * προφίλ κάτοψης είναι πλέον `PlanProfile` (**2Δ**, χωρίς `z`), αλλά το schema
 * **ΔΙΑΤΗΡΕΙ** το `z` προαιρετικό. Αυτό **δεν είναι απόκλιση — είναι ο νόμος του
 * Postel** («conservative in what you send, liberal in what you accept»): γράφουμε 2Δ,
 * δεχόμαστε ό,τι έγραψε το παρελθόν.
 *
 * ⚠️ **ΜΗΝ αφαιρέσεις το `z` από το {@link BimPointSchema}.** Είναι `.strict()`, και η
 * αφαίρεση κάνει **κάθε παλιό έγγραφο να ΑΠΟΡΡΙΠΤΕΤΑΙ** με `unrecognized_keys` —
 * αποδεδειγμένο **εκτελώντας** (zod 3.25.76, ADR-789 §8). Δεν υπάρχει migration, και
 * δεν πρέπει να χρειαστεί: το `z` αυτών των πεδίων δεν το διαβάζει κανείς (μετρημένο:
 * 0 αναγνώσεις `.z` σε `footprint` / `outline` / `polylineVertices` σε όλο το δέντρο).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-789-planar-point-vocabulary.md
 */

import { z } from 'zod';

/**
 * Σημείο **ανάγνωσης**: `x`/`y` υποχρεωτικά, `z` **ανεκτό** (3D-readiness G11 + legacy).
 *
 * ⚠️ Το ότι το schema δέχεται `z` **ΔΕΝ** σημαίνει ότι κάποιος το γράφει ή το διαβάζει.
 * Για γνήσια χωρικά δεδομένα (σκάλες · MEP routing · στέγες · κάγκελα) το `z` είναι
 * πραγματικό· για προφίλ κάτοψης είναι **κατάλοιπο** που ανεχόμαστε στην ανάγνωση.
 */
export const BimPointSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict();

/** Κλειστό πολύγωνο ≥3 κορυφών. Η ανοχή στο `z` κληρονομείται από το {@link BimPointSchema}. */
export const BimPolygonSchema = z
  .object({
    vertices: z.array(BimPointSchema).min(3),
  })
  .strict();

/**
 * **Αποθηκευμένο προφίλ κάτοψης** — το schema ανάγνωσης του TS τύπου `PlanProfile`.
 *
 * Σκόπιμα **ταυτόσημο** με το {@link BimPolygonSchema}: η στένωση ζει στον **τύπο**
 * (τι γράφουμε), όχι στο schema (τι δεχόμαστε). Υπάρχει ως ξεχωριστό όνομα ώστε το
 * σημείο χρήσης να **δηλώνει τον ρόλο** — ένα `outline: PlanProfileSchema` λέει
 * «προφίλ κάτοψης», ενώ `outline: BimPolygonSchema` λέει «πολύγωνο στον χώρο».
 */
export const PlanProfileSchema = BimPolygonSchema;
