/**
 * Main i18n configuration with lazy loading support
 * This config now uses lazy loading for better performance
 */

import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import ICU from 'i18next-icu';
import { loadNamespace, CRITICAL_NAMESPACES, type Language, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './lazy-config';
import { remapLegacyTranslationKey } from './namespace-compat';
import { pseudoPostProcessor, PSEUDO_LANGUAGE } from './pseudo-post-processor';

// 🏢 ADR-744: the ONLY locale data imported synchronously — generated, not written.
import shellSlice from './generated/shell-slice.el.json';
// 🏢 ADR-744 §11: which of those namespaces travel WHOLE — also generated (~200 bytes).
import shellWholeNamespaces from './generated/shell-slice.whole.json';
import { recordShellBootstrap } from './bundle-registry';

import { createModuleLogger } from '@/lib/telemetry';
import { safeGetItem, STORAGE_KEYS } from '@/lib/storage';
const logger = createModuleLogger('i18n-config');

/**
 * 🏢 ADR-744 — the synchronous bootstrap is GENERATED, not hand-kept.
 *
 * What used to be here: 18 static JSON imports and a hand-written `resources`
 * literal naming 9 namespaces — 295.093 bytes, 40% of it `admin.json`, which is
 * not on screen at boot. Beside it lived a SECOND hand-written list, the 72
 * `CRITICAL_NAMESPACES` loaded asynchronously below. Nothing compared the two,
 * and they had drifted by 63 entries: any surface using one of those 63 could
 * paint a raw key (`search.globalSearch`) until the await resolved. The strings
 * existed — they had not arrived.
 *
 * What is here now: the static import closure of the app's layouts (and the
 * cold-entry route), sliced at KEY granularity. The shell needs `search.*` out
 * of `common-shared` — about 400 bytes of its 39.935 — so that is what ships.
 * **295.093 → 184.599 bytes**, and the list is derived from the code instead of
 * remembered, which is what makes the drift structurally impossible rather than
 * merely discouraged.
 *
 * ⚠️ THE NUMBER IS NOT SMALLER BECAUSE OF A DELIBERATE CORRECTION. The nine
 *    namespaces that were 100% synchronous before this ADR are still shipped
 *    WHOLE (173.720 of those bytes). The first cut key-sliced them too, which
 *    was correct for the shell and wrong for everything else: a PAGE is a route
 *    boundary and sits outside the shell closure by design, but on a COLD LOAD
 *    it paints in the SAME FRAME as the layout. `/dxf/viewer` rendered the raw
 *    key `dxfViewer.checkingPermissions` as a result. Per-route slices are what
 *    releases those bytes (ADR-744 §8); until then, whole is the only answer
 *    that is provably no worse than before. The saving that IS real today: the
 *    entire `en` half, 147 KB that could never be read (see below), plus seven
 *    namespaces that were NOT synchronous before and now have their shell keys.
 *
 * ⚠️ DO NOT hand-add a namespace here. Add the `useTranslation(...)` where the
 *    component lives and re-run `npm run generate:i18n-shell-slice`; CHECK 3.34
 *    blocks the commit if the two disagree.
 *
 * ⚠️ `el` ONLY, deliberately. `getInitialLanguage()` returns DEFAULT_LANGUAGE
 *    unconditionally (to avoid an SSR/CSR mismatch) and `fallbackLng` is the
 *    same 'el', so the synchronous `en` half — 147 KB of the old 295 KB — could
 *    never be read before the async preload had already replaced it. A language
 *    switch goes through changeLanguage() → preloadCriticalNamespaces(), which
 *    awaits.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-744-i18n-shell-slice.md
 * @see .i18n-shell-slice.json — shell roots, migration ledger, dynamic-key policy
 */
const resources: Resource = { [DEFAULT_LANGUAGE]: shellSlice };

// Derived, never restated: the namespaces i18next is told about at init are
// exactly the ones the generated slice carries.
const SHELL_NAMESPACES = Object.keys(shellSlice);

// Detect preferred language
const getInitialLanguage = (): Language => {
  // Always start with default language to avoid SSR/CSR mismatch.
  return DEFAULT_LANGUAGE;
};

// Initialize i18n with minimal resources
i18n
  .use(ICU)
  .use(pseudoPostProcessor)
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    debug: false, // Disabled to reduce console noise

    // 🧪 ADR-666: το pseudo παράγεται runtime από το el — δεν έχει resource αρχεία
    postProcess: [PSEUDO_LANGUAGE],

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    // 🏢 ADR-744: derived from the generated slice — one list, no second copy.
    defaultNS: 'common',
    ns: SHELL_NAMESPACES,

    react: {
      useSuspense: false, // Better for lazy loading
    },
  });

