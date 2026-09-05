/**
 * 🔴 **Ο ΚΡΙΤΗΣ ΤΟΥ «ΓΙΝΕΣΑΙ ΔΕΚΤΟΣ;» ΕΙΝΑΙ ΕΝΑΣ — ΚΑΙ ΡΩΤΑ ΜΕ ΤΗ ΣΩΣΤΗ ΣΕΙΡΑ.**
 * @related ADR-843 §10.18 · services/contact/first-contact-admission.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ, ΚΑΙ ΓΙΑΤΙ Η ΣΕΙΡΑ ΕΙΝΑΙ ΤΟ ΠΡΑΓΜΑ ΠΟΥ ΜΠΟΡΕΙ ΝΑ ΧΑΛΑΣΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι τρεις πρώτοι φρουροί του γραφέα **έφυγαν** σε δικό τους αρχείο, ώστε να μπορεί να
 * τους ρωτήσει **και η οθόνη** πριν βάψει το κουμπί. Η μετακόμιση είναι ασφαλής **μόνο
 * αν η σειρά ταξίδεψε μαζί τους** — και η σειρά είναι **παρατηρήσιμη σε μία και μόνο
 * περίπτωση**:
 *
 * > Ο άνθρωπος έχει **γεμάτη** χωρητικότητα **ΚΑΙ** ήδη ανοιχτή πράξη προς **αυτόν**
 * > τον στόχο. Η ιδεμποτησία πρώτη λέει *«την έχεις ήδη»* — **επιτυχία**. Η
 * > χωρητικότητα πρώτη λέει *«γέμισε»* — **άρνηση για κάτι που ήδη πέτυχε**.
 *
 * ⚠️ **Ένα fixture όπου τα δύο συμφωνούν θα ήταν πράσινο και με τις δύο σειρές**,
 * δηλαδή θα φύλαγε **μηδέν** — ίδιο μάθημα με το ασύμφωνο fixture χωρητικότητας του
 * §10.14 (*«η ασυμφωνία είναι το όργανο»*).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΣΧΗΜΑ: **ΚΡΙΤΗΡΙΟ ΩΣ ΣΥΝΑΡΤΗΣΗ + ΑΝΤΙ-ΠΑΡΑΔΕΙΓΜΑ** (§10.14)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το κριτήριο ({@link signatureOf}) ορίζεται **μία** φορά και **εκτελείται δύο**: στον
 * **αληθινό** κριτή *(πρέπει να περάσει)* και σε έναν **γραμμένο εδώ μέσα** που ρωτά με
 * ανάποδη σειρά *(πρέπει να πέσει)*. Χωρίς το δεύτερο σκέλος, το αρχείο θα ισχυριζόταν
 * ότι φυλάει σειρά **χωρίς να το έχει αποδείξει ποτέ**.
 *
 * ⚠️ **Κανένα αρχείο του δέντρου δεν μεταλλάσσεται** — μετρήθηκε 2026-09-04 ότι
 * παράλληλος πράκτορας διαβάζει τη μετάλλαξη και την αναφέρει ως εύρημα, ή την κάνει
 * commit.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { OPEN_CONTACT_CAPACITY } from '@/lib/contact/first-contact-limits';
import type { ListingActor } from '@/lib/owner-property/listing-custody';
import type { LocatedTarget } from '@/services/contact/first-contact-target-locator';
import {
  refuseFirstContact,
  FIRST_CONTACT_UNAVAILABLE,
} from '@/services/contact/first-contact-vocabulary';
import type { FirstContact, FirstContactTarget } from '@/types/first-contact';

import { admitFirstContact, type ContactAdmission } from '../first-contact-admission';

// ---------------------------------------------------------------------------
// Οι δύο συνεργάτες είναι ΨΕΥΤΙΚΟΙ, και είναι σκόπιμο: αυτό το αρχείο δεν κρίνει
// «ποιον φτάνει η πράξη» ούτε «πόσες έχει ανοιχτές» — τα φυλούν οι δικές τους
// άγκυρες. Εδώ κρίνεται **ΠΟΙΟΝ ΡΩΤΑΜΕ, ΜΕ ΤΙ ΣΕΙΡΑ, ΚΑΙ ΤΙ ΑΠΑΝΤΑΜΕ**.
// ---------------------------------------------------------------------------
jest.mock('@/services/contact/first-contact-projection', () => ({
  loadSeekerContacts: jest.fn(),
}));
jest.mock('@/services/contact/first-contact-guards', () => ({
  resolveTarget: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires -- τα mocks πρέπει να διαβαστούν ΜΕΤΑ το jest.mock
const projection = require('@/services/contact/first-contact-projection');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const guards = require('@/services/contact/first-contact-guards');

const loadSeekerContacts = projection.loadSeekerContacts as jest.Mock;
const resolveTarget = guards.resolveTarget as jest.Mock;

const NOW = '2026-09-05T10:00:00.000Z';
const DB = {} as AdminFirestore;
const ACTOR: ListingActor = { uid: 'user-maria', companyId: null };
const TARGET: FirstContactTarget = { kind: 'listing', listingId: 'ownp_0001' };
const OTHER: FirstContactTarget = { kind: 'listing', listingId: 'ownp_9999' };

const LOCATED: LocatedTarget = {
  custody: { kind: 'personal', userId: 'user-nikos' },
  facts: null,
};

function openContactToward(target: FirstContactTarget, id: string): FirstContact {
  return {
    id,
    seekerUserId: ACTOR.uid,
    target,
    offerer: { kind: 'personal', userId: 'user-nikos' },
    demandId: null,
    disclosure: {
      displayName: 'Μαρία Κ.',
      email: 'maria@example.gr',
      phone: null,
      acceptsPlatformMessages: false,
    },
    matchReason: null,
    lifecycle: 'open',
    createdAt: '2026-09-01T10:00:00.000Z',
    withdrawnAt: null,
    seenAt: null,
  };
}

/** Γεμάτος φάκελος **προς άλλους** στόχους — η χωρητικότητα έχει εξαντληθεί. */
const FULL: readonly FirstContact[] = Array.from(
  { length: OPEN_CONTACT_CAPACITY },
  (_unused, index) => openContactToward({ kind: 'listing', listingId: `ownp_full_${index}` }, `fcon_${index}`),
);

