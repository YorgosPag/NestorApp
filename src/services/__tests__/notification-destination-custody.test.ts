/**
 * =============================================================================
 * ADR-841 §7 Α18 — **Η ΘΕΜΑΤΟΦΥΛΑΚΗ ΤΗΣ ΔΙΕΥΘΥΝΣΗΣ ΤΗΣ ΕΙΔΟΠΟΙΗΣΗΣ**
 * =============================================================================
 *
 * Το ερώτημα: *«κάθε ειδοποίηση που φτιάχνουμε — ξέρει **πού οδηγεί**, ή αφήνει τον
 * άνθρωπο σε αδιέξοδο;»*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΗ Η ΑΓΚΥΡΑ ΔΙΑΒΑΖΕΙ **ΠΗΓΑΙΟ ΚΩΔΙΚΑ** ΚΑΙ ΟΧΙ ΣΥΜΠΕΡΙΦΟΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ελάττωμα **δεν ήταν λάθος τιμή** — ήταν **απουσία**: πέντε υπηρεσίες έγραφαν
 * `actions` **μηδέν φορές**, οπότε το `actionUrl` του `NotificationDrawer` ήταν **πάντα**
 * `undefined` και το κουμπί «Προβολή» **δεν αποδιδόταν ποτέ**. Μια άγκυρα συμπεριφοράς
 * ανά υπηρεσία θα έπιανε τις **τρεις που διορθώθηκαν** και θα ήταν **τυφλή στην έκτη
 * που θα γραφτεί αύριο** — δηλαδή θα έλυνε το **δείγμα**, όχι την **κλάση**.
 *
 * 🔑 **ΚΑΙ ΤΟ HANDOFF ΕΙΧΕ ΗΔΗ ΤΟ ΛΑΘΟΣ ΠΛΗΘΟΣ**: έλεγε *«οι τρεις notifiers»*· η
 * μέτρηση βρήκε **πέντε** αρχεία `*-notifier.service.ts`, από τα οποία **τέσσερα**
 * καλούν `dispatchNotification`. Ακριβώς το μάθημα *«μέτρα ΚΑΙ ΤΟΝ ΑΔΕΛΦΟ»* που το
 * ADR-841 έχει ήδη πληρώσει μία φορά *(changelog 2026-09-03)*.
 *
 * ⚠️ **ΔΕΝ αντικαθιστά τις άγκυρες συμπεριφοράς** — τις **συμπληρώνει**: εκείνες λένε
 * *«η διεύθυνση είναι η σωστή»*, αυτή λέει *«κανείς δεν ξέφυγε»*.
 */

import fs from 'node:fs';
import path from 'node:path';

// =============================================================================
// Η ΑΝΑΚΑΛΥΨΗ — από τον ΔΙΣΚΟ, ποτέ χειρόγραφη λίστα
// =============================================================================

const SERVICES_ROOT = path.join(process.cwd(), 'src', 'services');

/**
 * 🔑 **Η λίστα παράγεται, δεν γράφεται.** Μια χειρόγραφη λίστα εδώ θα ήταν **δεύτερο
 * μητρώο** που παλιώνει σιωπηλά — ακριβώς το σχήμα που το `CLAUDE.md` έχει μετρήσει να
 * αποτυγχάνει τέσσερις φορές *(CHECK 3.34 · 3.37 · 3.49 · 3.57)*.
 */
function notifierFiles(): readonly string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(full);
      } else if (entry.name.endsWith('-notifier.service.ts')) {
        found.push(full);
      }
    }
  };
  walk(SERVICES_ROOT);
  return found.sort();
}

/**
 * **Ο δηλωμένος λόγος να ΜΗΝ έχει διεύθυνση** — και είναι επίτηδες μακρύς.
 *
 * ⛔ Μια σημαία τύπου `// no-actions` θα ήταν **ένα πράγμα που γράφεται σε τρία
 * δευτερόλεπτα** για να σωπάσει η πύλη. Αυτή η φράση απαιτεί από τον άνθρωπο να
 * **γράψει από κάτω γιατί** — και εμφανίζεται στο diff.
 */
const DECLARED_NO_DESTINATION = 'ΔΕΝ ΠΑΙΡΝΕΙ `actions`, ΚΑΙ ΕΙΝΑΙ';

/** Καλεί τον ορχηστρωτή; Μόνο τότε μπορεί να παράγει κουμπί στον drawer. */
function dispatches(source: string): boolean {
  return source.includes('dispatchNotification({');
}

