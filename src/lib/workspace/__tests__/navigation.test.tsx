/**
 * `lib/workspace/navigation` — ΤΟ ΣΥΝΟΡΟ
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΥΛΑΕΙ (ADR-787 §5.3 θ)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το σύνορο είναι **ένα** σημείο για **276** σημεία πλοήγησης. Άρα κάθε σφάλμα
 * του πολλαπλασιάζεται σε ολόκληρη την εφαρμογή, και **καμία πύλη δεν βλέπει**
 * μια διεύθυνση που χτίστηκε λάθος: το μόνο σύμπτωμα είναι 404 στην οθόνη.
 *
 * ⚠️ Οι άγκυρες δοκιμάζουν **συμπεριφορά**, όχι υλοποίηση: ό,τι κρίνεται εδώ
 * είναι η **διεύθυνση που παράγεται** — αυτό ακριβώς που βλέπει ο άνθρωπος.
 */

import { render, renderHook, screen } from '@testing-library/react';
import { createRef } from 'react';

// ─── Ελεγχόμενο Next + ταυτότητα ─────────────────────────────────────────────
let currentPathname: string | null = '/';
const push = jest.fn();
const replace = jest.fn();
const prefetch = jest.fn();
const back = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push, replace, prefetch, back }),
}));

import {
  Link,
  usePathname,
  useRouter,
  useWorkspaceAlias,
  workspaceHref,
} from '../navigation';

const ORG = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';

beforeEach(() => {
  currentPathname = '/';
  push.mockClear();
  replace.mockClear();
  prefetch.mockClear();
});

// =============================================================================
// Η — Η ΚΑΘΑΡΗ ΚΑΤΑΣΚΕΥΗ
// =============================================================================

describe('Η — workspaceHref: η πράξη, χωρίς React', () => {
  it('Η1: εντός χώρου ⇒ παίρνει πρόθεμα · εκτός ⇒ μένει ανέγγιχτο', () => {
    expect(workspaceHref('/projects', 'nikos')).toBe('/o/nikos/projects');
    expect(workspaceHref('/login', 'nikos')).toBe('/login');
    expect(workspaceHref('/terms', 'nikos')).toBe('/terms');
  });

  it('Η2: είναι idempotent — διπλή κλήση δεν δίνει /o/nikos/o/nikos/...', () => {
    const once = workspaceHref('/projects', 'nikos');
    expect(workspaceHref(once, 'nikos')).toBe(once);
  });

  it('Η3: το ερώτημα επιβιώνει ακέραιο', () => {
    expect(workspaceHref('/contacts?filter=%CE%91', 'nikos')).toBe(
      '/o/nikos/contacts?filter=%CE%91'
    );
  });
});

// =============================================================================
// Θ — ΠΟΙΟΣ ΕΙΝΑΙ Ο ΕΝΕΡΓΟΣ ΧΩΡΟΣ
// =============================================================================

