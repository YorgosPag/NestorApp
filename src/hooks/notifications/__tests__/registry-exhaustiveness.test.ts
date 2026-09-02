/**
 * ============================================================================
 * NOTIFICATION_KEYS Registry — Exhaustiveness & Coverage (φρουρός δύο κατευθύνσεων)
 * ============================================================================
 *
 * Αμφίδρομο αμετάβλητο ανάμεσα στο `NOTIFICATION_KEYS` και τα hooks του τομέα:
 *
 *   **Α)** Κάθε **μέθοδος** hook στέλνει φύλλο που **ζει** στο μητρώο.
 *          ⇒ ο διανομέας δεν μπορεί να περάσει κλειδί εκτός SSoT.
 *   **Β)** Κάθε **φύλλο** του μητρώου είναι **προσβάσιμο** από μέθοδο hook, ή είναι
 *          ρητά στη λίστα άμεσης χρήσης (καθαροί βοηθοί που δεν μπορούν να καλέσουν
 *          hook). ⇒ φύλλο χωρίς ιδιοκτήτη κοκκινίζει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΜΑΘΗΜΑ ΤΗΣ 2026-09-02 — Ο ΦΡΟΥΡΟΣ ΕΙΧΕ ΔΙΚΙΟ, Η ΛΙΣΤΑ ΤΟΥ ΕΙΧΕ ΠΑΛΙΩΣΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η σουίτα ήταν **κόκκινη στο `main`** με **πέντε** φύλλα «χωρίς ιδιοκτήτη»:
 * `projects:messages.movedToTrash` · `.restored` · `.permanentlyDeleted` ·
 * `files:upload.toast.uploadSuccess` · `files:trash.movedToTrash`.
 *
 * 🔑 **Και τα πέντε ΕΙΧΑΝ μέθοδο hook.** Κανένα δεν ήταν κενό καλωδίωσης: ο έλεγχος
 * απλώς **δεν τις καλούσε**. Η ίδια η άγκυρα κρατούσε **χειρόγραφη** λίστα κλήσεων που
 * όφειλε να μένει συγχρονισμένη με τη διεπαφή του hook — δηλαδή ο φρουρός φύλαγε από
 * απόκλιση που **ο ίδιος επέτρεπε στον εαυτό του**.
 *
 * ⛔ **Γι' αυτό ΔΕΝ μπήκαν στη λίστα επιτρεπτών** *(φρουρός που σιωπά δεν είναι
 * φρουρός)* **ούτε προστέθηκαν πέντε γραμμές** *(θα ξαναπάλιωναν στην έκτη μέθοδο)*.
 *
 * ✅ **Η λίστα κλήσεων είναι πλέον ΠΑΡΑΓΟΜΕΝΗ**: ο {@link invokeEveryMethod} περπατά
 * το αντικείμενο που **επιστρέφει** το hook και εκτελεί **κάθε** συνάρτηση που βρίσκει,
 * σε όση βάθος ιεραρχία κι αν ζει. Νέα μέθοδος ⇒ καλύπτεται **δωρεάν**· παράλειψη
 * γίνεται **δομικά αδύνατη**, όχι θέμα μνήμης.
 *
 * ⚠️ **ΚΑΙ Ο ΠΕΡΙΠΑΤΗΤΗΣ ΕΧΕΙ ΤΟΝ ΔΙΚΟ ΤΟΥ ΦΡΟΥΡΟ** (ADR-749 §5): αν σπάσει και
 * εκτελέσει **μηδέν** μεθόδους, η κατεύθυνση Α θα περνούσε **κενή** — αληθής για το
 * τίποτα. Το `Γ1` απαιτεί απόδειξη ζωής, και το `Γ2` απαγορεύει μέθοδο που **πετά** να
 * περάσει ως «καλύφθηκε».
 *
 * @see src/config/notification-keys.ts — SSoT μητρώο
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderHook } from '@testing-library/react';
import { NOTIFICATION_KEYS } from '@/config/notification-keys';
import { useContactNotifications } from '../useContactNotifications';
import { useProjectNotifications } from '../useProjectNotifications';
import { useFilesNotifications } from '../useFilesNotifications';

const success = jest.fn();
const error = jest.fn();
const info = jest.fn();
const warning = jest.fn();

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success, error, info, warning }),
}));

// Ο τομέας των αρχείων περνά από `useTranslation` για ICU. Ταυτοτικό διπλό ⇒ η τιμή
// που φτάνει στον διανομέα **είναι** το κλειδί, που είναι ακριβώς το υπό κρίση.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: {} }),
}));

// ---------------------------------------------------------------------------
// Το μητρώο — κάθε συμβολοσειρά-φύλλο ως σύνολο
// ---------------------------------------------------------------------------
function collectLeaves(node: unknown, out: Set<string>): void {
  if (typeof node === 'string') {
    out.add(node);
    return;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node as Record<string, unknown>)) {
      collectLeaves(value, out);
    }
  }
}

function registryLeaves(subtree: unknown): Set<string> {
  const out = new Set<string>();
  collectLeaves(subtree, out);
  return out;
}

// ---------------------------------------------------------------------------
// Ο ΠΕΡΙΠΑΤΗΤΗΣ — εκτελεί ΚΑΘΕ μέθοδο, χωρίς χειρόγραφη λίστα
// ---------------------------------------------------------------------------

/**
 * Ένα όρισμα που ικανοποιεί **κάθε** υπογραφή του τομέα *(πλήθος · όνομα αρχείου ·
 * αποδόμηση `{ success, fail, total }`)*. Χρησιμοποιείται **μόνο** ως δεύτερη ευκαιρία:
 * η πρώτη κλήση γίνεται **χωρίς όρισμα**, γιατί μέθοδοι σαν το `batch.archiveError`
 * αλλάζουν **συμπεριφορά** όταν τους δοθεί μήνυμα διακομιστή (στέλνουν το ωμό κείμενο
 * αντί για το κλειδί) — και τότε θα δοκιμάζαμε τον λάθος κλάδο.
 */
