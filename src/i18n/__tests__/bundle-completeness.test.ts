/**
 * ADR-744 §11 — Η ΠΥΛΗ ΓΙΑ ΤΗΝ ΕΡΩΤΗΣΗ ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΕΚΑΝΕ.
 *
 * Το `shell-slice-no-raw-keys.test.ts` ρωτά «φτάνει το slice για το **κέλυφος**;».
 * Η απάντηση ήταν, και παραμένει, ναι. Αυτό εδώ ρωτά το άλλο μισό, που κανείς δεν
 * ρωτούσε:
 *
 *   **Ό,τι το slice έγραψε ΚΟΜΜΕΝΟ, το παίρνει ποτέ κανείς ολόκληρο;**
 *
 * Μέχρι 2026-08-07 η απάντηση ήταν **όχι**. Ο loader αποφάσιζε «χρειάζεται
 * φόρτωση;» με `i18n.hasResourceBundle`, που απαντά «υπάρχει κάτι;» — και το
 * slice είχε φροντίσει να υπάρχει πάντα κάτι. Αποτέλεσμα: το πλήρες
 * `projects.json` δεν φορτωνόταν ΠΟΤΕ, και το `/projects` ζωγράφιζε ωμό
 * `page.loadingMessage` (μόνιμα στην παραγωγή) ενώ:
 *   · η μετάφραση υπήρχε        → CHECK 3.8  πράσινο
 *   · το namespace είχε loader  → CHECK 3.36 πράσινο
 *   · οι τύποι ήταν φρέσκοι     → CHECK 3.33 πράσινο
 *   · το slice ήταν υπογεγραμμένο → CHECK 3.34 πράσινο
 *
 * Πέντε πράσινες πύλες, μία ερώτηση που έλειπε.
 */

import fs from 'node:fs';
import path from 'node:path';

import i18next, { type Resource } from 'i18next';

import shellSlice from '../generated/shell-slice.el.json';
import shellWholeNamespaces from '../generated/shell-slice.whole.json';
import {
  getBundleState,
  isBundleComplete,
  recordLoaderInstall,
  recordShellBootstrap,
  resetBundleRegistry,
} from '../bundle-registry';

const LANGUAGE = 'el';
const LOCALES_DIR = path.join(__dirname, '..', 'locales', LANGUAGE);

const slice = shellSlice as Record<string, Record<string, unknown>>;
const sliceNamespaces = Object.keys(slice);
const whole = new Set<string>(shellWholeNamespaces);

