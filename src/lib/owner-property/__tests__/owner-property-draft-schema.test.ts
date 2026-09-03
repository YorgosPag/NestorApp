/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ, ΜΕ ΜΑΡΤΥΡΕΣ** — τι επιβιώνει και τι όχι.
 * @related ADR-777 §7 (Α5 · Α14 · §14.5) · lib/owner-property/owner-property-draft-schema.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΡΑΦΤΗΚΕ — Η ΒΛΑΒΗ ΠΟΥ ΔΕΝ ΕΙΧΕ ΚΑΝΕΝΑ ΟΡΓΑΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι τις 2026-08-27, **καμία** αγγελία με δηλωμένη διεύθυνση δεν έφτανε ποτέ στο
 * `public_listings` — από **καμία** από τις τρεις πόρτες γραφής. Και η σχέση ήταν
 * **ανάποδη από την υπόσχεση της φόρμας** *(«χωρίς θέση το ακίνητο δεν εμφανίζεται
 * στον χάρτη»)*: όσο **πληρέστερη** η αγγελία, τόσο **σιγουρότερα** εξαφανιζόταν.
 *
 * Η αλυσίδα, μετρημένη ζωντανά: ο πελάτης έστελνε το `place.link` · το zod **δεν το
 * είχε** · ένα `as OwnerPropertyDraft` **έσβηνε** τη διαφωνία με την οντότητα · η
 * προβολή διάβαζε `undefined` · και το Firestore **πετά** σε `undefined`. Αποτέλεσμα:
 * `publish: 'failed'`, **σιωπηλά**, με HTTP **200**.
 *
 * 🔴 **ΤΗΝ ΩΡΑ ΠΟΥ ΓΡΑΦΤΗΚΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΔΕΝ ΥΠΗΡΧΕ ΚΑΜΙΑ ΣΟΥΙΤΑ** που να καλεί
 * την {@link ownerPropertyDraftFromRequest} — μετρημένο, **μηδέν** αρχεία. Το σύνορο
 * που δέχεται ό,τι φτάνει από το δίκτυο ήταν εντελώς αμάρτυρο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΙ **ΔΕΝ** ΜΠΟΡΕΙ ΝΑ ΔΕΙ ΑΥΤΗ Η ΣΟΥΙΤΑ — ΔΗΛΩΜΕΝΟ, ΟΧΙ ΣΙΩΠΗΛΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το Jest εδώ τρέχει με **@swc/jest** (`jest.config.js`), που **σβήνει τους τύπους**.
 * Άρα *«ξαναβάλε το `as` ⇒ κοκκίνισε»* **δεν είναι εφικτό ως άγκυρα**: καμία δοκιμή
 * εδώ δεν βλέπει σφάλμα μεταγλώττισης. Οι δύο εγγυήσεις είναι **διαφορετικά όργανα**
 * και δηλώνονται χωριστά:
 *
 * | Εγγύηση | Ποιος την επιβάλλει |
 * |---|---|
 * | *«το σχήμα **παράγει** ό,τι απαιτεί η οντότητα»* | ο **μεταγλωττιστής** (σκέτη ανάθεση, χωρίς `as`) — pre-commit hook · CI |
 * | *«το πεδίο **επιβιώνει** του συνόρου, με αυτή την τιμή»* | **αυτή η σουίτα** |
 *
 * Ένας ισχυρισμός τύπου μέσα σε δοκιμή θα ήταν **πράσινο που δεν σημαίνει τίποτα**.
 */

import { PROPERTY_TYPES } from '@/constants/property-types';
import { buildPublicListing } from '@/services/listings/public-listing-projection';
import type { OwnerProperty } from '@/types/owner-property';

