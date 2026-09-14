/**
 * @fileoverview Άγκυρες του **συμβολαίου περιβάλλοντος** (ADR-777 §8.35).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ **ΕΙΝΑΙ** Η ΠΥΛΗ, ΚΑΙ ΟΧΙ ΝΕΟ `scripts/check-*.js`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι το ADR-783 (CHECK 3.54) μια άγκυρα **δεν** ήταν πύλη: **3.289 από τα 3.458**
 * αρχεία test εκτελούνταν μόνο μέσα από `continue-on-error` και **κανένα δεν μπορούσε
 * να κοκκινίσει τίποτα**. Σήμερα το `jest-suite.yml` τρέχει **ολόκληρη** τη σουίτα
 * **άνευ όρων, χωρίς `paths:`**, και μπλοκάρει με ratchet κατά ταυτότητα αρχείου.
 *
 * ⇒ Ένα νέο `scripts/check-env-contract.js` + νέο workflow θα ήταν **δεύτερος
 * μηχανισμός** για ερώτημα που ο υπάρχων απαντά ήδη — και θα μεγάλωνε το μητρώο πυλών
 * (33) χωρίς να προσθέσει καμία εγγύηση. *Η αυστηρότητα δεν είναι ο αριθμός των
 * μηχανών.*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΟΙ ΟΜΑΔΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 * **Κ**  — το κατηγόρημα «υπάρχει;»
 * **Λ**  — η κρίση και η **κλειστή λογιστική**
 * **Β**  — η αντίδραση στο boot (πετά / ονομάζει)
 * **Σ**  — 🔴 **ΤΟ ΣΥΜΒΟΛΑΙΟ ΕΝΑΝΤΙ ΤΟΥ ΠΡΑΓΜΑΤΙΚΟΥ ΚΩΔΙΚΑ** — η μόνη ομάδα που
 *          εμποδίζει το μητρώο να γίνει «δεύτερη αλήθεια» που αποκλίνει σιωπηλά
 */

import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import {
  ENVIRONMENT_CONTRACT,
  type EnvironmentRequirement,
} from '@/config/environment-contract';
import {
  auditEnvironment,
  describeMissing,
  readConfiguredValue,
} from '@/lib/environment/environment-audit';
import { assertEnvironmentContract } from '@/lib/environment/environment-startup';
import { requireTokenSecret } from '@/lib/tokens/signed-token';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');

/** Δύο δηλώσεις-παιχνίδι, ώστε οι άγκυρες κρίσης να μην εξαρτώνται από το πραγματικό μητρώο. */
const FATAL: EnvironmentRequirement = {
  name: 'TEST_FATAL_VAR',
  severity: 'fatal',
  feature: 'δοκιμαστική κρίσιμη',
  consequence: 'τίποτα δεν σερβίρεται',
  consumer: 'test',
};
const FEATURE: EnvironmentRequirement = {
  name: 'TEST_FEATURE_VAR',
  severity: 'feature',
  feature: 'δοκιμαστική δυνατότητα',
  consequence: 'μια πόρτα κλείνει σιωπηλά',
  consumer: 'test',
};

// ─── Κ: το κατηγόρημα ────────────────────────────────────────────────────────

