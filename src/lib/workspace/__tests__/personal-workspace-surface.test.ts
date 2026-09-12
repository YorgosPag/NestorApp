/**
 * @fileoverview **ΑΓΚΥΡΕΣ: τι προσφέρει ο ιδιωτικός χώρος** (ADR-787 §5.3 ζ όριο 1 · Ε-3).
 * @related lib/workspace/personal-workspace-surface · components/workspace/PersonalWorkspaceSurface
 *
 * 🔴 Η κατεύθυνση της ζημιάς είναι όλο το σκεπτικό: σελίδα γραφείου που **ξεχάστηκε** εκτός
 * λίστας δείχνει τη σχεδιασμένη κατάσταση *(ορατό)*· σελίδα που θα ξεχνιόταν μέσα σε λίστα
 * **απαγορεύσεων** θα ζητούσε δεδομένα εταιρείας μέσα στον ιδιωτικό χώρο *(σιωπηλό)*.
 */

// 🔑 SSoT ανάγνωσης πηγαίου κώδικα από άγκυρα (ADR-660 §5.13) — **ποτέ** δικό μου
//    `readFileSync` + δικό μου αφαιρετή σχολίων: το CHECK 3.50 `Κ7β` λέει ότι άγκυρα που
//    κρίνει **σχόλια** αντί για κώδικα κοκκινίζει σε κάθε τεκμηρίωση.
import { readRepoFile, stripComments } from '@/test-utils/read-source';

import {
  PERSONAL_WORKSPACE_SURFACE,
  isOfferedInPersonalWorkspace,
  personalWorkspaceLanding,
} from '../personal-workspace-surface';
import { PRIVATE_SPACE_HOME } from '@/lib/routes/landing';

describe('Κ1 — Η ΠΡΟΕΠΙΛΟΓΗ ΕΙΝΑΙ «ΔΕΝ ΠΡΟΣΦΕΡΕΤΑΙ» (fail-closed)', () => {
  it.each([
    '/projects',
    '/accounting',
    '/procurement',
    '/properties',
    '/crm',
    '/dashboard',
    '/settings/company',
    '/properties/prop_ef2eaebd',
  ])('%s δεν προσφέρεται μέσα στον ιδιωτικό χώρο', (path) => {
    expect(isOfferedInPersonalWorkspace(path)).toBe(false);
  });

  it('η ρίζα του χώρου (`/o/me` σκέτο) δεν προσφέρεται — δεν έχει σελίδα ούτε σήμερα', () => {
    expect(isOfferedInPersonalWorkspace('/')).toBe(false);
  });
});

describe('Κ2 — ΤΟ ΕΡΩΤΗΜΑ ΚΑΙ ΤΟ ΘΡΑΥΣΜΑ ΔΕΝ ΕΙΝΑΙ ΤΜΗΜΑΤΑ ΔΙΑΔΡΟΜΗΣ', () => {
  /**
   * ⚠️ Ο κριτής ρωτά τον **ΕΝΑΝ** αναλυτή τμήματος (`firstPathSegment`) του
   * `workspace-scope.ts`. Δεύτερη γραφή του θα απέκλινε **ακριβώς εδώ**: ένα
   * `/projects?x=1` θα έδινε τμήμα `projects?x=1`, που δεν ταιριάζει με **καμία** εγγραφή —
   * δηλαδή θα «δούλευε» σήμερα (κενό σύνολο) και θα **έσπαγε σιωπηλά** την ημέρα που
   * μπαίνει η πρώτη εγγραφή.
   */
  it('το ερώτημα δεν αλλάζει την απάντηση', () => {
    expect(isOfferedInPersonalWorkspace('/projects?filter=all')).toBe(false);
    expect(isOfferedInPersonalWorkspace('/projects#top')).toBe(false);
  });
});

describe('Λ — Η ΠΡΟΣΓΕΙΩΣΗ: το `/o/me/<τομέας>` δεν ανοίγει, στέλνει στον χώρο του ανθρώπου', () => {
  it.each([
    '/o/me',
    '/o/me/projects',
    '/o/me/accounting/invoices',
    '/o/me/properties/prop_ef2eaebd',
  ])('%s ⇒ προσγείωση στον ιδιωτικό χώρο', (pathname) => {
    expect(personalWorkspaceLanding(pathname)).toBe(PRIVATE_SPACE_HOME);
  });

  /**
   * 🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — ΜΙΣΗ Η ΑΓΚΥΡΑ: χωρίς αυτό, το «ο ιδιωτικός χώρος ανακατευθύνει»
   * θα μπορούσε να σημαίνει «**όλα** ανακατευθύνουν», δηλαδή σπασμένη εφαρμογή με πράσινο
   * test. Ο κανόνας τρέχει σε **κάθε** αίτημα του middleware.
   */
  it.each([
    '/o/pagonis/projects',
    '/o/pagonis',
    '/offers',
    '/demands/dmnd_1',
    '/api/projects/list',
    '/login',
    '/',
    '/o/member/projects',
    '/o/mexico',
  ])('Λ-Π %s μένει ΑΝΕΓΓΙΧΤΟ', (pathname) => {
    expect(personalWorkspaceLanding(pathname)).toBeNull();
  });

  it('Λ1 🔴 το ψευδώνυμο κρίνεται ΧΩΡΙΣ πεζά/κεφαλαία — ίδιο με τον κριτή της διαδρομής', () => {
    // ⚠️ Ο `resolveWorkspaceFromPath` κάνει `segment.toLowerCase() === 'me'`. Αν εδώ η
    //    σύγκριση ήταν αυστηρή, το `/o/ME/projects` θα **άνοιγε** ό,τι κλείνει αυτός ο
    //    κανόνας — δύο κριτές για το ίδιο ψευδώνυμο, με διαφορετική απάντηση.
    expect(personalWorkspaceLanding('/o/ME/projects')).toBe(PRIVATE_SPACE_HOME);
  });

  it('Λ2 — η προσγείωση είναι ΥΠΑΡΚΤΗ σελίδα, εκτός προθέματος χώρου (ποτέ νέο 404)', () => {
    // 🔑 ADR-819 §8: «διεύθυνση άψογα χτισμένη προς το πουθενά» είναι το σχήμα που
    //    πληρώθηκε τρεις φορές. Το `PRIVATE_SPACE_HOME` είναι η **ίδια** αυθεντία που
    //    χρησιμοποιεί ο επιλογέας χώρων και η προσγείωση μετά τη σύνδεση.
    expect(PRIVATE_SPACE_HOME.startsWith('/o/')).toBe(false);
    expect(personalWorkspaceLanding(PRIVATE_SPACE_HOME)).toBeNull();
  });
});

