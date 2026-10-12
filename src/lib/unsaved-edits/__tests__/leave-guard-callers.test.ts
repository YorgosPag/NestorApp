/**
 * Άγκυρα σάρωσης πηγαίου της ερώτησης εξόδου (ADR-912 §12.12, Εύρημα 11).
 *
 * 🔑 Το `settledLeave` είναι η ΜΟΝΗ νόμιμη παράκαμψη της ερώτησης («η έξοδος έχει ήδη αποφασιστεί»). Κάθε καλών του
 *   είναι σημείο όπου αλλαγές ΜΠΟΡΟΥΝ να χαθούν χωρίς ερώτηση — άρα το σύνολο είναι **κλειστό**, με **λόγο** ανά αρχείο
 *   και **πλήθος** ανά αρχείο: νέα κλήση σε γνωστό αρχείο κοκκινίζει όσο και νέο αρχείο.
 * 🔑 Η φύλαξη της επιλογής ζει στην ΠΗΓΗ (`useEntityPageState.setSelectedItem`): ο ωμός setter δεν βγαίνει από το hook.
 */
import { listRepoSourceFiles, readRepoCode } from '@/test-utils/read-source';

interface SettledCaller {
  /** Πόσες κλήσεις `settledLeave(` έχει το αρχείο (χωρίς σχόλια). */
  readonly calls: number;
  /** Γιατί εδώ η αλλαγή ΔΕΝ είναι έξοδος του ανθρώπου. */
  readonly why: string;
}

const SETTLED_LEAVE_CALLERS: Readonly<Record<string, SettledCaller>> = {
  'src/lib/unsaved-edits/leave-guard.ts': {
    calls: 1,
    why: 'Το `guardLeave` εκτελεί την έξοδο ΑΦΟΥ απάντησε ο άνθρωπος — ό,τι φυλαγμένο τρέξει μέσα της δεν ξαναρωτά.',
  },
  'src/core/layouts/MobileDetailsSlideIn.tsx': {
    calls: 1,
    why: 'Ο ✕ του φύλλου ρώτησε ήδη (`confirmLeave`) — η Ακύρωση που κλείνει την επιλογή δεν ξαναρωτά.',
  },
  'src/hooks/trash/useEntityTrashState.ts': {
    calls: 2,
    why: 'Εναλλαγή κάδου ΑΦΟΥ απάντησε ο άνθρωπος · ολοκληρωμένη ενέργεια κάδου πάνω στην εγγραφή (επαναφορά / διαγραφή).',
  },
  'src/components/building-management/BuildingsPageContent.tsx': {
    calls: 3,
    why: 'Το πρόχειρο ΕΓΙΝΕ εγγραφή · ρητή «Ακύρωση» δημιουργίας · το κτίριο διαγράφηκε — καμία από τις τρεις δεν είναι έξοδος.',
  },
  'src/components/projects/projects-page-content.tsx': {
    calls: 3,
    why: 'Το πρόχειρο ΕΓΙΝΕ εγγραφή · ρητή «Ακύρωση» δημιουργίας · το έργο διαγράφηκε — καμία από τις τρεις δεν είναι έξοδος.',
  },
  'src/components/space-management/StoragesPage/StoragePageContent.tsx': {
    calls: 1,
    why: 'Η αποθήκη διαγράφηκε: η επιλογή αδειάζει επειδή η εγγραφή δεν υπάρχει πια, όχι επειδή φεύγει ο άνθρωπος.',
  },
  'src/components/space-management/ParkingPage/ParkingPageContent.tsx': {
    calls: 1,
    why: 'Η θέση διαγράφηκε: η επιλογή αδειάζει επειδή η εγγραφή δεν υπάρχει πια, όχι επειδή φεύγει ο άνθρωπος.',
  },
  'src/components/contacts/page/useContactsTrashState.ts': {
    calls: 2,
    why: 'Οριστική διαγραφή της επαφής · ολοκληρωμένη ενέργεια κάδου — ο κάδος είναι μόνο για ανάγνωση, καμία φόρμα να χαθεί.',
  },
  'src/components/contacts/page/useContactBulkActions.ts': {
    calls: 1,
    why: 'Η επιλεγμένη επαφή διαγράφηκε ή αρχειοθετήθηκε: η επιλογή αδειάζει επειδή η ενέργεια ολοκληρώθηκε.',
  },
};

const isProductionSource = (file: string) => !file.includes('/__tests__/') && !file.includes('.test.');

const count = (source: string, needle: string) => source.split(needle).length - 1;

describe('ερώτηση εξόδου — κλειστό σύνολο παρακάμψεων', () => {
  const files = listRepoSourceFiles('src').filter(isProductionSource);
  const found: Record<string, number> = {};
  const rawSetterFiles: string[] = [];

  for (const file of files) {
    const code = readRepoCode(file);
    const calls = count(code, 'settledLeave(');
    if (calls > 0) found[file] = calls;
    if (code.includes('setSelectedItemRaw')) rawSetterFiles.push(file);
  }

  it('Σ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η σάρωση είδε το δέντρο (όχι «0 = κανείς δεν κοίταξε»)', () => {
    expect(files.length).toBeGreaterThan(5000);
    expect(files).toContain('src/lib/unsaved-edits/leave-guard.ts');
    expect(files.some((file) => file.startsWith('src/subapps/'))).toBe(true);
  });

  it('Σ1 — κάθε `settledLeave(` ανήκει στο κλειστό σύνολο, με το ΙΔΙΟ πλήθος ανά αρχείο', () => {
    const declared = Object.fromEntries(
      Object.entries(SETTLED_LEAVE_CALLERS).map(([file, caller]) => [file, caller.calls]),
    );
    expect(found).toEqual(declared);
  });

  it('Σ2 — κάθε δήλωση λέει ΓΙΑΤΙ δεν είναι έξοδος', () => {
    for (const [file, caller] of Object.entries(SETTLED_LEAVE_CALLERS)) {
      expect({ file, reasoned: caller.why.trim().length >= 40 }).toEqual({ file, reasoned: true });
    }
  });

  it('Σ3 — ο ωμός setter της επιλογής ΔΕΝ βγαίνει από την πηγή της', () => {
    expect(rawSetterFiles).toEqual(['src/hooks/useEntityPageState.ts']);
  });
});