describe('Κ — «υπάρχει;» σημαίνει ΕΝΑ πράγμα', () => {
  it('Κ1 — απούσα ⇒ null', () => {
    expect(readConfiguredValue({}, 'X')).toBeNull();
  });

  it('Κ2 — κενή συμβολοσειρά ⇒ null (φαίνεται συμπληρωμένη, δεν υπογράφει τίποτα)', () => {
    expect(readConfiguredValue({ X: '' }, 'X')).toBeNull();
  });

  it('Κ3 — μόνο κενά ⇒ null', () => {
    expect(readConfiguredValue({ X: '   \t ' }, 'X')).toBeNull();
  });

  it('Κ4 — τιμή ⇒ η τιμή, κομμένη στα άκρα', () => {
    expect(readConfiguredValue({ X: '  s3cret  ' }, 'X')).toBe('s3cret');
  });

  // 🔴 Η ΑΓΚΥΡΑ ΤΗΣ ΕΝΟΠΟΙΗΣΗΣ. Χωρίς αυτήν, κάποιος «απλοποιεί» το κατηγόρημα σε
  // `!== undefined` και η αναφορά ετοιμότητας λέει «ρυθμισμένο» ενώ η πύλη συνδέσμου
  // απαντά «άκυρος» — δύο απαντήσεις στο ίδιο ερώτημα, ταυτόχρονα (ADR-749).
  //
  // ⚠️ ΡΩΤΑ ΤΗ ΣΥΜΠΕΡΙΦΟΡΑ, ΟΧΙ ΤΟ ΚΕΙΜΕΝΟ. Η πρώτη γραφή έψαχνε τη συμβολοσειρά
  // `process.env[x]?.trim()` στην πηγή και κοκκίνιζε πάνω στο **σχόλιο που τεκμηριώνει
  // τη θεραπεία** — το ίδιο σχήμα με το `Κ7β` του CHECK 3.50 και το `Π2` του 3.55.
  it('Κ5 — το `requireTokenSecret` κρίνει ΤΟ ΙΔΙΟ με το `readConfiguredValue`', () => {
    const VAR = 'ENV_CONTRACT_ANCHOR_K5';
    const original = process.env[VAR];
    try {
      for (const value of ['', '   ']) {
        process.env[VAR] = value;
        expect(readConfiguredValue(process.env, VAR)).toBeNull();
        // Ίδια είσοδος, ίδια ετυμηγορία: ό,τι η κρίση λέει «μη ρυθμισμένο», η πύλη
        // συνδέσμου οφείλει να αρνείται — αλλιώς η αναφορά υγείας λέει ψέματα.
        expect(() => requireTokenSecret(VAR)).toThrow(VAR);
      }
      process.env[VAR] = ' ok ';
      expect(readConfiguredValue(process.env, VAR)).toBe('ok');
      expect(requireTokenSecret(VAR)).toBe('ok');
    } finally {
      if (original === undefined) delete process.env[VAR];
      else process.env[VAR] = original;
    }
  });
});

// ─── Λ: η κρίση ──────────────────────────────────────────────────────────────

describe('Λ — η κρίση, με κλειστή λογιστική', () => {
  it('Λ1 — όλα ρυθμισμένα ⇒ καμία απουσία, και ο παρονομαστής μένει', () => {
    const audit = auditEnvironment({ TEST_FATAL_VAR: 'a', TEST_FEATURE_VAR: 'b' }, [FATAL, FEATURE]);
    expect(audit.missingFatal).toHaveLength(0);
    expect(audit.missingFeature).toHaveLength(0);
    expect(audit.declared).toBe(2);
    expect(audit.configured).toBe(2);
  });

  it('Λ2 — η βαθμίδα ξεχωρίζει τις δύο απουσίες', () => {
    const audit = auditEnvironment({}, [FATAL, FEATURE]);
    expect(audit.missingFatal.map((r) => r.name)).toEqual(['TEST_FATAL_VAR']);
    expect(audit.missingFeature.map((r) => r.name)).toEqual(['TEST_FEATURE_VAR']);
  });

  // Κάθε δήλωση καταλήγει σε ΑΚΡΙΒΩΣ μία κατάσταση — το άθροισμα οφείλει να κλείνει.
  it('Λ3 — η λογιστική κλείνει: ρυθμισμένες + απούσες = δηλωμένες', () => {
    const audit = auditEnvironment({ TEST_FEATURE_VAR: 'b' }, [FATAL, FEATURE]);
    const missing = audit.missingFatal.length + audit.missingFeature.length;
    expect(audit.configured + missing).toBe(audit.declared);
    expect(audit.verdicts).toHaveLength(audit.declared);
  });

  // 🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ. Κενό συμβόλαιο ΔΕΝ επιτρέπεται να διαβαστεί ως «όλα εντάξει».
  it('Λ4 — κενό συμβόλαιο δηλώνει 0, δεν σιωπά', () => {
    const audit = auditEnvironment({}, []);
    expect(audit.declared).toBe(0);
    expect(audit.configured).toBe(0);
  });

  it('Λ5 — η διατύπωση κουβαλά τη ΣΥΝΕΠΕΙΑ, όχι μόνο το όνομα', () => {
    const [line] = describeMissing([FEATURE]);
    expect(line).toContain('TEST_FEATURE_VAR');
    expect(line).toContain('μια πόρτα κλείνει σιωπηλά');
  });
});

// ─── Β: η αντίδραση στο boot ─────────────────────────────────────────────────

