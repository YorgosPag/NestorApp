/**
 * @fileoverview Το ντετερμινιστικό κλειδί μιας εγκεκριμένης σύνδεσης πινακίδας (ADR-745 §6.2).
 *
 * Καθαρό, μηδέν I/O. Το ερώτημα που απαντά είναι ένα: **ποιο έγγραφο είναι «αυτό το κελί αυτού
 * του σχεδίου δείχνει σε αυτή την οντότητα»**, ώστε η επανάληψη της έγκρισης να μη διπλασιάζει
 * και η διόρθωση να μη σβήνει.
 *
 * ```
 * tbb_{fileRecordId}_{levelId}_{cellRef}_{fieldKey}_{slot}_{targetRef}
 * ```
 *
 * 🔴 **Το ADR §6.2 πρότεινε `${fileRecordId}:${fieldKey}` — ΑΝΕΠΑΡΚΕΣ, μετρημένα.** Σπάει σε
 * τέσσερα σημεία: δύο πινακίδες στο ίδιο layer (§2.3 Παγίδα Δ), δύο πρόσωπα από **ένα** κελί
 * μελετητών, τρεις ενότητες από **ένα** κελί θέσης, και το ίδιο αρχείο σε δύο levels.
 *
 * 🔑 **Γιατί ΓΕΩΜΕΤΡΙΑ και όχι `sourceHandle` — το πιο ακριβό μάθημα αυτής της φάσης.**
 * Το `sourceHandle` **δεν είναι DXF handle**: `scene-title-block-cells.ts:96` δίνει `entity.id`,
 * που παράγεται ως `` `${idPrefix}_${index}` `` (`dxf-text-converters.ts:221`) από **δύο
 * ανεξάρτητους μετρητές** — τον top-level (`dxf-scene-builder.ts:272` → `:314`) και τον
 * block-flattened (`:265` `idSeq` → `dxf-block-expander.ts:203`) — **που καταλήγουν στην ίδια
 * σκηνή** (`:310`). Πινακίδα μέσα σε BLOCK, η κλασική περίπτωση AutoCAD, δίνει έτσι **δύο
 * `mtext_7`** στο ίδιο layer. Το σημείο εισαγωγής, αντίθετα, είναι **σταθερό ανά αρχείο**,
 * **μοναδικό ανά κελί**, και ανεξάρτητο και από τους δύο μετρητές **και** από το κατώφλι
 * ομαδοποίησης του Λ1 — που είναι ο λόγος που ούτε ο `titleBlockIndex` κάνει για κλειδί.
 *
 * @module lib/title-block-binding-id
 */

import { titleBlockBindingKey } from '@/services/enterprise-id-composite-keys';
import type { BindingProposal, BindingTarget } from '@/types/title-block-binding';

/**
 * Δεκαδικά του `cellRef`.
 *
 * Τρία αρκούν με τεράστιο περιθώριο: στο δείγμα G753 τα **γειτονικά** κελιά απέχουν ≳1,6 μονάδες
 * και οι δύο πινακίδες 36,49 (ADR §5.4α). Περισσότερα δεκαδικά θα έκαναν το κλειδί ευάλωτο σε
 * θόρυβο τελευταίου bit· λιγότερα θα συγχώνευαν κελιά.
 */
const CELL_DECIMALS = 3;

/**
 * Συντεταγμένη → σταθερό κομμάτι κλειδιού.
 *
 * ⚠️ Το `-0` εξομαλύνεται σε `0`: το `(-0.0001).toFixed(3)` δίνει `'-0.000'` ενώ το `(0).toFixed(3)`
 * δίνει `'0.000'` — **δύο κλειδιά για το ίδιο σημείο**. Χωρίς αυτή τη γραμμή, ένα κελί ακριβώς
 * πάνω στον άξονα θα έδινε άλλοτε το ένα κι άλλοτε το άλλο, ανάλογα με το προηγούμενο bit.
 */
function coordSegment(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`title-block-binding-id: non-finite coordinate (${value})`);
  }
  const factor = 10 ** CELL_DECIMALS;
  const rounded = Math.round(value * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return normalized.toFixed(CELL_DECIMALS).replace('-', 'n').replace('.', 'p');
}

/** Η **ταυτότητα του κελιού**: το σημείο εισαγωγής της τιμής, όχι ο μετρητής της σκηνής. */
export function cellRef(at: { readonly x: number; readonly y: number }): string {
  return `x${coordSegment(at.x)}y${coordSegment(at.y)}`;
}

/**
 * Ελεύθερο κείμενο → **αντιστρεπτό** τμήμα κλειδιού.
 *
 * 🔴 **Η αντιστρεψιμότητα ΔΕΝ είναι σχολαστικισμός — είναι ο φύλακας.** Μια «καθαρίστρια»
 * κανονικοποίηση που αντικαθιστά κάθε ύποπτο χαρακτήρα με `-` θα έστελνε το `ΠΑΠΠΑΣ Α/Β` και το
 * `ΠΑΠΠΑΣ Α Β` στο **ίδιο** slot ⇒ η έγκριση του δεύτερου θα μαρκάριζε `superseded` τον πρώτο,
 * **σιωπηλά**. Το percent-encoding είναι 1:1, άρα δύο διαφορετικά ονόματα δεν συγχωνεύονται ποτέ.
 *
 * Το `/` είναι **πραγματικό** εδώ, όχι υποθετικό: το `resolve-landowner.ts` περνά **ωμό κείμενο
 * κελιού** ως `personName`, και το δείγμα G753 γράφει «ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ» — και το `/` είναι
 * **παράνομος χαρακτήρας σε Firestore document id**.
 *
 * Το `_` κωδικοποιείται κι αυτό: είναι ο διαχωριστής μας, και ένα `_` μέσα σε τμήμα θα έκανε τα
 * όρια των τμημάτων διφορούμενα για όποιον κοιτάξει ποτέ το κλειδί.
 */