describe('Σ — Ο ΚΑΝΟΝΑΣ ΕΙΝΑΙ ΣΥΝΔΕΔΕΜΕΝΟΣ: το σύνορο της διεύθυνσης τον ΡΩΤΑ', () => {
  /**
   * ⚠️ **Γιατί άγκυρα σε πηγαίο κώδικα**: το `src/middleware.ts` τρέχει στο **Edge** και δεν
   * έχει σουίτα στο repo. Χωρίς αυτή τη γραμμή, μια διαγραφή των δύο γραμμών της σύνδεσης
   * θα άφηνε **όλες** τις άγκυρες πράσινες και τον κανόνα **νεκρό** — ακριβώς το σχήμα
   * «μηχανισμός που δεν εκτελείται» (ADR-749 §5).
   *
   * ⚠️ Και ρωτά **ονόματα**, όχι αριθμούς γραμμής ή κειμένου: το μάθημα των Κ10/Κ10β του
   * `workspace-segment.test.ts`, που έμειναν καρφωμένες σε θέση κώδικα που **μετακόμισε**.
   */
  it('Σ1 — το `src/middleware.ts` καλεί την αυθεντία της προσγείωσης', () => {
    // ⚠️ **Χωρίς σχόλια**: η πρώτη γραφή έκρινε το ωμό αρχείο και κοκκίνισε πάνω στη
    //    **δική μου τεκμηρίωση** (το σχόλιο αναφέρει `/o/me`) — το σχήμα `Κ7β` του CHECK 3.50.
    const middleware = stripComments(readRepoFile('src/middleware.ts'));

    // 🔴 **Η ΚΛΗΣΗ, ΟΧΙ ΤΟ ΟΝΟΜΑ**: η πρώτη γραφή ζητούσε `toContain('personalWorkspaceLanding')`
    //    και η μετάλλαξη **Μ11 ΕΠΕΖΗΣΕ** — η *εισαγωγή* του ονόματος αρκούσε για να μείνει
    //    πράσινη, με τον κανόνα **νεκρό**. Άγκυρα που πιάνει ονόματα δεν πιάνει συμπεριφορά.
    expect(middleware).toMatch(/personalWorkspaceLanding\(\s*pathname\s*\)/);
    // ⛔ Και **δεν** ξαναγράφει μόνο του το πρόθεμα: δεύτερος κριτής της διεύθυνσης θα
    //    αποκλίνει (CHECK 3.58 — το γιατί ζει στην κεφαλίδα του module).
    expect(middleware).not.toMatch(/['"`]\/o\/me/);
  });
});

describe('Κ3 — ΤΟ ΣΥΝΟΛΟ ΕΙΝΑΙ ΚΕΝΟ ΣΗΜΕΡΑ, ΚΑΙ ΚΑΘΕ ΕΓΓΡΑΦΗ ΕΧΕΙ ΛΟΓΟ', () => {
  it('κενό — μετρημένο συμπέρασμα: η προϊοντική επιφάνεια του ιδιώτη ζει στο group `(me)`', () => {
    expect(Object.keys(PERSONAL_WORKSPACE_SURFACE)).toEqual([]);
  });

  /**
   * ⛔ Η άγκυρα που κρατά την **ποιότητα της δήλωσης**, όχι το πλήθος: όποιος προσθέσει
   * τομέα οφείλει να γράψει **γιατί** έχει νόημα χωρίς εταιρεία (πρότυπο
   * `.workspace-scope.json` · CHECK 3.35 / 3.50: δήλωση χωρίς λόγο = παράκαμψη με άλλο όνομα).
   */
  it('καμία εγγραφή χωρίς ουσιαστικό λόγο', () => {
    for (const [segment, why] of Object.entries(PERSONAL_WORKSPACE_SURFACE)) {
      expect(`${segment}: ${why}`.length).toBeGreaterThan(segment.length + 40);
    }
  });
});