describe('Θ — ο χώρος βγαίνει ΜΟΝΟ από τη διεύθυνση', () => {
  it('Θ1: 🔴 Η ΔΙΕΥΘΥΝΣΗ ΕΙΝΑΙ Η ΠΗΓΗ — το ρητό αίτημα του ανθρώπου', () => {
    currentPathname = '/o/nikos/projects';
    expect(renderHook(() => useWorkspaceAlias()).result.current).toBe('nikos');
  });

  it('Θ1β: 🔴 Η ΜΟΡΦΗ ΔΙΑΤΗΡΕΙΤΑΙ — ταυτότητα στη μπάρα ⇒ ταυτότητα στους συνδέσμους', () => {
    // Αν το σύνορο «διόρθωνε» σε ψευδώνυμο, η διεύθυνση θα άλλαζε μορφή στο
    // πάτημα ενός συνδέσμου — σπάει το «γύρω πίσω» και τους σελιδοδείκτες.
    currentPathname = `/o/${ORG}/projects`;
    expect(renderHook(() => useWorkspaceAlias()).result.current).toBe(ORG);
  });

  it('Θ2: 🔴🔴 ΧΩΡΙΣ ΧΩΡΟ ΣΤΗ ΔΙΕΥΘΥΝΣΗ ⇒ null — ΑΝΑΘΕΣΗ, ΟΧΙ ΜΑΝΤΕΨΙΑ', () => {
    // Το `null` λέει «δεν ξέρω, και δεν μαντεύω». Την απάντηση τη δίνει το δίχτυ
    // στον διακομιστή, με ΚΡΙΜΕΝΗ ταυτότητα — όχι με claim που μπορεί να έχει
    // ανακληθεί.
    currentPathname = '/pending-approval';
    expect(renderHook(() => useWorkspaceAlias()).result.current).toBeNull();
  });

  it('Θ3: 🔴 Ο ΩΜΟΣ ΣΥΝΔΕΣΜΟΣ ΕΙΝΑΙ Η ΣΩΣΤΗ ΑΠΑΝΤΗΣΗ — τον πιάνει το δίχτυ', () => {
    // Ένα `?? PERSONAL_WORKSPACE_ALIAS` εδώ θα έστελνε κάθε μέλος οργανισμού
    // στον ΙΔΙΩΤΙΚΟ του χώρο — σιωπηλά, και σε λάθος δεδομένα.
    expect(workspaceHref('/dashboard', null)).toBe('/dashboard');
    expect(workspaceHref('/terms', null)).toBe('/terms');
  });
});

// =============================================================================
// Ι — ΟΙ ΤΡΕΙΣ ΑΝΤΙΚΑΤΑΣΤΑΤΕΣ
// =============================================================================