import { ownerPropertyDraftFromRequest } from '../owner-property-draft-schema';
import {
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '../owner-property-projection';
import { validDraft, validOwnerProperty } from './owner-property-fixtures';

const AT = '2026-08-27T12:00:00.000Z';

/** Ο δεσμός που στέλνει ο επιλογέας της φόρμας — γη **και** κτίριο. */
const LINK = { landId: 'land_dokimi', buildingId: 'pbld_dokimi' } as const;

const DECLARED = {
  kind: 'declared',
  point: { lat: 40.63, lng: 22.95 },
  label: 'Εγνατίας 147, Θεσσαλονίκη',
  accuracy: 'exact',
} as const;

/**
 * Ό,τι στέλνει ο πελάτης — **ωμό `unknown`**, όπως το βλέπει ο διακομιστής.
 *
 * ⚠️ **ΔΕΝ γράφεται ως `OwnerPropertyDraft`**, και είναι το νόημα: αν το σώμα ήταν
 * τυπωμένο, η δοκιμή θα ρωτούσε *«περνά ο τύπος;»* ενώ το ερώτημα του συνόρου είναι
 * *«τι επιβιώνει από **αυθαίρετο** JSON;»*.
 */
function bodyOf(place: unknown, rest: Record<string, unknown> = {}): unknown {
  const { place: _replaced, ...draft } = validDraft();
  return { ...draft, ...rest, place };
}

/**
 * **Κάθε μονοπάτι όπου ζει `undefined`**, όσο βαθιά κι αν είναι.
 *
 * 🔑 **Ο ανιχνευτής ρωτά την ΚΛΑΣΗ, όχι το δείγμα.** Το Firestore πετά σε
 * *«Cannot use "undefined" as a Firestore value»* για **οποιοδήποτε** πεδίο — όχι
 * μόνο για το `place` που έτυχε να μας κάψει. Μια άγκυρα καρφωμένη στο `place` θα
 * ήταν πράσινη την επόμενη φορά που ένα **άλλο** πεδίο κάνει το ίδιο.
 */
function undefinedPathsIn(value: unknown, path = '$'): readonly string[] {
  if (value === undefined) return [path];
  if (value === null || typeof value !== 'object') return [];

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => undefinedPathsIn(item, `${path}[${index}]`));
  }

  return Object.entries(value).flatMap(([key, item]) =>
    undefinedPathsIn(item, `${path}.${key}`),
  );
}

/** Η **πλήρης** διαδρομή προς τη δημόσια προβολή, όπως την εκτελεί ο γραφέας. */
function publicListingOf(property: OwnerProperty): unknown {
  return buildPublicListing(
    projectableFromOwnerProperty(property, AT),
    placeKnowledgeFromOwnerProperty(property, AT),
    AT,
  );
}

// =============================================================================
// Κ1 — Ο ΔΕΣΜΟΣ ΕΠΙΒΙΩΝΕΙ ΤΟΥ ΣΥΝΟΡΟΥ
// =============================================================================

