/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ: τα μηνύματα επικύρωσης ΦΤΑΝΟΥΝ στην οθόνη (ADR-804 §2)
 * =============================================================================
 *
 * 🔑 **ΤΙ ΚΛΕΙΔΩΝΟΥΝ ΑΥΤΕΣ ΟΙ ΑΓΚΥΡΕΣ**: την **ΙΔΙΟΤΗΤΑ** «κανένα μήνυμα δεν
 * βγαίνει ωμό κλειδί ή `undefined`» — **ΟΧΙ** το κείμενο των μεταφράσεων.
 * Άγκυρα που καρφώνει διατύπωση σπάει σε κάθε αλλαγή copywriting και τελικά
 * διαγράφεται· άγκυρα που κλειδώνει τη **βλάβη** επιβιώνει (μάθημα CHECK 3.50 §Δ).
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΤΟ ΠΑΝ** (ADR-790 §9.1): τα `Π` τρέχουν πάνω στον
 * **ΠΡΑΓΜΑΤΙΚΟ ΠΑΛΙΟ** κώδικα από καρφωμένο commit και απαιτούν να είναι
 * **ΚΟΚΚΙΝΟΣ**. Χωρίς αυτό, το «σήμερα είναι πράσινο» μπορεί να σημαίνει
 * «δεν υπήρξε ποτέ βλάβη», δηλαδή φρουρός χωρίς απόδειξη ζωής.
 *
 * ⚠️ **ΚΑΡΦΩΜΕΝΟ COMMIT, ΠΟΤΕ `HEAD`**: το `HEAD` μετακινείται (κοινό working
 * tree, άλλοι πράκτορες) και τα `Π` θα αυτοακυρώνονταν **σιωπηλά**.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import i18next from 'i18next';
import ICU from 'i18next-icu';

import elForms from '@/i18n/locales/el/forms.json';
import enForms from '@/i18n/locales/en/forms.json';

const REPO = path.resolve(__dirname, '../../..');
/** ⚠️ ΚΑΡΦΩΜΕΝΟ — ο γονέας της διόρθωσης. ΠΟΤΕ `HEAD`. */
const BEFORE_FIX = 'bdd213f6';
const FILE = 'src/utils/validation.ts';