// ===========================================================================
// ΤΟ ΚΡΙΤΗΡΙΟ — μία φορά ορισμένο, δύο φορές εκτελεσμένο
// ===========================================================================

/** Ο κόσμος μιας σκηνής: τι απαντούν οι δύο συνεργάτες. */
interface Scene {
  readonly name: string;
  readonly contacts: readonly FirstContact[] | null;
  readonly target: LocatedTarget | ReturnType<typeof refuseFirstContact> | typeof FIRST_CONTACT_UNAVAILABLE;
}

type Judge = (
  db: AdminFirestore,
  actor: ListingActor,
  target: FirstContactTarget,
  nowISO: string,
) => Promise<ContactAdmission>;

const SCENES: readonly Scene[] = [
  { name: 'βλάβη ανάγνωσης', contacts: null, target: LOCATED },
  {
    name: 'ήδη ανοιχτή προς ΑΥΤΟΝ τον στόχο',
    contacts: [openContactToward(TARGET, 'fcon_same')],
    target: LOCATED,
  },
  {
    // 🔴 Η ΔΙΑΚΡΙΝΟΥΣΑ ΣΚΗΝΗ: γεμάτος **και** ήδη ανοιχτή προς αυτόν τον στόχο.
    name: 'γεμάτος ΚΑΙ ήδη ανοιχτή',
    contacts: [...FULL.slice(1), openContactToward(TARGET, 'fcon_same')],
    target: LOCATED,
  },
  { name: 'γεμάτος, χωρίς ανοιχτή προς αυτόν', contacts: FULL, target: LOCATED },
  {
    name: 'χώρος, αλλά είναι δικό του',
    contacts: [openContactToward(OTHER, 'fcon_other')],
    target: refuseFirstContact('contact-own-target'),
  },
  { name: 'χώρος, και ο στόχος στέκει', contacts: [], target: LOCATED },
];

/**
 * **Η υπογραφή ενός κριτή**: τι απάντησε σε κάθε σκηνή, **και ποιον ρώτησε**.
 *
 * 🔑 Η λίστα κλήσεων είναι μέρος του κριτηρίου, όχι διακόσμηση: *«γέμισε»* χωρίς να
 * ρωτηθεί ο στόχος είναι **απόδειξη** ότι δεν πληρώθηκε η ανάγνωση — η δηλωμένη
 * αιτιολογία της σειράς (2) → (3).
 */
