/**
 * =============================================================================
 * ADR-841 §7 Α18 · ADR-849 §6δ Β1 — **Η ΘΕΜΑΤΟΦΥΛΑΚΗ ΤΗΣ ΔΙΕΥΘΥΝΣΗΣ ΤΗΣ ΕΙΔΟΠΟΙΗΣΗΣ**
 * =============================================================================
 *
 * Το ερώτημα: *«κάθε ειδοποίηση που φτιάχνουμε — ξέρει **πού οδηγεί** και **σε ποιον
 * χώρο**, ή αφήνει τον άνθρωπο σε αδιέξοδο;»*
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
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΝΑΚΑΛΥΨΗ ΗΤΑΝ ΣΤΕΝΗ — ΚΑΙ ΕΚΡΥΒΕ 404 (ADR-849 §6δ Β1, 2026-09-11)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι Κ1–Κ3 έκριναν **μόνο** αρχεία `*-notifier.service.ts`. Το
 * `procurement/po-notification-service.ts` λέγεται αλλιώς — και έγραφε με το χέρι
 * `/procurement/<id>`, διεύθυνση **χωρίς σελίδα**, με **ελληνική** ετικέτα. Πράσινο
 * επειδή κανείς δεν κοίταξε. Πλέον η ανακάλυψη είναι **η ίδια η κλήση**
 * (`dispatchNotification({`) — ίδιο ιδίωμα με το Κ0 της `notification-title-key-reach`.
 *
 * ⚠️ **ΔΕΝ αντικαθιστά τις άγκυρες συμπεριφοράς** — τις **συμπληρώνει**: εκείνες λένε
 * *«η διεύθυνση είναι η σωστή»*, αυτή λέει *«κανείς δεν ξέφυγε»*.
 */

import fs from 'node:fs';
import path from 'node:path';

// =============================================================================
// Η ΑΝΑΚΑΛΥΨΗ — από τον ΔΙΣΚΟ, ποτέ χειρόγραφη λίστα
// =============================================================================

const SRC_ROOT = path.join(process.cwd(), 'src');
const SERVICES_ROOT = path.join(SRC_ROOT, 'services');

function sourceFiles(root: string): readonly string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
        found.push(full);
      }
    }
  };
  walk(root);
  return found.sort();
}

/** ⛔ Ο ίδιος ο μηχανισμός (ορχηστρωτής, μόνιμος σύνδεσμος) δεν είναι παραγωγός. */
function isMechanism(file: string): boolean {
  const relative = path.relative(SRC_ROOT, file).split(path.sep).join('/');
  return relative.startsWith('server/notifications/');
}

const ALL_SOURCES = sourceFiles(SRC_ROOT);
const read = (file: string): string => fs.readFileSync(file, 'utf8');

/**
 * 🔑 **Κάθε αρχείο που καλεί τον ορχηστρωτή** — όχι όσα λέγονται `*-notifier`.
 * Η λίστα **παράγεται**, δεν γράφεται (CHECK 3.34 · 3.37 · 3.49 · 3.57).
 */
const PRODUCERS = ALL_SOURCES.filter(
  (file) => !isMechanism(file) && read(file).includes('dispatchNotification({'),
);

/** Οι σαρωτές ζήτησης — για τον κοινό πυρήνα (Κ4). */
const NOTIFIERS = sourceFiles(SERVICES_ROOT).filter((file) => file.endsWith('-notifier.service.ts'));

/** Ο ορισμός του βοηθού — εξαιρείται από την Κ2 (η υπογραφή του δεν είναι κλήση). */
const DESTINATION_SSOT = path.join(SRC_ROOT, 'lib', 'notifications', 'notification-destination.ts');

/**
 * **Ο δηλωμένος λόγος να ΜΗΝ έχει διεύθυνση** — και είναι επίτηδες μακρύς.
 *
 * ⛔ Μια σημαία τύπου `// no-actions` θα ήταν **ένα πράγμα που γράφεται σε τρία
 * δευτερόλεπτα** για να σωπάσει η πύλη. Αυτή η φράση απαιτεί από τον άνθρωπο να
 * **γράψει από κάτω γιατί** — και εμφανίζεται στο diff.
 */
const DECLARED_NO_DESTINATION = 'ΔΕΝ ΠΑΙΡΝΕΙ `actions`, ΚΑΙ ΕΙΝΑΙ';

