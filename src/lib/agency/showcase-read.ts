/**
 * ADR-841 **Φ6-Β** — ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΗΣ ΒΙΤΡΙΝΑΣ.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΙ ΘΕΡΑΠΕΥΕΙ — ΤΟ `as` ΠΟΥ ΔΕΧΟΤΑΝ Ο,ΤΙ ΓΡΑΦΤΗΚΕ ΠΟΤΕ
 *
 * Το `snapshot.data() as AgencyProfile` ζούσε σε **τρία** σημεία. Με **ένα**
 * σχήμα και υποχρεωτικό `gemiNumber` ήταν ανεκτό. Με **credentials** γίνεται
 * επικίνδυνο: ένα έγγραφο χωρίς **καμία** απόδειξη θα ζωγραφιζόταν ως κάρτα —
 * δηλαδή ακριβώς ο κατάλογος που το ADR-827 §9.9 β ονομάζει *«επικίνδυνο αντί
 * για χρήσιμο»*.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 Η ΜΕΤΑΝΑΣΤΕΥΣΗ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ, ΟΧΙ SCRIPT — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΕΙΚΑΣΙΑ
 *
 * Παλιά έγγραφα δεν έχουν `credentials`· έχουν `gemiNumber`. Η αντιστοίχισή
 * τους σε μεσιτικό credential **δεν μαντεύεται — αποδεικνύεται**: κάθε υπάρχον
 * έγγραφο γράφτηκε από τον `publishAgencyProfile`, που **απαιτούσε**
 * `BrokerageAuthority` *(ενεργή μεσιτική ικανότητα)* **και** μη-κενό
 * `gemiNumber`. Άρα *«χωρίς credentials, με ΓΕΜΗ»* σημαίνει **αποδεδειγμένα**
 * μεσίτης — συμπέρασμα από τον **γραφέα**, όχι από το σχήμα.
 *
 * ⚠️ Το παλιό έγγραφο **δεν έχει ειδικότητα** *(κανείς δεν τη ζήτησε ποτέ)*.
 * Παίρνει την **κανονική** ειδικότητα του μεσίτη, `ISCO 3334`, με το ESCO URI
 * της — και τις ετικέτες της ταξινομίας. ⛔ **Δεν είναι μαντεψιά**: η ιδιότητα
 * του μεσίτη είναι **ήδη αποδεδειγμένη** από το ΓΕΜΗ που κρατά το έγγραφο.
 *
 * ⛔ **ΜΗΝ βάλεις προεπιλογή** τύπου `credentials ?? []`: θα ήταν μαντεψιά με
 * πρόσωπο βεβαιότητας, και το `unreadable` υπάρχει για να μη χρειαστεί ποτέ.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠️ ΤΟ `standing` ΔΕΝ ΔΙΑΒΑΖΕΤΑΙ — **ΥΠΟΛΟΓΙΖΕΤΑΙ**
 *
 * Αν διαβαζόταν από το έγγραφο, μια αποθηκευμένη σημαία θα μπορούσε να πει
 * `self-declared` για μεσίτη και ο τύπος θα το δεχόταν — δηλαδή ο φρουρός του
 * ΓΕΜΗ θα ήταν παρακάμψιμος με **μία λέξη σε ένα JSON**. Εδώ παράγεται από το
 * `iscoCode` με τον {@link occupationNeedsCapability}, δηλαδή από **την ίδια
 * συνάρτηση** που ο γραφέας ρωτά πριν γράψει. Μία ερώτηση, δύο πλευρές.
 *
 * @module lib/agency/showcase-read
 * @see types/agency-profile.ts — το σχήμα και ο τύπος της έκβασης
 * @see lib/professional/showcase-eligibility.ts — ποιο επάγγελμα θέλει άδεια
 */

import { occupationNeedsCapability } from '@/lib/professional/showcase-eligibility';
import type {
  ClassifiedOccupation,
  PublicShowcase,
  ShowcaseCredential,
  ShowcaseRead,
} from '@/types/agency-profile';
import type { ProfessionalAttestation } from '@/types/professional-identity';
import { isRegistryAuthority, isChapteredRegistry } from '@/constants/professional-registries';

