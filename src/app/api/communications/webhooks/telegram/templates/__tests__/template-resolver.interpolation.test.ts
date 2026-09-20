/**
 * ΑΓΚΥΡΑ ADR-869 §13 — ο resolver ΑΝΤΙΚΑΘΙΣΤΑ ό,τι γράφουν τα locale JSON.
 *
 * 🔴 Το περιστατικό: ο resolver έκανε `replace(/\{\{(\w+)\}\}/g, …)` — δηλαδή έψαχνε
 * **διπλά** άγκιστρα. Τα ίδια τα `locales/{el,en}/telegram.json` όμως γράφουν **μονά**
 * (`"Βρέθηκαν {count} ακίνητα"`), γιατί αυτό **απαιτεί** η CHECK 3.9 (ICU). Άρα καμία
 * παράμετρος δεν αντικαθίστατο ποτέ και ο πελάτης έβλεπε ωμό `{count}` στο Telegram.
 *
 * Δύο κανόνες που ήταν και οι δύο σωστοί, και κανείς δεν τους έβαλε στο ίδιο δωμάτιο.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { TelegramTemplateResolver } from '../template-resolver';

describe('TelegramTemplateResolver — ΜΙΑ σύμβαση παρεμβολής (ADR-869 §13)', () => {
  it('🔴 αντικαθιστά τα ΜΟΝΑ άγκιστρα που γράφουν τα locale JSON', () => {
    const resolver = new TelegramTemplateResolver('el');

    const text = resolver.getText('search.results.found', { count: 5 });

    expect(text).toBe('Βρέθηκαν 5 ακίνητα');
    expect(text).not.toContain('{');
  });

  it('παράμετρος που λείπει αφήνει το μοτίβο ορατό — δεν γίνεται «undefined»', () => {
    const resolver = new TelegramTemplateResolver('el');

    expect(resolver.getText('search.results.found')).toBe('Βρέθηκαν {count} ακίνητα');
  });

  it('πολλαπλές παράμετροι στην ίδια πρόταση', () => {
    const resolver = new TelegramTemplateResolver('el');

    expect(resolver.getText('search.results.showing', { shown: 3, total: 12 })).toBe(
      'Εμφάνιση 3 από 12',
    );
  });

  it('🔴 ΚΑΝΕΝΑ κλειδί των δύο locale δεν χρησιμοποιεί διπλά άγκιστρα', () => {
    // Αν κάποιος «διορθώσει» ένα JSON σε `{{x}}` για να ταιριάξει με παλιό resolver,
    // η CHECK 3.9 (ICU) θα το χτυπήσει — και αυτός ο έλεγχος το λέει από εδώ.
    const el = JSON.stringify(jest.requireActual('@/i18n/locales/el/telegram.json'));
    const en = JSON.stringify(jest.requireActual('@/i18n/locales/en/telegram.json'));

    expect(el).not.toContain('{{');
    expect(en).not.toContain('{{');
  });
});

/**
 * ΑΓΚΥΡΑ ADR-869 §13.1 — ΚΑΘΕ κλειδί που ζητά ο κώδικας ΥΠΑΡΧΕΙ, και στις δύο γλώσσες.
 *
 * 🔴 **Γιατί χρειάζεται**: το `getText()` σε ανύπαρκτο κλειδί **δεν πετά** — καταγράφει
 * `MISSING_KEY` στον server και επιστρέφει το γενικό «Παρουσιάστηκε σφάλμα». Δηλαδή ένα
 * τυπογραφικό σε κλειδί δίνει στον πελάτη **λάθος μήνυμα** χωρίς κανένα ορατό σημάδι —
 * ακριβώς το σχήμα «πράσινο επειδή κανείς δεν κοίταξε».
 */
describe('Κάθε κλειδί του bot υπάρχει και στις δύο γλώσσες (ADR-869 §13.1)', () => {
  const REPO_ROOT = path.resolve(__dirname, '../../../../../../../..');

  /** Κάθε `getText('…')` σε ολόκληρο το δέντρο του Telegram bot. */
  function requestedKeys(): string[] {
    const files = execFileSync(
      'git',
      ['grep', '-l', '--', 'getText(', 'src/app/api/communications/webhooks/telegram'],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    )
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.endsWith('.ts') && !s.includes('__tests__'));

    const keys = new Set<string>();
    for (const rel of files) {
      const source = readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      for (const m of source.matchAll(/getText\(\s*'([^']+)'/g)) keys.add(m[1]);
    }
    return [...keys].sort();
  }

  it('ο παρονομαστής δεν είναι κενός — αλλιώς ο επόμενος έλεγχος είναι κενά πράσινος', () => {
    expect(requestedKeys().length).toBeGreaterThanOrEqual(20);
  });

  /**
   * ⚠️ Η ΠΡΩΤΗ εκδοχή σύγκρινε με το γενικό μήνυμα σφάλματος που επιστρέφει ο resolver —
   * και κατήγγειλε το ίδιο το `errors.generic` ως «λείπει», επειδή η τιμή του **είναι**
   * αυτό το μήνυμα. Ψευδώς θετικό από κατασκευή. Ρωτάμε πλέον **τα δεδομένα**.
   */
  function resolveInLocale(locale: 'el' | 'en', key: string): unknown {
    const data = jest.requireActual(`@/i18n/locales/${locale}/telegram.json`) as Record<string, unknown>;
    return key.split('.').reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      data,
    );
  }

  it.each(['el', 'en'] as const)('καμία απώλεια κλειδιού στο locale «%s»', (locale) => {
    const missing = requestedKeys().filter((key) => {
      const value = resolveInLocale(locale, key);
      return typeof value !== 'string' && !Array.isArray(value);
    });

    expect(missing).toEqual([]);
  });

  it.each(['el', 'en'] as const)('κάθε κλειδί λύνεται και ΜΕΣΩ του resolver στο «%s»', (locale) => {
    const resolver = new TelegramTemplateResolver(locale);

    const broken = requestedKeys().filter((key) => {
      const value = resolveInLocale(locale, key);
      // Πίνακες περνούν από `getList`, όχι από `getText`.
      return typeof value === 'string' && resolver.getText(key) !== value;
    });

    expect(broken).toEqual([]);
  });
});
