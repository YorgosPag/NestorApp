/**
 * @tests ADR-867 Β9 — το σηματάκι είναι **phrasing content**, και το αποδεικνύει ο parser.
 *
 * ── ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ──
 *
 * Το `Badge` απέδιδε `<div>`. Μέσα σε `<p>` αυτό είναι **άκυρη HTML**, και η HTML5 δεν
 * το αγνοεί ευγενικά: ο tree-construction algorithm **κλείνει το `<p>`** μόλις δει
 * block-level ετικέτα. Δηλαδή ο server στέλνει ένα δέντρο και ο browser χτίζει **άλλο**
 * ⇒ `hydration error` ⇒ ο React πετά και ξαναχτίζει ολόκληρο το υποδέντρο.
 *
 * Το ελάττωμα έζησε γιατί **είναι αόρατο στην οθόνη**: το σηματάκι σχεδιάζεται μια χαρά
 * στη σωστή θέση. Μετρήθηκε 2026-09-20 σε ζωντανό browser στο `/offers/[offerId]`
 * (`AudienceRosterPanel` → `MemberRow`), και ο ίδιος συνδυασμός υπήρχε **σε τρία**
 * σημεία του `src/` — τα άλλα δύο απλώς δεν τα είχε ανοίξει κανείς.
 *
 * ⛔ **ΜΗΝ το μετατρέψεις σε έλεγχο συμβολοσειράς** («λέει `<span>` το badge.tsx;»).
 * Αυτό θα κλείδωνε τη *διατύπωσή* μας, όχι το συμβόλαιο — και θα έμενε πράσινο αν αύριο
 * κάποιος γράψει `<section>` ή `<figure>`, που σπάνε **ακριβώς το ίδιο**. Ο έλεγχος εδώ
 * περνά το πραγματικό SSR markup από τον **ίδιο τον HTML parser** και ρωτά το μόνο που
 * μετράει: **επέζησε το σηματάκι μέσα στην παράγραφο;**
 *
 * ⚠️ Το `render()` του RTL **ΔΕΝ** μπορεί να κάνει αυτή την ερώτηση: χτίζει το DOM μέσω
 * `createElement`/`appendChild`, που **παρακάμπτουν** τον parser — ένα `<div>` μέσα σε
 * `<p>` θα επιβίωνε εκεί και το test θα ήταν **ψευδώς πράσινο**. Γι' αυτό
 * `renderToStaticMarkup` + `innerHTML`.
 *
 * @see components/ui/badge.tsx — εκεί ζει η απόφαση, μία φορά για 364 σημεία χρήσης
 */

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Badge } from '../badge';

// =============================================================================
// Η ΜΗΧΑΝΗ: markup → HTML parser → «ποιος είναι ο γονιός;»
// =============================================================================

const PROBE = 'phrasing-probe';

/**
 * Περνά το markup από τον HTML parser του jsdom (parse5 — ο ίδιος αλγόριθμος με τον
 * browser) και απαντά αν το στοιχείο-δείγμα έμεινε **μέσα** στην παράγραφο.
 *
 * `false` σημαίνει ότι ο parser το **μετακίνησε** — δηλαδή ακριβώς το hydration
 * mismatch που βλέπει ο χρήστης.
 */
function survivesInsideParagraph(inner: React.ReactElement): boolean {
  const markup = renderToStaticMarkup(<p data-testid="host">{inner}</p>);

  const scratch = document.createElement('div');
  scratch.innerHTML = markup; // ← ΕΔΩ τρέχει ο tree-construction algorithm

  const probe = scratch.querySelector(`[data-testid="${PROBE}"]`);
  if (!probe) throw new Error('Το δείγμα χάθηκε εντελώς από το markup — άλλο πρόβλημα.');

  return probe.closest('p') !== null;
}

// =============================================================================
// ΑΥΤΟΕΛΕΓΧΟΣ — «μπορεί αυτό το αρχείο να κοκκινίσει;» (CHECK 3.54)
// =============================================================================

describe('η μηχανή του ελέγχου ξεχωρίζει όντως τις δύο περιπτώσεις', () => {
  it('ΠΙΑΝΕΙ ένα block-level παιδί: ο parser το βγάζει έξω από την παράγραφο', () => {
    // Αν αυτό γίνει ΠΡΑΣΙΝΟ, ο έλεγχος παρακάτω είναι διακοσμητικός.
    expect(survivesInsideParagraph(<div data-testid={PROBE} />)).toBe(false);
  });

  it('ΑΦΗΝΕΙ ήσυχο ένα phrasing παιδί', () => {
    expect(survivesInsideParagraph(<span data-testid={PROBE} />)).toBe(true);
  });
});

// =============================================================================
// ΤΟ ΣΥΜΒΟΛΑΙΟ
// =============================================================================

describe('Badge — phrasing content', () => {
  it('επιζεί μέσα σε <p> αντί να το σπάσει', () => {
    expect(survivesInsideParagraph(<Badge data-testid={PROBE}>σήμα</Badge>)).toBe(true);
  });

  it('επιζεί και με κάθε variant — η απόφαση είναι του στοιχείου, όχι του variant', () => {
    const variants = ['default', 'secondary', 'outline', 'success', 'destructive'] as const;

    for (const variant of variants) {
      expect(survivesInsideParagraph(
        <Badge variant={variant} data-testid={PROBE}>σήμα</Badge>,
      )).toBe(true);
    }
  });

  it('κρατά το inline-flex — το `<span>` δεν αλλάζει την όψη επειδή η βάση το δηλώνει', () => {
    // Χωρίς αυτό, το «καμία οπτική αλλαγή» θα ήταν ισχυρισμός αντί για γεγονός:
    // ένα γυμνό <span> είναι inline και ΔΕΝ σέβεται padding/ύψος όπως το div.
    const markup = renderToStaticMarkup(<Badge>σήμα</Badge>);

    const scratch = document.createElement('div');
    scratch.innerHTML = markup;

    expect(scratch.firstElementChild?.className).toContain('inline-flex');
  });
});