/**
 * Η **κανονική** ειδικότητα του μεσίτη — για τη μετανάστευση των παλιών εγγράφων.
 *
 * ✅ **ΕΠΑΛΗΘΕΥΜΕΝΟ ΑΠΟ ΤΗΝ ΠΗΓΗ, 2026-09-02** *(ESCO API,
 * `/resource/occupation?uri=…`)* — ίδιο πρότυπο με το `profession-bridge.config.ts`,
 * που φέρει τη σφραγίδα *«VERIFIED MAPPING (EU ESCO API)»*. Οι ετικέτες είναι τα
 * `preferredLabel` της ταξινομίας, **αυτολεξεί**:
 *
 *   • `el` → *«μεσίτης ακίνητης περιουσίας/μεσίτρια ακίνητης περιουσίας»*
 *   • `en` → *«real estate agent»* · ISCO **3334**
 *
 * ⚠️ **Η ΠΡΩΤΗ ΓΡΑΦΗ ΕΙΧΕ ΕΠΙΝΟΗΜΕΝΟ UUID** και ελληνική ετικέτα «Κτηματομεσίτης»
 * που **δεν** είναι το `preferredLabel` της ταξινομίας. Θα ήταν ακριβώς η
 * **μαντεψιά με πρόσωπο βεβαιότητας** που αυτό το αρχείο απαγορεύει δύο σχόλια
 * πιο πάνω — και θα ήταν **αόρατη**: κάθε test θα περνούσε, γιατί κανένα δεν
 * ρωτά την ταξινομία.
 *
 * 🔑 Το `iscoCode` **συμφωνεί** με τη γραμμή `'3334'` του
 * `ISCO_REGISTRY_AUTHORITY`, που είναι ο **μόνος** κωδικός με `authority: 'gemi'`.
 * Αν κάποιος αλλάξει τον έναν χωρίς τον άλλο, ο μεταναστευμένος μεσίτης θα
 * διαβαστεί ως `self-declared` — γι' αυτό υπάρχει άγκυρα που το ελέγχει
 * **εκτελεσμένα**, όχι σχόλιο που ζητά προσοχή.
 */
const BROKER_OCCUPATION: ClassifiedOccupation = {
  escoUri: 'http://data.europa.eu/esco/occupation/8ec8df02-e9dd-43b7-b416-5846ae0414ab',
  label: {
    el: 'μεσίτης ακίνητης περιουσίας/μεσίτρια ακίνητης περιουσίας',
    en: 'real estate agent',
  },
  iscoCode: '3334',
};

/**
 * **Το μεσιτικό credential από έναν αριθμό ΓΕΜΗ** — μία πηγή, δύο πλευρές.
 *
 * ⚠️ **ΕΝΑΣ ΚΑΤΑΝΑΛΩΤΗΣ ΣΗΜΕΡΑ, ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΟ**: η **μετανάστευση** εδώ. Μέχρι
 * τη Φ6-Β3 το χρησιμοποιούσε **και** ο γραφέας, επειδή δεχόταν μόνο ΓΕΜΗ· τώρα
 * ο γραφέας δέχεται **ειδικότητα** και σχηματίζει το credential με τον
 * {@link asCredential} — την **ίδια** συνάρτηση που καλεί κι αυτό εδώ. Δηλαδή η
 * κοινή απάντηση στο *«πώς μοιάζει μια απόδειξη;»* **δεν** χάθηκε, μετακόμισε
 * ένα επίπεδο πιο κάτω· εδώ μένει μόνο *«ποια είναι η ειδικότητα του μεσίτη»*,
 * που η μετανάστευση **οφείλει** να ξέρει και ο γραφέας **δεν** επιτρέπεται να
 * μαντεύει.
 *
 * ⚠️ Επιστρέφει `ShowcaseCredential`, όχι `ShowcaseCredential | null`: το `3334`
 * είναι **εξ ορισμού** ρυθμιζόμενο και ο αριθμός **δίνεται** — άρα το
 * {@link asCredential} δεν μπορεί να αρνηθεί. Ο τύπος το λέει· η άγκυρα το
 * **εκτελεί**.
 */
export function brokerCredentialOf(gemiNumber: string): ShowcaseCredential {
  const credential = asCredential(BROKER_OCCUPATION, {
    state: 'declared',
    registration: { authorityKind: 'national', authority: 'gemi', number: gemiNumber },
  });
  /* istanbul ignore next — μη προσιτό: το 3334 είναι ρυθμιζόμενο ΚΑΙ ο αριθμός δίνεται. */
  if (credential === null) {
    throw new Error('ADR-841 A9 invariant: broker credential was not constructed - did the ISCO table change?');
  }
  return credential;
}