describe('Β — το boot αντιδρά ανάλογα με τη βαθμίδα', () => {
  it('Β1 — `fatal` που λείπει ΣΤΑΜΑΤΑ την εκκίνηση, με το όνομα μέσα', () => {
    expect(() => assertEnvironmentContract({}, [FATAL])).toThrow(/TEST_FATAL_VAR/);
  });

  it('Β1β — `feature` που λείπει ΔΕΝ σταματά την εκκίνηση', () => {
    expect(() => assertEnvironmentContract({}, [FEATURE])).not.toThrow();
  });

  // 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΠΡΟΣΤΑΤΕΥΕΙ ΤΗΝ ΠΑΡΑΓΩΓΗ. Αν κάποιος ανεβάσει μυστικό συνδέσμου σε
  // `fatal`, το επόμενο deploy σταματά ΟΛΟΚΛΗΡΟ τον ιστότοπο επειδή λείπει το μυστικό
  // ΜΙΑΣ ροής. Μετρημένο: το MANDATE_CONSENT_SECRET λείπει σήμερα από το Netcup.
  it('Β2 — καμία δηλωμένη ρύθμιση που λείπει σήμερα δεν ρίχνει το boot', () => {
    expect(() => assertEnvironmentContract({})).not.toThrow();
  });

  it('Β3 — πλήρες περιβάλλον δεν πετά', () => {
    const full = Object.fromEntries(ENVIRONMENT_CONTRACT.map((r) => [r.name, 'x']));
    expect(() => assertEnvironmentContract(full)).not.toThrow();
  });
});

// ─── Σ: το συμβόλαιο έναντι του πραγματικού κώδικα ───────────────────────────

/**
 * Βρίσκει, με AST, τα μυστικά που ζητά **πραγματικά** ο κώδικας: κάθε αρχείο που
 * εισάγει `requireTokenSecret` δηλώνει το όνομα σε `const SECRET_ENV = '…'`.
 *
 * ⚠️ **AST και όχι `grep`**: το μάθημα `Μ-Β` — ένα `grep` για ονόματα μεταβλητών είναι
 * δομικά τυφλό σε ό,τι δεν είναι γραμμένο ακριβώς όπως το περίμενες, και μια πύλη που
 * δεν βρίσκει τίποτα απαντά «καθαρό» ενώ σημαίνει «δεν κοίταξα».
 *
 * ⚠️ `ts.createSourceFile` = **parse-only**, ποτέ `ts.Program`/`tsc` (κανόνας N.17).
 */
function secretsRequestedByCode(): ReadonlySet<string> {
  const roots = ['src/services', 'src/lib', 'src/app'];
  const found = new Set<string>();

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;

      const text = fs.readFileSync(full, 'utf8');
      // Προφίλτρο κειμένου: μόνο τα ~3 αρχεία που όντως καλούν τη μηχανή πληρώνουν parse.
      if (!text.includes('requireTokenSecret')) continue;

      const sf = ts.createSourceFile(full, text, ts.ScriptTarget.Latest, true);
      sf.forEachChild((node) => {
        if (!ts.isVariableStatement(node)) return;
        for (const decl of node.declarationList.declarations) {
          // `…SECRET_ENV` και όχι μόνο `SECRET_ENV`: το ADR-848 εξάγει `EMAIL_SUBSCRIPTION_SECRET_ENV`
          // — ακριβές όνομα θα το άφηνε αόρατο, πράσινο επειδή κανείς δεν κοίταξε.
          if (!ts.isIdentifier(decl.name) || !decl.name.text.endsWith('SECRET_ENV')) continue;
          if (decl.initializer && ts.isStringLiteral(decl.initializer)) {
            found.add(decl.initializer.text);
          }
        }
      });
    }
  };

  for (const root of roots) walk(path.join(REPO, root));
  return found;
}

