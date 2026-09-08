/**
 * Firestore Rules Test Harness — CRM Owner Contract (ADR-841 §7 Α21.14.8)
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ
 * ═════════════════════════════════════════════════════════════════════════════
 * Οι `leads` / `opportunities` / `activities` είχαν η καθεμία **ΔΥΟ** `match`
 * μπλοκ στην ίδια διαδρομή (PR-1B και PR-1D, 2026-01-29). Στο Firestore το
 * `allow` είναι η **ΕΝΩΣΗ** των μπλοκ που ταιριάζουν ⇒ το χαλαρότερο νικά
 * σιωπηλά, και η αυστηροποίηση του PR-1D **δεν ίσχυσε ποτέ**.
 *
 * 🔴 **ΚΑΙ Η ΣΟΥΙΤΑ ΗΤΑΝ ΤΥΦΛΗ ΣΕ ΟΛΟΚΛΗΡΗ ΤΗ ΔΙΑΦΩΝΙΑ.** Μετρημένο 2026-09-08:
 * σβήνοντας **ΜΟΝΟ** το ένα μπλοκ, και οι **60** δοκιμές των τριών συλλογών
 * έμεναν **ΠΡΑΣΙΝΕΣ**. Σβήνοντας **ΜΟΝΟ** το άλλο — πάλι **60/60 πράσινες**.
 * Δηλαδή η `crmDirectMatrix()` δεν περιέγραφε ποτέ τη διαφορά: το seed έγγραφο
 * φέρει `createdBy = same_tenant_user.uid`, οπότε **κάθε** κελί περνά από το
 * σκέλος του δημιουργού και **κανένα** δεν ακουμπά τον ανατεθειμένο.
 *
 * ⇒ Η πιο επικίνδυνη εκδοχή του «κάτι που μοιάζει επικυρωμένο και δεν είναι»:
 *   μια πύλη που **τρέχει**, μια σουίτα που είναι **πράσινη**, και ένα σκέλος
 *   ασφαλείας που **κανείς δεν ρώτησε ποτέ**.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΙ ΚΑΡΦΩΝΕΙ — ό,τι ο πίνακας (πρόσωπο × πράξη) **δεν μπορεί** να εκφράσει
 * ═════════════════════════════════════════════════════════════════════════════
 * Ο πίνακας μεταβάλλει τον **ΚΑΛΟΥΝΤΑ**. Οι παρακάτω δοκιμές μεταβάλλουν το
 * **ΕΓΓΡΑΦΟ** — ποιος το δημιούργησε, σε ποιον ανατέθηκε, αν έχει καθόλου
 * `companyId`, αν υπάρχει καν. Κάθε μία καρφώνει όρο που αλλιώς δεν έχει μάρτυρα.
 *
 * ⚠️ **SSoT — ΓΙΑΤΙ ΕΙΝΑΙ ΚΟΙΝΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΤΡΙΑ ΑΝΤΙΓΡΑΦΑ**: οι τρεις
 * συλλογές μοιράζονται το ίδιο σχήμα κανόνα και διαφέρουν σε **έναν** όρο (τον
 * ανατεθειμένο). Γραμμένο τρεις φορές θα ήταν ακριβώς το sibling-clone που
 * απαγορεύει ο N.18 — και, χειρότερα, θα επέτρεπε στις τρεις εκδοχές να
 * αποκλίνουν σιωπηλά. Εδώ η διαφορά είναι **μία σημαία**, ορατή στο σημείο της.
 *
 * @module tests/firestore-rules/_harness/crm-owner-contract
 * @since 2026-09-08 (ADR-841 §7 Α21.14.8)
 */

import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

import { initEmulator, teardownEmulator, resetData } from './emulator';
import { getContext, withSeedContext } from './auth-contexts';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
  CROSS_TENANT_COMPANY_ID,
} from '../_registry/personas';

/** Ο ανατεθειμένος πωλητής — το πρόσωπο που ο πίνακας δεν ρωτά ποτέ. */
const ASSIGNEE_UID = PERSONA_CLAIMS.same_tenant_user.uid;

/** Κάποιος τρίτος της ίδιας εταιρείας: δημιούργησε το έγγραφο, δεν το δουλεύει. */
const AUTHOR_UID = 'persona-crm-author';