describe('Ι — Link · useRouter', () => {
  it('Ι1: το <Link> βάζει τον χώρο — και ΔΕΝ τον βάζει στο δημόσιο', () => {
    currentPathname = '/o/nikos/dashboard';
    render(
      <>
        <Link href="/projects">έργα</Link>
        <Link href="/terms">όροι</Link>
      </>
    );
    expect(screen.getByText('έργα')).toHaveAttribute('href', '/o/nikos/projects');
    expect(screen.getByText('όροι')).toHaveAttribute('href', '/terms');
  });

  it('Ι2: 🔴 ΠΡΟΩΘΕΙ ΤΟ ref — αλλιώς σπάει σιωπηλά η τοποθέτηση σε μενού/tooltip', () => {
    currentPathname = '/o/nikos/dashboard';
    const ref = createRef<HTMLAnchorElement>();
    render(
      <Link href="/projects" ref={ref}>
        έργα
      </Link>
    );
    expect(ref.current).toBeInstanceOf(HTMLAnchorElement);
  });

  it('Ι3: 🔴 push ΚΑΙ replace περνούν από τον χώρο — καθένα με ΕΝΤΟΣ προορισμό', () => {
    // ⚠️ ΤΟ ΠΛΗΡΩΣΑΜΕ: η πρώτη γραφή δοκίμαζε το `replace` με `/login`, που είναι
    //    **εκτός** χώρου — εκεί ωμό και μεταφρασμένο δίνουν το ΙΔΙΟ, άρα η άγκυρα
    //    έμενε ΠΡΑΣΙΝΗ όταν το `replace` έχανε τη μετάφραση (μετάλλαξη Μ6).
    //    Κάθε μέθοδος ΟΦΕΙΛΕΙ να ασκείται με προορισμό όπου η διαφορά φαίνεται.
    currentPathname = '/o/nikos/dashboard';
    const { result } = renderHook(() => useRouter());
    result.current.push('/contacts');
    result.current.replace('/properties');
    expect(push).toHaveBeenCalledWith('/o/nikos/contacts');
    expect(replace).toHaveBeenCalledWith('/o/nikos/properties');
  });

  it('Ι3β: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — δημόσιος προορισμός περνά ανέγγιχτος και στις δύο', () => {
    currentPathname = '/o/nikos/dashboard';
    const { result } = renderHook(() => useRouter());
    result.current.push('/login');
    result.current.replace('/terms');
    expect(push).toHaveBeenCalledWith('/login');
    expect(replace).toHaveBeenCalledWith('/terms');
  });

  it('Ι3γ: 🔴 ΤΑ ΟΡΙΣΜΑΤΑ ΠΡΟΩΘΟΥΝΤΑΙ ΑΥΤΟΥΣΙΑ — ούτε λείπουν, ούτε περισσεύουν', () => {
    // 🔴 ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΠΡΑΓΜΑΤΙΚΗ ΒΛΑΒΗ (ADR-787 §5.3 ν). Η υπογραφή ήταν
    //    `(href, options?)`, άρα το σύνορο προώθει `undefined` **πάντα**: το
    //    `push(x)` έφτανε ως `push(x, undefined)`. Λειτουργικά αδιάφορο για το
    //    Next — αλλά ένα σύνορο που υπόσχεται «τα σημεία κλήσης δεν
    //    αλλάζουν» δεν επιτρέπεται να αλλάζει την **αριθμητική** της κλήσης.
    //    Το έπιασε ζωντανά το `route-tabs.test.tsx` στην πρώτη μετανάστευση.
    //
    // ⚠️ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ, ΠΟΤΕ ΜΙΑ: έλεγχος μόνο για «δεν περισσεύει» θα
    //    έμενε πράσινος αν κάποιος «διόρθωνε» το σύνορο πετώντας τα options.
    currentPathname = '/o/nikos/dashboard';
    const { result } = renderHook(() => useRouter());

    result.current.push('/contacts');
    expect(push.mock.calls[0]).toHaveLength(1);

    result.current.push('/projects', { scroll: false });
    expect(push.mock.calls[1]).toEqual(['/o/nikos/projects', { scroll: false }]);
  });

  it('Ι4: 🔴🔴 ΤΟ prefetch ΜΕΤΑΦΡΑΖΕΤΑΙ — αλλιώς προφορτώνει 404 ΧΩΡΙΣ ΚΑΝΕΝΑ ΙΧΝΟΣ', () => {
    // Το χειρότερο είδος βλάβης: η πλοήγηση απλώς «είναι αργή», και δεν υπάρχει
    // σφάλμα πουθενά για να το βρει κανείς.
    currentPathname = '/o/nikos/dashboard';
    const { result } = renderHook(() => useRouter());
    result.current.prefetch('/projects');
    expect(prefetch).toHaveBeenCalledWith('/o/nikos/projects');
  });

  it('Ι5: ό,τι δεν παίρνει διεύθυνση περνά αυτούσιο', () => {
    const { result } = renderHook(() => useRouter());
    expect(typeof result.current.back).toBe('function');
    result.current.back();
    expect(back).toHaveBeenCalled();
  });
});

// =============================================================================
// Κ — Η ΑΛΛΗ ΚΑΤΕΥΘΥΝΣΗ: Η ΑΦΑΙΡΕΣΗ
// =============================================================================

describe('Κ — usePathname: η αφαίρεση', () => {
  it('Κ1: 🔴 ΑΦΑΙΡΕΙ τον χώρο — η κατεύθυνση που ξεχνιέται', () => {
    currentPathname = '/o/nikos/dxf/viewer';
    expect(renderHook(() => usePathname()).result.current).toBe('/dxf/viewer');
  });

  it('Κ2: διαδρομή χωρίς χώρο μένει αναλλοίωτη — ασφαλές να μπει ΠΑΝΤΟΥ', () => {
    currentPathname = '/login';
    expect(renderHook(() => usePathname()).result.current).toBe('/login');
  });

  it('Κ3: η ρίζα του χώρου γίνεται ρίζα', () => {
    currentPathname = '/o/nikos';
    expect(renderHook(() => usePathname()).result.current).toBe('/');
  });

  it('Κ4: χωρίς διαδρομή ⇒ κενό, όπως και το πρωτότυπο', () => {
    currentPathname = null;
    expect(renderHook(() => usePathname()).result.current).toBe('');
  });
});

