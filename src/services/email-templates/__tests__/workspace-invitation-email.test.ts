/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ EMAIL ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΣΕ ΧΩΡΟ** (ADR-853 Φ5) — άγκυρες.
 * @related services/email-templates/workspace-invitation-email.ts
 *
 * ⚠️ **Κάθε άρνηση δοκιμάζεται με τον ΠΑΡΟΝΟΜΑΣΤΗ της**: πρώτα ότι η **ίδια** είσοδος
 * δίνει το σωστό αποτέλεσμα όταν αλλάζει **μόνο** το κρίσιμο. Χωρίς αυτό, μια άγκυρα
 * μπορεί να είναι πράσινη επειδή κάτι **άσχετο** έσπασε.
 */

jest.mock('server-only', () => ({}));

import {
  buildWorkspaceInvitationEmail,
  everyLanguageHasInvitationWording,
} from '../workspace-invitation-email';

const ORIGIN = 'https://nestorconstruct.gr';
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

const NOW = '2026-09-12T10:00:00.000Z';
/** Ακριβώς 7 ημέρες — η λήξη του §7.1. */
const IN_SEVEN_DAYS = '2026-09-19T10:00:00.000Z';

beforeEach(() => { process.env.NEXT_PUBLIC_APP_URL = ORIGIN; });
afterAll(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL;
});

/** Η σωστή πρόσκληση σε όλα — **κάθε** άγκυρα αλλάζει ΕΝΑ πεδίο αυτής. */
function build(overrides: Partial<Parameters<typeof buildWorkspaceInvitationEmail>[0]> = {}) {
  return buildWorkspaceInvitationEmail({
    language: 'el',
    workspaceName: 'Παγώνης Τεχνική',
    role: 'internal_user',
    expiresAt: IN_SEVEN_DAYS,
    token: 'tok_abc123',
    nowISOValue: NOW,
    ...overrides,
  });
}

// =============================================================================
// Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// =============================================================================

describe('Π — ο παρονομαστής: η σωστή πρόσκληση γεννά πλήρες μήνυμα', () => {
  it('Π1 — όνομα χώρου, ρόλος, λήξη και κουμπί, όλα μέσα', () => {
    const email = build();

    expect(email).not.toBeNull();
    expect(email?.html).toContain('Παγώνης Τεχνική');
    expect(email?.html).toContain('Εσωτερικός χρήστης');
    expect(email?.html).toContain('7 ημέρες');
    expect(email?.html).toContain(`${ORIGIN}/invite/tok_abc123`);
  });

  it('Π2 — κάθε γλώσσα έχει ΟΛΑ τα λόγια, για ΚΑΘΕ ρόλο', () => {
    expect(everyLanguageHasInvitationWording()).toBe(true);
  });
});

// =============================================================================
// Σ — Ο ΣΥΝΔΕΣΜΟΣ
// =============================================================================

describe('Σ — ο σύνδεσμος', () => {
  it('🔴 Σ1 — ΧΩΡΙΣ δημόσια διεύθυνση ⇒ ΚΑΝΕΝΑ email (ποτέ σύνδεσμος που δεν οδηγεί πουθενά)', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(build()).toBeNull();
  });

  it('🔑 Σ2 — το token κωδικοποιείται: δεν εμπιστευόμαστε τη σημερινή αλφάβητο του', () => {
    const email = build({ token: 'a+b/c=d' });

    expect(email?.html).toContain(`${ORIGIN}/invite/a%2Bb%2Fc%3Dd`);
    // ΠΑΡΟΝΟΜΑΣΤΗΣ: το ωμό, ακωδικοποίητο δεν επιβιώνει πουθενά.
    expect(email?.html).not.toContain('/invite/a+b/c=d');
  });

  it('Σ3 — ο σύνδεσμος υπάρχει ΚΑΙ στο απλό κείμενο, σε δική του γραμμή', () => {
    const email = build();

    expect(email?.text).toContain(`${ORIGIN}/invite/tok_abc123`);
    // Το απλό κείμενο δεν κουβαλά ετικέτες — αλλιώς ο παραλήπτης διαβάζει `<strong>`.
    expect(email?.text).not.toMatch(/<[a-z/]/i);
  });
});

// =============================================================================
// Γ — Η ΓΛΩΣΣΑ ΤΟΥ ΠΑΡΑΛΗΠΤΗ
// =============================================================================

describe('Γ — η γλώσσα', () => {
  it('🔴 Γ1 — αγγλικά ⇒ αγγλικό θέμα, αγγλικός ρόλος ΚΑΙ `<html lang="en">`', () => {
    const email = build({ language: 'en' });

    expect(email?.subject).toBe('Παγώνης Τεχνική invited you to collaborate — Nestor App');
    expect(email?.html).toContain('<html lang="en">');
    expect(email?.html).toContain('Internal user');
  });

  it('Γ2 — ελληνικά ⇒ ελληνικό θέμα και `<html lang="el">`', () => {
    const email = build();

    expect(email?.subject).toBe('Πρόσκληση συνεργασίας από Παγώνης Τεχνική — Nestor App');
    expect(email?.html).toContain('<html lang="el">');
  });

  it('🔑 Γ3 — ΑΓΝΩΣΤΗ γλώσσα πέφτει στην προεπιλογή, ΠΟΤΕ σε κενό μήνυμα', () => {
    // Η τιμή έρχεται από έγγραφο Firestore: μπορεί να είναι ό,τι να ΄ναι.
    const email = build({ language: 'κλίνγκον' });

    expect(email?.subject).toContain('Πρόσκληση συνεργασίας');
  });
});