export interface CrmOwnerContract {
  /** Φυσικό όνομα συλλογής — ίδιο με το `match /<name>/{id}` στο firestore.rules. */
  readonly collection: string;
  /**
   * Επιτρέπει ο κανόνας στον **ανατεθειμένο** (που ΔΕΝ είναι ο δημιουργός) να
   * ενημερώσει και να διαβάσει;
   *
   * 🔴 **Σήμερα: ΜΟΝΟ το `leads`.** Δεν είναι σχεδιαστική επιλογή που πάρθηκε —
   * είναι η κατάσταση που κληρονομήθηκε από το PR-1B και **μετρήθηκε** κατά την
   * ένωση. Κατά Salesforce / HubSpot / Zoho ο «owner» **είναι** ο ανατεθειμένος,
   * και το `Opportunity.assignedTo` είναι **υποχρεωτικό** πεδίο του μοντέλου
   * (`src/types/crm.ts:37`) ⇒ ο ανατεθειμένος πωλητής **δεν μπορεί** σήμερα να
   * ενημερώσει τη δική του ευκαιρία.
   *
   * ⚠️ Η επέκτασή του στις άλλες δύο είναι **διεύρυνση πρόσβασης παραγωγής**,
   * δηλαδή **ξεχωριστή απόφαση** — όχι παρενέργεια refactor. Μέχρι να παρθεί, η
   * ασυμμετρία καρφώνεται **και προς τις δύο κατευθύνσεις**: αν φύγει από το
   * `leads` κοκκινίζει, αν μπει κρυφά στις άλλες κοκκινίζει.
   */
  readonly assigneeIsOwner: boolean;
}

/** Πεδία που κάνουν ένα έγγραφο αποδεκτό από κάθε μία από τις τρεις συλλογές. */
function docShape(extra: Record<string, unknown>): Record<string, unknown> {
  return { title: 'crm-owner-contract', status: 'new', ...extra };
}

/**
 * Οι δοκιμές που ο πίνακας δεν μπορεί να εκφράσει, για μία CRM συλλογή.
 *
 * Καλείται μία φορά ανά σουίτα, **έξω** από τον βρόχο της `COVERAGE.matrix`.
 */
