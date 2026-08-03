'use client';

/**
 * ADR-750 Φ5 (Α23) — **τι διάλεξε ο χρήστης για το μολύβι περιγράμματος**: χρώμα, στυλ
 * γραμμής, πάχος, διπλή. Ένα εργαλείο, τέσσερα ανεξάρτητα πεδία, κάθε ένα **προαιρετικό**.
 *
 * ## 🔴 Δεν αποθηκεύεται το μολύβι — αποθηκεύεται η ΕΠΙΛΟΓΗ
 * Η Α15 απαγορεύει global μολύβι και η Α20 απάντησε «παράγεται από το στυλ». Και οι δύο
 * μένουν ισχυρές: εδώ δεν ζει `TableBorderSpec`, ζει ένα σύνολο **παρακάμψεων**. Απόν πεδίο
 * σημαίνει «ρώτα το στυλ», άρα ένας πίνακας που αλλάζει στυλ ακολουθεί αμέσως το νέο στυλ σε
 * ό,τι ο χρήστης δεν όρισε ρητά. Ένα αποθηκευμένο *μολύβι* θα πάγωνε και τα τέσσερα με το
 * πρώτο κλικ σε ένα από αυτά — και ο πίνακας θα έπαυε σιωπηλά να ακολουθεί το σχέδιο.
 *
 * ## Γιατί κρατιέται το ΟΝΟΜΑ του τύπου γραμμής και όχι το μοτίβο
 * Το `Dashed` είναι η **απόφαση**· το `[12.7, -6.35]` είναι η σημερινή της τιμή. Αν ο χρήστης
 * επεξεργαστεί τον τύπο γραμμής (ADR-642 editor) ή φορτωθεί άλλο `.lin`, η επιλογή «Dashed»
 * οφείλει να δείχνει στο **νέο** μοτίβο. Η επίλυση γίνεται στο {@link tableBorderPencilChoice},
 * μία φορά ανά εντολή, μέσω του app-wide SSoT (`resolveLinetypePatternMm`) — γι' αυτό το
 * καθαρό `bim/table/table-border-pencil.ts` δέχεται μοτίβο και **όχι** όνομα: αλλιώς θα
 * χρειαζόταν το `LinetypeRegistry`, δηλαδή θα έπαυε να είναι ντετερμινιστικό.
 *
 * ## Γιατί store και όχι state του component
 * Ίδιος λόγος με το χρώμα κειμένου: η γραμμή εργαλείων **ξεμοντάρει** σε κάθε κλείσιμο του
 * μενού. Ένα `useState` θα ξεχνούσε το μολύβι ανάμεσα σε δύο δεξιά κλικ, δηλαδή ο χρήστης θα
 * ξαναδιάλεγε χρώμα και πάχος **πριν από κάθε** εντολή περιγράμματος.
 *
 * Η συχνότητα είναι **ανθρώπινη** (μία γραφή ανά επιλογή), άρα μια συνδρομή React σε **φύλλο**
 * είναι θεμιτή — ο ADR-040 απαγορεύει συνδρομές σε orchestrators και σε ροές 60 fps.
 *
 * @module subapps/dxf-viewer/state/table-border-pencil-store
 * @see bim/table/table-border-pencil.ts — πού εφαρμόζεται η επιλογή πάνω στο στυλ (Α23)
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §19
 */

import { createExternalStore } from '../stores/createExternalStore';
import { storageGetString, storageSetString, STORAGE_KEYS } from '../utils/storage-utils';
import { normalizeHexColor } from '../config/color-math';
import { survivesAsInk } from '../config/print-color-policy';
import { nearestIsoLineweight } from '../config/lineweight-iso-catalog';
import { resolveLinetypeDef, resolveLinetypePatternMm } from '../rendering/linetype-dash-resolver';
import type { TableBorderPencilChoice } from '../bim/table/table-border-pencil';