/** Διαβάζει αρχείο από συγκεκριμένο commit· **σκάει** σε κενή απάντηση. */
function gitShow(commit: string, file: string): string {
  const out = execFileSync('git', ['show', `${commit}:${file}`], {
    cwd: REPO, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (!out || out.trim().length === 0) {
    throw new Error(`gitShow κενό για ${commit}:${file} — η άγκυρα θα ήταν ψευδώς πράσινη`);
  }
  return out;
}

const readCurrent = (): string => gitShow('HEAD', FILE);

/** Τα κλειδιά που ζητά το `validationRules`, διαβασμένα ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ. */
function requestedKeys(src: string): string[] {
  return [...src.matchAll(/getValidationMessage\('([^']+)'/g)].map((m) => m[1]);
}

const dig = (obj: unknown, dotted: string): unknown =>
  dotted.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], obj);

describe('ADR-804 §2 — τα μηνύματα επικύρωσης φτάνουν στην οθόνη', () => {
  const current = require('fs').readFileSync(path.join(REPO, FILE), 'utf8') as string;

  // ---------------------------------------------------------------- Π (παρονομαστής)
  describe('Π — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο παλιός κώδικας ΗΤΑΝ σπασμένος', () => {
    const old = gitShow(BEFORE_FIX, FILE);

    it('Π1 — ο παλιός κώδικας ζητούσε ΔΙΠΛΟ πρόθεμα `forms.validation.` μέσα σε ns=forms', () => {
      expect(old).toContain('`forms.validation.${key}`');
      expect(old).toContain("ns: 'forms'");
    });

    it('Π2 — το διπλό πρόθεμα ΔΕΝ λύνεται: το i18next επιστρέφει το ΙΔΙΟ το κλειδί', async () => {
      // ⚠️ Ο παρονομαστής δεν είναι ο κώδικας — είναι το ΑΠΟΤΕΛΕΣΜΑ του i18next.
      // ⚠️ ΠΡΑΓΜΑΤΙΚΟ instance με ΦΟΡΤΩΜΕΝΟ locale: το ακέραιο global i18next
      // επιστρέφει `undefined` για ΚΑΘΕ κλειδί, οπότε η άγκυρα θα «περνούσε»
      // για λόγο άσχετο με τη βλάβη — σφάλμα περιβάλλοντος, όχι απόδειξη.
      const inst = i18next.createInstance();
      await inst.use(ICU).init({
        lng: 'el', resources: { el: { forms: elForms } }, interpolation: { escapeValue: false },
      });
      // το ΣΩΣΤΟ κλειδί λύνεται…
      expect(inst.t('validation.required', { ns: 'forms' })).not.toBe('validation.required');
      // …ενώ το ΠΑΛΙΟ, διπλά προθεματισμένο, γυρίζει πίσω αυτούσιο στην οθόνη
      expect(inst.t('forms.validation.required', { ns: 'forms' })).toBe('forms.validation.required');
    });

    it('Π3 — ο παλιός κώδικας είχε fallback που ΔΕΝ ΜΠΟΡΟΥΣΕ ΝΑ ΠΥΡΟΔΟΤΗΣΕΙ', () => {
      // `try { <object literal return> } catch { … }` ⇒ αδρανής φρουρός (ADR-749 §5)
      expect(old).toContain('getValidationMessagesOnce');
      expect(old).toMatch(/catch\s*\(error\)/);
      // ο πάροχος του `try` επέστρεφε σκέτο literal ⇒ αδύνατο να πετάξει
      const provider = gitShow(BEFORE_FIX, 'src/subapps/dxf-viewer/config/modal-select.ts');
      expect(provider).toMatch(/export function getValidationMessages\(\)\s*\{\s*return \{/);
    });

    it('Π4 — ο παλιός κώδικας είχε ωμά κλειδιά που ΔΕΝ καλούσαν καθόλου i18n', () => {
      expect(old).toContain('`validation.dates.maxYearsAgo`');
      expect(old).toContain('`validation.dates.maxYearsAhead`');
    });
  });

  // ---------------------------------------------------------------- Κ (η θεραπεία)
  describe('Κ — η θεραπεία', () => {
    it('Κ1 — ΚΑΜΙΑ κλήση δεν ξαναγράφει πρόθεμα `forms.` μέσα σε ns=forms', () => {
      expect(current).not.toContain('forms.validation.${key}');
      expect(current).toContain('`validation.${key}`');
    });

    it('Κ2 — ΚΑΝΕΝΑ φάντασμα του νεκρού μονοπατιού δεν έμεινε ΣΕ ΚΩΔΙΚΑ', () => {
      // ⚠️ ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ: το docblock ΤΕΚΜΗΡΙΩΝΕΙ τη βλάβη ονομάζοντάς την,
      // άρα έλεγχος στο ωμό κείμενο κοκκινίζει πάνω στη ΘΕΡΑΠΕΙΑ (σχήμα Κ7β / 3.50).
      const code = current.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, '');
      for (const ghost of ['validationMessages', 'getValidationMessagesOnce', 'ValidationMessagesConfig']) {
        expect(code).not.toContain(ghost);
      }
    });

    it('Κ3 — κανένα ωμό κλειδί: κάθε `validation.*` περνά από τη ΜΙΑ συνάρτηση', () => {
      const code = current.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, '');
      // template literal ή σκέτη συμβολοσειρά «validation.…» ΕΚΤΟΣ της μίας κλήσης
      const raw = [...code.matchAll(/[`'"]validation\.[a-zA-Z.]+[`'"]/g)]
        .map((m) => m[0])
        .filter((s) => !s.includes('${key}'));
      expect(raw).toEqual([]);
    });

    it('Κ4 — ο viewer ΔΕΝ είναι πια πηγή μηνυμάτων της εφαρμογής', () => {
      expect(current).not.toContain('subapps/dxf-viewer');
    });
  });

  // ---------------------------------------------------------------- Λ (λύνονται ΟΛΑ)
  describe('Λ — κάθε ζητούμενο κλειδί λύνεται, σε ΚΑΙ ΤΙΣ ΔΥΟ γλώσσες', () => {
    const keys = requestedKeys(current);

    it('Λ0 — ο πληθυσμός δεν είναι κενός (αλλιώς τα Λ είναι κενά πράσινα)', () => {
      expect(keys.length).toBeGreaterThanOrEqual(20);
    });

    it.each(['el', 'en'])('Λ1 — κάθε κλειδί υπάρχει στο locale «%s»', (lang) => {
      const bundle = lang === 'el' ? elForms : enForms;
      const missing = keys.filter((k) => dig(bundle, `validation.${k}`) === undefined);
      expect(missing).toEqual([]);
    });

    it('Λ2 — με ΠΡΑΓΜΑΤΙΚΟ i18next+ICU κανένα δεν βγαίνει ωμό ή undefined', async () => {
      const inst = i18next.createInstance();
      await inst.use(ICU).init({
        lng: 'el',
        resources: { el: { forms: elForms } },
        interpolation: { escapeValue: false },
      });
      const bad: string[] = [];
      for (const k of keys) {
        const v = inst.t(`validation.${k}`, { ns: 'forms', min: 1, max: 2, length: 3, value: 4, years: 5 });
        if (v === undefined || v === `validation.${k}` || String(v).startsWith('validation.')) bad.push(k);
      }
      expect(bad).toEqual([]);
    });

    it('Λ3 — και τα 5 μηνύματα ημερομηνίας που έβγαιναν `undefined` λύνονται', async () => {
      const inst = i18next.createInstance();
      await inst.use(ICU).init({
        lng: 'el', resources: { el: { forms: elForms } }, interpolation: { escapeValue: false },
      });
      const dates = [
        'dates.birthdateFutureError', 'dates.issueDateFutureError',
        'dates.expiryAfterIssueError', 'dates.pastDateError', 'dates.dateComparisonError',
      ];
      for (const k of dates) {
        const v = inst.t(`validation.${k}`, { ns: 'forms' });
        expect(typeof v).toBe('string');
        expect(v).not.toBe(`validation.${k}`);
        expect((v as string).length).toBeGreaterThan(3);
      }
    });
  });
});