const UNIVERSAL_ARG = { success: 1, fail: 1, total: 3, count: 1, name: 'file.pdf' } as const;

interface WalkOutcome {
  /** Πόσες μέθοδοι εκτελέστηκαν με επιτυχία — η **απόδειξη ζωής** του περιπατητή. */
  readonly invoked: number;
  /** Μονοπάτια μεθόδων που πέταξαν **και** χωρίς όρισμα **και** με το καθολικό. */
  readonly failed: readonly string[];
}

/** Μία μέθοδος: πρώτα χωρίς όρισμα, μετά με το καθολικό. */
function invokeOne(fn: (...args: readonly unknown[]) => unknown): boolean {
  try {
    fn();
    return true;
  } catch {
    try {
      fn(UNIVERSAL_ARG);
      return true;
    } catch {
      return false;
    }
  }
}

/** Περπατά το API του hook και εκτελεί **κάθε** συνάρτηση, σε κάθε βάθος. */
function invokeEveryMethod(api: unknown, path = ''): WalkOutcome {
  if (!api || typeof api !== 'object') return { invoked: 0, failed: [] };

  let invoked = 0;
  const failed: string[] = [];

  for (const [key, value] of Object.entries(api as Record<string, unknown>)) {
    const here = path === '' ? key : `${path}.${key}`;
    if (typeof value === 'function') {
      if (invokeOne(value as (...args: readonly unknown[]) => unknown)) invoked += 1;
      else failed.push(here);
      continue;
    }
    const nested = invokeEveryMethod(value, here);
    invoked += nested.invoked;
    failed.push(...nested.failed);
  }

  return { invoked, failed };
}

// ---------------------------------------------------------------------------
// Ό,τι έφτασε στον διανομέα
// ---------------------------------------------------------------------------
function captureKeys(fn: jest.Mock): Set<string> {
  const keys = new Set<string>();
  for (const call of fn.mock.calls) {
    if (typeof call[0] === 'string') keys.add(call[0]);
  }
  return keys;
}

function allDispatchedKeys(): Set<string> {
  const out = new Set<string>();
  for (const spy of [success, error, info, warning]) {
    for (const k of captureKeys(spy)) out.add(k);
  }
  return out;
}

/** Εκτελεί όλο το hook και επιστρέφει **τι στάλθηκε** μαζί με **τι εκτελέστηκε**. */
function exerciseHook(hook: () => unknown): WalkOutcome & { readonly dispatched: Set<string> } {
  const { result } = renderHook(hook);
  const outcome = invokeEveryMethod(result.current);
  return { ...outcome, dispatched: allDispatchedKeys() };
}

beforeEach(() => {
  success.mockClear();
  error.mockClear();
  info.mockClear();
  warning.mockClear();
});

// ---------------------------------------------------------------------------
// Οι τρεις τομείς — μία δήλωση, τρεις κατευθύνσεις ελέγχου
// ---------------------------------------------------------------------------

