/**
 * Unit tests — τα `card.*` κλειδιά της κάρτας **λύνονται** (ADR-280 compat).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΒΡΕΘΗΚΕ ΣΤΗΝ ΟΘΟΝΗ, ΜΕ ΟΛΕΣ ΤΙΣ ΠΥΛΕΣ ΠΡΑΣΙΝΕΣ (2026-08-09).
 * Το `namespace-compat.ts` ανακατευθύνει **κάθε** κλειδί `card.*` του namespace
 * `properties` στο **`properties-detail`**. Η δουλειά της Α6 πρόσθεσε τα δικά της
 * κλειδιά στο `properties.json` — αρχείο που, γι' αυτά τα κλειδιά, **δεν ρωτιέται
 * ΠΟΤΕ**. Αποτέλεσμα: **11 κλειδιά μονίμως ωμά**, ανάμεσά τους ολόκληρο το
 * `card.price.*`, δηλαδή **ακριβώς οι ετικέτες με τις οποίες η Α6 υποσχέθηκε ότι
 * «η απουσία ονομάζεται»**.
 *
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΤΟ ΕΙΔΕ ΚΑΝΕΙΣ. Το CHECK 3.8 ρωτά «υπάρχει το κλειδί στα locales;»
 * — και **υπήρχε**. Κανείς δεν ρωτούσε «υπάρχει στο locale που θα **ρωτηθεί**;».
 * Και τα τρία `card.price.*` είναι **δομικά μη-προσβάσιμα** από την οθόνη
 * «Διαθέσιμα»: η πύλη εμφάνισης αποκλείει ακριβώς τα ακίνητα που θα τα έδειχναν.
 * Ίδιο σχήμα με το CHECK 3.51 (ωμό κλειδί ενώ **η μετάφραση υπάρχει**).
 *
 * ⚠️ Το test **δεν** αντιγράφει τη χαρτογράφηση: τη **διαβάζει** από τον ίδιο τον
 * compat χάρτη. Αντιγραμμένη λίστα θα ήταν δεύτερη αλήθεια που θα απέκλινε
 * σιωπηλά — το σχήμα που αυτό το αρχείο υπάρχει για να αποτρέψει.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getCompatNamespaces } from '@/i18n/namespace-compat';

/**
 * Κάθε `card.*` κλειδί που ζωγραφίζει η κάρτα ακινήτου, χειρόγραφα.
 * ⚠️ **Δεύτερη φωνή, επίτηδες**: αν παραγόταν από τον ίδιο τον κώδικα που
 * κρίνεται, θα άδειαζε μαζί του και θα έμενε πράσινο (παγίδα «ο παρονομαστής
 * δεν πρέπει να είναι ο κριτής»).
 */
const CARD_KEYS = [
  'card.ariaLabel',
  'card.viewFloorPlan',
  'card.aria.favorite',
  'card.aria.moreDetails',
  'card.aria.propertyActions',
  'card.aria.propertyFeatures',
  'card.aria.propertyInfo',
  'card.aria.propertyPrice',
  'card.aria.propertyStatus',
  'card.aria.propertyTags',
  'card.stats.area',
  'card.stats.bathrooms',
  'card.stats.bedrooms',
  'card.stats.building',
  'card.stats.condition',
  'card.stats.floor',
  'card.stats.price',
  'card.stats.sale',
  'card.stats.rent',
  'card.stats.soldFor',
  'card.stats.askedFor',
  'card.stats.rentValue',
  'card.stats.salePricePerSqm',
  'card.stats.rentPricePerSqm',
  'card.price.notListed',
  'card.price.saleMissing',
  'card.price.rentMissing',
] as const;

const LOCALES = ['el', 'en'] as const;

const localeDir = (locale: string) =>
  path.join(process.cwd(), 'src', 'i18n', 'locales', locale);

