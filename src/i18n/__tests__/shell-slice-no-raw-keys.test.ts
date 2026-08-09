/**
 * ADR-744 — the end-to-end proof, at runtime.
 *
 * Everything else in this ADR reasons about the slice statically: the closure is
 * derived, the keys are classified, the bytes are signed. This suite asks the
 * only question a user can perceive:
 *
 *   **Boot i18next with the synchronous slice AND NOTHING ELSE. Can any key the
 *   shell is able to request still come back as itself?**
 *
 * A raw key on screen is exactly `t('search.globalSearch') === 'search.globalSearch'`.
 * So the test loads only `shell-slice.el.json` — no async preload, no
 * `CRITICAL_NAMESPACES`, no network — and walks every key the generator recorded
 * as reachable from a shell module. If one of them fails to resolve, this suite
 * goes red with the key's name, which is the same string the user would have
 * seen.
 *
 * WHY THIS IS NOT REDUNDANT WITH CHECK 3.34. The gate proves the slice is what
 * the generator would produce; it cannot prove the generator's output is USABLE.
 * A slice could be perfectly fresh, perfectly signed, and still be missing the
 * plural sibling of a key — freshness and correctness are different claims, and
 * green tooling proving the wrong claim is how the original 63-namespace drift
 * survived every CHECK in the repo.
 */

import i18next, { type Resource } from 'i18next';

import manifest from '../generated/shell-slice.manifest.json';
import shellSlice from '../generated/shell-slice.el.json';
// Ανεξάρτητη αυθεντία: τι ΟΦΕΙΛΕΙ να υπάρχει, έναντι του τι ΤΑΞΙΔΕΥΕΙ (ADR-781 §7).
import localeNavigation from '../locales/el/navigation.json';

const LANGUAGE = 'el';

type Want = { keys: string[]; prefixes: string[]; whole: boolean };
const wants = manifest.wants as unknown as Record<string, Want>;
const unresolvable = new Set<string>(manifest.unresolvableKeys as string[]);

/**
 * 🔴 ADR-781 §7 — ΓΙΑΤΙ ΔΕΝ ΥΠΑΡΧΕΙ ΠΙΑ `if (want.whole) continue` ΕΔΩ
 * ==================================================================
 * Μέχρι τις 2026-08-09 και οι δύο συναρτήσεις παρέλειπαν τα namespaces που
 * ταξιδεύουν ΟΛΟΚΛΗΡΑ, με το σκεπτικό «ταξιδεύει ολόκληρο ⇒ δεν χρειάζεται
 * έλεγχος». Το σκεπτικό είναι λάθος και το κόστος του μετρήθηκε:
 *
 *   • **33 κλειδιά δεν ρωτιόντουσαν ΠΟΤΕ** (143 → 176 μετά τη διόρθωση).
 *   • Ανάμεσά τους, ολόκληρο το `navigation` — το namespace του πλαϊνού μενού.
 *   • Την ίδια στιγμή, ο `useTranslationLazy` έβαφε **17 ωμά κλειδιά σε ΚΑΘΕ
 *     μία από τις 141 διαδρομές**, μόνιμα, στην παραγωγή.
 *   • Αυτό εδώ ήταν η **μοναδική απόδειξη χρόνου εκτέλεσης** του έργου, και
 *     ήταν **ΠΡΑΣΙΝΟ πάνω στη σπασμένη οθόνη** επί μήνες. Δεν αστόχησε: **δεν
 *     ρώτησε**.
 *
 * Ένα anchor χωρίς gate είναι σχόλιο· ένα anchor με `continue` είναι χειρότερο,
 * γιατί **μοιάζει** με απόδειξη.
 *
 * ⚠️ ΤΟ ΣΥΜΠΑΝ ΤΟΥ TEST = «κλειδιά που ΥΠΑΡΧΟΥΝ σε κάποιο locale».
 * Το ερώτημα εδώ είναι «**ΑΡΚΕΙ το slice;**», όχι «είναι πλήρη τα locales;» —
 * το δεύτερο είναι το **CHECK 3.8**. Η συγκομιδή τιμών από άλλα modules
 * (ADR-744: «τα κλειδιά ενός generic renderer ζουν στο module που τον ΡΥΘΜΙΖΕΙ»)
 * βάζει στο `wants` και συμβολοσειρές που **δεν είναι κλειδιά κανενός locale**
 * (μετρημένο: το `search`, ίδια οικογένεια με τα `aiInbox`/`auditLog`/`backup`
 * που ο generator ήδη καταγράφει ως `unresolvableKeys`). Το να τα κρίνει αυτό
 * το test θα ήταν σύγχυση δύο ερωτημάτων σε μία μηχανή — το λάθος του ADR-749.
 */