async function signatureOf(judge: Judge): Promise<readonly string[]> {
  const out: string[] = [];

  for (const scene of SCENES) {
    const asked: string[] = [];
    loadSeekerContacts.mockReset();
    resolveTarget.mockReset();
    loadSeekerContacts.mockImplementation(async () => {
      asked.push('contacts');
      return scene.contacts;
    });
    resolveTarget.mockImplementation(async () => {
      asked.push('target');
      return scene.target;
    });

    const verdict = await judge(DB, ACTOR, TARGET, NOW);
    const detail = verdict.kind === 'rejected' ? `${verdict.kind}:${verdict.reason}` : verdict.kind;
    out.push(`${scene.name} → ${detail} [${asked.join('+')}]`);
  }

  return out;
}

/**
 * ⛔ **ΤΟ ΑΝΤΙ-ΠΑΡΑΔΕΙΓΜΑ** — ο ίδιος κριτής με τη χωρητικότητα **πριν** την
 * ιδεμποτησία. Γραμμένο **εδώ μέσα**, ποτέ ως μετάλλαξη αρχείου του δέντρου.
 */
const capacityFirst: Judge = async (db, actor, target, nowISO) => {
  const existing = await projection.loadSeekerContacts(db, actor.uid);
  if (existing === null) return FIRST_CONTACT_UNAVAILABLE;

  if (existing.filter((c: FirstContact) => c.lifecycle === 'open').length >= OPEN_CONTACT_CAPACITY) {
    return refuseFirstContact('capacity-full');
  }

  const already = existing.find(
    (c: FirstContact) => c.lifecycle === 'open' && c.target.listingId === target.listingId,
  );
  if (already !== undefined) {
    return { kind: 'unchanged', contact: { id: already.id } } as unknown as ContactAdmission;
  }

  const located = await guards.resolveTarget(db, actor, target, nowISO);
  if ('kind' in located) return located;
  return { kind: 'admitted', located };
};

// ===========================================================================
// ΜΕΡΟΣ Α — ο αληθινός κριτής απαντά όπως το ADR υπόσχεται
// ===========================================================================

describe('ADR-843 §10.18 — «γίνεσαι δεκτός;» ρωτιέται ΜΕ ΣΕΙΡΑ', () => {
  it('η υπογραφή του κριτή είναι ακριβώς η δηλωμένη', async () => {
    await expect(signatureOf(admitFirstContact)).resolves.toEqual([
      // Βλάβη ⇒ «δεν μάθαμε», ΠΟΤΕ άρνηση (N.12) — και ο στόχος δεν πληρώνεται.
      'βλάβη ανάγνωσης → unavailable [contacts]',
      // Ιδεμποτησία = ΕΠΙΤΥΧΙΑ, και σταματά πριν τον στόχο.
      'ήδη ανοιχτή προς ΑΥΤΟΝ τον στόχο → unchanged [contacts]',
      // 🔴 Η ΔΙΑΚΡΙΝΟΥΣΑ: γεμάτος, αλλά την έχει ήδη ⇒ «την έχεις», όχι «γέμισε».
      'γεμάτος ΚΑΙ ήδη ανοιχτή → unchanged [contacts]',
      // Γεμάτος χωρίς ανοιχτή ⇒ «γέμισε», ΧΩΡΙΣ να πληρωθεί ανάγνωση στόχου.
      'γεμάτος, χωρίς ανοιχτή προς αυτόν → rejected:capacity-full [contacts]',
      'χώρος, αλλά είναι δικό του → rejected:contact-own-target [contacts+target]',
      'χώρος, και ο στόχος στέκει → admitted [contacts+target]',
    ]);
  });

  // =========================================================================
  // ΜΕΡΟΣ Β — ΤΟ ΑΝΤΙ-ΠΑΡΑΔΕΙΓΜΑ: το ίδιο κριτήριο ΠΕΦΤΕΙ σε ανάποδη σειρά
  // =========================================================================
  it('ο κριτής με ανάποδη σειρά ΔΕΝ περνά το ίδιο κριτήριο', async () => {
    const wrong = await signatureOf(capacityFirst);
    const right = await signatureOf(admitFirstContact);

    expect(wrong).not.toEqual(right);
    // Και ονομαστικά: η διακρίνουσα σκηνή είναι ΑΚΡΙΒΩΣ εκεί που διαφωνούν.
    expect(wrong[2]).toBe('γεμάτος ΚΑΙ ήδη ανοιχτή → rejected:capacity-full [contacts]');
    expect(right[2]).toBe('γεμάτος ΚΑΙ ήδη ανοιχτή → unchanged [contacts]');
  });
});
