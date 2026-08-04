/**
 * 🔴 ADR-751 — **η καλωδίωση του συνδέσμου κελιού**: hover, Ctrl+κλικ, άνοιγμα.
 *
 * Λεπτό στρώμα πάνω από τον καθαρό {@link resolveTableCellLinkAtWorld}, ακριβώς όπως το
 * `handleStairClickInto2D` κάθεται πάνω από το `resolveStairClickInto` (ADR-358 Q19 Φ3b). Ο
 * λόγος είναι ο ίδιος και είναι πρακτικός: οι δύο χειριστές ποντικιού
 * (`mouse-handler-up-marquee.ts`, `mouse-handler-move.ts`) είναι **και οι δύο** κοντά στο
 * όριο των 500 γραμμών (N.7.1), οπότε ό,τι μπαίνει εκεί πρέπει να είναι μία κλήση.
 *
 * ## 🔴 Γιατί ο έλεγχος διαβάζει `ctrlKey` και ΟΧΙ το υπάρχον `additive`
 * Στο `processSinglePointPick` το Ctrl είναι **ήδη** δεσμευμένο: `additive = shift || ctrl ||
 * meta` σημαίνει «πρόσθεσε στην επιλογή». Δύο συνέπειες που καθόρισαν τον σχεδιασμό:
 *
 *  1. Ο έλεγχος συνδέσμου πρέπει να **καταναλώνει** το συμβάν (`return true`) **μόνο** όταν
 *     πραγματικά υπάρχει σύνδεσμος κάτω από τον δείκτη. Οποιοδήποτε άλλο Ctrl+κλικ —
 *     σε άλλη οντότητα, σε άδειο μέρος του πίνακα, σε κελί χωρίς διεύθυνση — οφείλει να
 *     πέσει στην πολλαπλή επιλογή που ήδη υπάρχει, αλλιώς σπάει λειτουργία που δουλεύει.
 *  2. Διαβάζεται **ρητά** το `ctrlKey`, όχι το `additive`: σε macOS το `metaKey` (⌘) είναι
 *     ήδη ο modifier πολλαπλής επιλογής, και αν ο σύνδεσμος τον διεκδικούσε κιόλας, ο
 *     χρήστης Mac θα έχανε το ⌘+κλικ πάνω σε κάθε πίνακα με e-mail.
 *
 * @module subapps/dxf-viewer/bim/table/table-link-interaction-2d
 * @see bim/table/table-cell-link-hit.ts — ο καθαρός επιλυτής (η απόφαση)
 * @see state/table-cell-link-hover-store.ts — πού ζει η απάντηση του hover
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isTableEntity } from '../../types/table-entity';
import { setHoveredCellLink } from '../../state/table-cell-link-hover-store';
import { resolveTableCellLinkAtWorld } from './table-cell-link-hit';

/**
 * Τα μόνα σχήματα που επιτρέπεται να ανοίξουν.
 *
 * Ο ανιχνευτής παράγει ήδη μόνο αυτά τα τρία — το `WEB_URL_EXTRACT_REGEX` απαιτεί `http(s)`
 * ή `www.`, οπότε δεν υπάρχει διαδρομή προς `javascript:` ή `data:`. Ο φρουρός είναι
 * **άμυνα σε βάθος**: το κείμενο έρχεται από αρχείο που μπορεί να έφτιαξε τρίτος, και ένα
 * μελλοντικό χαλάρωμα του regex δεν πρέπει να μπορεί να γίνει διαδρομή εκτέλεσης κώδικα.
 */
const ALLOWED_SCHEMES = ['mailto:', 'tel:', 'https://', 'http://'] as const;