/** Δηλώνει προορισμό: κυριολεκτικό `actions: [` ή βοηθό `...xxxDestination(`. */
function declaresDestination(source: string): boolean {
  return /\n\s*actions:\s*\[/.test(source) || /\.\.\.\s*\w+Destination\(/.test(source);
}

const ACTION_BLOCKS = /\n\s*actions:\s*\[[^\]]*\]/g;

/** Το πρώτο όρισμα κάθε κλήσης `viewDestination(` — **εκτός** από τον ορισμό της. */
function viewDestinationArgs(source: string): readonly string[] {
  return [...source.matchAll(/(function\s+)?viewDestination\(\s*([^,)]*)/g)]
    .filter((m) => m[1] === undefined)
    .map((m) => m[2].trim());
}

/** Η διαδρομή ζητείται από SSoT: βοηθός `…Href(` ή σταθερά μητρώου (`ENTITY_ROUTES.…`). */
const ROUTE_FROM_SSOT = /^(\w+Href\(|[A-Z][A-Z_]*\.[\w.]+)/;

// =============================================================================

describe('ADR-841 §7 Α18 — καμία ειδοποίηση χωρίς δηλωμένο προορισμό', () => {
  it('Κ0 — η ανακάλυψη βρίσκει παραγωγούς (αλλιώς η πύλη είναι πράσινη επειδή δεν κοίταξε)', () => {
    // 🔴 **ΤΟ `0` ΣΗΜΑΙΝΕΙ «ΚΑΝΕΙΣ ΔΕΝ ΚΟΙΤΑΞΕ», ΟΧΙ «ΚΑΘΑΡΟ».** Μετρημένο 2026-09-11:
    //    7 παραγωγοί (5 υπηρεσίες ζήτησης/εντολών + προμήθειες + εισερχόμενα email) και
    //    ένα route. Και οι σαρωτές ζήτησης (Κ4) τουλάχιστον 4.
    expect(PRODUCERS.length).toBeGreaterThanOrEqual(7);
    expect(NOTIFIERS.length).toBeGreaterThanOrEqual(4);
    // Ο παραγωγός που γέννησε τη διεύρυνση ΠΡΕΠΕΙ να είναι μέσα — αλλιώς η διεύρυνση είναι σχόλιο.
    expect(PRODUCERS.some((file) => file.endsWith('po-notification-service.ts'))).toBe(true);
  });

  it.each(PRODUCERS.map((f) => [path.relative(SRC_ROOT, f), f] as const))(
    'Κ1 — %s: ή δίνει προορισμό, ή δηλώνει ΓΡΑΠΤΩΣ γιατί όχι',
    (_name, file) => {
      const source = read(file);
      expect(declaresDestination(source) || source.includes(DECLARED_NO_DESTINATION)).toBe(true);
    },
  );

  /**
   * 🔴 **Η ΔΙΕΥΘΥΝΣΗ ΧΤΙΖΕΤΑΙ ΑΠΟ ΤΟ SSoT, ΠΟΤΕ ΜΕ ΤΟ ΧΕΡΙ.**
   *
   * Ένα χειρόγραφο `` `/procurement/${id}` `` «δούλευε» — και δεν υπήρχε σελίδα εκεί.
   * Ένας βοηθός `…Href` κουβαλά το `encodeURIComponent` **και** ζει δίπλα στη διαδρομή
   * που υπάρχει. Η κρίση πάει **σε κάθε κλήση** του `viewDestination`, όπου κι αν ζει.
   */
  it('Κ2 🔴 — κάθε `viewDestination(` παίρνει τη διαδρομή από SSoT (και υπάρχουν κλήσεις)', () => {
    const calls = ALL_SOURCES.filter((file) => file !== DESTINATION_SSOT)
      .flatMap((file) => viewDestinationArgs(read(file)).map((arg) => [path.relative(SRC_ROOT, file), arg]));

    expect(calls.length).toBeGreaterThanOrEqual(6);
    // Το αρχείο ταξιδεύει μέσα στη σύγκριση, ώστε η αποτυχία να λέει ΠΟΙΟ ξέφυγε.
    const offenders = calls.filter(([, arg]) => !ROUTE_FROM_SSOT.test(arg));
    expect(offenders).toEqual([]);
  });

  it.each(PRODUCERS.map((f) => [path.relative(SRC_ROOT, f), f] as const))(
    'Κ2β — %s: καμία χειρόγραφη διαδρομή μέσα σε κυριολεκτικό `actions`',
    (_name, file) => {
      for (const block of read(file).match(ACTION_BLOCKS) ?? []) {
        expect(block).toMatch(/url:\s*\w+Href\(/);
      }
    },
  );

  /**
   * ⚠️ **Η ΕΤΙΚΕΤΑ ΔΕΝ ΦΤΑΝΕΙ ΠΟΤΕ ΣΕ ΟΘΟΝΗ — ΚΑΙ ΓΙ' ΑΥΤΟ ΔΕΝ ΕΙΝΑΙ ΕΛΛΗΝΙΚΗ.**
   *
   * Ο `NotificationDrawer` **αγνοεί** το `action.label` και αποδίδει δικό του
   * μεταφρασμένο κείμενο. Ένα ελληνικό κείμενο εκεί θα ήταν **ψεύτικη υπόσχεση
   * μετάφρασης** (N.11). Το `viewDestination` γράφει σταθερό `view` — εδώ κρίνονται
   * οι κυριολεκτικοί πίνακες που απέμειναν.
   */
  it.each(PRODUCERS.map((f) => [path.relative(SRC_ROOT, f), f] as const))(
    'Κ3 — %s: καμία ελληνική ετικέτα μέσα σε `actions`',
    (_name, file) => {
      for (const block of read(file).match(ACTION_BLOCKS) ?? []) {
        const label = /label:\s*'([^']*)'/.exec(block);
        expect(label).not.toBeNull();
        expect(label?.[1] ?? '').not.toMatch(/[Ͱ-Ͽἀ-῿]/);
      }
    },
  );

  /**
   * 🔴 **Ο ΠΡΟΟΡΙΣΜΟΣ ΔΕΝ ΕΙΝΑΙ ΕΝΑΣ — ΚΑΙ Ο ΚΟΙΝΟΣ ΠΥΡΗΝΑΣ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΤΟ ΞΕΡΕΙ**
   * (ADR-841 §7 Α18.9 · ADR-849 §6δ Β1).
   *
   * Το `announceIfNewsworthy` είναι **ένα** σώμα που εξυπηρετεί **δύο** σαρωτές. Η
   * κατοχή (ποια πόρτα) **και** ο κάτοχος του χώρου (σε ποιον χώρο ανοίγει) δεν
   * συνάγονται — **δηλώνονται** από όποιον διάβασε τη συλλογή.
   *
   * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΖΕΙ ΣΤΟ ΙΔΙΟ ΚΡΙΤΗΡΙΟ, ΕΠΙΤΗΔΕΣ.** Η πρώτη γραφή του Κ4 έψαχνε
   * το κλείσιμο με indentation που **δεν υπάρχει** ⇒ μηδέν κλήσεις, πράσινο επειδή δεν
   * κοίταξε. Πιάστηκε πριν φύγει· μένει γραμμένο ώστε να μην ξαναγραφτεί έτσι.
   */
  it('Κ4 🔴 — κάθε κλήση του κοινού πυρήνα ΔΗΛΩΝΕΙ κατοχή ΚΑΙ κάτοχο χώρου (και υπάρχουν κλήσεις)', () => {
    const calls = NOTIFIERS.flatMap((file) => {
      const source = read(file);
      return [...source.matchAll(/announceIfNewsworthy\(/g)].map((m) =>
        source.slice(m.index, m.index + 1600),
      );
    });

    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const call of calls) {
      expect(call).toMatch(/\n\s+source: '[a-z-]+',/);
      expect(call).toMatch(/\n\s+holderId[,:]/);
    }
  });

  /**
   * 🔴 **ADR-849 §6δ Β1 — ΚΑΝΕΝΑΣ ΠΡΟΟΡΙΣΜΟΣ ΧΩΡΙΣ ΧΩΡΟ.** Ο τύπος το επιβάλλει ήδη
   * (`DispatchDestination`)· αυτή η γραμμή είναι η ζώνη ασφαλείας για ό,τι δεν περνά
   * από έλεγχο τύπων πριν το commit. Κυριολεκτικό `actions: [` ⇒ `workspace:` στο ίδιο
   * αρχείο· οι βοηθοί `…Destination(` το κουβαλούν από κατασκευής.
   */
  it.each(PRODUCERS.map((f) => [path.relative(SRC_ROOT, f), f] as const))(
    'Κ5 — %s: κυριολεκτικές ενέργειες ⇒ δηλωμένος χώρος',
    (_name, file) => {
      const source = read(file);
      if ((source.match(ACTION_BLOCKS) ?? []).length === 0) return;
      expect(source).toMatch(/\n\s*workspace[,:]/);
    },
  );
});
