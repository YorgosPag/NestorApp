/**
 * @fileoverview Η καλωδίωση της παλέτας «Σύνδεση Πινακίδας» (ADR-745 Φ3β).
 *
 * Τρία πράγματα που **δεν** τα πιάνει κανένα άλλο test, και που όταν σπάνε δεν βγάζουν σφάλμα:
 *
 * 1. **Κουμπί χωρίς χειριστή** — το ribbon δηλώνει `action`, ο dispatcher το αγνοεί: το κλικ
 *    απλώς δεν κάνει τίποτα.
 * 2. **Ωμό κλειδί στην οθόνη** — ο ρητός χάρτης δείχνει σε κλειδί που δεν υπάρχει στα locales.
 *    Είναι ακριβώς η βλάβη του ADR-752: τα αρχεία υπήρχαν, οι τύποι υπήρχαν, οι καταναλωτές
 *    υπήρχαν, και η οθόνη έβαφε `titleBlockBinding.fields.employer` — με **όλες** τις πύλες
 *    πράσινες, γιατί καμία δεν ρωτούσε αυτή την ερώτηση.
 * 3. **Απόκλιση el/en** — το ένα locale παίρνει το κλειδί, το άλλο όχι, και η βλάβη εμφανίζεται
 *    μόνο σε γλώσσα που κανείς δεν δοκιμάζει.
 */

import fs from 'fs';
import path from 'path';
import { PROJECT_ROLE_LABEL } from '@/config/project-role-labels';
import type { BindingCandidate } from '@/types/title-block-binding';
import { candidateLabel } from '../proposal-labels';

// __tests__ → title-block-binding → components → ui → dxf-viewer → subapps → src → ρίζα
const ROOT = path.resolve(__dirname, '../../../../../../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const locale = (lang: string) =>
  JSON.parse(read(`src/i18n/locales/${lang}/dxf-viewer-shell.json`)) as Record<string, unknown>;

/** Ακολουθεί μια διαδρομή τύπου `a.b.c` μέσα στο locale· `undefined` όταν λείπει. */
function at(tree: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    tree,
  );
}

const PANEL_DIR = 'src/subapps/dxf-viewer/ui/components/title-block-binding';

/**
 * Κάθε αρχείο της παλέτας που γράφει κλειδί i18n ή συνθέτει ετικέτα.
 *
 * ⚠️ Μία λίστα για **όλους** τους ελέγχους αυτού του αρχείου. Υπήρχαν δύο, με διαφορετικό
 * περιεχόμενο — και η μία είχε μείνει στα 2 από τα 6 αρχεία. Δύο λίστες για το ίδιο ερώτημα
 * αποκλίνουν: είναι το σχήμα των δύο λιστών namespace του CHECK 3.34.
 *
 * 🔴 **Boy scout 2026-08-05 (ADR-759 Φ1): η λίστα ΠΑΡΑΓΕΤΑΙ πλέον, δεν γράφεται.** Ήταν έξι
 * χειρόγραφες διαδρομές με σχόλιο που παρακαλούσε τον επόμενο να τις συντηρήσει — και η Φ1
 * πρόσθεσε **δύο** αρχεία που γράφουν κλειδιά. Ο φύλακας θα έμενε πράσινος κοιτάζοντας το
 * **75%** του φακέλου, ακριβώς όπως είχε ήδη συμβεί μία φορά με τα 2/6. Οδηγία σε σχόλιο δεν
 * είναι πύλη (CHECK 3.37): το αρχείο που μπαίνει στον φάκελο μπαίνει και στον έλεγχο.
 */
const PALETTE_SOURCES: readonly string[] = [
  ...fs
    .readdirSync(path.join(ROOT, PANEL_DIR))
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => `${PANEL_DIR}/${name}`),
  'src/subapps/dxf-viewer/ui/components/TitleBlockBindingPalette.tsx',
];

/** Τα κλειδιά που όντως γράφει ο κώδικας — διαβασμένα από το αρχείο, όχι ξαναγραμμένα εδώ. */
function declaredKeys(): string[] {
  // ⚠️ Η λίστα πρέπει να καλύπτει **κάθε** αρχείο που γράφει κλειδί. Στη Φ3β το αρχείο
  // χωρίστηκε σε τρία (N.7.1) και οι ετικέτες μετακόμισαν στο `proposal-labels.ts`: με τη
  // σκέτη παλιά λίστα το test θα εξέταζε **7** κλειδιά αντί για 30+, δηλαδή θα έμενε πράσινο
  // κοιτάζοντας σχεδόν τίποτα. Ο φρουρός «δηλώνει κλειδιά» παρακάτω υπάρχει ακριβώς γι' αυτό.
  const sources = PALETTE_SOURCES.map(read).join('\n');
  return [...sources.matchAll(/'(titleBlockBinding\.[A-Za-z0-9.\-_]+)'/g)].map((m) => m[1]);
}

