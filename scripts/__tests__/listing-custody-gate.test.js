/**
 * =============================================================================
 * CHECK 3.56 — ΠΥΛΗ ΘΕΜΑΤΟΦΥΛΑΚΗΣ ΑΓΓΕΛΙΑΣ (ADR-777 §8.42)
 * =============================================================================
 *
 * 🔴 **Μ0 — Η ΒΑΘΜΟΝΟΜΗΣΗ ΣΕ ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ.** Η πύλη κρίνεται πάνω στην
 * **προηγούμενη** εκδοχή του `place-interest.service.ts` (καρφωμένο commit, ποτέ
 * `HEAD`): εκεί έπρεπε να είναι **κόκκινη**, και στη σημερινή **πράσινη**. Χωρίς
 * αυτό, το «0 παραβιάσεις» θα μπορούσε να σημαίνει «δεν κοίταξα ποτέ».
 */
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { classify, SSOT } = require('../check-listing-custody');

const REPO = path.join(__dirname, '..', '..');
const PINNED = 'a19347d3';

const gitShow = (ref, file) => {
  const out = execFileSync('git', ['show', `${ref}:${file}`], { cwd: REPO, encoding: 'utf8' });
  if (out.trim() === '') throw new Error(`ΚΕΝΗ απάντηση git για ${ref}:${file}`);
  return out;
};

const OWNER_FILE = 'src/services/demand/place-interest.service.ts';

describe('Μ0 — βαθμονόμηση σε πραγματικό κώδικα', () => {
  // 🔴 Η ΑΠΟΔΕΙΞΗ ΟΤΙ ΔΑΓΚΩΝΕΙ: στο καρφωμένο commit το αρχείο έκρινε μόνο του.
  it('Μ0α — η ΠΑΛΙΑ εκδοχή είναι δεύτερη αυθεντία', () => {
    expect(classify(OWNER_FILE, gitShow(PINNED, OWNER_FILE)).state).toBe('second-authority');
  });

  it('Μ0β — η ΣΗΜΕΡΙΝΗ εκδοχή δεν συγκρίνει καθόλου (ρωτά το SSoT)', () => {
    const fs = require('node:fs');
    const now = fs.readFileSync(path.join(REPO, OWNER_FILE), 'utf8');
    expect(classify(OWNER_FILE, now).state).toBe('no-comparison');
  });

  it('Μ0γ — το ίδιο το SSoT δεν είναι ποτέ παράβαση', () => {
    const fs = require('node:fs');
    expect(classify(SSOT, fs.readFileSync(path.join(REPO, SSOT), 'utf8')).state).toBe('ssot');
  });
});

describe('Κ — οι καταστάσεις, μία ανά αρχείο', () => {
  const owner = (body) => `import { COLLECTIONS } from '@/config/firestore-collections';\n`
    + `db.collection(COLLECTIONS.OWNER_PROPERTIES);\n${body}`;

  it('Κ1 — σύγκριση σε αγγελία, χωρίς SSoT ⇒ δεύτερη αυθεντία', () => {
    expect(classify('src/x.ts', owner('if (p.authorUserId !== uid) return null;')).state)
      .toBe('second-authority');
  });

  // 🔑 ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ: 8 από τις 10 εμφανίσεις στο δέντρο ΕΙΝΑΙ σχόλια που
  // τεκμηριώνουν τη βλάβη. Χωρίς αυτό, η πύλη κοκκινίζει πάνω στη θεραπεία της.
  it('Κ2 — η ΙΔΙΑ σύγκριση μέσα σε σχόλιο ΔΕΝ μετράει', () => {
    expect(classify('src/x.ts', owner('// ΗΤΑΝ: if (p.authorUserId !== uid) return null;')).state)
      .toBe('no-comparison');
  });

  // 🔴 ΚΡΙΝΕΤΑΙ Η ΣΥΓΚΡΙΣΗ, ΟΧΙ Η ΓΡΑΜΜΗ — το πραγματικό σχήμα του competition route.
  it('Κ3 — έλεγχος κενού ΚΑΙ απόφαση στην ΙΔΙΑ γραμμή ⇒ απόφαση', () => {
    const src = owner('if (p === undefined || p.authorUserId !== ctx.uid) return null;');
    expect(classify('src/x.ts', src).state).toBe('second-authority');
  });

  it('Κ4 — ΜΟΝΟ έλεγχος κενού ⇒ null-guard, ονομασμένο και όχι πεταμένο', () => {
    expect(classify('src/x.ts', owner('if (authorUserId === null) return null;')).state)
      .toBe('null-guard');
  });

  // ⚠️ Ο ΠΗΧΗΣ ΤΩΝ ΨΕΥΔΩΣ ΘΕΤΙΚΩΝ: η ζήτηση ΔΕΝ έχει θεματοφυλακή. Κριτήριο
  // «οποιοδήποτε authorUserId ===» θα έδινε 67% ψευδώς θετικά.
  it('Κ5 — ίδια σύγκριση σε ΑΛΛΟΝ πόρο ⇒ other-resource', () => {
    expect(classify('src/x.ts', 'if (demand.authorUserId !== ctx.uid) return null;').state)
      .toBe('other-resource');
  });

  it('Κ6 — αρχείο που ρωτά το SSoT δίπλα σε ωμή σύγκριση ⇒ delegates', () => {
    const src = owner('mayAdminister(custodyOf(p), a);\nif (p.authorCompanyId !== x) log();');
    expect(classify('src/x.ts', src).state).toBe('delegates');
  });

  it('Κ7 — fixture δοκιμής δεν είναι απόφαση παραγωγής', () => {
    expect(classify('src/x.test.ts', owner('if (p.authorUserId !== uid) return null;')).state)
      .toBe('fixture');
  });

  // ⚠️ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟΣ (πρότυπο CHECK 3.35): εξαίρεση χωρίς λόγο είναι
  // παράκαμψη με άλλο όνομα.
  it('Κ8 — εξαίρεση ΜΕ λόγο περνά, ΧΩΡΙΣ λόγο ΟΧΙ', () => {
    const body = 'if (p.authorUserId !== uid) return null;';
    expect(classify('src/x.ts', '// custody-exempt: ρητή απόφαση τομέα\n' + owner(body)).state)
      .toBe('exempt');
    expect(classify('src/x.ts', '// custody-exempt:\n' + owner(body)).state)
      .toBe('second-authority');
  });

  it('Κ9 — αρχείο χωρίς καμία σύγκριση δεν μπαίνει σε κανέναν κάδο απόφασης', () => {
    expect(classify('src/x.ts', 'export const a = 1;').state).toBe('no-comparison');
  });
});