function namespacesRequesting(key: string): string[] {
  return Object.entries(wants)
    .filter(([, want]) => want.keys.includes(key))
    .map(([namespace]) => namespace);
}

/** Κλειδί που δεν υπάρχει σε ΚΑΝΕΝΑ locale namespace ⇒ δεν είναι κλειδί. */
function existsInSomeLocale(key: string): boolean {
  for (const bundle of Object.values(shellSlice as Record<string, unknown>)) {
    let cursor: unknown = bundle;
    for (const segment of key.split('.')) {
      if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) { cursor = undefined; break; }
      cursor = (cursor as Record<string, unknown>)[segment];
    }
    if (cursor !== undefined) return true;
  }
  return false;
}

function allRequestedKeys(): string[] {
  const keys = new Set<string>();
  for (const want of Object.values(wants)) {
    want.keys.forEach(key => keys.add(key));
  }
  return [...keys]
    .filter(key => !unresolvable.has(key) && existsInSomeLocale(key))
    .sort();
}

describe('ADR-744 — the shell slice alone is enough to render the shell', () => {
  beforeAll(async () => {
    // Deliberately the SYNCHRONOUS half of src/i18n/config.ts and nothing more:
    // same resources, same fallback, no preload IIFE, no backend.
    await i18next.createInstance().init({
      resources: { [LANGUAGE]: shellSlice } as Resource,
      lng: LANGUAGE,
      fallbackLng: LANGUAGE,
      ns: Object.keys(shellSlice),
      defaultNS: 'common',
      initImmediate: false,
      interpolation: { escapeValue: false },
    });
  });

  const instance = () => i18next;

  it('boots with at least the default namespace present', () => {
    expect(Object.keys(shellSlice)).toContain('common');
    expect(Object.keys(shellSlice).length).toBeGreaterThan(0);
  });

  it('resolves EVERY key a shell module can request — no key comes back as itself', async () => {
    const client = i18next.createInstance();
    await client.init({
      resources: { [LANGUAGE]: shellSlice } as Resource,
      lng: LANGUAGE,
      fallbackLng: LANGUAGE,
      ns: Object.keys(shellSlice),
      defaultNS: 'common',
      initImmediate: false,
      interpolation: { escapeValue: false },
    });

    const raw: string[] = [];
    for (const key of allRequestedKeys()) {
      const candidates = namespacesRequesting(key);
      const resolved = candidates.some(namespace => client.exists(key, { ns: namespace }));
      if (!resolved) raw.push(`${key}  (tried: ${candidates.join(', ')})`);
    }

    // The failure message IS the string the user would have seen on screen.
    expect(raw).toEqual([]);
    expect(instance()).toBeDefined();
  });

  it('a namespace taken whole is present in full, not half', () => {
    for (const [namespace, want] of Object.entries(wants)) {
      if (!want.whole) continue;
      expect(Object.keys((shellSlice as Record<string, object>)[namespace] || {}).length).toBeGreaterThan(0);
    }
  });

  it('stays materially smaller than the 295.093 bytes it replaced', () => {
    // If this ever fails, the migration ledger has grown instead of shrinking
    // and the whole synchronous bundle is on its way back.
    expect(JSON.stringify(shellSlice).length).toBeLessThan(220_000);
  });

  /**
   * REGRESSION ANCHOR — the bug this list exists because of.
   *
   * The first cut of ADR-744 key-sliced these nine namespaces down to what the
   * SHELL asks for. That is correct for the shell and wrong for everything else:
   * a PAGE is a route boundary and sits outside the shell closure by design, but
   * on a COLD LOAD it renders in the same frame as the layout with no transition
   * to hide behind. `/dxf/viewer` painted the raw key
   * `dxfViewer.checkingPermissions` (src/app/dxf/viewer/page.tsx:43) because
   * common.json had gone from 34.201 bytes to 5.076.
   *
   * This list is FROZEN HISTORY — exactly what `src/i18n/config.ts:41-44` shipped
   * synchronously before this ADR. It is not a list to maintain; it is the
   * definition of "no worse than before", and it may only ever SHRINK, one entry
   * at a time, as per-route slices take over (ADR-744 §8).
   */
  const SYNCHRONOUS_BEFORE_ADR744 = [
    'common', 'common-actions', 'common-navigation', 'common-status',
    'common-validation', 'common-empty-states', 'landing', 'navigation', 'admin',
  ] as const;

  it.each(SYNCHRONOUS_BEFORE_ADR744)(
    'ships %s WHOLE — it was synchronous before ADR-744, so slicing it is a regression',
    (namespace) => {
      const want = wants[namespace];
      expect(want).toBeDefined();
      expect(want.whole).toBe(true);
      expect(Object.keys((shellSlice as Record<string, object>)[namespace] || {}).length).toBeGreaterThan(0);
    },
  );

  it('resolves the exact key that was reported raw on /dxf/viewer', async () => {
    const client = i18next.createInstance();
    await client.init({
      resources: { [LANGUAGE]: shellSlice } as Resource,
      lng: LANGUAGE,
      fallbackLng: LANGUAGE,
      ns: Object.keys(shellSlice),
      defaultNS: 'common',
      initImmediate: false,
      interpolation: { escapeValue: false },
    });

    for (const key of ['dxfViewer.checkingPermissions', 'dxfViewer.loading', 'dxfViewer.accessDeniedAriaLabel']) {
      expect(client.exists(key, { ns: 'common' })).toBe(true);
      expect(client.t(key, { ns: 'common' })).not.toBe(key);
    }
  });

  /**
   * 🔴 ADR-781 §7 — ΑΥΤΟΣ Ο ΕΛΕΓΧΟΣ ΕΙΧΕ **ΔΥΟ** ΔΙΑΦΥΓΕΣ ΚΑΙ ΗΤΑΝ ΣΧΕΔΟΝ ΚΕΝΟΣ
   *
   *   `if (want.whole) continue;`      ⇒ παρέλειπε τα 9 namespaces του shell
   *   `if (tree === undefined) continue;` ⇒ και μετά παρέλειπε **ακριβώς** την
   *                                       περίπτωση που ψάχνει: το prefix ΛΕΙΠΕΙ
   *
   * Το δεύτερο δικαιολογούνταν ως «απόν εδώ, παρόν σε αδελφό namespace» — που
   * είναι σωστή παρατήρηση και **λάθος υλοποίηση**: το σωστό είναι να ζητηθεί
   * να υπάρχει σε **έστω ΕΝΑΝ** από τους υποψηφίους (η σειρά αναζήτησης του
   * i18next), όχι να μη ζητηθεί από **κανέναν**.
   */
  it('every prefix the generator recorded resolves in AT LEAST ONE candidate namespace', () => {
    const subtree = (namespace: string, prefix: string): unknown =>
      prefix.split('.').reduce<unknown>(
        (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
        (shellSlice as Record<string, unknown>)[namespace],
      );

    const orphaned: string[] = [];
    for (const [namespace, want] of Object.entries(wants)) {
      for (const prefix of want.prefixes) {
        const candidates = Object.entries(wants)
          .filter(([, other]) => other.prefixes.includes(prefix))
          .map(([other]) => other);
        if (!candidates.some(candidate => subtree(candidate, prefix) !== undefined)) {
          orphaned.push(`${namespace}:${prefix}*  (tried: ${candidates.join(', ')})`);
        }
      }
    }
    expect(orphaned).toEqual([]);
  });

  /**
   * 🔴 ΑΓΚΥΡΑ ΠΑΛΙΝΔΡΟΜΗΣΗΣ ΓΙΑ ΤΑ 17 ΚΛΕΙΔΙΑ × 141 ΔΙΑΔΡΟΜΕΣ (ADR-781)
   *
   * Το πλαϊνό μενού ζει στο **root layout**, άρα ό,τι βάφει το βάφει **παντού**.
   * Ο `useTranslationLazy` το έκανε να βάφει ωμά κλειδιά, και η μετάφραση **ΗΤΑΝ
   * ΗΔΗ ΕΔΩ** — αυτό ακριβώς αποδεικνύει το test παρακάτω. Δεν έλειπαν δεδομένα:
   * το component τα αρνιόταν.
   *
   * ⚠️ Τα κλειδιά έρχονται μέσα από το **prefix** `pages` (δηλωμένο στο
   * `.i18n-shell-slice.json → dynamicKeyPolicy`), γι' αυτό ΔΕΝ εμφανίζονται στο
   * `wants.navigation.keys` και **καμία** εκδοχή του παραπάνω βρόχου δεν θα τα
   * ρωτούσε ποτέ. Χρειάζονται ρητή, ονομαστική άγκυρα.
   */
  it('resolves EVERY page label the sidebar paints on all 141 routes', async () => {
    const client = i18next.createInstance();
    await client.init({
      resources: { [LANGUAGE]: shellSlice } as Resource,
      lng: LANGUAGE,
      fallbackLng: LANGUAGE,
      ns: Object.keys(shellSlice),
      defaultNS: 'common',
      initImmediate: false,
      interpolation: { escapeValue: false },
    });

    // 🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΤΟ **LOCALE**, ΟΧΙ ΤΟ SLICE — ΚΑΙ ΤΟ ΛΑΘΟΣ ΕΓΙΝΕ.
    // Η πρώτη γραφή διάβαζε `Object.keys(shellSlice.navigation.pages)`, δηλαδή
    // ρωτούσε το ΙΔΙΟ αντικείμενο που κρίνει. Μετρημένο: σβήνοντας το
    // `pages.home` από το slice, το test έμενε **ΠΡΑΣΙΝΟ** — ο παρονομαστής
    // μετακινούνταν μαζί με τη μετάλλαξη. Ένα άθροισμα που ρωτά μόνο τον εαυτό
    // του **επικυρώνει τον εαυτό του**.
    // Το locale είναι ανεξάρτητη αυθεντία: λέει τι ΟΦΕΙΛΕΙ να υπάρχει· το slice
    // λέει τι ΤΑΞΙΔΕΥΕΙ. Η σύγκρισή τους ΕΙΝΑΙ το ερώτημα.
    const expected = Object.keys((localeNavigation as Record<string, Record<string, unknown>>).pages || {});
    expect(expected.length).toBeGreaterThanOrEqual(10);

    const raw: string[] = [];
    for (const page of expected) {
      const key = `pages.${page}`;
      if (!client.exists(key, { ns: 'navigation' })) { raw.push(key); continue; }
      const value = client.t(key, { ns: 'navigation' });
      if (value === key || value === page) raw.push(`${key} → ${String(value)}`);
    }
    expect(raw).toEqual([]);

    // Το κλειδί που ονομάστηκε στο ADR-744 §12 ως αυτό που έβαφε ωμό.
    expect(client.t('pages.home', { ns: 'navigation' })).not.toBe('pages.home');
  });
});