export function describeCrmOwnerLeg(contract: CrmOwnerContract): void {
  const { collection, assigneeIsOwner } = contract;

  describe(`${collection}.rules — το σκέλος του ΚΑΤΟΧΟΥ (ADR-841 §7 Α21.14.8)`, () => {
    let env: RulesTestEnvironment;

    beforeAll(async () => {
      env = await initEmulator();
    });
    afterAll(async () => {
      await teardownEmulator(env);
    });
    afterEach(async () => {
      await resetData(env);
    });

    /** Σύγχρονο έγγραφο: έχει `companyId`, το έγραψε ο ένας, το δουλεύει ο άλλος. */
    async function seedAssignedToMe(docId: string): Promise<void> {
      await withSeedContext(env, async (ctx) => {
        await ctx
          .firestore()
          .collection(collection)
          .doc(docId)
          .set(
            docShape({
              companyId: SAME_TENANT_COMPANY_ID,
              createdBy: AUTHOR_UID,
              assignedTo: ASSIGNEE_UID,
            }),
          );
      });
    }

    it('✅ ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: ο δημιουργός ενημερώνει το δικό του έγγραφο', async () => {
      // Χωρίς αυτόν, ένας κανόνας «άρνηση σε όλα» θα έκανε ΚΑΘΕ αρνητική δοκιμή
      // παρακάτω πράσινη για λάθος λόγο. Είναι η γραμμή που αποδεικνύει ότι οι
      // υπόλοιπες μετρούν κάτι.
      await withSeedContext(env, async (ctx) => {
        await ctx
          .firestore()
          .collection(collection)
          .doc('crm-mine')
          .set(
            docShape({
              companyId: SAME_TENANT_COMPANY_ID,
              createdBy: ASSIGNEE_UID,
              assignedTo: AUTHOR_UID,
            }),
          );
      });

      await assertSucceeds(
        getContext(env, 'same_tenant_user')
          .firestore()
          .collection(collection)
          .doc('crm-mine')
          .update({ status: 'working' }),
      );
    });

    it('🚫 ούτε δημιουργός ούτε ανατεθειμένος ⇒ ΔΕΝ ενημερώνει (το σκέλος είναι ΠΥΛΗ)', async () => {
      // Ο συνάδελφος ΔΙΑΒΑΖΕΙ το έγγραφο (tenant-wide) αλλά δεν το γράφει.
      // Χωρίς αυτή τη γραμμή, το «ο ανατεθειμένος μπορεί» θα ήταν συμβατό με το
      // «όλοι μπορούν» — δηλαδή δεν θα απεδείκνυε τίποτα.
      await withSeedContext(env, async (ctx) => {
        await ctx
          .firestore()
          .collection(collection)
          .doc('crm-theirs')
          .set(
            docShape({
              companyId: SAME_TENANT_COMPANY_ID,
              createdBy: AUTHOR_UID,
              assignedTo: AUTHOR_UID,
            }),
          );
      });

      const db = getContext(env, 'same_tenant_user').firestore();
      await assertSucceeds(db.collection(collection).doc('crm-theirs').get());
      await assertFails(db.collection(collection).doc('crm-theirs').update({ status: 'working' }));
    });

    it(
      assigneeIsOwner
        ? '🏆 Ο ΑΝΑΤΕΘΕΙΜΕΝΟΣ ενημερώνει το έγγραφο που του δόθηκε (Salesforce/HubSpot/Zoho)'
        : '🔓 ΑΝΟΙΧΤΟ: ο ανατεθειμένος ΔΕΝ ενημερώνει — μετρημένη ασυμμετρία, όχι απόφαση',
      async () => {
        // 🔴 Η ΜΕΤΑΛΛΑΞΗ: βγάλε το `crmIsAssignee(resource.data)` από το `allow
        //    update` του `leads` ⇒ αυτή η γραμμή κοκκινίζει. Πρόσθεσέ το στα
        //    `opportunities`/`activities` ⇒ κοκκινίζει η δική τους.
        await seedAssignedToMe('crm-assigned');

        const update = getContext(env, 'same_tenant_user')
          .firestore()
          .collection(collection)
          .doc('crm-assigned')
          .update({ status: 'working' });

        await (assigneeIsOwner ? assertSucceeds(update) : assertFails(update));
      },
    );

    it(
      assigneeIsOwner
        ? '🏆 LEGACY (χωρίς companyId): ο ανατεθειμένος ΔΙΑΒΑΖΕΙ'
        : '🔓 LEGACY (χωρίς companyId): ο ανατεθειμένος ΔΕΝ διαβάζει',
      async () => {
        // Το legacy fallback είναι ο ΜΟΝΟΣ δρόμος χωρίς έλεγχο tenant. Καρφώνεται
        // ρητά ώστε να μη διευρυνθεί κατά λάθος — και η επόμενη δοκιμή δείχνει
        // ότι δεν είναι τρύπα διαρροής.
        await withSeedContext(env, async (ctx) => {
          await ctx
            .firestore()
            .collection(collection)
            .doc('crm-legacy')
            .set(docShape({ createdBy: AUTHOR_UID, assignedTo: ASSIGNEE_UID }));
        });

        const read = getContext(env, 'same_tenant_user')
          .firestore()
          .collection(collection)
          .doc('crm-legacy')
          .get();

        await (assigneeIsOwner ? assertSucceeds(read) : assertFails(read));
      },
    );

    it('🔒 ΚΑΜΙΑ ΔΙΑΡΡΟΗ: ανάθεση σε έγγραφο ΞΕΝΟΥ tenant δεν δίνει πρόσβαση', async () => {
      // Η ανάθεση είναι δικαίωμα ΜΕΣΑ στον χώρο σου. Ένα `assignedTo` που δείχνει
      // σ' εσένα από άλλη εταιρεία δεν σε κάνει κάτοχο — αλλιώς ο έλεγχος tenant
      // θα παρακάμπτονταν με ένα πεδίο.
      await withSeedContext(env, async (ctx) => {
        await ctx
          .firestore()
          .collection(collection)
          .doc('crm-cross')
          .set(
            docShape({
              companyId: CROSS_TENANT_COMPANY_ID,
              createdBy: AUTHOR_UID,
              assignedTo: ASSIGNEE_UID,
            }),
          );
      });

      const db = getContext(env, 'same_tenant_user').firestore();
      await assertFails(db.collection(collection).doc('crm-cross').get());
      await assertFails(db.collection(collection).doc('crm-cross').update({ status: 'working' }));
    });

    it('🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΕΚΛΕΙΣΕ: ο ΔΗΜΙΟΥΡΓΟΣ δεν γράφει έγγραφο ΞΕΝΟΥ tenant', async () => {
      // 🔴 ΜΕΤΡΗΜΕΝΟ ΠΑΝΩ ΣΤΟ ΤΟΤΕ `main` (2026-09-08) — ΚΑΙ ΣΤΙΣ ΤΡΕΙΣ ΣΥΛΛΟΓΕΣ:
      //      read: DENY · update: **ALLOW** · delete: **ALLOW**
      //    Ο έλεγχος tenant υπήρχε στο `read` και ΕΛΕΙΠΕ από `update`/`delete`:
      //    το σκέλος `createdBy == uid` δεν ρωτούσε ΠΟΤΕ σε ποιον ανήκει το
      //    έγγραφο. Δηλαδή **εγγραφή σε έγγραφο που δεν μπορείς να διαβάσεις**,
      //    πάνω από το σύνορο του tenant.
      //
      //    Ρεαλιστικό σενάριο: υπάλληλος αλλάζει εταιρεία — το `uid` μένει, η
      //    αξίωση `companyId` αλλάζει, και ό,τι δημιούργησε στην παλιά εταιρεία
      //    παραμένει γι' αυτόν εγγράψιμο και διαγράψιμο, αόρατα.
      //
      // 🔴 Η ΜΕΤΑΛΛΑΞΗ: βγάλε το `crmNotForeignTenant(doc)` από το
      //    `crmWriterIsPrivileged()` ⇒ κοκκινίζουν και οι τρεις σουίτες.
      await withSeedContext(env, async (ctx) => {
        await ctx
          .firestore()
          .collection(collection)
          .doc('crm-foreign-mine')
          .set(
            docShape({
              companyId: CROSS_TENANT_COMPANY_ID,
              createdBy: ASSIGNEE_UID,
              assignedTo: ASSIGNEE_UID,
            }),
          );
      });

      const db = getContext(env, 'same_tenant_user').firestore();
      const ref = db.collection(collection).doc('crm-foreign-mine');
      // Και οι τρεις μαζί: η ανάγνωση ΗΤΑΝ ήδη κλειστή — αυτό ακριβώς αποδεικνύει
      // ότι το γράψιμο ήταν απροσπέλαστο από νόμιμη οθόνη, άρα το κλείσιμό του
      // δεν μπορεί να κλειδώσει κανέναν πραγματικό χρήστη.
      await assertFails(ref.get());
      await assertFails(ref.update({ status: 'working' }));
      await assertFails(ref.delete());
    });

    it('🔒 το `companyId` δεν μετακινείται με ενημέρωση πελάτη', async () => {
      // `crmCompanyIdUnchanged()` — όρος χωρίς μάρτυρα μέχρι σήμερα.
      await withSeedContext(env, async (ctx) => {
        await ctx
          .firestore()
          .collection(collection)
          .doc('crm-immutable')
          .set(
            docShape({
              companyId: SAME_TENANT_COMPANY_ID,
              createdBy: ASSIGNEE_UID,
            }),
          );
      });

      await assertFails(
        getContext(env, 'same_tenant_user')
          .firestore()
          .collection(collection)
          .doc('crm-immutable')
          .update({ companyId: CROSS_TENANT_COMPANY_ID }),
      );
    });

    it('🔴 Ο ΦΡΟΥΡΟΣ ΠΟΥ ΕΠΙΤΕΛΟΥΣ ΔΑΓΚΩΝΕΙ: super admin δεν διαγράφει ΑΝΥΠΑΡΚΤΟ έγγραφο', async () => {
      // 📊 Η **ΜΟΝΗ** αλλαγή συμπεριφοράς της ένωσης — 3 στις 756 μετρήσεις, και
      //    οι τρεις αυτή. Πριν: το `resource.data.createdBy` πάνω σε ανύπαρκτο
      //    έγγραφο έριχνε *σφάλμα αποτίμησης*, το CEL το ΑΠΟΡΡΟΦΟΥΣΕ επειδή το
      //    `isSuperAdminOnly()` ήταν αληθές, και η διαγραφή περνούσε. Το
      //    `resource != null` του PR-1D — γραμμένο 2026-01-29, ανενεργό ως
      //    σήμερα επειδή το δεύτερο μπλοκ το ένωνε — πλέον ισχύει.
      //
      // 🔴 Η ΜΕΤΑΛΛΑΞΗ: βγάλε το `resource != null` από το `allow delete` ⇒
      //    η γραμμή κοκκινίζει. Είναι ΑΓΚΥΡΑ ΠΟΥ ΜΠΟΡΕΙ ΝΑ ΚΟΚΚΙΝΙΣΕΙ — και
      //    γι' αυτό υπάρχει μόνο για ΑΥΤΟΝ τον φρουρό: οι υπόλοιποι
      //    (`resource == null` στο create, οι `hasAny([...])`) μετρήθηκαν
      //    **0/756**, δηλαδή δεν είναι παρατηρήσιμοι από πελάτη. Δοκιμή γι'
      //    αυτούς θα ήταν πράσινη ό,τι κι αν γίνει — δηλαδή σχόλιο, όχι άγκυρα.
      await assertFails(
        getContext(env, 'super_admin')
          .firestore()
          .collection(collection)
          .doc('crm-does-not-exist')
          .delete(),
      );
    });
  });
}