export function encodeKeySegment(raw: string): string {
  const normalized = raw.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error('title-block-binding-id: empty key segment');
  return encodeURIComponent(normalized).replace(/[_.!~*'()]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Πού δείχνει ένας στόχος, ως τμήμα κλειδιού. */
export function targetRef(target: BindingTarget): string {
  switch (target.kind) {
    case 'contact':
      // 🔑 Ο ΡΟΛΟΣ είναι μέρος της ταυτότητας, γιατί είναι μέρος του id του ίδιου του συνδέσμου
      // (`lib/contact-link-id.ts:31-35`). Χωρίς αυτόν, «λάθος ρόλος → σωστός ρόλος» θα άφηνε
      // **δύο ενεργά** `contact_links` και **ένα** binding: ο παλιός σύνδεσμος θα γινόταν μόνιμα
      // ανακτήσιμος, αφού το `unlinkContact()` απαιτεί το `linkId` που δεν ξαναχτίζεται.
      return `contact-${target.contactId}-${target.role}`;
    case 'landowner':
      return `landowner-${target.contactId}`;
    case 'project-address':
      return `addr-${target.field}`;
    case 'project-field':
      return `pfield-${target.field}`;
    case 'drawing-meta':
      return `meta-${target.field}`;
  }
}

/**
 * Ποια **θέση πρότασης μέσα στο κελί** — ο άξονας που ούτε το `fieldKey` ούτε το `cellRef` βλέπουν.
 *
 * 🔴 Χωρίς αυτόν, το supersede θα είχε εμβέλεια **κελιού** και η έγκριση του μελετητή #2 θα
 * μαρκάριζε `superseded` τον #1 — **δύο νόμιμες συνδέσεις από το ίδιο κελί**, η μία σβησμένη
 * χωρίς να το ζητήσει κανείς. Το `ΘΕΣΗ` έχει το ίδιο σχήμα με τρεις ενότητες.
 */
export function bindingSlot(proposal: BindingProposal, target: BindingTarget): string {
  if (proposal.personName) return encodeKeySegment(proposal.personName);
  switch (target.kind) {
    case 'project-address':
    case 'project-field':
    case 'drawing-meta':
      return target.field;
    // Πρόσωπο χωρίς `personName` δεν παράγεται από τον Λ2, αλλά ένα κλειδί δεν επιτρέπεται να
    // εξαρτάται από αυτό: η επαφή/ο οικοπεδούχος ταυτοποιείται ήδη μοναδικά στο `targetRef`.
    case 'contact':
    case 'landowner':
      return target.contactId;
  }
}

export interface TitleBlockBindingKeyParts {
  readonly fileRecordId: string;
  readonly levelId: string;
  readonly proposal: BindingProposal;
  readonly target: BindingTarget;
}

/**
 * Το κλειδί μιας έγκρισης.
 *
 * @throws αν λείπει `fileRecordId` ή `levelId` — **ποτέ `?? ''`**. Ένα κενό τμήμα θα γεννούσε
 *   κλειδί που το επόμενο φόρτωμα δεν ξαναβρίσκει, άρα **δεύτερο έγγραφο για την ίδια σύνδεση**
 *   (ADR-745 §Γ2: το `fileRecordId` φτάνει **αργότερα** από την πρώτη απόδοση). Η σιωπηλή
 *   ανοχή εδώ ήταν ο τελευταίος φραγμός του κλικ στο §13(ι) — `user?.uid ?? ''`.
 */
export function buildTitleBlockBindingKey(parts: TitleBlockBindingKeyParts): string {
  const { fileRecordId, levelId, proposal, target } = parts;
  if (!fileRecordId) throw new Error('buildTitleBlockBindingKey: fileRecordId is required');
  if (!levelId) throw new Error('buildTitleBlockBindingKey: levelId is required');

  return titleBlockBindingKey([
    encodeKeySegment(fileRecordId),
    encodeKeySegment(levelId),
    cellRef(proposal.at),
    proposal.fieldKey,
    bindingSlot(proposal, target),
    targetRef(target),
  ]);
}

/**
 * Η **εμβέλεια του supersede**: όλα όσα καταλαμβάνουν την ίδια θέση, ό,τι κι αν δείχνουν.
 *
 * Ίδιο πρόθεμα κλειδιού μέχρι και το `slot`, **χωρίς** το `targetRef`. Παράγεται από την ίδια
 * συνάρτηση με το κλειδί ώστε τα δύο να **μην μπορούν** να αποκλίνουν: μια χειρόγραφη δεύτερη
 * συναρμολόγηση είναι ακριβώς το είδος διπλότυπου που ξεσυγχρονίζεται μήνες αργότερα.
 */
export function bindingSlotScope(parts: TitleBlockBindingKeyParts): string {
  const full = buildTitleBlockBindingKey(parts);
  const suffix = `_${targetRef(parts.target)}`;
  return full.slice(0, full.length - suffix.length);
}
