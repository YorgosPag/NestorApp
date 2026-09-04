/**
 * @fileoverview 🔴 **ΑΠΑΝΤΑ ΤΟ «ΠΟΙΟΝ ΦΤΑΝΕΙ Η ΠΡΑΞΗ;» ΕΝΑΣ — ΚΑΙ ΤΟΝ ΑΚΟΥΝΕ ΟΛΟΙ;**
 * @related ADR-843 §10.17 *(η εξαγωγή)* · §10.16 *(οι δύο οικογένειες)* · ADR-813
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ ΠΟΥ ΓΕΝΝΗΣΕ ΤΟ ΑΡΧΕΙΟ — 2026-09-04, ΣΤΑΔΙΟ ΣΤ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §10.16 έδωσε κατοικία στο *«ποιες οικογένειες αγγελιών υπάρχουν;»*. **Ένα
 * επίπεδο πιο πάνω ζούσε το ίδιο ακριβώς σχήμα και δεν το είχε δει κανείς**: η
 * ερώτηση *«ποιον φτάνει αυτή η πράξη;»* απαντιόταν σε **δύο** σημεία μέσα στον
 * `resolveTarget` — μία γραμμή ενσωματωμένη για τον **επαγγελματία**, ο επιλυτής για
 * την **αγγελία** — και ήταν **απρόσιτη από έξω**, μπλεγμένη με εξουσιοδότηση και
 * ζωντάνια.
 *
 * ⇒ Όταν το backfill του `offerer` χρειάστηκε την **ίδια** απάντηση, δεν είχε τι να
 * καλέσει. Ο εύκολος δρόμος —να γράψει δικό του `switch (target.kind)`— θα έκανε την
 * απάντηση **τρίτη**, και η μέρα που οι τρεις θα διαφωνούσαν θα ήταν η μέρα που ένα
 * μήνυμα φτάνει σε **λάθος γραφείο**: σφάλμα που **κανένα** test δεν βλέπει, γιατί
 * και οι δύο απαντήσεις είναι «σωστές» χωριστά.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΙ ΚΡΙΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — ΤΕΣΣΕΡΑ, ΚΑΙ ΚΑΝΕΝΑ ΔΕΝ ΕΙΝΑΙ «ΥΠΑΡΧΕΙ Η ΣΥΝΑΡΤΗΣΗ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | ΜΕΡΟΣ | Η ερώτηση | Τι πέφτει αν σπάσει |
 * |---|---|---|
 * | **Α** | απαντά ο εντοπιστής για **ΚΑΘΕ** είδος στόχου; | backfill που ξεχνά είδος |
 * | **Β** | δίνει η **γέννηση** τον **ΙΔΙΟ** παραλήπτη με τη **θεραπεία**; | δύο αυθεντίες που αποκλίνουν |
 * | **Γ** | κρατιέται η **ΣΕΙΡΑ** «δικό σου» πριν «ζωντανό»; | χειρότερο μήνυμα + περιττή ανάγνωση |
 * | **Δ** | ρωτά το εισερχόμενο **πεδίο που ΥΠΑΡΧΕΙ** στον παραλήπτη; | σιωπηλά κενά εισερχόμενα |
 *
 * 🔴 **ΤΟ ΜΕΡΟΣ Δ ΕΙΝΑΙ ΤΟ ΣΗΜΑΝΤΙΚΟΤΕΡΟ, ΚΑΙ ΤΟ ΛΙΓΟΤΕΡΟ ΠΡΟΦΑΝΕΣ.** Η γραφή και η
 * ανάγνωση συμφωνούν σήμερα επειδή κάποιος πληκτρολόγησε **δύο φορές** το ίδιο
 * όνομα πεδίου: μία στον τύπο `ListingCustody`, μία στο ερώτημα `offerer.userId`.
 * Μια μετονομασία στον τύπο **δεν σπάει τίποτα** — απλώς κάθε εισερχόμενο γυρίζει
 * **κενό**, δηλαδή λέει σε κάθε άνθρωπο *«κανείς δεν σε πλησίασε»*. Εδώ η συμφωνία
 * **εκτελείται**: το μονοπάτι που ρωτά ο κώδικας αποσυντίθεται και ζητείται να είναι
 * **υπαρκτό κλειδί με ίδια τιμή** πάνω στο ίδιο το αντικείμενο θεματοφυλακής.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import type { ListingCustody } from '@/lib/owner-property/listing-custody';
import { resolveTarget } from '@/services/contact/first-contact-guards';
import { contactsAddressedTo } from '@/services/contact/first-contact-projection';
import {
  locateTarget,
  type TargetLocation,
} from '@/services/contact/first-contact-target-locator';
import { lookupAgencyProfile } from '@/services/mandate/agency-profile.service';
import { FIRST_CONTACT_TARGET_KINDS, type FirstContactTarget } from '@/types/first-contact';

jest.mock('@/services/mandate/agency-profile.service', () => ({
  lookupAgencyProfile: jest.fn(),
}));

const lookupMock = lookupAgencyProfile as jest.MockedFunction<typeof lookupAgencyProfile>;

const NOW = '2026-09-04T10:00:00.000Z';
const AGENCY_COMPANY = 'comp_alfa';
const OWNER_USER = 'user-idiotis';

// =============================================================================
// ΤΑ ΔΟΚΙΜΑΣΤΙΚΑ — ένα ανά είδος στόχου, από το ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ
// =============================================================================

/**
 * 🔑 **`Record<FirstContactTargetKind, …>` και όχι πίνακας**: ένα τρίτο είδος στο
 * `FIRST_CONTACT_TARGET_KINDS` κάνει αυτόν τον χάρτη **ελλιπή** και ο μεταγλωττιστής
 * σταματά — δηλαδή κανείς δεν μπορεί να προσθέσει είδος **χωρίς** να το δοκιμάσει.
 */