/** Είναι μη-κενό κείμενο; — το σύνορο δέχεται `unknown`, όχι υποσχέσεις. */
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** Διαβάζει μια ταξινομημένη ειδικότητα, ή `null` αν λείπει έστω ένα από τα τρία. */
function readOccupation(raw: unknown): ClassifiedOccupation | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;

  const escoUri = text(source.escoUri);
  const iscoCode = text(source.iscoCode);
  const label = source.label as Record<string, unknown> | undefined;
  const el = text(label?.el);
  const en = text(label?.en);

  // ⚠️ ΚΑΙ ΤΑ ΤΕΣΣΕΡΑ ΜΑΖΙ. Μια ειδικότητα με ελληνική ετικέτα και χωρίς αγγλική
  //    είναι ακριβώς η βλάβη που ο τύπος `EscoBilingualText` υπάρχει να κλείσει.
  if (escoUri === null || iscoCode === null || el === null || en === null) return null;
  return { escoUri, iscoCode, label: { el, en } };
}

/** Διαβάζει την απόδειξη. Η **απουσία** είναι έγκυρη — είναι το `unknown`. */
function readAttestation(raw: unknown): ProfessionalAttestation | null {
  if (raw === undefined || raw === null) return { state: 'unknown' };
  if (typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;

  const state = source.state;
  if (state === 'unknown') return { state: 'unknown' };
  if (state !== 'declared' && state !== 'verified') return null;

  const registration = source.registration as Record<string, unknown> | undefined;
  const authority = text(registration?.authority);
  const number = text(registration?.number);
  if (authority === null || number === null || !isRegistryAuthority(authority)) return null;

  if (isChapteredRegistry(authority)) {
    const chapter = text(registration?.chapter);
    // 🔒 Η Α9.1 στο σύνορο: «1234» χωρίς «ΔΣΘ» δεν επαληθεύεται από κανέναν.
    if (chapter === null) return null;
    return { state, registration: { authorityKind: 'chapter', authority, chapter, number } };
  }
  return { state, registration: { authorityKind: 'national', authority, number } };
}

/**
 * Δίνει σε ένα ζεύγος *(ειδικότητα, απόδειξη)* την **παραλλαγή** του — ή `null`
 * όταν η ρυθμιζόμενη δραστηριότητα δεν φέρει απόδειξη.
 *
 * 🔑 **ΕΞΑΓΕΤΑΙ ΕΠΕΙΔΗ Ο ΓΡΑΦΕΑΣ ΚΑΝΕΙ ΤΗΝ ΙΔΙΑ ΕΡΩΤΗΣΗ** *(ADR-841 Φ6-Β3)*:
 * *«αυτό το ζεύγος είναι έγκυρο credential, και ποιας παραλλαγής;»*. Δεύτερη
 * υλοποίηση στον γραφέα θα ήταν δεύτερη απάντηση — και η μία θα ξεχνούσε ότι το
 * ρυθμιζόμενο επάγγελμα **δεν μπαίνει** χωρίς απόδειξη, οπότε ο μεσίτης χωρίς
 * ΓΕΜΗ θα γραφόταν και θα **εξαφανιζόταν στην ανάγνωση**.
 */
export function asCredential(
  occupation: ClassifiedOccupation,
  attestation: ProfessionalAttestation,
): ShowcaseCredential | null {
  if (!occupationNeedsCapability(occupation.iscoCode)) {
    return { standing: 'self-declared', occupation, attestation };
  }
  // 🔒 ΡΥΘΜΙΖΟΜΕΝΗ ⇒ ΑΠΟΔΕΙΞΗ ΥΠΟΧΡΕΩΤΙΚΗ. Το «δεν μπαίνεις χωρίς αυτόν» του
  //    παλιού `gemiNumber: string`, τώρα ως τύπος.
  if (attestation.state === 'unknown') return null;
  return { standing: 'regulated', occupation, attestation };
}

/**
 * **Ο φρουρός του συνόρου** — και **η μετανάστευση**, στην ίδια συνάρτηση.
 *
 * @param raw Ό,τι επέστρεψε το `snapshot.data()`.
 * @param companyId Το κλειδί του εγγράφου — για την καταγραφή του `unreadable`.
 */
export function readShowcase(raw: unknown, companyId: string): ShowcaseRead {
  const unreadable: ShowcaseRead = { outcome: 'unreadable', companyId };
  if (typeof raw !== 'object' || raw === null) return unreadable;
  const source = raw as Record<string, unknown>;

  const alias = text(source.alias);
  const displayName = text(source.displayName);
  const publishedAt = text(source.publishedAt);
  if (alias === null || displayName === null || publishedAt === null) return unreadable;

  const credentials = readCredentials(source);
  if (credentials.length === 0) return unreadable;

  return {
    outcome: 'showcase',
    showcase: {
      companyId,
      alias,
      displayName,
      credentials,
      place: readPlace(source.place),
      position: readPosition(source.position),
      publishedAt,
    } satisfies PublicShowcase,
  };
}

/** Τα credentials — από τον πίνακα, **ή** από τη μετανάστευση του παλιού ΓΕΜΗ. */
function readCredentials(source: Record<string, unknown>): readonly ShowcaseCredential[] {
  const declared = source.credentials;
  if (Array.isArray(declared)) {
    const read: ShowcaseCredential[] = [];
    for (const entry of declared) {
      if (typeof entry !== 'object' || entry === null) continue;
      const row = entry as Record<string, unknown>;
      const occupation = readOccupation(row.occupation);
      const attestation = readAttestation(row.attestation);
      if (occupation === null || attestation === null) continue;
      const credential = asCredential(occupation, attestation);
      if (credential !== null) read.push(credential);
    }
    return read;
  }

  // ── ΜΕΤΑΝΑΣΤΕΥΣΗ: παλιό έγγραφο, χωρίς credentials, ΜΕ ΓΕΜΗ ────────────────
  const gemiNumber = text(source.gemiNumber);
  if (gemiNumber === null) return [];
  // 🔑 Η ΙΔΙΑ συνάρτηση που χρησιμοποιεί ο γραφέας — μηδέν διπλότυπο.
  return [brokerCredentialOf(gemiNumber)];
}

/** `PlaceRef` ή `null` — το `landId` είναι το μόνο υποχρεωτικό (η γη κρατά τη θέση). */
function readPlace(raw: unknown): PublicShowcase['place'] {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const landId = text(source.landId);
  return landId === null ? null : { landId, buildingId: text(source.buildingId) };
}

/**
 * `GeoPoint` ή `null`.
 *
 * ⚠️ **Το `{lat:0,lng:0}` ΔΕΝ φιλτράρεται εδώ** — και είναι σκόπιμο: ένα σημείο
 * στον Ατλαντικό είναι **έγκυρο** ζεύγος συντεταγμένων, και μια «έξυπνη»
 * απόρριψή του θα ήταν κανόνας τομέα κρυμμένος σε αναλυτή. Ο φρουρός είναι ο
 * **γραφέας**, που δεν το γράφει ποτέ.
 */
function readPosition(raw: unknown): PublicShowcase['position'] {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const { lat, lng } = source;
  return typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng)
    ? { lat, lng }
    : null;
}