describe('Κ1 — ο δεσμός προς το επίπεδο Α επιβιώνει του συνόρου', () => {
  /** ⛔ ΜΕΤΑΛΛΑΞΗ: βγάλε το `link` από το zod σχήμα ⇒ **κόκκινο**. */
  it('κρατά τον δεσμό αυτούσιο', () => {
    const parsed = ownerPropertyDraftFromRequest(bodyOf({ ...DECLARED, link: LINK }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.place).toMatchObject({ kind: 'declared', link: LINK });
  });

  /**
   * ✅ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — αποδεικνύει ότι το όργανο ΒΛΕΠΕΙ το πεδίο.**
   *
   * Πριν τη διόρθωση, αυτό ακριβώς το σώμα περνούσε **αθόρυβα** και παρήγαγε `link:
   * undefined`. Αν αύριο κάποιος κάνει το πεδίο `optional`, αυτή η άγκυρα κοκκινίζει
   * **πρώτη** — και είναι η μόνη που ξεχωρίζει *«το σχήμα έχει το πεδίο»* από *«το
   * σχήμα το απαιτεί»*.
   */
  it('ΑΠΟΡΡΙΠΤΕΙ δηλωμένη θέση χωρίς δεσμό — η απουσία δεν είναι απάντηση', () => {
    const parsed = ownerPropertyDraftFromRequest(bodyOf(DECLARED));

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.malformed).toContain('place.link');
  });

  /** «Δεν δείχνω κτίριο» είναι **απάντηση** — επιλογή, ποτέ προϋπόθεση (§21.4). */
  it('δέχεται ρητό `null` και το κρατά `null`', () => {
    const parsed = ownerPropertyDraftFromRequest(bodyOf({ ...DECLARED, link: null }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.place).toMatchObject({ kind: 'declared', link: null });
  });

  /** Γη χωρίς κτίριο: **η γη αρκεί** — δες `PlaceRef.buildingId`. */
  it('δέχεται δεσμό μόνο προς γη', () => {
    const onlyLand = { landId: 'land_dokimi', buildingId: null };
    const parsed = ownerPropertyDraftFromRequest(bodyOf({ ...DECLARED, link: onlyLand }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.place).toMatchObject({ link: onlyLand });
  });

  /** ⛔ ΜΕΤΑΛΛΑΞΗ: `z.string()` αντί για `z.string().min(1)` ⇒ **κόκκινο**. */
  it('απορρίπτει κενή ταυτότητα γης — δείκτης προς το πουθενά', () => {
    const parsed = ownerPropertyDraftFromRequest(
      bodyOf({ ...DECLARED, link: { landId: '', buildingId: null } }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.malformed).toContain('place.link.landId');
  });

  /**
   * ⚠️ Το `declined` **δεν έχει** πεδίο δεσμού — και είναι σχεδίαση: το να δείξεις
   * δημόσιο κτίριο **είναι** αποκάλυψη θέσης, ακριβέστερη από μια διεύθυνση.
   */
  it('η άρνηση θέσης περνά χωρίς δεσμό', () => {
    const parsed = ownerPropertyDraftFromRequest(bodyOf({ kind: 'declined' }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.place).toEqual({ kind: 'declined' });
  });
});

// =============================================================================
// Κ2 — ΤΟ ΕΙΔΟΣ ΕΙΝΑΙ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ
// =============================================================================

describe('Κ2 — το είδος ακινήτου είναι κλειστό σύνολο', () => {
  /**
   * ⛔ ΜΕΤΑΛΛΑΞΗ: γύρνα το `type` σε `z.string()` ⇒ **κόκκινο**.
   *
   * Πριν τη διόρθωση **κάθε** συμβολοσειρά περνούσε για είδος, γραφόταν στο
   * `owner_properties`, και ξαναβαφτιζόταν με **δεύτερο** `as` στη δημόσια προβολή.
   */
  it('απορρίπτει είδος εκτός λεξιλογίου', () => {
    const parsed = ownerPropertyDraftFromRequest(
      bodyOf({ ...DECLARED, link: null }, { type: 'κάστρο' }),
    );

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.malformed).toContain('type');
  });

  /**
   * ✅ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — η αυστηροποίηση δεν έκλεισε καμία ανοιχτή πόρτα.**
   *
   * Η φόρμα προσφέρει **ακριβώς** αυτό το σύνολο (`OwnerPropertyFields.tsx` →
   * `options={PROPERTY_TYPES}`). Χωρίς αυτή τη δοκιμή, το «απορρίπτει τα άγνωστα»
   * θα ήταν πράσινο **και** αν το σχήμα απέρριπτε τα πάντα.
   */
  it.each(PROPERTY_TYPES)('δέχεται το κανονικό είδος «%s»', (type) => {
    const parsed = ownerPropertyDraftFromRequest(
      bodyOf({ ...DECLARED, link: null }, { type }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.type).toBe(type);
  });
});

// =============================================================================
// Κ3 — 🔴 Η ΚΛΑΣΗ: ΚΑΜΙΑ ΤΙΜΗ `undefined` ΔΕΝ ΦΤΑΝΕΙ ΣΤΟ FIRESTORE
// =============================================================================

describe('Κ3 — η δημόσια προβολή δεν περιέχει ΠΟΤΕ `undefined`', () => {
  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ ΠΕΡΙΣΤΑΤΙΚΟΥ, ΓΡΑΜΜΕΝΗ ΩΣ ΚΛΑΣΗ.**
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: βγάλε το `link` από το σχήμα **ή** το `?? null` της προβολής ⇒
   * **κόκκινο**, με το μονοπάτι τυπωμένο.
   */
  it('με δηλωμένο δεσμό', () => {
    const property = validOwnerProperty({ place: { ...DECLARED, link: LINK } });

    expect(undefinedPathsIn(publicListingOf(property))).toEqual([]);
  });

  it('χωρίς δεσμό (`null`)', () => {
    expect(undefinedPathsIn(publicListingOf(validOwnerProperty()))).toEqual([]);
  });

  it('με άρνηση θέσης', () => {
    const property = validOwnerProperty({ place: { kind: 'declined' } });

    expect(undefinedPathsIn(publicListingOf(property))).toEqual([]);
  });

  /**
   * ✅ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ ΟΡΓΑΝΟΥ.** Χωρίς αυτόν, τα τρία από πάνω θα ήταν πράσινα
   * και αν ο ανιχνευτής επέστρεφε **πάντα** κενό — δηλαδή «0 ευρήματα» θα σήμαινε
   * «δεν κοίταξα». Φυτεύουμε `undefined` σε **τρία** βάθη, και τρεις μη-τιμές που
   * **δεν** πρέπει να μπερδευτούν μαζί του.
   */
  it('ο ανιχνευτής ΒΛΕΠΕΙ — φυτεμένο `undefined` βρίσκεται', () => {
    expect(undefinedPathsIn({ a: undefined })).toEqual(['$.a']);
    expect(undefinedPathsIn({ a: { b: undefined } })).toEqual(['$.a.b']);
    expect(undefinedPathsIn({ a: [1, undefined] })).toEqual(['$.a[1]']);
    expect(undefinedPathsIn({ a: null, b: 0, c: '' })).toEqual([]);
  });
});

// =============================================================================
// Κ4 — ΖΩΝΗ ΚΑΙ ΤΙΡΑΝΤΕΣ: ΜΠΑΓΙΑΤΙΚΟ ΕΓΓΡΑΦΟ ΔΕΝ ΡΙΧΝΕΙ ΤΗΝ ΠΡΟΒΟΛΗ
// =============================================================================

describe('Κ4 — έγγραφο χωρίς `link` δίνει `ref: null`, ποτέ `undefined`', () => {
  /**
   * 🔑 **Δεν είναι επανάληψη του Κ1 — είναι ΑΛΛΗ ΠΗΓΗ.** Το Κ1 φυλάει το **δίκτυο**·
   * αυτό φυλάει τη **βάση**: κάθε αγγελία που γράφτηκε πριν τη διόρθωση **δεν έχει**
   * το πεδίο, και η επανασύνθεση θα τη διαβάσει αυτούσια.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: βγάλε το `?? null` από την `placeKnowledgeFromOwnerProperty` ⇒
   * **κόκκινο**.
   */
  it('η γνώση τόπου κλείνει την απουσία', () => {
    // ⚠️ Ο ισχυρισμός τύπου είναι **σκόπιμος και μοναδικός**: εκφράζει έγγραφο που ο
    //    σημερινός τύπος **δεν επιτρέπει** να γεννηθεί, αλλά η βάση **περιέχει**.
    const stale = validOwnerProperty({
      place: { ...DECLARED, link: undefined as unknown as null },
    });

    expect(placeKnowledgeFromOwnerProperty(stale, AT).ref).toBeNull();
    expect(undefinedPathsIn(publicListingOf(stale))).toEqual([]);
  });
});

// =============================================================================
// Κ5 — Η ΕΠΙΛΟΓΗ ΔΗΜΟΣΙΕΥΣΗΣ ΕΠΙΒΙΩΝΕΙ ΤΟΥ ΣΥΝΟΡΟΥ (ADR-841 §7 Α2.7)
// =============================================================================

/**
 * 🔴 **ΤΡΙΤΟ ΔΕΙΓΜΑ ΤΗΣ ΙΔΙΑΣ ΚΛΑΣΗΣ, ΒΡΕΜΕΝΟ ΠΕΡΠΑΤΩΝΤΑΣ ΤΗ Φ3 (2026-09-01).**
 *
 * Ο άνθρωπος τσέκαρε «Δημοσίευση», η οθόνη έγραψε «Δημοσιεύονται 1 από 24», και το
 * `published` **δεν έφτασε ποτέ στη Firestore**: το `zod` κόβει σιωπηλά ό,τι δεν
 * δηλώνεται. Η αγγελία έμεινε χωρίς εικόνες, με `publish: 'published'` και HTTP 200 —
 * **ακριβώς** το σχήμα του `place.link` της 27/08 που γέννησε αυτό το αρχείο.
 *
 * ⚠️ **ΚΑΙ Ο ΜΕΤΑΓΛΩΤΤΙΣΤΗΣ ΗΤΑΝ ΔΟΜΙΚΑ ΑΝΙΚΑΝΟΣ ΝΑ ΤΟ ΔΕΙ**, παρότι το σχήμα δηλώνει
 * ρητό τύπο επιστροφής ακριβώς γι' αυτόν τον λόγο: το πεδίο είναι **προαιρετικό** στην
 * οντότητα, άρα αντικείμενο **χωρίς** αυτό ικανοποιεί τον τύπο. Ο φρουρός της
 * «απόκλισης σχήματος ⇄ οντότητας» πιάνει τα **υποχρεωτικά**· τα **προαιρετικά** τα
 * φυλάει μόνο άγκυρα που **περνά τιμή** από το σύνορο — δηλαδή αυτή εδώ.
 */
describe('Κ5 — η επιλογή «δημοσίευσε αυτό το αρχείο» επιβιώνει του συνόρου', () => {
  const fileAt = (name: string, published?: boolean, kind?: 'photo' | 'floorplan') => ({
    storagePath: `owner_properties/u1/ownp_1/${name}`,
    fileName: name,
    sizeBytes: 10,
    uploadedAt: AT,
    ...(published === undefined ? {} : { published }),
    ...(kind === undefined ? {} : { kind }),
  });

  /**
   * ⚠️ **Το σύνορο επιστρέφει κρίση, όχι προσχέδιο** — `{ ok, draft } | { ok: false, malformed }`.
   * Κάθε άγκυρα εδώ περνά πρώτα από `expect(parsed.ok).toBe(true)`: χωρίς αυτό, ένα
   * σκέτο `if (!parsed.ok) return` θα έκανε τη δοκιμή **πράσινη ακριβώς όταν το σχήμα
   * απορρίπτει το σώμα** — δηλαδή τυφλή στην ίδια την κλάση που φυλάει (ίδιο ύφος με Κ1–Κ4).
   */
  const draftFrom = (media: readonly unknown[]) =>
    ownerPropertyDraftFromRequest(bodyOf({ kind: 'declined' }, { media }));

  /** ⛔ ΜΕΤΑΛΛΑΞΗ: βγάλε το `published` από το zod σχήμα ⇒ **κόκκινο**. */
  it('το ρητό `true` φτάνει αυτούσιο στην οντότητα', () => {
    const parsed = draftFrom([fileAt('a.jpg', true)]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.media[0].published).toBe(true);
  });

  it('🔑 και η ΑΠΟΥΣΙΑ μένει απουσία — ποτέ σιωπηλό `true`', () => {
    // Η προεπιλογή είναι **ιδιωτικό** (opt-in): ένα `?? true` κάπου στη διαδρομή θα
    // δημοσίευε αναδρομικά κάθε αρχείο που ανέβηκε υπό γραπτή υπόσχεση ιδιωτικότητας.
    const parsed = draftFrom([fileAt('a.jpg')]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.media[0].published).toBeUndefined();
  });

  it('🔴 και η ΕΠΙΛΟΓΗ φτάνει ως ΠΗΓΗ ΤΟΥ ΡΑΦΙΟΥ — η ολόκληρη αλυσίδα', () => {
    // Δεν ελέγχεται πεδίο: εκτελείται η **πλήρης** διαδρομή σύνορο → οντότητα →
    // γραφέας, γιατί κάθε κρίκος της έχει ήδη σπάσει μία φορά σε αυτό το έργο.
    //
    // 🔑 **Ξεκινά από ωμό JSON, όχι από στιγμιότυπο οντότητας**: μια αλυσίδα που
    //    αρχίζει **μετά** το σύνορο δεν βλέπει τον κρίκο που έσπασε — και το `zod` που
    //    κόβει σιωπηλά είναι **ακριβώς εκεί**. Το σχόλιο που υπόσχεται «σύνορο → μ → γ»
    //    και ξεκινά από το μ είναι το ίδιο το ψέμα που κυνηγάει αυτή η σουίτα.
    const parsed = draftFrom([fileAt('nai.jpg', true), fileAt('oxi.jpg')]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const chosen = validOwnerProperty(parsed.draft);

    expect(projectableFromOwnerProperty(chosen, AT).publishedMedia).toEqual([
      {
        privateStoragePath: 'owner_properties/u1/ownp_1/nai.jpg',
        material: { kind: 'photo' },
      },
    ]);
  });

  /**
   * 🔴 **Η ΔΕΥΤΕΡΗ ΔΗΛΩΣΗ ΠΕΡΝΑ ΤΟ ΙΔΙΟ ΣΥΝΟΡΟ — ΚΑΙ ΤΟ ΙΔΙΟ `zod` ΤΗΝ ΕΚΟΒΕ**
   * (ADR-841 §7 Α17).
   *
   * Το `kind` είναι **προαιρετικό**, ακριβώς όπως το `published` από πάνω — άρα ο
   * μεταγλωττιστής είναι **ξανά** δομικά ανίκανος να δει την κοπή. Χωρίς αυτή την
   * άγκυρα, ο άνθρωπος θα τσέκαρε «Είναι κάτοψη», η οθόνη θα το έδειχνε τσεκαρισμένο,
   * και η δήλωση **δεν θα έφτανε ποτέ στη Firestore**: η κάτοψη θα ξαναγινόταν
   * *«Φωτογραφία N από M»* — **το Ο-20 με τη διόρθωσή του γραμμένη και ανενεργή**.
   *
   * ⛔ **ΜΕΤΑΛΛΑΞΗ**: βγάλε το `kind` από το zod σχήμα ⇒ **κόκκινο**.
   */
  it('🔴 και η ΔΗΛΩΣΗ «είναι κάτοψη» φτάνει ως ΠΗΓΗ ΤΟΥ ΡΑΦΙΟΥ, με τη στιγμή του ανθρώπου', () => {
    const parsed = draftFrom([
      fileAt('foto.jpg', true),
      fileAt('katopsi.jpg', true, 'floorplan'),
    ]);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.draft.media[1].kind).toBe('floorplan');

    const chosen = validOwnerProperty(parsed.draft);

    // 🔑 **Και οι δύο φτάνουν στο ράφι** — ΕΝΑ πρόθεμα ανά αγγελία, ΕΝΑΣ διαχωρισμός
    //    στο τέλος. Δύο συμφιλιώσεις θα έσβηναν η μία τα αντικείμενα της άλλης.
    expect(projectableFromOwnerProperty(chosen, AT).publishedMedia).toEqual([
      {
        privateStoragePath: 'owner_properties/u1/ownp_1/foto.jpg',
        material: { kind: 'photo' },
      },
      {
        privateStoragePath: 'owner_properties/u1/ownp_1/katopsi.jpg',
        // ⚠️ Το `at` είναι το `uploadedAt` **του ανθρώπου**, ποτέ ρολόι του γραφέα.
        material: { kind: 'floorplan', at: AT },
      },
    ]);
  });
});
