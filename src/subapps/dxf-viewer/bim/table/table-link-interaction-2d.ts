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

import type { TextLinkKind } from '@/lib/validation/text-link-segments';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { isTableEntity, type TableEntity } from '../../types/table-entity';
import { setHoveredCellLink } from '../../state/table-cell-link-hover-store';
import { resolveTableCellLinkAtWorld } from './table-cell-link-hit';
import { tableCellLinksAt, type TableCellLinkEntry } from './table-cell-link-index';
import { linkClipboardText } from './table-link-labels';

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
  if (!isAllowedLinkHref(href)) return;
  if (typeof window === 'undefined') return;

  if (href.startsWith('mailto:') || href.startsWith('tel:')) {
    window.open(href, '_self');
    return;
  }
  window.open(href, '_blank', 'noopener,noreferrer');
}

/**
 * ADR-751 Φ8.β — **αντιγραφή της διεύθυνσης στο πρόχειρο**. `true` σε επιτυχία.
 *
 * ## 🔴 Γιατί ΕΔΩ χρησιμοποιείται το `navigator.clipboard`, ενώ ο πίνακας το αποφεύγει
 * Το `use-table-range-actions.ts` τεκμηριώνει ρητά ότι το πρόχειρο του πίνακα **δεν** περνά
 * από `navigator.clipboard` αλλά από τα φυσικά συμβάντα `copy`/`paste` του browser — και έχει
 * δίκιο για τη δουλειά του: εκεί ο χρήστης πατά `Ctrl+C`, οπότε υπάρχει έτοιμο `clipboardData`
 * χωρίς άδεια και χωρίς εξάρτηση από διάταξη πληκτρολογίου.
 *
 * Εδώ **δεν υπάρχει συμβάν `copy`**: ο χρήστης διάλεξε εντολή από μενού. Το κλικ στο μενού
 * **είναι** η χειρονομία που απαιτεί το `writeText`, οπότε η προϋπόθεση ικανοποιείται στην
 * πηγή. Δεν είναι ασυνέπεια — είναι **άλλη ερώτηση**: «αντέγραψε ό,τι διάλεξα» αντί για
 * «τι στέλνω στο συμβάν που μόλις συνέβη».
 *
 * ⚠️ Μια μελλοντική «ενοποίηση για συνέπεια» προς οποιαδήποτε κατεύθυνση σπάει το ένα από τα
 * δύο: το `Ctrl+C` σε ελληνική διάταξη (`key: 'ψ'`) ή την εντολή του μενού, που δεν έχει
 * συμβάν να καβαλήσει.
 *
 * Επιστρέφει `boolean` και δεν καταπίνει την αποτυχία: το πρόχειρο μπορεί να απορριφθεί από
 * την πολιτική του browser, και ο χρήστης πρέπει να **μάθει** ότι δεν αντιγράφηκε αντί να
 * επικολλήσει κάτι παλιό νομίζοντας ότι πέτυχε.
 */
export async function copyCellLinkAddress(kind: TextLinkKind, href: string): Promise<boolean> {
  if (!isAllowedLinkHref(href)) return false;
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(linkClipboardText(kind, href));
    return true;
  } catch {
    return false;
  }
}

/** Ο φρουρός σχημάτων, σε **ένα** σημείο — τον ρωτούν και το άνοιγμα και η αντιγραφή. */
function isAllowedLinkHref(href: string): boolean {
  return ALLOWED_SCHEMES.some((scheme) => href.startsWith(scheme));
}

/**
 * Τι συνέβη όταν ζητήθηκε άνοιγμα συνδέσμου **κελιού** (χωρίς ποντίκι).
 *
 * Η `ambiguous` δεν είναι σφάλμα — είναι **ερώτηση προς τον χρήστη**. Ένα κελί μπορεί κάλλιστα
 * να γράφει `a@nestor.gr · b@nestor.gr`, και τότε το «άνοιξε τον σύνδεσμο» δεν έχει μία
 * απάντηση. Το να ανοίγαμε τον **πρώτο** θα ήταν σιωπηλή επιλογή εκ μέρους του: θα καλούσε
 * λάθος άνθρωπο χωρίς να το μάθει ποτέ. Τα Google Sheets ρωτούν επίσης όταν το κελί έχει
 * πολλαπλούς συνδέσμους — η επιλογή ανήκει σε αυτόν που ξέρει ποιον ήθελε.
 */
export type CellLinkActivation =
  | { readonly kind: 'none' }
  | { readonly kind: 'opened'; readonly href: string }
  | { readonly kind: 'ambiguous'; readonly links: readonly TableCellLinkEntry[] };

/**
 * ADR-751 Φ8.γ — **άνοιξε τον σύνδεσμο ΑΥΤΟΥ του κελιού** (`Alt+Enter`, πρότυπο Google
 * Sheets). Καμία συντεταγμένη οθόνης: ο στόχος είναι το κελί του δρομέα.
 *
 * Ο καλών παίρνει **αποτέλεσμα** αντί για `void` γιατί οι τρεις εκβάσεις θέλουν τρεις
 * διαφορετικές αντιδράσεις στη διεπαφή, και καμία δεν αποφασίζεται εδώ: το `none` είναι
 * σιωπή (το κελί απλώς δεν έχει διεύθυνση), το `opened` τετέλεσται, το `ambiguous` πρέπει να
 * γίνει **ερώτηση**.
 */
export function activateTableCellLink(
  entity: TableEntity,
  rowId: string,
  colId: string,
): CellLinkActivation {
  const links = tableCellLinksAt(entity, rowId, colId);
  if (links.length === 0) return { kind: 'none' };
  if (links.length > 1) return { kind: 'ambiguous', links };

  const href = links[0]!.span.href;
  openCellLink(href);
  return { kind: 'opened', href };
}