describe('Λ — η λογιστική είναι κλειστή, και ασκείται', () => {
  const { tally } = require('../check-listing-custody');
  const owner = (body) => `db.collection(COLLECTIONS.OWNER_PROPERTIES);\n${body}`;

  // 🔴 ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΒΓΗΚΕ ΠΡΑΣΙΝΗ (`Μ6`): όσο η λογιστική ζούσε μέσα
  // στη `main`, καμία άγκυρα δεν την ασκούσε — σβήνοντας το `throw`, όλα πράσινα.
  it('Λ1 — κάθε αρχείο μπαίνει σε ΕΝΑΝ κάδο και το άθροισμα κλείνει', () => {
    const entries = [
      { rel: 'src/a.ts', raw: owner('if (p.authorUserId !== uid) return null;') },
      { rel: 'src/b.ts', raw: owner('if (authorUserId === null) return null;') },
      { rel: 'src/c.test.ts', raw: owner('if (p.authorUserId !== uid) return null;') },
      { rel: 'src/d.ts', raw: 'export const x = 1;' },
    ];
    const ledger = tally(entries);
    const sum = Object.values(ledger).reduce((n, l) => n + l.length, 0);
    expect(sum).toBe(entries.length);
    expect(ledger['second-authority']).toEqual(['src/a.ts']);
    expect(ledger['null-guard']).toEqual(['src/b.ts']);
    expect(ledger.fixture).toEqual(['src/c.test.ts']);
  });

  // ⚠️ ΜΕ ΡΑΦΗ ΕΝΕΣΗΣ. Χωρίς αυτήν το test έσκαγε στο `stripComments(null)` και **δεν
  // έφτανε ποτέ** στον φρουρό που υποτίθεται ότι έλεγχε — πράσινο για λάθος λόγο, που
  // είναι χειρότερο από κόκκινο.
  //
  // 🔑 ΜΕΤΑΛΛΑΣΣΟΝΤΑΙ ΚΑΙ ΟΙ ΔΥΟ ΦΡΟΥΡΟΙ ΜΑΖΙ: αλληλοκαλύπτονται εκ σχεδιασμού
  // (belt-and-suspenders), οπότε σβήνοντας τον έναν πυροδοτεί ο άλλος και η μετάλλαξη
  // «περνά» χωρίς να αποδεικνύει τίποτα.
  it('Λ2 — κατάσταση εκτός καταστίχου ΣΚΑΕΙ, δεν πετιέται σιωπηλά', () => {
    expect(() => tally([{ rel: 'src/a.ts', raw: 'x' }], () => ({ state: 'φάντασμα' })))
      .toThrow(/άγνωστη κατάσταση|δεν κλείνει/);
  });
});

describe('Ν — έλεγχος κενού ΚΑΙ απόφαση στο ΙΔΙΟ αρχείο', () => {
  // 🔴 ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΒΓΗΚΕ ΠΡΑΣΙΝΗ (`Μ2`). Το `Κ4` έχει ΜΟΝΟ έλεγχο
  // κενού και το `Κ3` ΜΟΝΟ απόφαση· κανένα δεν έπιανε το «υπάρχουν και τα δύο», που
  // είναι ακριβώς η περίπτωση όπου ένα `some` αντί για `every` βάφει την απόφαση
  // «έλεγχος κενού» και την **εξαφανίζει**.
  it('Ν1 — ΜΙΑ σύγκριση με null + ΜΙΑ πραγματική ⇒ ΑΠΟΦΑΣΗ, όχι null-guard', () => {
    const src = [
      'db.collection(COLLECTIONS.OWNER_PROPERTIES);',
      'if (authorUserId === null) return null;',
      'if (p.authorCompanyId !== actorCompany) return null;',
    ].join('\n');
    expect(classify('src/x.ts', src).state).toBe('second-authority');
  });
});
