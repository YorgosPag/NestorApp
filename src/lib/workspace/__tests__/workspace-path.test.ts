/**
 * `lib/workspace/workspace-path` — ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ, και η μία ξεχνιέται
 *
 * ⚠️ Το βάρος **δεν** πέφτει στο «κολλάει συμβολοσειρές». Πέφτει στο ότι τα
 * **285** σημεία διαδρομών της παραγωγής θέλουν **δύο διαφορετικές** πράξεις,
 * και ένας μηχανισμός για τα δύο θα ήταν σωστός στο μισό (ADR-787 §5.3 η #1).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  WORKSPACE_PATH_PREFIX,
  extractWorkspaceSegment,
  hasWorkspacePrefix,
  stripWorkspace,
  workspacePath,
} from '../workspace-path';
// ⚠️ Η ομάδα Ε ρωτά την **ίδια** αυθεντία προσγείωσης με τη διαδρομή — ποτέ ωμό
//    `'/dashboard'`, που θα ήταν δεύτερος κριτής μέσα στο ίδιο το test (ADR-749).
import { resolvePostLoginRoute } from '@/lib/routes/landing';

describe('Α — ανάγνωση: ονομάζει χώρο;', () => {
  it('Α1: /o/nikos/projects → «nikos»', () => {
    expect(extractWorkspaceSegment('/o/nikos/projects')).toBe('nikos');
  });

  it('Α2: /o/nikos (χωρίς συνέχεια) → «nikos»', () => {
    expect(extractWorkspaceSegment('/o/nikos')).toBe('nikos');
  });

  it('Α3: διαδρομή ΧΩΡΙΣ πρόθεμα → null (δεν είναι λάθος)', () => {
    // Οι δημόσιες οθόνες, η σύνδεση και η εγγραφή ζουν ΕΚΤΟΣ προθέματος εξ
    // ορισμού (ADR-787 §5.3 γ) — το null σημαίνει «δεν ονομάζει χώρο», όχι «άκυρο».
    expect(extractWorkspaceSegment('/login')).toBeNull();
    expect(extractWorkspaceSegment('/privacy-policy')).toBeNull();
    expect(extractWorkspaceSegment('/')).toBeNull();
  });

  it('Α4: σκέτο /o χωρίς ψευδώνυμο → null', () => {
    expect(extractWorkspaceSegment('/o')).toBeNull();
  });

  it('Α5: 🔴 φάκελος που ΞΕΚΙΝΑ με «o» ΔΕΝ είναι ο δείκτης', () => {
    // Ένα `startsWith('/o')` θα έπιανε το `/obligations` — υπαρκτή διαδρομή του
    // δέντρου. Η σύγκριση γίνεται σε επίπεδο ΤΜΗΜΑΤΟΣ, όχι προθέματος κειμένου.
    expect(extractWorkspaceSegment('/obligations')).toBeNull();
    expect(extractWorkspaceSegment('/offers/new')).toBeNull();
  });

  it('Α6: 🔴 η ΓΡΑΜΜΑΤΙΚΗ δεν κρίνεται εδώ — επιστρέφεται ΩΜΟ', () => {
    // Η διπλή κρίση θα ήταν δεύτερο κριτήριο που μπορεί να αποκλίνει (ADR-749).
    // Ο έλεγχος ανήκει στον `judgeAliasShape`, μία φορά.
    expect(extractWorkspaceSegment('/o/!!!/projects')).toBe('!!!');
  });
});

describe('Β — γραφή: πρόσθεση προθέματος (ΣΥΝΔΕΣΜΟΙ)', () => {
  it('Β1: («nikos», «/projects») → /o/nikos/projects', () => {
    expect(workspacePath('nikos', '/projects')).toBe('/o/nikos/projects');
  });

  it('Β2: δέχεται διαδρομή ΧΩΡΙΣ αρχική κάθετο', () => {
    // Και οι δύο μορφές υπάρχουν ήδη στα 285 σημεία· απαίτηση για μία θα σήμαινε
    // 285 χειροκίνητες διορθώσεις, δηλαδή 285 ευκαιρίες για λάθος.
    expect(workspacePath('nikos', 'projects')).toBe('/o/nikos/projects');
  });

  it('Β3: χωρίς διαδρομή → η ρίζα του χώρου', () => {
    expect(workspacePath('nikos')).toBe('/o/nikos');
  });

  it('Β4: 🔴 IDEMPOTENT — διπλή κλήση ΔΕΝ δίνει /o/nikos/o/nikos', () => {
    // Χωρίς αυτό, το σφάλμα θα φαινόταν ΜΟΝΟ στην οθόνη — καμία πύλη δεν κρίνει
    // συμβολοσειρά διαδρομής που χτίστηκε σε χρόνο εκτέλεσης.
    const once = workspacePath('nikos', '/projects');
    expect(workspacePath('nikos', once)).toBe(once);
  });
});

describe('Γ — 🔴 Η ΚΑΤΕΥΘΥΝΣΗ ΠΟΥ ΞΕΧΝΙΕΤΑΙ: αφαίρεση (ΣΥΓΚΡΙΣΕΙΣ)', () => {
  it('Γ1: /o/nikos/projects → /projects', () => {
    expect(stripWorkspace('/o/nikos/projects')).toBe('/projects');
  });

  it('Γ2: /o/nikos → /', () => {
    expect(stripWorkspace('/o/nikos')).toBe('/');
  });

  it('Γ3: διαδρομή ΧΩΡΙΣ πρόθεμα επιστρέφεται ΑΝΑΛΛΟΙΩΤΗ', () => {
    // Γι' αυτό η συνάρτηση είναι ασφαλής να μπει ΠΑΝΤΟΥ, και δεν χρειάζεται
    // κανείς να ξεχωρίσει «ποιες συγκρίσεις είναι μέσα σε χώρο» — ένας κανόνας
    // που πρέπει να θυμάσαι έχει αποτύχει μετρημένα τέσσερις φορές.
    expect(stripWorkspace('/login')).toBe('/login');
    expect(stripWorkspace('/')).toBe('/');
  });

  it('Γ4: 🔴🔴 Η ΖΩΝΤΑΝΗ ΣΥΓΚΡΙΣΗ ΤΟΥ (app)/layout.tsx ΣΥΝΕΧΙΖΕΙ ΝΑ ΔΟΥΛΕΥΕΙ', () => {
    // `SIDEBAR_COLLAPSED_ROUTES` περιέχει '/dxf/viewer' και το layout συγκρίνει
    // με `===`. Χωρίς αφαίρεση, η σύγκριση γίνεται σιωπηλά false, η μπάρα ανοίγει,
    // και ο καμβάς μετράει ~256px λιγότερο πλάτος — ενώ το σχόλιο του ADR-726
    // §13.1 λέει ότι «η μετρημένη γεωμετρία οφείλει να είναι η παραδιδόμενη».
    const live = '/o/nikos/dxf/viewer';
    expect(live === '/dxf/viewer').toBe(false); // ο παρονομαστής: ΧΩΡΙΣ θεραπεία σπάει
    expect(stripWorkspace(live)).toBe('/dxf/viewer'); // ΜΕ θεραπεία δουλεύει
  });

  it('Γ5: αφαίρεση και πρόσθεση είναι αντίστροφες', () => {
    for (const path of ['/projects', '/dxf/viewer', '/contacts/123', '/']) {
      expect(stripWorkspace(workspacePath('nikos', path))).toBe(path);
    }
  });
});

describe('Δ — το SSoT του προθέματος', () => {
  it('Δ1: το πρόθεμα είναι ΜΙΑ λέξη — αυτό είναι το κέρδος του δείκτη', () => {
    // Στη ρίζα θα ήταν 99 δεσμευμένες λέξεις από 4 ασύνδετες πηγές (§5.3 α).
    expect(WORKSPACE_PATH_PREFIX).toBe('o');
  });

  it('Δ2: το hasWorkspacePrefix συμφωνεί με το extractWorkspaceSegment', () => {
    for (const path of ['/o/nikos', '/o/nikos/x', '/login', '/obligations', '/o', '/']) {
      expect(hasWorkspacePrefix(path)).toBe(extractWorkspaceSegment(path) !== null);
    }
  });
});

// =============================================================================
// Ε — 🔴 ΠΡΟΣΓΕΙΩΝΕΤΑΙ ΚΑΠΟΥ ΑΥΤΗ Η ΔΙΕΥΘΥΝΣΗ; (ADR-787 Κ-1, 2026-08-27)
// =============================================================================
//
// 🔴 ΤΟ ΓΕΓΟΝΟΣ: το `POST /api/workspaces` επέστρεφε `redirectTo: workspacePath(alias)`
//    — δηλαδή **σκέτο** `/o/<ψευδώνυμο>`. Δεν υπάρχει `page.tsx` στη ρίζα του
//    `(app)/o/[workspace]/`, μόνο `layout.tsx` και υποφάκελοι. Ο άνθρωπος που μόλις
//    έφτιαξε το γραφείο του προσγειωνόταν στο **κέλυφός του με 404 μέσα**: το sidebar
//    φόρτωνε κανονικά, το περιεχόμενο έλεγε «Η σελίδα που αναζητάτε δεν βρέθηκε».
//
// ⚠️ **ΓΙΑΤΙ ΚΑΝΕΝΑ ΥΠΑΡΧΟΝ TEST ΔΕΝ ΤΟ ΕΠΙΑΣΕ**: όλα τα Β/Γ παραπάνω κρίνουν
//    **μορφή** συμβολοσειράς — «μπήκε το πρόθεμα;». Καμία ερώτηση δεν ήταν
//    *«υπάρχει σελίδα εκεί;»*, και η μορφή ήταν **άψογη**. Ίδιο σχήμα με το
//    `/unauthorized` του ADR-787 §5.3 ξ: σωστά χτισμένη διεύθυνση προς το πουθενά.
//
// ⛔ Η άγκυρα ρωτά το **αρχειοσύστημα**, όχι μια λίστα: λίστα διαδρομών θα ήταν
//    δεύτερη αυθεντία δίπλα στον App Router, και θα πάλιωνε σιωπηλά.
describe('Ε — 🔴 Ο ΠΡΟΟΡΙΣΜΟΣ ΥΠΑΡΧΕΙ; (όχι απλώς «είναι σωστά γραμμένος»)', () => {
  const WORKSPACE_TREE = join(__dirname, '../../../app/(app)/o/[workspace]');

  /** Το τμήμα μετά το ψευδώνυμο έχει `page.tsx`; */
  const landsOnAPage = (path: string): boolean => {
    const segment = path.replace(/^\/o\/[^/]+/, '').split('/').filter(Boolean)[0];
    if (!segment) return false; // σκέτο `/o/<alias>` — η ίδια η βλάβη
    return existsSync(join(WORKSPACE_TREE, segment, 'page.tsx'));
  };

  it('Ε0: Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — το όργανο ΒΛΕΠΕΙ σελίδες', () => {
    // Χωρίς αυτό, ένα λάθος μονοπάτι θα έκανε το Ε2 πράσινο για λάθος λόγο:
    // «δεν βρήκα σελίδα» και «δεν κοίταξα» δίνουν το ίδιο false.
    expect(existsSync(join(WORKSPACE_TREE, 'dashboard', 'page.tsx'))).toBe(true);
  });

  it('Ε1: 🔴 Η ΒΛΑΒΗ — το ΣΚΕΤΟ /o/<alias> ΔΕΝ προσγειώνεται πουθενά', () => {
    expect(workspacePath('dokimi')).toBe('/o/dokimi');
    expect(landsOnAPage(workspacePath('dokimi'))).toBe(false);
    // Και ο λόγος, ρητά: ΔΕΝ υπάρχει σελίδα στη ρίζα του χώρου.
    expect(existsSync(join(WORKSPACE_TREE, 'page.tsx'))).toBe(false);
  });

  it('Ε2: 🔑 Η ΔΙΟΡΘΩΣΗ — ο νέος διαχειριστής προσγειώνεται σε ΥΠΑΡΚΤΗ σελίδα', () => {
    // Ακριβώς η έκφραση του `api/workspaces/route.ts`, ρωτώντας την ΙΔΙΑ αυθεντία.
    const destination = workspacePath(
      'dokimi',
      resolvePostLoginRoute({ companyId: 'comp_x' }),
    );

    expect(landsOnAPage(destination)).toBe(true);
  });

  it('Ε3: ⛔ Η ΑΥΘΕΝΤΙΑ ΕΙΝΑΙ ΜΙΑ — δεν ρωτάμε τον ΔΡΩΝΤΑ, ρωτάμε το ΑΠΟΤΕΛΕΣΜΑ', () => {
    // Ο αιτών μπαίνει ΧΩΡΙΣ οργανισμό. Αν τον ρωτούσαμε αυτόν, θα έπαιρνε την
    // προσγείωση του πολίτη και θα έστελνε τον νέο διαχειριστή ΕΞΩ από το
    // γραφείο που μόλις γέννησε — μέσα σε διεύθυνση που δηλώνει ότι είναι μέσα.
    const asCitizen = resolvePostLoginRoute({ companyId: null });
    const asFounder = resolvePostLoginRoute({ companyId: 'comp_x' });

    expect(asCitizen).not.toBe(asFounder);
    expect(landsOnAPage(workspacePath('dokimi', asCitizen))).toBe(false);
  });
});