/**
 * Η επιλογή όπως **αποθηκεύεται**: το στυλ γραμμής ως όνομα, όχι ως μοτίβο.
 *
 * Κάθε πεδίο απόν ⇒ «Αυτόματο» για εκείνο το πεδίο. Το κενό αντικείμενο είναι η αρχική
 * κατάσταση και σημαίνει «όλα από το στυλ» — δηλαδή ακριβώς η συμπεριφορά των Φ3/Φ4.
 */
export interface TableBorderPencilSelection {
  readonly colorHex?: string;
  /** Όνομα καταλόγου ή μητρώου (`Continuous`, `Dashed`, custom από `.lin`). */
  readonly linetypeName?: string;
  /** Πένα ISO σε mm. */
  readonly widthMm?: number;
  readonly double?: boolean;
}

/** Καμία παράκαμψη — κάθε ερώτηση πάει στο στυλ του πίνακα (Α20). */
export const AUTOMATIC_TABLE_BORDER_PENCIL: TableBorderPencilSelection = {};

const store = createExternalStore<TableBorderPencilSelection>(AUTOMATIC_TABLE_BORDER_PENCIL);

/**
 * 🔴 Το `localStorage` διαβάζεται **τεμπέλικα**, όχι στην αρχικοποίηση του module.
 *
 * Ο κώδικας τρέχει και στον server (Next.js): μια ανάγνωση εδώ θα έδινε στον server την
 * προεπιλογή και στον client το αποθηκευμένο ⇒ **hydration mismatch** στο πρώτο render. Με
 * τεμπέλικη ανάγνωση, η πρώτη κλήση συμβαίνει σε χειρισμό συμβάντος ή σε effect.
 */
let hydrated = false;

function hydrateOnce(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  const stored = sanitize(storageGetString(STORAGE_KEYS.TABLE_BORDER_PENCIL));
  if (!sameSelection(stored, store.get())) store.set(stored);
}

/** Η τρέχουσα επιλογή, **τη στιγμή της κλήσης** — για χειριστές συμβάντων. */
export function getTableBorderPencil(): TableBorderPencilSelection {
  hydrateOnce();
  return store.get();
}

/**
 * Αλλάζει **ένα** πεδίο. `undefined` ⇒ επιστροφή του πεδίου στο «Αυτόματο».
 *
 * Ανά πεδίο και όχι ολόκληρη η επιλογή, επειδή αυτή είναι η πραγματική χειρονομία: κάθε
 * flyout του μενού αγγίζει ακριβώς ένα. Ένα `setTableBorderPencil(whole)` θα ανάγκαζε κάθε
 * καλούντα να διαβάσει-συγχωνεύσει-γράψει, δηλαδή τέσσερα αντίγραφα της ίδιας συγχώνευσης.
 */
export function setTableBorderPencilField<K extends keyof TableBorderPencilSelection>(
  field: K,
  value: TableBorderPencilSelection[K],
): void {
  hydrateOnce();
  const next = sanitize2({ ...store.get(), [field]: value });
  if (sameSelection(next, store.get())) return;
  store.set(next);
  storageSetString(STORAGE_KEYS.TABLE_BORDER_PENCIL, JSON.stringify(next));
}

/** Συνδρομή για φύλλα React (`useSyncExternalStore`). */
export function subscribeTableBorderPencil(listener: () => void): () => void {
  hydrateOnce();
  return store.subscribe(listener);
}

/**
 * Η επιλογή **επιλυμένη σε καθαρά δεδομένα**, έτοιμη για το `resolveTableBorderPencil`.
 *
 * Εδώ και μόνο εδώ γίνεται όνομα → μοτίβο. Το `Continuous` δίνει **κενό** μοτίβο, που είναι
 * σημασιολογικά διαφορετικό από «καμία επιλογή»: το πρώτο λέει «θέλω συνεχή», το δεύτερο
 * «ό,τι λέει το στυλ» (δες το `??` στο `resolveTableBorderPencil`).
 */
export function tableBorderPencilChoice(
  selection: TableBorderPencilSelection = getTableBorderPencil(),
): TableBorderPencilChoice {
  return {
    ...(selection.colorHex !== undefined ? { colorHex: selection.colorHex } : {}),
    ...(selection.widthMm !== undefined ? { widthMm: selection.widthMm } : {}),
    ...(selection.linetypeName !== undefined
      ? { dashMm: resolveLinetypePatternMm(selection.linetypeName) }
      : {}),
    ...(selection.double ? { double: true } : {}),
  };
}