/**
 * Ενημερώνει το store με τον σύνδεσμο κάτω από τον δείκτη — καλείται από το **ήδη
 * περιορισμένο** πέρασμα hover του `mouse-handler-move`.
 *
 * ⚠️ Η γρήγορη έξοδος όταν `hitEntityId` είναι `null` **δεν είναι βελτιστοποίηση, είναι ο
 * σχεδιασμός**: η ευρεία φάση (χωρικό ευρετήριο) έχει ήδη τρέξει και είναι δωρεάν εδώ, ενώ
 * η στενή φάση χτίζει γεωμετρία πίνακα. Το έργο έχει ήδη πληρώσει ακριβώς αυτό το λάθος στο
 * ADR-735 (δουλειά ανάλογη του zoom σε κάθε καρέ). Πάνω από κάθε άλλη οντότητα, και πάνω από
 * κενό χώρο, το κόστος εδώ είναι μία σύγκριση.
 */
export function updateTableLinkHover2D(
  hitEntityId: string | null,
  worldPoint: Point2D,
  entities: readonly Entity[] | undefined,
  anchor: { readonly clientX: number; readonly clientY: number },
): void {
  const entity = hitEntityId ? entities?.find((en) => en.id === hitEntityId) : undefined;
  if (!entity || !isTableEntity(entity)) {
    setHoveredCellLink(null);
    return;
  }
  const hit = resolveTableCellLinkAtWorld(entity, worldPoint);
  setHoveredCellLink(
    hit ? { entityId: entity.id, hit, clientX: anchor.clientX, clientY: anchor.clientY } : null,
  );
}

/**
 * Ctrl+κλικ πάνω σε σύνδεσμο ⇒ άνοιγμα, και **κατανάλωση** του κλικ.
 *
 * Επιστρέφει `false` σε κάθε άλλη περίπτωση, ώστε ο καλών να συνεχίσει κανονικά — δες την
 * κεφαλίδα για το γιατί η στενότητα εδώ είναι κρίσιμη.
 */
export function handleTableLinkClick2D(
  hitEntityId: string | null,
  ctrlKey: boolean,
  worldPoint: Point2D,
  entities: readonly Entity[] | undefined,
): boolean {
  if (!ctrlKey || !hitEntityId) return false;
  const entity = entities?.find((en) => en.id === hitEntityId);
  if (!entity || !isTableEntity(entity)) return false;

  const hit = resolveTableCellLinkAtWorld(entity, worldPoint);
  if (!hit) return false;

  openCellLink(hit.span.href);
  return true;
}

/**
 * Ανοίγει έναν προορισμό συνδέσμου.
 *
 * ## Γιατί άλλος στόχος ανά σχήμα
 * `http(s)` ανοίγει σε **νέα καρτέλα** με `noopener,noreferrer`: ο χρήστης βρίσκεται μέσα σε
 * σχέδιο με μη αποθηκευμένη δουλειά, και μια πλοήγηση στην ίδια καρτέλα θα την έπαιρνε μαζί
 * της. Τα `mailto:` και `tel:` παραδίδονται στο λειτουργικό (`_self`) γιατί **δεν πλοηγούν**
 * — ανοίγουν εξωτερική εφαρμογή· μια νέα καρτέλα θα έμενε κενή στην οθόνη.
 *
 * ⚠️ Είναι το ίδιο idiom που επαναλαμβάνεται ήδη σε ~35 σημεία του `src/` **χωρίς SSoT**.
 * Δεν κεντρικοποιείται εδώ γιατί η μετακίνηση 35 καλούντων είναι δουλειά άλλης εντολής
 * (N.0.2: >1h ⇒ καταγραφή αντί για αυτοσχέδια εξαγωγή στη μέση άσχετου έργου) — αλλά ο
 * σωστός καθαρισμός του τηλεφώνου, που **λείπει** από τα υπόλοιπα σημεία, γίνεται ήδη
 * ανάντη, στον ανιχνευτή.
 */
export function openCellLink(href: string): void {
  if (!ALLOWED_SCHEMES.some((scheme) => href.startsWith(scheme))) return;
  if (typeof window === 'undefined') return;

  if (href.startsWith('mailto:') || href.startsWith('tel:')) {
    window.open(href, '_self');
    return;
  }
  window.open(href, '_blank', 'noopener,noreferrer');
}