/**
 * Φύλλα που καταναλώνονται από **μη-hook** βοηθούς (καθαρές συναρτήσεις που δεν
 * μπορούν να καλέσουν React hook). Όταν ο βοηθός μεταναστεύσει σε διανομέα, η γραμμή
 * του **φεύγει** — αυτός είναι ο **μόνος** τρόπος να μικρύνει η λίστα.
 *
 * ⛔ **Ποτέ γραμμή εδώ για να πρασινίσει κόκκινη πύλη.** Κάθε καταχώρηση δείχνει τον
 * βοηθό που την καταναλώνει, ονομαστικά.
 */
const DIRECT_USAGE_LEAVES = new Set<string>([
  // src/utils/contactForm/submission-error-handler.ts — καθαρός βοηθός, χωρίς hook
  NOTIFICATION_KEYS.contacts.duplicate.exactMatch,
  NOTIFICATION_KEYS.contacts.duplicate.possibleMatch,
  NOTIFICATION_KEYS.contacts.duplicate.similarMatch,
  // src/utils/contactForm/execute-guarded-contact-update.ts — καθαρός βοηθός, χωρίς hook
  NOTIFICATION_KEYS.contacts.companyIdentity.unsafeClear,
  // Σημείωση: τα batch.archiveSuccess / archivePartialSuccess / archiveNoChanges
  // ανήκουν στο showArchiveResultFeedback() (SSoT «archive-feedback») και ΔΕΝ ζουν
  // στο NOTIFICATION_KEYS — είναι εκτός του μοτίβου των hooks του τομέα.
]);

const DOMAINS = [
  { name: 'contacts', hook: useContactNotifications, subtree: NOTIFICATION_KEYS.contacts },
  { name: 'projects', hook: useProjectNotifications, subtree: NOTIFICATION_KEYS.projects },
  { name: 'files', hook: useFilesNotifications, subtree: NOTIFICATION_KEYS.files },
] as const;