function readNamespace(locale: string, namespace: string): Record<string, unknown> {
  const file = path.join(localeDir(locale), `${namespace}.json`);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

function lookup(tree: Record<string, unknown>, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>(
    (node, segment) =>
      node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined,
    tree,
  );
}

/**
 * 🔴 ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΣΥΜΠΕΡΑΣΜΕΝΟ. Το `properties-detail` είναι το namespace στο
 * οποίο **αποδεδειγμένα** λύνονται τα `card.*` — επαληθεύτηκε ζωντανά στη σελίδα
 * `/properties` (2026-08-09): με τα κλειδιά **μόνο** στο `properties.json` η
 * οθόνη έβαφε `card.stats.rentValue` ωμό· με τα ίδια κλειδιά **μόνο** εδώ, βάφει
 * «500 €/μήνα».
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ — ο ΑΚΡΙΒΗΣ μηχανισμός δεν αποδείχθηκε.** Ο χάρτης
 * `namespace-compat.ts` δηλώνει `card: 'properties-detail'` κάτω από το
 * `properties`, αλλά το `remapLegacyTranslationKey` **δεν** ανακατευθύνει σκέτο
 * κλειδί (απαιτεί ρητό πρόθεμα ή `options.ns`) — άρα η διαδρομή περνά από τη
 * σειρά namespaces του `resolveAllNamespaces`, που **δεν ιχνηλατήθηκε πλήρως**.
 * Αυτό δηλώνεται αντί να υπονοηθεί: το test αγκυρώνει το **μετρημένο αποτέλεσμα**,
 * και θα κοκκινίσει αν κάποιος ξαναβάλει τα κλειδιά στο λάθος αρχείο.
 *
 * ⚠️ **ΜΗΝ το χαλαρώσεις σε «ψάξε σε ΟΛΑ τα compat namespaces»**: έτσι γράφτηκε
 * την πρώτη φορά, και ήταν **πράσινο πάνω στο σπασμένο** — γιατί το `properties`
 * ήταν μέσα στη λίστα και τα κλειδιά ήταν εκεί. Ένας παρονομαστής που περιέχει
 * το λάθος δεν μπορεί να το βρει.
 */
const CARD_KEY_NAMESPACE = 'properties-detail';

function candidateNamespaces(_key: string): string[] {
  return [CARD_KEY_NAMESPACE];
}

// =============================================================================
// Κ1 — ΤΟ ΕΛΑΤΤΩΜΑ: κάθε κλειδί λύνεται στο namespace που ΘΑ ρωτηθεί
// =============================================================================

describe('Κ1 — κάθε card.* κλειδί υπάρχει εκεί που το ψάχνει ο resolver', () => {
  it.each(LOCALES)('%s — κανένα ωμό κλειδί', (locale) => {
    const unreachable = CARD_KEYS.filter((key) =>
      candidateNamespaces(key).every(
        (ns) => lookup(readNamespace(locale, ns), key) === undefined,
      ),
    );

    expect(unreachable).toEqual([]);
  });
});

// =============================================================================
// Κ2 — Η ΑΙΤΙΑ, ΟΝΟΜΑΣΤΙΚΑ: ο compat στέλνει το `card.*` αλλού
// =============================================================================

describe('Κ2 — ο compat χάρτης είναι ο λόγος, και δηλώνεται', () => {
  it('το properties-detail παραμένει ενεργό compat namespace του properties', () => {
    // Αν πάψει να είναι, η διαδρομή που μετρήθηκε ζωντανά έχει αλλάξει και τα
    // κλειδιά πρέπει να ξαναεξεταστούν — το test το λέει αντί να το
    // ανακαλύψει χρήστης βλέποντας ωμό κλειδί.
    expect([...getCompatNamespaces('properties')]).toContain(CARD_KEY_NAMESPACE);
  });

  it('🔴 τα κλειδιά ΔΕΝ ζουν πια στο properties.json, όπου δεν ρωτιούνται', () => {
    for (const locale of LOCALES) {
      expect(lookup(readNamespace(locale, 'properties'), 'card')).toBeUndefined();
    }
  });
});

// =============================================================================
// Κ3 — ΤΑ ΔΥΟ LOCALE ΣΥΜΦΩΝΟΥΝ (N.11: αλλιώς τα αγγλικά τρέχουν ελληνικά)
// =============================================================================

describe('Κ3 — el και en έχουν ΤΑ ΙΔΙΑ card.* κλειδιά', () => {
  it('καμία απόκλιση ανάμεσα στις δύο γλώσσες', () => {
    const missingPerLocale = Object.fromEntries(
      LOCALES.map((locale) => [
        locale,
        CARD_KEYS.filter((key) =>
          candidateNamespaces(key).every(
            (ns) => lookup(readNamespace(locale, ns), key) === undefined,
          ),
        ),
      ]),
    );
    expect(missingPerLocale.el).toEqual(missingPerLocale.en);
  });
});