const TARGETS: Record<(typeof FIRST_CONTACT_TARGET_KINDS)[number], FirstContactTarget> = {
  listing: { kind: 'listing', listingId: 'ownp_dokimi' },
  professional: { kind: 'professional', agencyCompanyId: AGENCY_COMPANY },
};

const SEEDED_DOCUMENTS: Readonly<Record<string, Record<string, unknown>>> = {
  [`${COLLECTIONS.OWNER_PROPERTIES}/ownp_dokimi`]: validOwnerProperty({
    id: 'ownp_dokimi',
    authorUserId: OWNER_USER,
    authorCompanyId: null,
  }) as unknown as Record<string, unknown>,
};

// =============================================================================
// Η ΨΕΥΤΙΚΗ ΒΑΣΗ — καταγράφει **τι ρωτήθηκε**, γιατί αυτό είναι το ζητούμενο
// =============================================================================

interface RecordedQuery {
  readonly collection: string;
  readonly fieldPath: string;
  readonly value: unknown;
}

interface Recorder {
  readonly opened: string[];
  readonly queries: RecordedQuery[];
}

/**
 * ⚠️ **Δεν μιμείται τη Firestore — μιμείται ΔΥΟ ερωτήσεις**: *«δώσε μου αυτό το
 * έγγραφο»* και *«δώσε μου ό,τι έχει αυτή την τιμή σε αυτό το πεδίο»*. Ό,τι δεν
 * σπάρθηκε απαντά **δεν υπάρχει**, που είναι και η αληθινή συμπεριφορά.
 */
function recordingDb(recorder: Recorder, rows: readonly Record<string, unknown>[] = []): AdminFirestore {
  const db = {
    collection(name: string) {
      recorder.opened.push(name);
      return {
        doc(id: string) {
          return {
            async get() {
              const data = SEEDED_DOCUMENTS[`${name}/${id}`];
              return { exists: data !== undefined, data: () => data };
            },
          };
        },
        where(fieldPath: string, _op: string, value: unknown) {
          recorder.queries.push({ collection: name, fieldPath, value });
          return {
            async get() {
              return { docs: rows.map((row) => ({ id: String(row.id), data: () => row })) };
            },
          };
        },
      };
    },
  };

  // Ο μοναδικός μετασχηματισμός τύπου: το ψεύτικο υλοποιεί **ακριβώς** την επιφάνεια
  // που αγγίζει ο κώδικας υπό δοκιμή, και τίποτε από τα υπόλοιπα μέλη.
  return db as unknown as AdminFirestore;
}

function freshRecorder(): Recorder {
  return { opened: [], queries: [] };
}

/** Ο παραλήπτης που επέστρεψε ένας εντοπισμός, ή `null` αν δεν υπήρξε. */
function custodyOfLocation(location: TargetLocation): ListingCustody | null {
  return location === null || location === 'absent' ? null : location.custody;
}

// =============================================================================

