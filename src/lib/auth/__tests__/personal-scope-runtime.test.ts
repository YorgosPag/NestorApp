/**
 * @jest-environment node
 *
 * =============================================================================
 * ΤΙ ΦΤΑΝΕΙ ΣΤΟΝ ΚΑΤΑΝΤΗ (ADR-817 §4.2)
 * =============================================================================
 *
 * Η άγκυρα των τύπων (`api-identity-personal-scope`) αποδεικνύει ότι το σύνορο
 * **παράγει** τρεις καταστάσεις. Αυτή αποδεικνύει το **επόμενο βήμα**: ότι ο
 * προσωπικός χώρος φτάνει στον κατάντη ως **απουσία μισθωτή** — και ότι εκεί
 * συμπεριφέρεται fail-closed.
 *
 * 🔴 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΑΓΚΥΡΑ**: ο μεταγλωττιστής φυλά τον **τύπο**, όχι τη
 * **μετάφραση**. Ένα `?? ''` στη θέση του `actorWorkspace` περνά κάθε έλεγχο τύπων
 * και γίνεται **«κενός μισθωτής»** σε ερώτημα Firestore — ακριβώς ό,τι κυνηγά το
 * **CHECK 3.35**, και ό,τι το `hasTenant` του `listing-custody` απορρίπτει ρητά.
 */

import { custodyOf, mayAdminister } from '@/lib/owner-property/listing-custody';
import { actorWorkspace, type ApiActor } from '../personal-scope-middleware';

const CITIZEN: ApiActor = {
  scope: 'personal',
  ctx: {
    uid: 'uid-ext-owner',
    email: 'ext.owner@solo.local',
    globalRole: 'external_user',
    mfaEnrolled: false,
    isAuthenticated: true,
  },
};

const EMPLOYEE: ApiActor = {
  scope: 'organization',
  ctx: {
    uid: 'uid-int-architect',
    email: 'int.architect@alpha.local',
    companyId: 'comp_alpha_emulator',
    globalRole: 'company_admin',
    mfaEnrolled: false,
    isAuthenticated: true,
  },
};

describe('ADR-817 §4.2 — actorWorkspace: Η ΜΙΑ μετάφραση προς `string | null`', () => {
  it('Π1 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο υπάλληλος δίνει τον χώρο του αυτούσιο', () => {
    expect(actorWorkspace(EMPLOYEE)).toBe('comp_alpha_emulator');
  });

  it('Κ1 — ο πολίτης δίνει `null`, ΠΟΤΕ κενή συμβολοσειρά', () => {
    // ⛔ Ένα `''` εδώ θα ήταν «κενός μισθωτής»: το `hasTenant` το απορρίπτει, αλλά μια
    //    κλήση Firestore με κενό φίλτρο είναι το ερώτημα «δώσε ό,τι δεν ανήκει σε
    //    κανέναν» (CHECK 3.35). Η διάκριση `null` / `''` ΕΙΝΑΙ η διάκριση
    //    «δεν έχει εταιρεία» / «έχει εταιρεία με κενό όνομα».
    expect(actorWorkspace(CITIZEN)).toBeNull();
    expect(actorWorkspace(CITIZEN)).not.toBe('');
  });
});

describe('ADR-817 §2.4 — ο ιδιωτικός χώρος ΔΕΝ διευρύνεται, προς καμία κατεύθυνση', () => {
  const OWN_LISTING = { authorUserId: 'uid-ext-owner', authorCompanyId: null };
  const AGENCY_LISTING = { authorUserId: 'someone-else', authorCompanyId: 'comp_alpha_emulator' };

  const actorOf = (a: ApiActor) => ({ uid: a.ctx.uid, companyId: actorWorkspace(a) });

  it('Κ2 — ο πολίτης διαχειρίζεται τη ΔΙΚΗ ΤΟΥ αγγελία', () => {
    expect(mayAdminister(custodyOf(OWN_LISTING), actorOf(CITIZEN))).toBe(true);
  });

  it('Κ3 — ο πολίτης ΔΕΝ αγγίζει εταιρική αγγελία', () => {
    expect(mayAdminister(custodyOf(AGENCY_LISTING), actorOf(CITIZEN))).toBe(false);
  });

  it('Κ4 — ούτε ο ΥΠΑΛΛΗΛΟΣ αγγίζει το προσωπικό ακίνητο ξένου ανθρώπου', () => {
    // 🔑 Η άλλη κατεύθυνση, και είναι η σημαντικότερη: αλλιώς το γραφείο ενός
    //    υπαλλήλου θα αποκτούσε δικαίωμα πάνω στο **σπίτι του**.
    expect(mayAdminister(custodyOf(OWN_LISTING), actorOf(EMPLOYEE))).toBe(false);
  });

  it('Π2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο υπάλληλος διαχειρίζεται την αγγελία ΤΟΥ ΓΡΑΦΕΙΟΥ του', () => {
    expect(mayAdminister(custodyOf(AGENCY_LISTING), actorOf(EMPLOYEE))).toBe(true);
  });
});

describe('ADR-817 §2.4 — lookupOwnedPlace: ο ιδιώτης ΔΕΝ ρωτά εταιρική συλλογή', () => {
  /** Ελάχιστο διπλό Firestore που **καταγράφει ποιες συλλογές ρωτήθηκαν**. */
  function spyDb(touched: string[]) {
    return {
      collection(name: string) {
        touched.push(name);
        return {
          doc: () => ({ get: async () => ({ data: () => undefined }) }),
          where() { return this; },
          limit() { return this; },
          get: async () => ({ empty: true, docs: [] }),
        };
      },
    };
  }

  it('Κ5 — χωρίς εταιρεία, η ΔΕΥΤΕΡΗ ανάγνωση δεν γίνεται καθόλου', async () => {
    const { lookupOwnedPlace } = await import('@/services/demand/place-interest.service');
    const touched: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- διπλό δοκιμής, όχι κώδικας προϊόντος
    const result = await lookupOwnedPlace(spyDb(touched) as any, 'ownp_x', 'uid-ext-owner', null);

    expect(result.kind).toBe('absent');
    // ⚠️ Ο πολίτης **δεν έχει** εταιρικά ακίνητα: `absent` είναι η ΣΩΣΤΗ απάντηση.
    //    Μια δεύτερη ανάγνωση με κενό μισθωτή θα ήταν ερώτημα χωρίς φίλτρο.
    expect(touched).toEqual(['owner_properties']);
  });

  it('Π3 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ΜΕ εταιρεία, η δεύτερη ανάγνωση ΓΙΝΕΤΑΙ', async () => {
    const { lookupOwnedPlace } = await import('@/services/demand/place-interest.service');
    const touched: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- διπλό δοκιμής, όχι κώδικας προϊόντος
    await lookupOwnedPlace(spyDb(touched) as any, 'ownp_x', 'uid-int', 'comp_alpha_emulator');

    // 🔴 Χωρίς αυτό, το Κ5 θα ήταν πράσινο ακόμη κι αν η εταιρική ανάγνωση είχε
    //    διαγραφεί ΕΝΤΕΛΩΣ — δηλαδή θα «αποδείκνυε» παράλειψη που ισχύει ΠΑΝΤΑ.
    expect(touched.length).toBeGreaterThan(1);
  });
});