/** Μόνο για tests — καθαρίζει και τη σημαία ενυδάτωσης, αλλιώς το επόμενο test κληρονομεί. */
export function resetTableBorderPencilForTest(): void {
  hydrated = false;
  store.set(AUTOMATIC_TABLE_BORDER_PENCIL);
}

// ──────────────────────────────────────────────────────────────────────────────
// Ιδιωτικά — τι γίνεται δεκτό
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Ένα αλλοιωμένο `localStorage` δεν επιτρέπεται να γεννήσει μολύβι που δεν υπάρχει.
 *
 * Κάθε πεδίο ελέγχεται **χωριστά** και το άκυρο απλώς **λείπει** — δηλαδή πέφτει στο
 * «Αυτόματο», που είναι πάντα έγκυρο. Ολική απόρριψη θα έριχνε και τα τρία σωστά πεδία μαζί
 * με το ένα χαλασμένο, για κανένα κέρδος ασφάλειας.
 */
function sanitize(raw: string | null): TableBorderPencilSelection {
  if (!raw) return AUTOMATIC_TABLE_BORDER_PENCIL;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return AUTOMATIC_TABLE_BORDER_PENCIL;
    const record = parsed as Record<string, unknown>;
    return sanitize2({
      colorHex: typeof record.colorHex === 'string' ? record.colorHex : undefined,
      linetypeName: typeof record.linetypeName === 'string' ? record.linetypeName : undefined,
      widthMm: typeof record.widthMm === 'number' ? record.widthMm : undefined,
      double: record.double === true ? true : undefined,
    });
  } catch {
    return AUTOMATIC_TABLE_BORDER_PENCIL;
  }
}

/**
 * Ο **ίδιος** έλεγχος για τιμές που έρχονται από το UI.
 *
 * Δεν είναι παράνοια απέναντι στα δικά μας components: είναι ο τόπος όπου ζει η απάντηση «τι
 * είναι έγκυρο μολύβι». Δύο έλεγχοι — ένας για τον δίσκο, ένας για το UI — θα ήταν δύο
 * ορισμοί εγκυρότητας, και ο δεύτερος θα ξεχνούσε τον `nearestIsoLineweight` την ημέρα που θα
 * μπει πεδίο ελεύθερης πληκτρολόγησης πάχους.
 */
function sanitize2(input: TableBorderPencilSelection): TableBorderPencilSelection {
  const colorHex = validColor(input.colorHex);
  const widthMm = input.widthMm === undefined ? undefined : nearestIsoLineweight(input.widthMm);
  const linetypeName =
    input.linetypeName !== undefined && resolveLinetypeDef(input.linetypeName) !== null
      ? input.linetypeName
      : undefined;

  return {
    ...(colorHex !== undefined ? { colorHex } : {}),
    ...(linetypeName !== undefined ? { linetypeName } : {}),
    ...(widthMm !== undefined ? { widthMm } : {}),
    ...(input.double ? { double: true } : {}),
  };
}

/** Δεκτό μόνο ό,τι επιβιώνει ως μελάνι — ένα μολύβι δεν βάφει λευκό σε λευκό. */
function validColor(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const hex = normalizeHexColor(raw);
  return /^#[0-9a-f]{6}$/.test(hex) && survivesAsInk(hex) ? hex : undefined;
}

/**
 * Ίδια επιλογή; Τέσσερα βαθμωτά πεδία, άρα σύγκριση πεδίο-προς-πεδίο — όχι `JSON.stringify`,
 * που θα έλεγε «διαφορετικά» για ίδια πεδία γραμμένα με άλλη σειρά.
 */
function sameSelection(a: TableBorderPencilSelection, b: TableBorderPencilSelection): boolean {
  return (
    a.colorHex === b.colorHex
    && a.linetypeName === b.linetypeName
    && a.widthMm === b.widthMm
    && a.double === b.double
  );
}