describe('ADR-843 §10.17 — ο ΕΝΑΣ παραλήπτης της πράξης', () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue({ outcome: 'found', showcase: {} } as never);
  });

  // ===========================================================================
  describe('ΜΕΡΟΣ Α — ο εντοπιστής απαντά για ΚΑΘΕ είδος στόχου', () => {
    it('🔴 ΚΑΝΕΝΑ είδος στόχου δεν μένει χωρίς παραλήπτη', async () => {
      const missing: string[] = [];

      for (const kind of FIRST_CONTACT_TARGET_KINDS) {
        const custody = custodyOfLocation(
          await locateTarget(recordingDb(freshRecorder()), TARGETS[kind], NOW),
        );
        if (custody === null) missing.push(kind);
      }

      expect(missing).toEqual([]);
    });

    it('ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ λύνεται ΧΩΡΙΣ καμία ανάγνωση — ο στόχος ΕΙΝΑΙ ο παραλήπτης', async () => {
      const recorder = freshRecorder();

      const custody = custodyOfLocation(
        await locateTarget(recordingDb(recorder), TARGETS.professional, NOW),
      );

      expect(custody).toEqual({ kind: 'company', companyId: AGENCY_COMPANY });
      expect(recorder.opened).toEqual([]);
    });

    it('η ΑΓΓΕΛΙΑ λύνεται από τη ΔΙΚΗ ΤΗΣ συλλογή, με τον χώρο του συντάκτη', async () => {
      const recorder = freshRecorder();

      const custody = custodyOfLocation(
        await locateTarget(recordingDb(recorder), TARGETS.listing, NOW),
      );

      expect(custody).toEqual({ kind: 'personal', userId: OWNER_USER });
      expect(recorder.opened).toContain(COLLECTIONS.OWNER_PROPERTIES);
    });
  });

  // ===========================================================================
  describe('ΜΕΡΟΣ Β — η ΓΕΝΝΗΣΗ και η ΘΕΡΑΠΕΙΑ δίνουν τον ΙΔΙΟ παραλήπτη', () => {
    /**
     * 🔴 **Αυτό είναι όλο το νόημα της εξαγωγής, εκτελεσμένο.** Ο `resolveTarget`
     * είναι η διαδρομή της **γέννησης** *(γράφει το `offerer`)* και ο `locateTarget`
     * η διαδρομή της **θεραπείας** *(το backfill)*. Αν κάποιος ξαναγράψει το ένα, ή
     * προσθέσει είδος μόνο στο ένα, εδώ αποκλίνουν και το test κοκκινίζει.
     */
    it('🏆 ΚΑΘΕ είδος στόχου δίνει ταυτόσημο παραλήπτη στις ΔΥΟ διαδρομές', async () => {
      const disagreements: string[] = [];

      for (const kind of FIRST_CONTACT_TARGET_KINDS) {
        const target = TARGETS[kind];

        // Ο καλών είναι **ξένος** και στα δύο, ώστε καμία διαδρομή να μην αρνηθεί.
        const born = await resolveTarget(
          recordingDb(freshRecorder()),
          { uid: 'user-xenos', companyId: null },
          target,
          NOW,
        );
        const healed = custodyOfLocation(
          await locateTarget(recordingDb(freshRecorder()), target, NOW),
        );

        const bornCustody = 'custody' in born ? born.custody : null;
        if (JSON.stringify(bornCustody) !== JSON.stringify(healed)) {
          disagreements.push(`${kind}: γέννηση=${JSON.stringify(bornCustody)} θεραπεία=${JSON.stringify(healed)}`);
        }
      }

      expect(disagreements).toEqual([]);
    });
  });

  // ===========================================================================
  describe('ΜΕΡΟΣ Γ — η ΣΕΙΡΑ των ελέγχων είναι συμβόλαιο, όχι λεπτομέρεια', () => {
    /**
     * ⚠️ **Ο ιδιοκτήτης αδημοσίευτης βιτρίνας πρέπει να ακούσει «είναι δικό σου»**,
     * όχι «δεν υπάρχει». Η αντίστροφη σειρά θα πλήρωνε **επιπλέον μία ανάγνωση** για
     * να δώσει **χειρότερη** απάντηση — και η ανάγνωση είναι η απόδειξη της σειράς.
     */
    it('🔴 «δικό σου» κρίνεται ΠΡΙΝ ρωτηθεί η βιτρίνα — και η βιτρίνα ΔΕΝ διαβάζεται καν', async () => {
      lookupMock.mockResolvedValue({ outcome: 'not-published' } as never);

      const outcome = await resolveTarget(
        recordingDb(freshRecorder()),
        { uid: 'user-employee', companyId: AGENCY_COMPANY },
        TARGETS.professional,
        NOW,
      );

      expect(outcome).toEqual({ kind: 'rejected', reason: 'contact-own-target' });
      expect(lookupMock).not.toHaveBeenCalled();
    });

    it('ο ΞΕΝΟΣ σε αδημοσίευτη βιτρίνα ακούει «δεν υπάρχει» — η ΣΥΓΚΑΛΥΨΗ μένει', async () => {
      lookupMock.mockResolvedValue({ outcome: 'not-published' } as never);

      const outcome = await resolveTarget(
        recordingDb(freshRecorder()),
        { uid: 'user-xenos', companyId: null },
        TARGETS.professional,
        NOW,
      );

      expect(outcome).toEqual({ kind: 'rejected', reason: 'target-absent' });
      expect(lookupMock).toHaveBeenCalledTimes(1);
    });

    it('βλάβη στη βιτρίνα ΔΕΝ ισοπεδώνεται σε άρνηση (N.12: άγνωστο ≠ κενό)', async () => {
      lookupMock.mockResolvedValue({ outcome: 'unavailable' } as never);

      const outcome = await resolveTarget(
        recordingDb(freshRecorder()),
        { uid: 'user-xenos', companyId: null },
        TARGETS.professional,
        NOW,
      );

      expect(outcome).toEqual({ kind: 'unavailable' });
    });
  });

  // ===========================================================================
  describe('ΜΕΡΟΣ Δ — το εισερχόμενο ρωτά πεδίο που ο παραλήπτης ΠΡΑΓΜΑΤΙΚΑ έχει', () => {
    /**
     * 🔴 **Η γραφή και η ανάγνωση συμφωνούν σήμερα επειδή κάποιος πληκτρολόγησε δύο
     * φορές το ίδιο όνομα.** Μια μετονομασία στο `ListingCustody` δεν θα έσπαγε
     * τίποτα — απλώς κάθε εισερχόμενο θα γύριζε **κενό**, λέγοντας σε κάθε άνθρωπο
     * *«κανείς δεν σε πλησίασε»*. Εδώ η συμφωνία **εκτελείται**.
     */
    const CUSTODIES: readonly ListingCustody[] = [
      { kind: 'personal', userId: OWNER_USER },
      { kind: 'company', companyId: AGENCY_COMPANY },
    ];

    it.each(CUSTODIES)('🏆 το ερώτημα για %j ρωτά ΥΠΑΡΚΤΟ κλειδί με ΙΔΙΑ τιμή', async (custody) => {
      const recorder = freshRecorder();

      await contactsAddressedTo(recordingDb(recorder), custody);

      expect(recorder.queries).toHaveLength(1);
      const [query] = recorder.queries;
      expect(query.collection).toBe(COLLECTIONS.FIRST_CONTACTS);

      // Το μονοπάτι αποσυντίθεται: `offerer.<κλειδί>` — και το `<κλειδί>` οφείλει να
      // είναι **υπαρκτό** πάνω στο ίδιο το αντικείμενο, με **ίδια** τιμή.
      const [prefix, key] = query.fieldPath.split('.');
      expect(prefix).toBe('offerer');
      expect(Object.keys(custody)).toContain(key);
      expect(query.value).toBe((custody as unknown as Record<string, unknown>)[key]);
    });

    it('τα δύο σκέλη ρωτούν ΔΙΑΦΟΡΕΤΙΚΟ πεδίο — αλλιώς θα επικαλύπτονταν', async () => {
      const paths = new Set<string>();

      for (const custody of CUSTODIES) {
        const recorder = freshRecorder();
        await contactsAddressedTo(recordingDb(recorder), custody);
        paths.add(recorder.queries[0].fieldPath);
      }

      expect(paths.size).toBe(CUSTODIES.length);
    });
  });

  // ===========================================================================
  describe('ΜΕΡΟΣ Ε — το ΑΝΤΙ-ΠΑΡΑΔΕΙΓΜΑ: το backfill που θα έγραφε κανείς βιαστικά', () => {
    /**
     * Ο εντοπιστής όπως θα τον έγραφε ένα script που **δεν** κάλεσε τον κοινό: ξέρει
     * μόνο τις αγγελίες, γιατί αυτές είχε μπροστά του στα δοκιμαστικά δεδομένα.
     */
    async function naiveLocator(
      adminDb: AdminFirestore,
      target: FirstContactTarget,
      nowISO: string,
    ): Promise<TargetLocation> {
      if (target.kind !== 'listing') return 'absent';
      return locateTarget(adminDb, target, nowISO);
    }

    it('🔴 ΠΕΦΤΕΙ στο ΙΔΙΟ κριτήριο του ΜΕΡΟΥΣ Α — αλλιώς εκείνο δεν αποδεικνύει τίποτα', async () => {
      const missing: string[] = [];

      for (const kind of FIRST_CONTACT_TARGET_KINDS) {
        const custody = custodyOfLocation(
          await naiveLocator(recordingDb(freshRecorder()), TARGETS[kind], NOW),
        );
        if (custody === null) missing.push(kind);
      }

      expect(missing).toEqual(['professional']);
    });
  });
});