function readLocale(namespace: string): Record<string, unknown> | null {
  const file = path.join(LOCALES_DIR, `${namespace}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

/** Μετρά τα φύλλα ενός δέντρου μετάφρασης — η μονάδα «πόσο περιεχόμενο». */
function countLeaves(node: unknown): number {
  if (node === null || typeof node !== 'object') return 1;
  return Object.values(node as Record<string, unknown>).reduce<number>(
    (sum, child) => sum + countLeaves(child),
    0,
  );
}

describe('ADR-744 §11 — η λίστα πληρότητας δεν μπορεί να ψεύδεται', () => {
  it('κάθε namespace του slice έχει ρητή θέση: whole ή κομμένο', () => {
    expect(sliceNamespaces.length).toBeGreaterThan(0);
    // Κάθε όνομα στη λίστα whole ΠΡΕΠΕΙ να ταξιδεύει όντως στο slice — αλλιώς η
    // λίστα περιγράφει κάτι που δεν υπάρχει και ο bootstrap θα δήλωνε «complete»
    // ένα bundle που δεν έγραψε ποτέ.
    for (const namespace of whole) {
      expect(sliceNamespaces).toContain(namespace);
    }
  });

  it.each(sliceNamespaces)(
    '%s: αν είναι whole φέρνει ΟΛΑ τα φύλλα, αν όχι φέρνει ΓΝΗΣΙΟ υποσύνολο',
    (namespace) => {
      const full = readLocale(namespace);
      expect(full).not.toBeNull();

      const shipped = countLeaves(slice[namespace]);
      const complete = countLeaves(full);

      if (whole.has(namespace)) {
        // Ταυτότητα, όχι «περίπου»: το `pruneNamespace` επιστρέφει το ίδιο το
        // αντικείμενο-πηγή όταν `want.whole`, άρα οτιδήποτε λιγότερο σημαίνει ότι
        // η λίστα λέει «ολόκληρο» για κάτι κομμένο — δηλαδή ο loader θα το
        // παρέλειπε και θα ξαναγεννιόταν ακριβώς το bug του /projects.
        expect(slice[namespace]).toEqual(full);
        expect(shipped).toBe(complete);
      } else {
        // Και το αντίστροφο σφάλμα είναι εξίσου ακριβό: «κομμένο» για κάτι πλήρες
        // σημαίνει ότι ξανακατεβάζουμε δεδομένα που ήδη έχουμε στο main bundle.
        expect(shipped).toBeLessThan(complete);
      }
    },
  );

  /**
   * ΤΟ ΜΕΓΕΘΟΣ ΤΟΥ ΠΡΟΒΛΗΜΑΤΟΣ, ΓΡΑΜΜΕΝΟ.
   *
   * Δεν είναι assertion ορίου — είναι ορατότητα. Αν κάποιος δει αυτόν τον πίνακα
   * να μεγαλώνει, ξέρει ότι μεγάλωσε η επιφάνεια που εξαρτάται από το μητρώο.
   */
  it('καταγράφει ποια namespaces μπαίνουν κομμένα και πόσο', () => {
    const partial = sliceNamespaces.filter(ns => !whole.has(ns));
    expect(partial.length).toBeGreaterThan(0);

    const report = partial.map((ns) => {
      const full = readLocale(ns);
      return `${ns}: ${countLeaves(slice[ns])}/${countLeaves(full)} φύλλα`;
    });
    expect(report.length).toBe(partial.length);
    // Το `projects` είναι το χειρότερο και είναι αυτό που έσπασε στην οθόνη.
    expect(partial).toContain('projects');
  });
});

describe('ADR-744 §11 — το μητρώο ξεχωρίζει τρεις καταστάσεις', () => {
  beforeEach(() => {
    resetBundleRegistry();
    recordShellBootstrap(LANGUAGE, sliceNamespaces, shellWholeNamespaces);
  });

  it('κομμένο bundle = shell-partial, ΟΧΙ complete', () => {
    expect(getBundleState(LANGUAGE, 'projects')).toBe('shell-partial');
    expect(isBundleComplete(LANGUAGE, 'projects')).toBe(false);
  });

  it('ολόκληρο bundle = complete χωρίς δεύτερη φόρτωση', () => {
    expect(getBundleState(LANGUAGE, 'common')).toBe('complete');
    expect(isBundleComplete(LANGUAGE, 'common')).toBe(true);
  });

  it('namespace εκτός slice = absent', () => {
    expect(getBundleState(LANGUAGE, 'accounting')).toBe('absent');
    expect(isBundleComplete(LANGUAGE, 'accounting')).toBe(false);
  });

  it('ο loader προάγει shell-partial → complete', () => {
    recordLoaderInstall(LANGUAGE, 'projects');
    expect(getBundleState(LANGUAGE, 'projects')).toBe('complete');
  });

  it('ο bootstrap ΔΕΝ υποβαθμίζει bundle που ο loader πρόλαβε', () => {
    recordLoaderInstall(LANGUAGE, 'projects');
    recordShellBootstrap(LANGUAGE, sliceNamespaces, shellWholeNamespaces);
    expect(getBundleState(LANGUAGE, 'projects')).toBe('complete');
  });

  it('η κατάσταση είναι ανά ΓΛΩΣΣΑ — el complete δεν σημαίνει en complete', () => {
    recordLoaderInstall(LANGUAGE, 'projects');
    expect(isBundleComplete('en', 'projects')).toBe(false);
  });
});

/**
 * 🔴 Η ΑΠΟΔΕΙΞΗ ΟΤΙ Η ΑΛΛΑΓΗ ΔΕΝ ΕΙΝΑΙ ΙΣΟΔΥΝΑΜΗ ΜΕΤΑΛΛΑΞΗ.
 *
 * Αν κάποιος επαναφέρει το `hasResourceBundle` σε οποιοδήποτε από τα δύο σημεία
 * απόφασης, αυτό το block δείχνει ακριβώς τι θα ξαναγίνει: το i18next λέει
 * «ναι, το έχω», το μητρώο λέει «όχι, το έχω μισό», και το κλειδί δεν λύνεται.
 */
describe('ADR-744 §11 — η ρίζα, αναπαραγόμενη', () => {
  const RAW_KEY = 'page.loadingMessage';

  it('το i18next λέει "υπάρχει" για bundle με 1 από 49 κλειδιά', async () => {
    resetBundleRegistry();
    recordShellBootstrap(LANGUAGE, sliceNamespaces, shellWholeNamespaces);

    const client = i18next.createInstance();
    await client.init({
      resources: { [LANGUAGE]: shellSlice } as Resource,
      lng: LANGUAGE,
      fallbackLng: LANGUAGE,
      ns: sliceNamespaces,
      defaultNS: 'common',
      initImmediate: false,
      interpolation: { escapeValue: false },
    });

    // Η παλιά ερώτηση και η νέα, δίπλα-δίπλα, στο ίδιο bundle.
    expect(client.hasResourceBundle(LANGUAGE, 'projects')).toBe(true);   // «υπάρχει κάτι;»
    expect(isBundleComplete(LANGUAGE, 'projects')).toBe(false);          // «υπάρχει ΟΛΟ;»

    // Και να γιατί η διαφορά έχει σημασία: αυτό είναι το string που έβλεπε ο χρήστης.
    expect(client.t(RAW_KEY, { ns: 'projects' })).toBe(RAW_KEY);
  });

  it('μετά την εγκατάσταση του πλήρους locale, το κλειδί λύνεται', async () => {
    resetBundleRegistry();
    recordShellBootstrap(LANGUAGE, sliceNamespaces, shellWholeNamespaces);

    const client = i18next.createInstance();
    await client.init({
      resources: { [LANGUAGE]: shellSlice } as Resource,
      lng: LANGUAGE,
      fallbackLng: LANGUAGE,
      ns: sliceNamespaces,
      defaultNS: 'common',
      initImmediate: false,
      interpolation: { escapeValue: false },
    });

    // Ό,τι κάνει το `loadNamespace` όταν ΔΕΝ κάνει πια early-return.
    const full = readLocale('projects');
    client.addResourceBundle(LANGUAGE, 'projects', full, true, true);
    recordLoaderInstall(LANGUAGE, 'projects');

    expect(isBundleComplete(LANGUAGE, 'projects')).toBe(true);
    expect(client.t(RAW_KEY, { ns: 'projects' })).not.toBe(RAW_KEY);
    expect(client.t(RAW_KEY, { ns: 'projects' })).toContain('Φόρτωση');
  });
});