describe('καλωδίωση κουμπιού → ενέργεια', () => {
  it('η ενέργεια του ribbon έχει χειριστή στον dispatcher', () => {
    const ribbon = read('src/subapps/dxf-viewer/ui/ribbon/data/insert-tab.ts');
    const dispatcher = read('src/subapps/dxf-viewer/app/dxf-special-actions.ts');
    expect(ribbon).toContain("action: 'open-title-block-binding'");
    expect(dispatcher).toContain("action === 'open-title-block-binding'");
    expect(dispatcher).toContain('TitleBlockBindingPaletteStore.open()');
  });

  it('η παλέτα είναι όντως τοποθετημένη στο δέντρο, όχι μόνο γραμμένη', () => {
    const dialogs = read('src/subapps/dxf-viewer/app/DxfViewerDialogs.tsx');
    expect(dialogs).toContain('<TitleBlockBindingPalette');
    expect(dialogs).toContain('levelId={levelManager.currentLevelId');
  });

  it('🔴 το fileRecordId φτάνει στην παλέτα ως `?? null` — ΠΟΤΕ `?? \'\'`', () => {
    // Γ2: μηδενίσιμο εκ σχεδιασμού, φτάνει ΑΡΓΟΤΕΡΑ, και είναι μέρος του ντετερμινιστικού
    // κλειδιού. Κενή συμβολοσειρά ⇒ το επόμενο φόρτωμα δεν ξαναβρίσκει τη σύνδεση ⇒ δεύτερο
    // κλικ = ΔΕΥΤΕΡΟ έγγραφο. Το `user?.uid ?? ''` ήταν ο τελευταίος φραγμός του κλικ (§13ι).
    const dialogs = read('src/subapps/dxf-viewer/app/DxfViewerDialogs.tsx');
    expect(dialogs).toContain('fileRecordId={levelManager.fileRecordId ?? null}');
    expect(dialogs).not.toContain("fileRecordId={levelManager.fileRecordId ?? ''}");
  });
});