// =============================================================================
// Η ΑΛΛΗ ΚΑΤΕΥΘΥΝΣΗ — ΤΙ ΓΡΑΦΕΤΑΙ ΣΤΟΝ ΔΙΣΚΟ
// =============================================================================

/**
 * **Η βιτρίνα, ΟΠΩΣ ΑΠΟΘΗΚΕΥΕΤΑΙ** — δηλαδή **χωρίς** το `standing`.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΖΕΙ ΕΔΩ, ΔΙΠΛΑ ΣΤΟΝ ΑΝΑΓΝΩΣΤΗ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 *
 * Οι δύο κατευθύνσεις είναι **μία** σύμβαση: *«τι είναι έγγραφο βιτρίνας»*. Σε
 * χωριστό αρχείο, μια αλλαγή στον έναν και όχι στον άλλο θα έγραφε σχήμα που ο
 * αναγνώστης απορρίπτει — δηλαδή **βιτρίνα που εξαφανίζεται τη στιγμή που
 * δημοσιεύεται**, με πράσινο τον γραφέα.
 *
 * 🔴 **Η ΠΡΩΤΗ ΓΡΑΦΗ ΤΗΣ Φ6-Β ΑΠΟΘΗΚΕΥΕ ΤΟ `standing`** *(ο γραφέας έγραφε
 * ολόκληρο το `PublicShowcase`)*. Δεν έσπασε τίποτα — το {@link readShowcase}
 * **δεν το διαβάζει ποτέ**, άρα ο φρουρός έμεινε ακέραιος. Αλλά ήταν πεδίο που
 * **μπορεί να διαφωνήσει με το περιεχόμενο**, ακριβώς η κλάση που το
 * `types/agency-profile.ts` απαγορεύει για το `isPublished` και το ADR-749
 * ονομάζει. Η θεραπεία είναι να **μην γράφεται**, όχι να μη διαβάζεται.
 */
export function toStoredShowcase(showcase: PublicShowcase): Record<string, unknown> {
  const { credentials, ...rest } = showcase;
  return {
    ...rest,
    credentials: credentials.map(({ occupation, attestation }) => ({ occupation, attestation })),
  };
}