// =============================================================================
// Λ — Η ΑΠΟΜΟΝΩΣΗ ΤΟΥ ΓΡΑΦΟΥ (το ελάττωμα που πληρώσαμε)
// =============================================================================

describe('Λ — το σύνορο δεν αγγίζει ταυτότητα', () => {
  it('Λ2: 🔴🔴 ΜΗΔΕΝ ΑΚΜΗ ΠΡΟΣ auth/firebase/claims', () => {
    // Η πρώτη γραφή έπεφτε πίσω στο `useAuth`, και έσερνε `@firebase/auth` σε
    // ΚΑΘΕΝΑΝ από τους 133 καταναλωτές. Το έδειξε ζωντανά η σουίτα του
    // `ContactQuotesSection` (`fetch is not defined`, ΠΡΙΝ τρέξει test) — αλλά η
    // ίδια ακμή ταξίδευε και στο bundle. Η άγκυρα κρίνει τον ΓΡΑΦΟ, ώστε το
    // επόμενο σπάσιμο να ονομάζεται σωστά αντί να εμφανιστεί ως οκτώ άσχετες
    // σουίτες με σφάλμα περιβάλλοντος.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readRepoCode } = require('@/test-utils/read-source') as typeof import('@/test-utils/read-source');
    const source = readRepoCode('src/lib/workspace/navigation.tsx');
    for (const forbidden of ['useAuth', 'AuthContext', 'firebase', 'companyId', 'claims']) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('Λ3: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — το δίχτυ ΟΝΤΩΣ κρίνει ταυτότητα στον διακομιστή', () => {
    // Χωρίς αυτό, το Λ2 θα ήταν πράσινο και σε έναν κόσμο όπου ΚΑΝΕΙΣ δεν λύνει
    // τον χώρο — δηλαδή δεν θα απεδείκνυε ΜΕΤΑΚΙΝΗΣΗ της ευθύνης, αλλά απώλειά της.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readRepoCode } = require('@/test-utils/read-source') as typeof import('@/test-utils/read-source');
    const net = readRepoCode('src/app/(app)/[...unprefixed]/page.tsx');
    expect(net).toContain('readPageIdentity');
    // 🔴 ADR-807 — Η ΔΙΑΚΡΙΣΗ ΑΛΛΑΞΕ ΜΗΧΑΝΙΣΜΟ, ΚΑΙ Η ΑΓΚΥΡΑ ΕΓΙΝΕ ΑΥΣΤΗΡΟΤΕΡΗ.
    //
    // Ήταν `expect(net).toContain('hasOrganization')` — **μία** λέξη, που ονόμαζε
    // μόνο τη ΜΙΑ πλευρά της διακλάδωσης. Το `hasOrganization(identity.ctx)` έπαψε
    // να είναι εκφράσιμο: το `ctx` του προσωπικού χώρου **δεν έχει πια πεδίο**
    // `companyId` (`PersonalIdentityContext`), άρα η ερώτηση «έχει οργανισμό;»
    // πάνω του δεν είναι περιττή — είναι **λάθος ερώτηση**, και ο μεταγλωττιστής
    // την απαγορεύει.
    //
    // ⚠️ Ονομάζονται **ΚΑΙ ΟΙ ΔΥΟ** κλάδοι επίτηδες. Μέχρι το ADR-807 ο κλάδος του
    //    προσωπικού χώρου ήταν **νεκρός κώδικας** — γραμμένος, και δομικά ανέφικτος
    //    επειδή το `readPageIdentity` απέρριπτε την απουσία `companyId` ως αποτυχία
    //    ταυτότητας. Μια άγκυρα που κοιτά μόνο τον εταιρικό κλάδο θα ήταν **πράσινη
    //    πάνω σε ακριβώς εκείνο το ελάττωμα**.
    expect(net).toContain("identity.scope === 'organization'");
    expect(net).toContain('PERSONAL_WORKSPACE_ALIAS');
  });
});