/**
 * 🔴 ADR-744 §11 — Ο BOOTSTRAP ΔΗΛΩΝΕΙ ΤΙ ΕΓΡΑΨΕ, ΔΕΝ ΤΟ ΑΦΗΝΕΙ ΝΑ ΜΑΝΤΕΥΤΕΙ.
 *
 * Επτά από τα δεκάξι namespaces του slice μπαίνουν **κομμένα σε επίπεδο
 * κλειδιού** — αυτό είναι το σχέδιο. Το i18next όμως δεν έχει έννοια πληρότητας:
 * μετά από αυτή τη γραμμή, `hasResourceBundle('el','projects')` είναι `true` με
 * **1 από 49** top-level κλειδιά μέσα. Κάθε καταναλωτής που το διάβαζε ως «είναι
 * φορτωμένο» παρέλειπε τη φόρτωση του πλήρους αρχείου οριστικά.
 *
 * Η λίστα των «ολόκληρων» έρχεται από τον generator — καμία χειρόγραφη λίστα δεν
 * επιτρέπεται εδώ, γιατί η απόκλιση δύο χειρόγραφων λιστών είναι ακριβώς το
 * σφάλμα που γέννησε ολόκληρο το ADR-744.
 */
recordShellBootstrap(DEFAULT_LANGUAGE, SHELL_NAMESPACES, shellWholeNamespaces);

// Preload critical namespaces after initialization
if (typeof window !== 'undefined') {
  // Client-side only - 🏢 ENTERPRISE: Immediate preload (no delay)
  (async () => {
    const saved = safeGetItem(STORAGE_KEYS.PREFERRED_LANGUAGE, '');
    const browser = navigator.language.split('-')[0];
    const preferred = (saved || browser) as Language;
    const validLang: Language = SUPPORTED_LANGUAGES.includes(preferred) ? preferred : DEFAULT_LANGUAGE;

    try {
      // 🏢 SSoT: CRITICAL_NAMESPACES lives in lazy-config.ts and is shared with
      // preloadCriticalNamespaces() (language switch). Do not restate it here.
      await Promise.all(
        CRITICAL_NAMESPACES.map(async (ns) => {
          await loadNamespace(ns, validLang);
        })
      );

      if (validLang !== i18n.language) {
        await i18n.changeLanguage(validLang);
      }
    } catch (error) {
      logger.error('Failed to preload namespaces', { error });
    }
  })();
}

export default i18n;


const originalTranslate = i18n.t.bind(i18n);
type TranslateAdapter = (...args: readonly unknown[]) => unknown;

const compatibleTranslate = ((...args: readonly unknown[]) => {
  const [key, arg2, arg3] = args;
  const translate = originalTranslate as unknown as TranslateAdapter;

  if (typeof key !== 'string') {
    return arg3 === undefined
      ? translate(key, arg2)
      : translate(key, arg2, arg3);
  }

  const remapped = remapLegacyTranslationKey(key, arg2);
  return arg3 === undefined
    ? translate(remapped.key, remapped.options)
    : translate(remapped.key, remapped.options, arg3);
}) as unknown as typeof i18n.t;

i18n.t = compatibleTranslate;
