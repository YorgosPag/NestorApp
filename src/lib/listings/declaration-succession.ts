/**
 * @fileoverview **ΟΙ ΔΗΛΩΣΕΙΣ ΑΚΟΛΟΥΘΟΥΝ ΤΗΝ ΕΚΔΟΣΗ** — παλιό `FileRecord.id` → νέο, σε **κάθε** δήλωση του ακινήτου.
 * @related ADR-845 §7.17 Α3γ (κλάση Ο-35) · services/listings/agency-media-publication (`agencyMediaDeclaration`) ·
 *   services/iso19650/succession-inheritance (ο γραφέας που την καλεί)
 * @module lib/listings/declaration-succession
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 * Οι δηλώσεις του ανθρώπου του γραφείου *(σειρά · κατόψεις · σημείο εστίασης · σημείο λήψης · βορράς)*
 * ζουν στο έγγραφο του **ακινήτου** και δείχνουν σε αρχείο με το **id της έκδοσής του**. Κάθε νέα
 * έκδοση είναι **νέο** αρχείο ⇒ μετά από αντικατάσταση η νέα φωτογραφία έμπαινε **τελευταία**, χωρίς
 * εστίαση, και η νέα κάτοψη **έβγαινε** από τις δημοσιευμένες.
 *
 * 🌐 Autodesk ACC: ό,τι δείχνει σε αρχείο δείχνει στη **γενεαλογία** του (lineage), άρα πάντα στην
 * τελευταία έκδοση. Cloudinary / Contentstack: *«all existing references continue to work»*. Το δόγμα
 * είναι κοινό — **η αντικατάσταση δεν σπάει ποτέ ό,τι δείχνει στο αρχείο**. Εδώ κάθε έκδοση είναι
 * χωριστό αρχείο *(ISO 19650)*, άρα το ίδιο αποτέλεσμα δίνεται **μεταφέροντας τις αναφορές**, στην
 * ίδια συναλλαγή με τη διαδοχή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΟΥΛΕΥΕΙ ΠΑΝΩ ΣΤΟ **ΩΜΟ** ΠΕΔΙΟ, ΚΑΙ ΕΙΝΑΙ ΣΚΟΠΙΜΟ
 * ────────────────────────────────────────────────────────────────────────────
 * Δεν περνά από τους αναγνώστες των δηλώσεων *(που **πετούν** την άκυρη γραμμή)*: μια μεταφορά που
 * «καθαρίζει» ό,τι δεν καταλαβαίνει θα **έσβηνε** δήλωση άλλου αρχείου ως παρενέργεια αντικατάστασης.
 * Αλλάζει **μόνο** την ταυτότητα· κάθε άλλη γραμμή μένει **byte προς byte** όπως ήταν.
 *
 * ⚠️ **Καθαρό module** — κανένα React, κανένα Firestore. Ποτέ δεν πετά.
 */

import { isPlainRecord } from '@/lib/type-guards';

/**
 * **Πώς** κρατά μια δήλωση την ταυτότητα του αρχείου.
 *
 * | είδος | σχήμα |
 * |---|---|
 * | `ids` | πίνακας ταυτοτήτων |
 * | `by-file` | χάρτης `fileId → τιμή` |
 * | `by-file-on-floorplan` | χάρτης `fileId → τιμή`, και η τιμή δείχνει **και** σε κάτοψη (`floorplanFileId`) |
 */
export type AgencyDeclarationKind = 'ids' | 'by-file' | 'by-file-on-floorplan';

/**
 * 🔒 **Η ΚΛΕΙΣΤΗ ΛΙΣΤΑ ΤΩΝ ΔΗΛΩΣΕΩΝ ΤΟΥ ΑΚΙΝΗΤΟΥ ΠΟΥ ΔΕΙΧΝΟΥΝ ΣΕ ΑΡΧΕΙΟ.**
 *
 * Ο τύπος εισόδου του `agencyMediaDeclaration` **παράγεται** από εδώ ({@link AgencyDeclarationSource}):
 * έκτη δήλωση που διαβάζεται εκεί **χωρίς** γραμμή εδώ δεν μεταγλωττίζεται — δηλαδή δεν μπορεί να
 * υπάρξει δήλωση που η αντικατάσταση την αφήνει πίσω.
 */
export const AGENCY_DECLARATION_FIELDS = {
  publishedMediaOrder: 'ids',
  publishedFloorplans: 'ids',
  publishedMediaFocalPoints: 'by-file',
  publishedPhotoCaptureSpots: 'by-file-on-floorplan',
  publishedFloorplanNorth: 'by-file',
} as const satisfies Readonly<Record<string, AgencyDeclarationKind>>;