describe('Σ — το μητρώο ΔΕΝ επιτρέπεται να αποκλίνει από τον κώδικα', () => {
  const requested = secretsRequestedByCode();
  const declared = new Set(ENVIRONMENT_CONTRACT.map((r) => r.name));

  // 🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΣΑΡΩΣΗΣ. Αν ο σαρωτής σπάσει (μετακίνηση αρχείου,
  // μετονομασία της σταθεράς), θα έβρισκε ΜΗΔΕΝ — και οι δύο επόμενες άγκυρες θα
  // περνούσαν ΚΕΝΕΣ, δηλαδή πράσινες επειδή κανείς δεν κοίταξε.
  it('Σ0 — ο σαρωτής βρίσκει πραγματικούς καταναλωτές', () => {
    expect(requested.size).toBeGreaterThanOrEqual(3);
  });

  it('Σ1 — κάθε μυστικό που ζητά ο κώδικας είναι ΔΗΛΩΜΕΝΟ', () => {
    const undeclared = [...requested].filter((name) => !declared.has(name));
    expect(undeclared).toEqual([]);
  });

  // ⚠️ Μέχρι 2026-09-14 το φίλτρο ήταν «ο καταναλωτής λέγεται `token-service`/`consent.service`»:
  // τα 3 από τα 6 (invitation.service · workspace-invitation · subscription-token) ΞΕΦΕΥΓΑΝ
  // σιωπηλά. Κριτήριο πλέον = ο δηλωμένος καταναλωτής ΟΝΟΜΑΖΕΙ τη μεταβλητή ως literal.
  it('Σ2 — κάθε δήλωση έχει ΖΩΝΤΑΝΟ καταναλωτή που ζητά ΑΥΤΟ το όνομα', () => {
    const orphans = ENVIRONMENT_CONTRACT.filter((r) => {
      const full = path.join(REPO, r.consumer);
      if (!fs.existsSync(full)) return false; // το πιάνει η Σ3, με σαφέστερο μήνυμα
      return !fs.readFileSync(full, 'utf8').includes(`'${r.name}'`);
    }).map((r) => `${r.name} → ${r.consumer}`);
    expect(orphans).toEqual([]);
  });

  it('Σ3 — το αρχείο που δηλώνεται ως καταναλωτής ΥΠΑΡΧΕΙ', () => {
    const ghosts = ENVIRONMENT_CONTRACT.filter(
      (r) => !fs.existsSync(path.join(REPO, r.consumer)),
    ).map((r) => `${r.name} → ${r.consumer}`);
    expect(ghosts).toEqual([]);
  });

  // Το `consequence` είναι ο λόγος ύπαρξης του μητρώου: χωρίς αυτό, το boot log λέει ένα
  // όνομα μεταβλητής, που δεν σημαίνει τίποτα για όποιον δεν έγραψε τον κώδικα.
  it('Σ4 — κάθε δήλωση λέει τι βλέπει ο ΑΝΘΡΩΠΟΣ όταν λείπει', () => {
    const silent = ENVIRONMENT_CONTRACT.filter((r) => r.consequence.trim().length < 40).map(
      (r) => r.name,
    );
    expect(silent).toEqual([]);
  });

  // ⚠️ Το αρχείο είναι tracked· το `.env` δεν είναι. Καμία τιμή δεν επιτρέπεται εδώ.
  it('Σ5 — το μητρώο δεν κουβαλά τιμές', () => {
    const source = fs.readFileSync(path.join(REPO, 'src/config/environment-contract.ts'), 'utf8');
    expect(source).not.toMatch(/(SECRET|TOKEN|KEY)\s*[:=]\s*['"][A-Za-z0-9+/_-]{16,}['"]/);
  });

  // 🔴 Η ΑΠΟΚΛΙΣΗ ΠΟΥ ΤΟ §8.35 ΕΓΡΑΨΕ — ΚΑΙ ΞΑΝΑΓΙΝΕ. Στις 2026-08-21 λείπαν 2 μυστικά από
  // το `.env.example`· διορθώθηκαν με το χέρι, χωρίς άγκυρα. Στις 2026-09-14 έλειπαν πάλι
  // **3** (ADR-844 · 853 · 848). Διόρθωση χωρίς άγκυρα = υπόσχεση. Όποιος στήνει νέο
  // περιβάλλον (Netcup, νέος υπολογιστής) διαβάζει ΑΥΤΟ το αρχείο, όχι το συμβόλαιο.
  it('Σ6 — κάθε δηλωμένη ρύθμιση έχει γραμμή στο `.env.example`', () => {
    const example = fs.readFileSync(path.join(REPO, '.env.example'), 'utf8');
    const listed = new Set(
      [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]),
    );
    // Παρονομαστής: αν η ανάλυση σπάσει, ΜΗΔΕΝ γραμμές θα έκαναν κάθε όνομα «λείπει» —
    // κόκκινο, αλλά για λάθος λόγο. Εδώ η βλάβη του σαρωτή ονομάζεται χωριστά.
    expect(listed.size).toBeGreaterThan(ENVIRONMENT_CONTRACT.length);
    const undocumented = ENVIRONMENT_CONTRACT.map((r) => r.name).filter((n) => !listed.has(n));
    expect(undocumented).toEqual([]);
  });

  // Το `.env.example` είναι tracked και εξαιρείται από το secret-scan (`check-secret-scan.js`)
  // ⇒ ένα αληθινό μυστικό επικολλημένο εδώ ΔΕΝ θα το έπιανε καμία άλλη πύλη.
  it('Σ7 — το `.env.example` κουβαλά μόνο ΣΥΜΒΟΛΟ θέσης για τα δηλωμένα μυστικά', () => {
    const example = fs.readFileSync(path.join(REPO, '.env.example'), 'utf8');
    const leaked = ENVIRONMENT_CONTRACT.map((r) => r.name).filter((name) => {
      const value = new RegExp(`^${name}=(.*)$`, 'm').exec(example)?.[1]?.trim() ?? '';
      return value !== '' && !value.startsWith('your_');
    });
    expect(leaked).toEqual([]);
  });
});