function feedsActions(source: string): boolean {
  return /\n\s*actions:\s*\[/.test(source);
}

// =============================================================================

describe('ADR-841 §7 Α18 — καμία ειδοποίηση χωρίς δηλωμένο προορισμό', () => {
  const files = notifierFiles();

  it('Κ0 — η ανακάλυψη βρίσκει notifiers (αλλιώς η πύλη είναι πράσινη επειδή δεν κοίταξε)', () => {
    // 🔴 **ΤΟ `0` ΣΗΜΑΙΝΕΙ «ΚΑΝΕΙΣ ΔΕΝ ΚΟΙΤΑΞΕ», ΟΧΙ «ΚΑΘΑΡΟ».** Χωρίς αυτή τη γραμμή,
    //    μια μετονομασία φακέλου θα έκανε ολόκληρη τη σουίτα **μονίμως πράσινη** —
    //    το ακριβές σχήμα που το `CLAUDE.md` καταγγέλλει στα CHECK 3.18 και 3.28.
    expect(files.length).toBeGreaterThanOrEqual(4);
  });

  it.each(notifierFiles().map((f) => [path.basename(f), f] as const))(
    'Κ1 — %s: ή δίνει `actions`, ή δηλώνει ΓΡΑΠΤΩΣ γιατί όχι',
    (_name, file) => {
      const source = fs.readFileSync(file, 'utf8');
      if (!dispatches(source)) return; // δεν παράγει ειδοποίηση εντός εφαρμογής

      const ok = feedsActions(source) || source.includes(DECLARED_NO_DESTINATION);
      expect(ok).toBe(true);
    },
  );

  /**
   * 🔴 **Η ΔΙΕΥΘΥΝΣΗ ΧΤΙΖΕΤΑΙ ΑΠΟ ΤΟΝ helper, ΠΟΤΕ ΜΕ ΤΟ ΧΕΡΙ.**
   *
   * Ένα χειρόγραφο `` `/listing/${id}` `` θα «δούλευε» σήμερα και θα **έχανε το
   * `encodeURIComponent`** — δηλαδή θα αστοχούσε **σιωπηλά** σε ένα μόνο έγγραφο, το
   * χειρότερο είδος σφάλματος γιατί μοιάζει με «δεν υπάρχει». Είναι το **ίδιο** λάθος
   * που το `agency-directory-route.ts` έχει ήδη καταγράψει γραμμένο.
   */
  it.each(notifierFiles().map((f) => [path.basename(f), f] as const))(
    'Κ2 — %s: καμία χειρόγραφη διαδρομή μέσα σε `actions`',
    (_name, file) => {
      const source = fs.readFileSync(file, 'utf8');
      const urls = [...source.matchAll(/\n\s*actions:\s*\[[^\]]*\]/g)].map((m) => m[0]);
      for (const block of urls) {
        expect(block).toMatch(/url:\s*\w+Href\(/);
      }
    },
  );

  /**
   * ⚠️ **Η ΕΤΙΚΕΤΑ ΔΕΝ ΦΤΑΝΕΙ ΠΟΤΕ ΣΕ ΟΘΟΝΗ — ΚΑΙ ΓΙ' ΑΥΤΟ ΔΕΝ ΕΙΝΑΙ ΕΛΛΗΝΙΚΗ.**
   *
   * Μετρημένο: ο `NotificationDrawer` **αγνοεί** το `action.label` και αποδίδει το δικό
   * του `t('notifications.actions.view_email')` *(→ «Προβολή» / «View»)*. Το πεδίο είναι
   * `z.string().min(1)` στο σχήμα, οπότε **κάτι** πρέπει να μπει· ένα ελληνικό κείμενο
   * εκεί θα ήταν **ψεύτικη υπόσχεση μετάφρασης** — string που κανείς δεν μπορεί να
   * αλλάξει γλώσσα και **κανείς δεν διαβάζει** (N.11).
   */
  it.each(notifierFiles().map((f) => [path.basename(f), f] as const))(
    'Κ3 — %s: καμία ελληνική ετικέτα μέσα σε `actions`',
    (_name, file) => {
      const source = fs.readFileSync(file, 'utf8');
      const blocks = [...source.matchAll(/\n\s*actions:\s*\[[^\]]*\]/g)].map((m) => m[0]);
      for (const block of blocks) {
        const label = /label:\s*'([^']*)'/.exec(block);
        expect(label).not.toBeNull();
        expect(label?.[1] ?? '').not.toMatch(/[Ͱ-Ͽἀ-῿]/);
      }
    },
  );
});