describe.each(DOMAINS)('NOTIFICATION_KEYS — τομέας «$name»', ({ hook, subtree }) => {
  it('Α — κάθε κλειδί που στάλθηκε ΕΙΝΑΙ φύλλο του μητρώου', () => {
    const { dispatched } = exerciseHook(hook);
    const registered = registryLeaves(subtree);

    for (const key of dispatched) {
      expect(registered).toContain(key);
    }
  });

  it('Β — κάθε φύλλο του μητρώου ΕΧΕΙ ιδιοκτήτη (μέθοδο hook ή ρητό βοηθό)', () => {
    const { dispatched } = exerciseHook(hook);

    const orphans = [...registryLeaves(subtree)].filter(
      (leaf) => !dispatched.has(leaf) && !DIRECT_USAGE_LEAVES.has(leaf),
    );

    expect(orphans).toEqual([]);
  });

  it('Γ2 — καμία μέθοδος δεν ΠΕΤΑ: ό,τι δεν εκτελείται δεν αποδεικνύει τίποτα', () => {
    expect(exerciseHook(hook).failed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Γ — ΑΠΟΔΕΙΞΗ ΖΩΗΣ ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΠΕΡΙΠΑΤΗΤΗ (ADR-749 §5)
// ---------------------------------------------------------------------------

describe('Γ — ο περιπατητής ΕΚΤΕΛΕΙ πράγματι', () => {
  /**
   * 🔴 **Χωρίς αυτό, ένας σπασμένος περιπατητής θα έκανε την κατεύθυνση Α «πράσινη».**
   * Το «για κάθε στοιχείο του κενού συνόλου» είναι **αληθές**, και αληθές για το
   * τίποτα — ακριβώς η μετάλλαξη που δραπέτευσε στη Φ5 του ADR-842.
   *
   * ⚠️ Το κάτω όριο είναι **σκόπιμα χαλαρό**: κλειδώνει το *«εκτελεί δεκάδες»*, όχι
   * έναν ακριβή αριθμό που θα κοκκίνιζε σε κάθε νέα μέθοδο — αριθμός που πονά σε
   * νόμιμη προσθήκη διδάσκει να τον ανεβάζουν χωρίς να τον διαβάζουν.
   */
  it('Γ1 — εκτελούνται δεκάδες μέθοδοι σε όλους τους τομείς', () => {
    const total = DOMAINS.reduce((sum, domain) => sum + exerciseHook(domain.hook).invoked, 0);
    expect(total).toBeGreaterThanOrEqual(40);
  });

  it('Γ3 — κάθε γραμμή της λίστας άμεσης χρήσης δείχνει σε υπαρκτό φύλλο', () => {
    const allLeaves = registryLeaves(NOTIFICATION_KEYS);
    for (const leaf of DIRECT_USAGE_LEAVES) {
      expect(allLeaves).toContain(leaf);
    }
  });
});

// ---------------------------------------------------------------------------
// Δ — Η ΤΡΥΠΑ ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΦΥΛΑΓΕ: ΕΧΕΙ ΤΟ ΚΛΕΙΔΙ ΜΕΤΑΦΡΑΣΗ;
// ---------------------------------------------------------------------------

/**
 * 🔴 **ΜΕΤΡΗΜΕΝΟ 2026-09-02: ΚΑΝΕΝΑ ΟΡΓΑΝΟ ΔΕΝ ΤΟ ΡΩΤΟΥΣΕ.**
 *
 * Η φυσική υποψηφιότητα ήταν το **CHECK 3.8** *(«`t()` χωρίς αντιστοιχία στα locales»)*.
 * Δεν το καλύπτει, και το λέει **το ίδιο του το αρχείο**: *«SKIPS: Dynamic keys:
 * `t(variable)`»*. Κάθε κλήση του μητρώου είναι **ακριβώς αυτό** —
 * `t(NOTIFICATION_KEYS.files.list.deleteError)`, σταθερά και όχι κυριολεκτικό.
 *
 * ⇒ Οι **80** συμβολοσειρές του μητρώου ήταν, μέχρι σήμερα, **αφύλακτες**: μια
 * μετονομασία κλειδιού σε locale JSON θα έβγαζε ωμό `files:list.deleteError` στην οθόνη
 * του ανθρώπου, και **καμία** πύλη δεν θα το έλεγε.
 *
 * 🔑 **Γι' αυτό ζει ΕΔΩ και όχι σε νέα πύλη**: αυτό το αρχείο είναι ήδη ο ιδιοκτήτης του
 * ερωτήματος *«έχει αυτό το φύλλο νόημα;»*. Οι Α/Β ρωτούν *«έχει ιδιοκτήτη στον
 * κώδικα;»*· το Δ ρωτά *«έχει **πρόταση** για τον άνθρωπο;»* — ίδιο μητρώο, δεύτερη
 * υποχρέωση.
 *
 * ⚠️ Η αναζήτηση κοιτά **και** τα compat splits (`<ns>-*`) του **ADR-280**: ο αποδότης
 * χρόνου εκτέλεσης ψάχνει σε όλα, οπότε μια πύλη που ρωτά **μόνο** το ομώνυμο αρχείο θα
 * ανέφερε «λείπει» για κλειδί που η εφαρμογή **βρίσκει** — και η μόνη «διόρθωση» θα ήταν
 * να ξανα-αντιγραφούν τα κλειδιά στο γονικό namespace, ακυρώνοντας τη διάσπαση.
 */
describe.each(['el', 'en'])('Δ — κάθε φύλλο του μητρώου έχει πρόταση στα «%s»', (lang) => {
  it('Δ1 — μηδέν κλειδιά χωρίς αντιστοιχία στα locale JSON', () => {
    const dir = join(process.cwd(), 'src', 'i18n', 'locales', lang);
    const bundles = new Map<string, unknown>(
      readdirSync(dir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => [
          file.replace('.json', ''),
          JSON.parse(readFileSync(join(dir, file), 'utf8')) as unknown,
        ]),
    );

    const at = (bundle: unknown, dotted: string): unknown =>
      dotted
        .split('.')
        .reduce<unknown>(
          (node, part) =>
            node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
          bundle,
        );

    const unresolved = [...registryLeaves(NOTIFICATION_KEYS)].filter((leaf) => {
      const separator = leaf.indexOf(':');
      if (separator < 0) return false; // χωρίς namespace ⇒ δεν το κρίνει αυτή η πύλη
      const namespace = leaf.slice(0, separator);
      const dotted = leaf.slice(separator + 1);

      if (at(bundles.get(namespace), dotted) !== undefined) return false;
      // ADR-280 compat splits: `<ns>-<κάτι>.json`
      for (const [name, bundle] of bundles) {
        if (name.startsWith(`${namespace}-`) && at(bundle, dotted) !== undefined) return false;
      }
      return true;
    });

    expect(unresolved).toEqual([]);
  });
});
