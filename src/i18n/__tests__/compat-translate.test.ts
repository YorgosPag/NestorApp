/**
 * ΑΓΚΥΡΕΣ — η δίπορτη αναζήτηση του compat στρώματος (ADR-798 §13).
 *
 * ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ Η ΜΙΣΗ ΔΟΥΛΕΙΑ. Δεν αρκεί «το `esco.badge` λύνεται»:
 * κλειδώνεται εξίσου ότι ο **στόχος κρατά την προτεραιότητά του** (αλλιώς η
 * επόμενη «απλοποίηση» θα αντέστρεφε τη σειρά και θα άλλαζε σιωπηλά 149 ορατά
 * κείμενα) και ότι το αρχικό **δεν ρωτιέται καν** όταν ο στόχος απαντά.
 *
 * ⚠️ Τα Π τρέχουν πάνω στα **ΠΡΑΓΜΑΤΙΚΑ** locale JSON και στον **ΠΡΑΓΜΑΤΙΚΟ**
 * `remapLegacyTranslationKey` — όχι σε fixture. Ένα fixture θα αποδείκνυε ότι ο
 * κώδικας κάνει ό,τι νομίζω· τα πραγματικά δεδομένα αποδεικνύουν ότι κάνει ό,τι
 * χρειάζεται **αυτό** το δέντρο.
 */

import fs from 'fs';
import path from 'path';
import { createCompatibleTranslate, type TranslateAdapter } from '../compat-translate';
import { getExplicitNamespace } from '../namespace-compat';

// ---------------------------------------------------------------------------
// Ένας μεταφραστής που μιμείται ΑΚΡΙΒΩΣ το συμβόλαιο αστοχίας του i18next:
// όταν το κλειδί λείπει, επιστρέφεται το **γυμνό** κλειδί (χωρίς πρόθεμα ns).
// Αυτό ακριβώς το συμβόλαιο κάνει το `isUnresolvedTranslation` μη τετριμμένο.
// ---------------------------------------------------------------------------
const LOCALES = path.join(process.cwd(), 'src/i18n/locales/el');
const cache = new Map<string, Record<string, unknown> | null>();

function loadNs(ns: string): Record<string, unknown> | null {
  if (cache.has(ns)) return cache.get(ns) ?? null;
  const p = path.join(LOCALES, `${ns}.json`);
  let v: Record<string, unknown> | null = null;
  if (fs.existsSync(p)) v = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
  cache.set(ns, v);
  return v;
}