describe('κλειδιά i18n', () => {
  const el = locale('el');
  const en = locale('en');

  it('ο κώδικας δηλώνει κλειδιά — αλλιώς το test θα περνούσε χωρίς να κοιτάξει τίποτα', () => {
    expect(declaredKeys().length).toBeGreaterThan(15);
  });

  it('🔴 η λίστα πηγών ΠΑΡΑΓΕΤΑΙ και δεν είναι κολοβή', () => {
    // Ο φρουρός του παραγωγού: ένα `readdirSync` που δείχνει σε λάθος φάκελο επιστρέφει κενό
    // και **όλοι** οι έλεγχοι από κάτω γίνονται δωρεάν αληθείς — «0 = κανείς δεν κοίταξε».
    expect(PALETTE_SOURCES.length).toBeGreaterThanOrEqual(7);
    expect(PALETTE_SOURCES).toContain(`${PANEL_DIR}/proposal-labels.ts`);
    expect(PALETTE_SOURCES).toContain(`${PANEL_DIR}/TitleBlockPrefillNotice.tsx`);
    expect(PALETTE_SOURCES).toContain(`${PANEL_DIR}/TitleBlockContactCreation.tsx`);
  });

  it.each(['el', 'en'])('🔴 κάθε κλειδί που γράφει ο κώδικας υπάρχει στο %s', (lang) => {
    const tree = lang === 'el' ? el : en;
    const missing = declaredKeys().filter((key) => {
      // Οι πληθυντικοί ζουν ως `key_one` / `key_other` (i18next) — το σκέτο κλειδί δεν υπάρχει.
      if (at(tree, key) !== undefined) return false;
      return at(tree, `${key}_one`) === undefined || at(tree, `${key}_other`) === undefined;
    });
    expect(missing).toEqual([]);
  });

  it('η ετικέτα του κουμπιού υπάρχει και στις δύο γλώσσες', () => {
    expect(at(el, 'ribbon.commands.titleBlockBinding')).toEqual(expect.any(String));
    expect(at(en, 'ribbon.commands.titleBlockBinding')).toEqual(expect.any(String));
  });

  it('🔴 el και en έχουν ΑΚΡΙΒΩΣ τα ίδια κλειδιά — καμία μονόπλευρη προσθήκη', () => {
    const flatten = (node: unknown, prefix = ''): string[] =>
      node && typeof node === 'object'
        ? Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
            v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
          )
        : [];
    expect(flatten(el.titleBlockBinding).sort()).toEqual(flatten(en.titleBlockBinding).sort());
  });

  it('🔴 κανένα δυναμικό t() με πρότυπο κείμενο — ο generator του shell slice αρνείται να παράγει', () => {
    // ⚠️ Τα σχόλια **αφαιρούνται πρώτα**, και όχι από ευγένεια: η πρώτη γραφή αυτού του test
    // κοκκίνιζε επειδή το ίδιο το σχόλιο του κώδικα *έγραφε το απαγορευμένο μοτίβο για να το
    // απαγορεύσει*. Ίδιο σχήμα με την παγίδα του CHECK 3.36, όπου ένα παράδειγμα μέσα σε σχόλιο
    // γέννησε φάντασμα namespace. Ένας φύλακας που δεν ξεχωρίζει κώδικα από κείμενο για
    // ανθρώπους παράγει ψευδώς θετικά — και τα ψευδώς θετικά σκοτώνουν φύλακες.
    const stripComments = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // Boy scout 06/08: ο έλεγχος κάλυπτε **2 από τα 6** αρχεία της παλέτας. Τα υπόλοιπα γράφουν
    // κι αυτά κλειδιά — ένας φύλακας που κοιτάζει το ένα τρίτο δίνει ψευδή ασφάλεια.
    const sources = PALETTE_SOURCES.map(read).map(stripComments).join('\n');
    expect(sources).not.toMatch(/\bt\(\s*`/);
  });
});

/**
 * 🔴 **Το λεξιλόγιο ρόλων έρχεται από ΑΛΛΟ namespace, και γι' αυτό δεν έχει δίχτυ.**
 *
 * Τα κλειδιά φέρουν πρόθεμα `building-address:`. Για προθεματισμένο κλειδί ο resolver πολλαπλών
 * namespaces του ADR-716 Φ5 **βγαίνει αμέσως** (`useTranslation.ts:99`) και το compat στρώμα δεν
 * γνωρίζει το `building-address` — άρα αν ο καταναλωτής δεν δηλώσει το namespace, η οθόνη βάφει
 * **ωμό κλειδί** ενώ η μετάφραση υπάρχει σε δύο γλώσσες. Είναι η βλάβη του ADR-752 ακέραιη.
 *
 * Το mock του `useTranslation` στο `title-block-write-spy.test.tsx` **αγνοεί τα ορίσματά** του,
 * άρα κανένα render test δεν μπορεί να το πιάσει. Ο μόνος τρόπος είναι η πηγή.
 */
describe('λεξιλόγιο ρόλων έργου (building-address)', () => {
  const roleLabelKeys = (): string[] => {
    const source = read('src/config/project-role-labels.ts');
    return [...source.matchAll(/'(building-address:associations\.roles\.[a-z_]+)'/g)].map((m) => m[1]);
  };

  it('ο χάρτης δηλώνει ρόλους — αλλιώς το test θα περνούσε χωρίς να κοιτάξει τίποτα', () => {
    expect(roleLabelKeys().length).toBeGreaterThanOrEqual(7);
  });

  it.each(['el', 'en'])('🔴 κάθε ετικέτα ρόλου υπάρχει στο %s', (lang) => {
    const tree = JSON.parse(
      read(`src/i18n/locales/${lang}/building-address.json`),
    ) as Record<string, unknown>;
    const missing = roleLabelKeys().filter(
      (key) => typeof at(tree, key.replace('building-address:', '')) !== 'string',
    );
    expect(missing).toEqual([]);
  });

  /**
   * ⚠️ **Στατικός έλεγχος δεν αρκεί.** Οι παραπάνω έλεγχοι διαβάζουν πηγή· κανένας δεν
   * **εκτελεί** τη σύνθεση. Χωρίς αυτό, ένα `candidateLabel` που επιστρέφει σκέτο `label` —
   * δηλαδή ακριβώς η βλάβη που διορθώνεται εδώ — θα άφηνε **όλες** τις πύλες πράσινες.
   */
  describe('η σύνθεση εκτελείται', () => {
    /**
     * `t` που διαβάζει τα **ΠΡΑΓΜΑΤΙΚΑ** locale αρχεία και εφαρμόζει ICU-στιλ αντικατάσταση.
     *
     * ⚠️ Ένα mock που επιστρέφει το κλειδί (το ιδίωμα του `write-spy`) **δεν μπορεί** να
     * ελέγξει αυτή τη σύνθεση: το πρότυπο `{name} — {role}` ζει στο locale, όχι στον κώδικα.
     * Διαβάζοντας το αρχείο, ο έλεγχος αποδεικνύει ταυτόχρονα ότι το κλειδί **υπάρχει** και ότι
     * το σχήμα του είναι **ICU** (μονά άγκιστρα — το project χρησιμοποιεί `.use(ICU)`, και τα
     * `{{διπλά}}` θα ήταν σιωπηλά αδρανή).
     */
    const trees: Record<string, Record<string, unknown>> = {
      'building-address': JSON.parse(read('src/i18n/locales/el/building-address.json')),
      'dxf-viewer-shell': locale('el'),
    };
    const fakeT = ((key: string, vars?: Record<string, string>) => {
      const [ns, bare] = key.includes(':')
        ? [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
        : ['dxf-viewer-shell', key];
      const raw = at(trees[ns] ?? {}, bare);
      const text = typeof raw === 'string' ? raw : key;
      return vars
        ? Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), text)
        : text;
    }) as never;

    const contactCandidate: BindingCandidate = {
      target: { kind: 'contact', contactId: 'c1', role: 'surveyor', projectId: 'p1' },
      label: 'Κωνσταντίνος Μαυρομιχάλης',
      evidence: [{ kind: 'name-abbrev', value: 'Κωνσταντίνος Μαυρομιχάλης' }],
    };

    it('🔴 η πρόταση επαφής φέρει ΚΑΙ τον ρόλο — δύο μελετητές έδειχναν ταυτόσημη γραμμή', () => {
      const out = candidateLabel(contactCandidate, fakeT);
      expect(out).toContain('Κωνσταντίνος Μαυρομιχάλης');
      // Η **μεταφρασμένη** ετικέτα, όχι το κλειδί: αν έμενε ωμό το κλειδί, αυτό ακριβώς θα
      // έβαφε η οθόνη — η βλάβη του ADR-752. Το `fakeT` το επιλύει από το πραγματικό locale.
      const translatedRole = (fakeT as (k: string) => string)(PROJECT_ROLE_LABEL.surveyor);
      expect(translatedRole).not.toContain('associations.roles');
      expect(out).toContain(translatedRole);
    });

    it('δύο ρόλοι με ίδιο όνομα δίνουν ΔΙΑΦΟΡΕΤΙΚΕΣ ετικέτες', () => {
      const other: BindingCandidate = {
        ...contactCandidate,
        target: { ...contactCandidate.target, role: 'structural_engineer' } as never,
      };
      expect(candidateLabel(contactCandidate, fakeT)).not.toEqual(candidateLabel(other, fakeT));
    });

    it('ο οικοπεδούχος μένει σκέτος — δεν φέρει ρόλο στον τύπο του', () => {
      const landowner: BindingCandidate = {
        target: {
          kind: 'landowner',
          projectId: 'p1',
          contactId: 'c2',
          acquisitionStatus: 'prospective',
        },
        label: 'Γεωργία Ζέρβα',
        evidence: [],
      };
      expect(candidateLabel(landowner, fakeT)).toBe('Γεωργία Ζέρβα');
    });
  });

  it('🔴 κάθε αρχείο της παλέτας που συνθέτει ετικέτα ρόλου δηλώνει το namespace', () => {
    const consumers = PALETTE_SOURCES.filter((file) => /\bcandidateLabel\(/.test(read(file)));
    // Δύο καταναλωτές: η γραμμή (πάντα ορατή) και ο επιλογέας (μόνο σε αμφισημία).
    expect(consumers.length).toBeGreaterThanOrEqual(2);
    for (const file of consumers) {
      const source = read(file);
      if (!/useTranslation\(/.test(source)) continue; // το `proposal-labels.ts` δέχεται το `t`
      expect(source).toMatch(/useTranslation\(\[[^\]]*PROJECT_ROLE_LABEL_NAMESPACE/);
    }
  });
});