export type AgencyDeclarationField = keyof typeof AGENCY_DECLARATION_FIELDS;

/** Το ωμό έγγραφο του ακινήτου, όσο το βλέπουν οι δηλώσεις. */
export type AgencyDeclarationSource = { readonly [Field in AgencyDeclarationField]?: unknown };

/** Οι δηλώσεις που **άλλαξαν** — μόνο αυτές, έτοιμες για `update()`. */
export type AgencyDeclarationPatch = { readonly [Field in AgencyDeclarationField]?: unknown };

/** Το πεδίο της τιμής σημείου λήψης που δείχνει στην **κάτοψη** (ADR-897). */
const FLOORPLAN_REFERENCE = 'floorplanFileId';

/** `null` ⇒ η δήλωση δεν αναφέρει το παλιό αρχείο — **καμία** αλλαγή. */
function repointIds(value: unknown, fromId: string, toId: string): unknown[] | null {
  if (!Array.isArray(value) || !value.includes(fromId)) return null;
  // Ο διάδοχος είναι **ήδη** δηλωμένος ⇒ κρατά τη δική του θέση· το παλιό απλώς φεύγει.
  if (value.includes(toId)) return value.filter((entry) => entry !== fromId);
  return value.map((entry) => (entry === fromId ? toId : entry));
}

/** Το **κλειδί** του χάρτη· `null` ⇒ το παλιό αρχείο δεν έχει γραμμή. */
function repointKey(
  value: Record<string, unknown>,
  fromId: string,
  toId: string,
): Record<string, unknown> | null {
  if (!Object.prototype.hasOwnProperty.call(value, fromId)) return null;
  const { [fromId]: carried, ...rest } = value;
  // Ό,τι δήλωσε **ήδη** ο άνθρωπος για τον διάδοχο νικά — η μεταφορά δεν το πατά.
  return Object.prototype.hasOwnProperty.call(rest, toId) ? rest : { ...rest, [toId]: carried };
}

/** Η **τιμή** κάθε γραμμής που δείχνει στην κάτοψη που αντικαταστάθηκε· `null` ⇒ καμία. */
function repointFloorplanReference(
  value: Record<string, unknown>,
  fromId: string,
  toId: string,
): Record<string, unknown> | null {
  let touched = false;
  const next = Object.fromEntries(
    Object.entries(value).map(([id, entry]) => {
      if (!isPlainRecord(entry) || entry[FLOORPLAN_REFERENCE] !== fromId) return [id, entry];
      touched = true;
      return [id, { ...entry, [FLOORPLAN_REFERENCE]: toId }];
    }),
  );
  return touched ? next : null;
}

function repointMap(
  value: unknown,
  fromId: string,
  toId: string,
  onFloorplan: boolean,
): Record<string, unknown> | null {
  if (!isPlainRecord(value)) return null;
  const rekeyed = repointKey(value, fromId, toId);
  if (!onFloorplan) return rekeyed;
  const referenced = repointFloorplanReference(rekeyed ?? value, fromId, toId);
  return referenced ?? rekeyed;
}

/**
 * **Μετάφερε κάθε δήλωση από την παλιά έκδοση στη νέα.**
 *
 * @returns μόνο τα πεδία που **άλλαξαν**, ή `null` όταν το ακίνητο δεν αναφέρει πουθενά το παλιό
 * αρχείο *(= καμία γραφή — το έγγραφο του ακινήτου δεν αγγίζεται καθόλου)*.
 *
 * @example
 * repointDeclarations({ publishedMediaOrder: ['a', 'b'] }, 'a', 'a2'); // { publishedMediaOrder: ['a2', 'b'] }
 * repointDeclarations({ publishedMediaOrder: ['b'] }, 'a', 'a2');      // null
 */
export function repointDeclarations(
  source: AgencyDeclarationSource,
  fromId: string,
  toId: string,
): AgencyDeclarationPatch | null {
  if (fromId === '' || toId === '' || fromId === toId) return null;

  const patch: { [Field in AgencyDeclarationField]?: unknown } = {};
  for (const field of Object.keys(AGENCY_DECLARATION_FIELDS) as AgencyDeclarationField[]) {
    const kind = AGENCY_DECLARATION_FIELDS[field];
    const next = kind === 'ids'
      ? repointIds(source[field], fromId, toId)
      : repointMap(source[field], fromId, toId, kind === 'by-file-on-floorplan');
    if (next !== null) patch[field] = next;
  }
  return Object.keys(patch).length === 0 ? null : patch;
}