function at(root: Record<string, unknown> | null, dotted: string): unknown {
  let cur: unknown = root;
  for (const part of dotted.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Καταγράφει ΚΑΘΕ κλειδί που ζητήθηκε — έτσι αποδεικνύεται και το «δεν ρωτήθηκε». */
const asked: string[] = [];

const realStoreTranslate: TranslateAdapter = (...args) => {
  const key = String(args[0]);
  asked.push(key);
  const { namespace, bareKey } = getExplicitNamespace(key);
  const value = at(loadNs(namespace ?? 'common'), bareKey);
  return typeof value === 'string' ? value : bareKey;   // ← το συμβόλαιο του i18next
};

const t = createCompatibleTranslate(realStoreTranslate);
beforeEach(() => { asked.length = 0; });

// ===========================================================================
describe('Π — πραγματικά δεδομένα: τα δύο κλειδιά που ζωγραφίζονταν ωμά', () => {
  it('Π1: `contacts:esco.badge` λύνεται (έμεινε πίσω στο αρχικό ns)', () => {
    expect(t('contacts:esco.badge')).toBe('ESCO');
  });

  it('Π2: `contacts:common.clear` λύνεται', () => {
    expect(t('contacts:common.clear')).toBe('Καθαρισμός');
  });

  it('Π3: ΠΑΡΟΝΟΜΑΣΤΗΣ — ο στόχος του remap ΟΝΤΩΣ δεν έχει το κλειδί', () => {
    // Χωρίς αυτό, τα Π1/Π2 θα μπορούσαν να είναι πράσινα επειδή δεν υπήρξε ποτέ βλάβη.
    expect(at(loadNs('contacts-relationships'), 'esco.badge')).toBeUndefined();
    expect(at(loadNs('contacts-core'), 'common.clear')).toBeUndefined();
    expect(at(loadNs('contacts'), 'esco.badge')).toBe('ESCO');
  });

  it('Π4: ΠΑΡΟΝΟΜΑΣΤΗΣ — μία μόνο πόρτα ΑΠΟΤΥΓΧΑΝΕΙ στα ίδια κλειδιά', () => {
    // Η παλιά συμπεριφορά, αναπαραγμένη: remap άνευ όρων, καμία δεύτερη ερώτηση.
    const oneDoor = (key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { remapLegacyTranslationKey } = require('../namespace-compat');
      const r = remapLegacyTranslationKey(key, undefined);
      return realStoreTranslate(r.key, r.options);
    };
    expect(oneDoor('contacts:esco.badge')).toBe('esco.badge');
    expect(oneDoor('contacts:common.clear')).toBe('common.clear');
  });

  it('Π5: τα ΤΡΙΑ αδέλφια που ΟΝΤΩΣ μετακόμισαν μένουν σωστά', () => {
    expect(t('contacts:esco.searchResults')).toBe('Αποτελέσματα αναζήτησης');
    expect(t('contacts:esco.noResults')).toBe('Δεν βρέθηκαν επαγγέλματα');
    expect(t('contacts:esco.useFreeText')).toBe('Χρήση ελεύθερου κειμένου');
  });
});

// ===========================================================================
describe('Κ — το συμβόλαιο της δίπορτης αναζήτησης', () => {
  it('Κ1: ο ΣΤΟΧΟΣ κρατά την προτεραιότητα — το αρχικό ΔΕΝ ρωτιέται καν', () => {
    // `contacts:esco.searchResults` υπάρχει στον στόχο ⇒ μία μόνο ερώτηση.
    t('contacts:esco.searchResults');
    expect(asked).toEqual(['contacts-relationships:esco.searchResults']);
  });

  it('Κ2: σε αστοχία στόχου, ρωτιέται το ΑΡΧΙΚΟ — με τη σωστή σειρά', () => {
    t('contacts:esco.badge');
    expect(asked).toEqual(['contacts-relationships:esco.badge', 'contacts:esco.badge']);
  });

  it('Κ3: χωρίς remap, ΜΙΑ μόνο αναζήτηση — ΑΚΟΜΑ ΚΑΙ ΣΕ ΑΣΤΟΧΙΑ', () => {
    // ⚠️ Η ΑΣΤΟΧΙΑ ΕΙΝΑΙ Η ΜΙΣΗ ΑΓΚΥΡΑ, ΚΑΙ ΤΟ ΕΔΕΙΞΕ ΜΕΤΑΛΛΑΞΗ. Η πρώτη γραφή
    // ρωτούσε μόνο κλειδί που **λύνεται**: εκεί η δίπορτη λογική επιστρέφει
    // ούτως ή άλλως στην πρώτη ερώτηση, οπότε το σβήσιμο της συντόμευσης
    // «κανένα remap» έμενε **ΠΡΑΣΙΝΟ**. Το κλειδί που **αστοχεί** είναι το μόνο
    // που ξεχωρίζει τη συντόμευση από την απουσία της.
    t('auth:login.title');
    expect(asked).toHaveLength(1);

    asked.length = 0;
    t('auth:δενΥπάρχειΤέτοιοΚλειδί');
    expect(asked).toEqual(['auth:δενΥπάρχειΤέτοιοΚλειδί']);
  });

  it('Κ4: όταν αστοχούν ΚΑΙ ΟΙ ΔΥΟ, ρωτιούνται ΚΑΙ ΤΑ ΔΥΟ και βγαίνει ωμό κλειδί', () => {
    // Ίδια σημασιολογία αστοχίας με πριν — το ίχνος δεν αλλάζει για τον διαγνώστη.
    //
    // ⚠️ **ΔΗΛΩΜΕΝΗ ΙΣΟΔΥΝΑΜΗ ΜΕΤΑΛΛΑΞΗ**: το τελικό `return viaCompat` μπορεί να
    // γίνει `return viaOriginal` **χωρίς να κοκκινίσει τίποτα**, και αυτό ΔΕΝ
    // είναι κενό δικτύου — είναι **ιδιότητα του i18next**: σε αστοχία επιστρέφει
    // το **γυμνό** κλειδί (ADR-635 Φ C.23), το οποίο είναι **η ίδια συμβολοσειρά**
    // και για τα δύο ερωτήματα, αφού το remap αλλάζει μόνο το πρόθεμα namespace.
    // Δεν υπάρχει είσοδος που να τα ξεχωρίζει· μια άγκυρα που θα το «έπιανε» θα
    // απαιτούσε ψεύτικο μεταφραστή που **δεν** τηρεί το συμβόλαιο του i18next,
    // δηλαδή θα δοκίμαζε κόσμο που δεν υπάρχει.
    const out = t('contacts:esco.δενΥπάρχειΠοτέ');
    expect(out).toBe('esco.δενΥπάρχειΠοτέ');
    expect(asked).toEqual([
      'contacts-relationships:esco.δενΥπάρχειΠοτέ',
      'contacts:esco.δενΥπάρχειΠοτέ',
    ]);
  });

  it('Κ5: κλειδί που ΔΕΝ είναι συμβολοσειρά περνά ανέπαφο, χωρίς remap', () => {
    const spy: TranslateAdapter = (...a) => JSON.stringify(a[0]);
    const wrapped = createCompatibleTranslate(spy);
    expect(wrapped(['a', 'b'])).toBe('["a","b"]');
  });

  it('Κ6: το τρίτο όρισμα διατηρείται ΚΑΙ ΣΤΙΣ ΔΥΟ πόρτες', () => {
    const seen: unknown[][] = [];
    const spy: TranslateAdapter = (...a) => { seen.push([...a]); return String(a[0]).split(':').pop(); };
    const wrapped = createCompatibleTranslate(spy);
    wrapped('contacts:esco.badge', { count: 1 }, 'THIRD');
    expect(seen).toHaveLength(2);
    expect(seen[0][2]).toBe('THIRD');
    expect(seen[1][2]).toBe('THIRD');
  });

  it('Κ7: ΔΗΛΩΜΕΝΟ ΟΡΙΟ — αντικείμενο από τον στόχο μετράει ως ΑΠΑΝΤΗΣΗ', () => {
    // `dxf-viewer:calibration.sceneStatus` είναι string στο αρχικό, ΑΝΤΙΚΕΙΜΕΝΟ στον
    // στόχο. Δεν είναι «ανεπίλυτο», άρα η συμπεριφορά μένει ΑΚΡΙΒΩΣ όπως πριν.
    // Αυτό είναι ΑΛΛΟ ελάττωμα (σκίαση τύπου) και κλειδώνεται εδώ ώστε να μη
    // «διορθωθεί» κατά λάθος από αυτόν τον μηχανισμό.
    const objTranslate: TranslateAdapter = (...args) => {
      const key = String(args[0]);
      asked.push(key);
      if (key.startsWith('dxf-viewer-wizard:')) return { title: 'Κατάσταση Σκηνής' };
      return key.split(':').pop();
    };
    const wrapped = createCompatibleTranslate(objTranslate);
    expect(wrapped('dxf-viewer:calibration.sceneStatus')).toEqual({ title: 'Κατάσταση Σκηνής' });
    expect(asked).toHaveLength(1);   // το αρχικό ΔΕΝ ρωτήθηκε
  });

  it('Κ8: κενή συμβολοσειρά από τον στόχο ΔΕΝ θεωρείται αστοχία', () => {
    const empty: TranslateAdapter = (...args) => {
      asked.push(String(args[0]));
      return args[0] === 'contacts-relationships:esco.badge' ? '' : 'ΑΡΧΙΚΟ';
    };
    expect(createCompatibleTranslate(empty)('contacts:esco.badge')).toBe('');
    expect(asked).toHaveLength(1);
  });
});

// ===========================================================================
describe('Λ — η ΚΛΑΣΗ, όχι το δείγμα', () => {
  /**
   * Κάθε κλειδί που **έμεινε πίσω** σε legacy namespace κάτω από χαρτογραφημένη
   * ρίζα πρέπει να είναι προσιτό. Η λίστα ΠΑΡΑΓΕΤΑΙ από τα ίδια τα locale —
   * χειρόγραφη λίστα θα σάπιζε σιωπηλά (σχήμα CHECK 3.34).
   */
  function stragglers(): string[] {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { remapLegacyTranslationKey } = require('../namespace-compat');
    const out: string[] = [];
    const flat = (node: unknown, prefix: string, acc: string[]): string[] => {
      if (node === null || typeof node !== 'object' || Array.isArray(node)) { acc.push(prefix); return acc; }
      for (const k of Object.keys(node as Record<string, unknown>)) {
        flat((node as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k, acc);
      }
      return acc;
    };
    for (const file of fs.readdirSync(LOCALES)) {
      if (!file.endsWith('.json')) continue;
      const ns = file.slice(0, -5);
      const json = loadNs(ns);
      if (!json) continue;
      for (const bare of flat(json, '', [])) {
        const full = `${ns}:${bare}`;
        const r = remapLegacyTranslationKey(full, undefined) as { key: string };
        if (r.key === full) continue;                       // δεν χαρτογραφείται
        if (typeof at(json, bare) !== 'string') continue;    // μόνο συμβολοσειρές
        const target = r.key.slice(0, r.key.indexOf(':'));
        if (typeof at(loadNs(target), bare) === 'string') continue;  // μετακόμισε κανονικά
        out.push(full);
      }
    }
    return out;
  }

  it('Λ1: υπάρχουν όντως κλειδιά που έμειναν πίσω (ο ΠΑΡΟΝΟΜΑΣΤΗΣ της Λ2)', () => {
    // Αν αυτό πέσει στο μηδέν, η Λ2 γίνεται κενή και θα περνούσε «επειδή δεν κοίταξε».
    expect(stragglers().length).toBeGreaterThan(50);
  });

  it('Λ2: ΚΑΝΕΝΑ από αυτά δεν ζωγραφίζεται ωμό', () => {
    const raw = stragglers().filter((full) => {
      const bare = full.slice(full.indexOf(':') + 1);
      const out = t(full);
      return out === bare || out === full;
    });
    expect(raw).toEqual([]);
  });
});
