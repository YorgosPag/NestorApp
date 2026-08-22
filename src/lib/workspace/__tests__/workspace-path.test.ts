/**
 * `lib/workspace/workspace-path` — ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ, και η μία ξεχνιέται
 *
 * ⚠️ Το βάρος **δεν** πέφτει στο «κολλάει συμβολοσειρές». Πέφτει στο ότι τα
 * **285** σημεία διαδρομών της παραγωγής θέλουν **δύο διαφορετικές** πράξεις,
 * και ένας μηχανισμός για τα δύο θα ήταν σωστός στο μισό (ADR-787 §5.3 η #1).
 */

import {
  WORKSPACE_PATH_PREFIX,
  extractWorkspaceSegment,
  hasWorkspacePrefix,
  stripWorkspace,
  workspacePath,
} from '../workspace-path';

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