// =============================================================================
// Λ — Η ΛΗΞΗ: ΠΟΤΕ ΛΙΓΟΤΕΡΕΣ ΑΠΟ ΟΣΕΣ ΔΙΝΟΥΜΕ
// =============================================================================

describe('Λ — οι ημέρες που απομένουν', () => {
  it('🔴 Λ1 — στρογγυλοποίηση ΠΡΟΣ ΤΑ ΠΑΝΩ: 6 ημέρες και 20 ώρες ⇒ «7 ημέρες»', () => {
    const email = build({ expiresAt: '2026-09-19T06:00:00.000Z' });

    // Με στρογγυλοποίηση προς τα κάτω θα έλεγε «6» — δηλαδή θα υποσχόταν ΛΙΓΟΤΕΡΑ
    // από όσα δίνει η πόρτα, σε ό,τι αφορά προθεσμία.
    expect(email?.html).toContain('7 ημέρες');
  });

  it('🔑 Λ2 — ΕΝΙΚΟΣ στη μία ημέρα: «1 ακόμη ημέρα», ποτέ «1 ημέρες»', () => {
    const email = build({ expiresAt: '2026-09-13T04:00:00.000Z' });

    expect(email?.html).toContain('1 ακόμη ημέρα');
    expect(email?.html).not.toContain('1 ημέρες');
  });

  it('Λ3 — ληγμένη ⇒ δάπεδο στο 1, ΠΟΤΕ αρνητικό ή μηδέν', () => {
    const email = build({ expiresAt: '2026-09-01T10:00:00.000Z' });

    expect(email?.html).toContain('1 ακόμη ημέρα');
    // 🔴 **Η ΠΡΩΤΗ ΓΡΑΦΗ ΑΥΤΗΣ ΤΗΣ ΑΓΚΥΡΑΣ ΗΤΑΝ ΛΑΘΟΣ ΚΑΙ ΚΟΚΚΙΝΙΣΕ ΣΩΣΤΑ**
    //    (2026-09-12): ρωτούσε `not.toContain('-')` πάνω σε **ολόκληρο** το έγγραφο, που
    //    είναι γεμάτο παύλες (`font-size`, `border-radius`, `-webkit-`). Δηλαδή μετρούσε
    //    **άλλο πράγμα** από αυτό που υπόσχεται το όνομά της.
    // ⇒ Η ερώτηση είναι *«βγήκε ΑΡΝΗΤΙΚΟΣ αριθμός ημερών;»*, και ρωτιέται **στη γραμμή
    //   της λήξης** — εκεί όπου ο αριθμός ζει.
    expect(email?.html).not.toMatch(/ισχύει για <strong>-/);
  });
});

// =============================================================================
// Ο — ΤΟ ΟΝΟΜΑ ΤΟΥ ΧΩΡΟΥ
// =============================================================================

describe('Ο — το όνομα του γραφείου', () => {
  it('🔴 Ο1 — ΚΕΝΟ όνομα ⇒ ετικέτα του πίνακα, ΠΟΤΕ ωμό αναγνωριστικό', () => {
    const email = build({ workspaceName: '' });

    expect(email?.html).toContain('ένα γραφείο');
    expect(email?.subject).toBe('Πρόσκληση συνεργασίας από ένα γραφείο — Nestor App');
  });

  it('Ο1β — ΠΑΡΟΝΟΜΑΣΤΗΣ: με όνομα, το όνομα φαίνεται και στο θέμα', () => {
    expect(build()?.subject).toContain('Παγώνης Τεχνική');
  });

  it('🔒 Ο2 — το όνομα ΔΙΑΦΕΥΓΕΙ: γραφείο με `<` δεν γράφει ετικέτα στο μήνυμα', () => {
    const email = build({ workspaceName: '<script>alert(1)</script>' });

    expect(email?.html).not.toContain('<script>');
    expect(email?.html).toContain('&lt;script&gt;');
  });
});

// =============================================================================
// Δ — Η ΔΕΣΜΕΥΣΗ ΣΤΗ ΔΙΕΥΘΥΝΣΗ (§7.5)
// =============================================================================

describe('Δ — η δέσμευση στον παραλήπτη', () => {
  it('🔒 Δ1 — και στις ΔΥΟ γλώσσες λέγεται ότι ο σύνδεσμος δουλεύει ΜΟΝΟ γι΄ αυτή τη διεύθυνση', () => {
    // Εκεί σπάει το προωθημένο email — και εκεί ρητά ΔΕΝ δεσμεύει το Figma (§5 #2).
    expect(build()?.html).toContain('μόνο');
    expect(build({ language: 'en' })?.html).toContain('only');
  });

  it('🔑 Δ2 — η έξοδος χωρίς ενοχή υπάρχει: «αγνοήστε το μήνυμα»', () => {
    expect(build()?.text).toContain('αγνοήστε το μήνυμα');
  });
});

// =============================================================================
// Ρ — Ο ΡΟΛΟΣ, ΣΤΗ ΓΛΩΣΣΑ ΤΟΥ ΑΝΘΡΩΠΟΥ
// =============================================================================

describe('Ρ — ο ρόλος', () => {
  it('Ρ1 — κάθε προσκλήσιμος ρόλος έχει όνομα, και τα τρία διαφέρουν', () => {
    const names = (['company_admin', 'internal_user', 'external_user'] as const).map(
      (role) => build({ role })?.html,
    );

    expect(names[0]).toContain('Διαχειριστής εταιρείας');
    expect(names[1]).toContain('Εσωτερικός χρήστης');
    expect(names[2]).toContain('Εξωτερικός χρήστης');
  });
});
