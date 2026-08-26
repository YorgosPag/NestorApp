/**
 * ADR-798 §7 — ΑΓΚΥΡΕΣ για την **υπόσχεση στην οθόνη**.
 *
 * Το §7 λέει κατά λέξη: «η οθόνη δείχνει **ΠΑΝΤΑ** ποια από τις τρεις ισχύει».
 * Μετρήθηκε (2026-08-25) ότι **δεν έδειχνε καμία**: `confidence` και
 * `isClassified` είχαν **0** καταναλωτές παραγωγής. Αυτές οι άγκυρες
 * χαρακτηρίζουν τις αναλλοίωτες που, αν σπάσουν σιωπηλά, ξαναφέρνουν το
 * ελάττωμα:
 *
 *   Ο-1  `unknown` ⇒ **ΠΡΟΤΑΣΗ**, ποτέ ερώτηση/modal (Ε7.γ′ · Α5)
 *   Ο-2  🔴 Η κατάσταση φαίνεται με **ΚΕΙΜΕΝΟ**, όχι μόνο χρώμα (3.41 · WCAG 1.4.1)
 *   Ο-3  🔴 Ελεύθερο κείμενο **ΔΕΝ** βγάζει κενή οθόνη — η συνηθισμένη περίπτωση
 *   Ο-4  Η **ΣΥΝΕΠΕΙΑ** («τι δουλειά υποδεικνύει») είναι ορατή
 *   Ο-5  Άγνωστο επάγγελμα ⇒ **σιωπή**, ποτέ μαντεψιά
 *   Ο-6  🔒 Α4: πουθενά ισχυρισμός δικαιώματος
 *
 * ⚠️ Οι μεταλλάξεις γίνονται **ΣΤΗΝ ΕΙΣΟΔΟ** (το `currentView`), ποτέ στον
 * κώδικα του component — πρότυπο `useDeclaredOccupation.test.tsx`.
 */

import { render, screen } from '@testing-library/react';
import type { DeclaredOccupationView } from '@/hooks/useDeclaredOccupation';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DeclaredOccupationBadge } from '../DeclaredOccupationBadge';

let currentView: DeclaredOccupationView;
const pushSpy = jest.fn();

jest.mock('@/hooks/useDeclaredOccupation', () => ({
  useDeclaredOccupation: () => currentView,
}));

jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

/**
 * Το i18n επιστρέφει **το κλειδί**, ώστε οι άγκυρες να κλειδώνουν *ποια
 * πρόταση ειπώθηκε* και όχι *πώς μεταφράστηκε σήμερα*. Η παρεμβολή κρατιέται
 * ορατή, γιατί το «Προτείνει: {job}» είναι ακριβώς η **συνέπεια** που ελέγχεται.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params && 'job' in params ? `${key}|${String(params.job)}` : key,
  }),
}));

const UNKNOWN: DeclaredOccupationView = {
  occupation: null,
  confidence: 'unknown',
  isClassified: false,
  iscoCode: null,
};

/** Πολιτικός μηχανικός — ISCO 2142, μέσα στο δηλωμένο πρόθεμα `214` ⇒ Σχέδιο. */
const ENGINEER: DeclaredOccupationView = {
  occupation: {
    profession: 'Πολιτικός Μηχανικός',
    escoUri: 'http://data.europa.eu/esco/occupation/civil',
    escoLabel: 'πολιτικός μηχανικός',
    iscoCode: '2142',
  },
  confidence: 'declared',
  isClassified: true,
  iscoCode: '2142',
};

/**
 * ⚠️ Ο `TooltipProvider` ΔΕΝ είναι διακοσμητικό του test: το badge ζει στην
 * κεφαλίδα, δηλαδή **μέσα** στον provider του `(app)/layout.tsx` (και του
 * `(auth)`). Το κεντρικό Tooltip (CHECK 3.23 — ποτέ native `title=`) **πετά**
 * χωρίς πρόγονο provider, οπότε render χωρίς αυτόν θα δοκίμαζε το component σε
 * περιβάλλον που **δεν υπάρχει**.
 */
function show(view: DeclaredOccupationView) {
  currentView = view;
  return render(
    <TooltipProvider>
      <DeclaredOccupationBadge />
    </TooltipProvider>
  );
}

beforeEach(() => pushSpy.mockClear());

// ============================================================================

describe('Ο-1 — `unknown` ⇒ ΠΡΟΤΑΣΗ, ποτέ ερώτηση', () => {
  it('προτείνει με ήπιο κείμενο και δεν κατηγορεί', () => {
    show(UNKNOWN);
    expect(screen.getByText('jobs.occupation.declare')).toBeInTheDocument();
    expect(screen.getByText('jobs.occupation.undeclaredHint')).toBeInTheDocument();
  });

  it('🔒 ΚΑΜΙΑ modal/dialog — Ε7.γ′ («καμία ερώτηση, κανένα modal»)', () => {
    const { container } = show(UNKNOWN);
    // Ο Revit 2022 ρωτά με modal και έχει άρθρο «How to disable». Η άγκυρα
    // κλειδώνει ότι δεν το επαναλαμβάνουμε: ένα κουμπί, μέσα σε ανοιγμένο μενού.
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('ένα κλικ πάει στο προφίλ και κλείνει τον φιλοξενητή', () => {
    const onNavigate = jest.fn();
    currentView = UNKNOWN;
    render(<DeclaredOccupationBadge onNavigate={onNavigate} />);
    screen.getByRole('button').click();
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith('/account/profile');
  });
});

describe('Ο-2 🔴 η κατάσταση φαίνεται με ΚΕΙΜΕΝΟ, όχι μόνο χρώμα (3.41)', () => {
  it('`declared` λέει ρητά ότι είναι ανεπαλήθευτο', () => {
    show(ENGINEER);
    expect(screen.getByText('jobs.occupation.declared')).toBeInTheDocument();
    expect(screen.queryByText('jobs.occupation.verified')).toBeNull();
  });

  it('`verified` λέει ρητά ότι είναι επαληθευμένο', () => {
    show({ ...ENGINEER, confidence: 'verified' });
    expect(screen.getByText('jobs.occupation.verified')).toBeInTheDocument();
    expect(screen.queryByText('jobs.occupation.declared')).toBeNull();
  });

  it('🔑 ΤΟ ΖΕΥΓΟΣ: οι δύο καταστάσεις ΔΕΝ λένε το ίδιο πράγμα', () => {
    // Χωρίς αυτό, μια μετάλλαξη που βάφει και τις δύο με το ίδιο κείμενο θα
    // περνούσε πράσινη — και το `declared` θα διαβαζόταν ως `verified`, που
    // ΕΙΝΑΙ η βλάβη που το §7 υπάρχει για να κλείσει.
    const a = show(ENGINEER).container.textContent ?? '';
    const b = show({ ...ENGINEER, confidence: 'verified' }).container.textContent ?? '';
    expect(a).not.toEqual(b);
  });
});

describe('Ο-3 🔴 ελεύθερο κείμενο — η ΣΥΝΗΘΙΣΜΕΝΗ περίπτωση δεν βγάζει κενό', () => {
  it('δείχνει το `profession` όταν λείπει το `escoLabel`', () => {
    // ADR-132 §1: η δήλωση χωρίς ESCO είναι **νόμιμη**, όχι ημιτελής. Ένας
    // καταναλωτής που δείχνει μόνο `escoLabel` δείχνει **τίποτα** ακριβώς εδώ.
    show({
      occupation: { profession: 'Ξυλουργός' },
      confidence: 'declared',
      isClassified: false,
      iscoCode: null,
    });
    expect(screen.getByText('Ξυλουργός')).toBeInTheDocument();
  });

  it('προτιμά το `escoLabel` όταν υπάρχει — αυθεντία η ταξινομία', () => {
    show(ENGINEER);
    expect(screen.getByText('πολιτικός μηχανικός')).toBeInTheDocument();
  });
});

describe('Ο-4 — η ΣΥΝΕΠΕΙΑ είναι ορατή, από τον ίδιο πίνακα που την εκτελεί', () => {
  it('ο μηχανικός (ISCO 214) βλέπει ότι προτείνει το Σχέδιο', () => {
    show(ENGINEER);
    expect(screen.getByText('jobs.occupation.suggests|jobs.design.label')).toBeInTheDocument();
  });

  it('ο δικηγόρος (ISCO 2611) βλέπει Πελάτες — ίδιο σχήμα, άλλη απάντηση', () => {
    show({ ...ENGINEER, iscoCode: '2611' });
    expect(screen.getByText('jobs.occupation.suggests|jobs.clients.label')).toBeInTheDocument();
  });
});

describe('Ο-5 — άγνωστο επάγγελμα ⇒ σιωπή, ΠΟΤΕ μαντεψιά', () => {
  it('εκτός πίνακα συγγένειας δεν επινοεί δουλειά', () => {
    // Οι διασταυρώσεις ESCO→O*NET της ΕΕ **δεν μπορούν** να πουν «δεν ξέρω».
    // Εδώ η απουσία είναι ονομασμένη κατάσταση.
    show({ ...ENGINEER, iscoCode: '9999' });
    expect(screen.getByText('jobs.occupation.noSuggestion')).toBeInTheDocument();
  });

  /**
   * 🔴 **ΑΛΛΑΞΕ 2026-08-26 (ADR-798 §20) — Η ΑΓΚΥΡΑ ΚΛΕΙΔΩΝΕ ΤΟ ΛΑΘΟΣ.**
   *
   * Απαιτούσε `noSuggestion` — *«δεν αντιστοιχεί σε συγκεκριμένη δουλειά»* — για
   * **ελεύθερο κείμενο**. Αυτό είναι **ισχυρισμός που δεν μπορούμε να
   * στηρίξουμε**: κανένας ταξινομητής δεν ρωτήθηκε ποτέ, άρα δεν ξέρουμε αν
   * αντιστοιχεί. Είναι η **απουσία γνώσης παρουσιασμένη ως γνώση** — η ίδια
   * βλάβη που ολόκληρο το ADR-798 υπάρχει για να αποτρέψει (Α5).
   */
  it('ελεύθερο κείμενο ΔΕΝ ισχυρίζεται ότι δεν αντιστοιχεί — καλεί σε ταξινόμηση', () => {
    show({
      occupation: { profession: 'Ξυλουργός' },
      confidence: 'declared',
      isClassified: false,
      iscoCode: null,
    });
    expect(screen.getByText('jobs.occupation.unclassifiedHint')).toBeInTheDocument();
    expect(screen.queryByText('jobs.occupation.noSuggestion')).not.toBeInTheDocument();
  });

  it('ταξινομημένο εκτός πίνακα ΟΝΤΩΣ δεν αντιστοιχεί — εκεί ο ισχυρισμός στέκει', () => {
    // ISCO 2163 (σχεδιαστές προϊόντος): έγκυρος, ταξινομημένος, και ο πίνακας
    // **σκόπιμα** σωπαίνει (δεν σχεδιάζει κτίρια). Εδώ το «δεν αντιστοιχεί»
    // είναι αληθές, γιατί ρωτήθηκε ταξινομητής και απάντησε.
    show({
      occupation: {
        profession: 'Σχεδιάστρια προϊόντος',
        escoUri: 'http://data.europa.eu/esco/occupation/product-designer',
        escoLabel: 'σχεδιαστής προϊόντος',
        iscoCode: '2163',
      },
      confidence: 'declared',
      isClassified: true,
      iscoCode: '2163',
    });
    expect(screen.getByText('jobs.occupation.noSuggestion')).toBeInTheDocument();
  });

  /**
   * 🔑 **ΤΟ ΖΕΥΓΟΣ.** Χωρίς αυτό, μια «απλοποίηση» που ξαναενώνει τις δύο σιωπές
   * σε ένα μήνυμα θα άφηνε **και τις δύο** παραπάνω άγκυρες πράσινες αν το
   * κοινό μήνυμα τύχαινε να είναι εκείνο που καθεμιά περιμένει. Η ταυτότητα
   * της βλάβης είναι ότι **δύο διαφορετικές καταστάσεις λένε το ίδιο**.
   */
  it('🔴 οι ΔΥΟ σιωπές ΔΕΝ λένε το ίδιο πράγμα', () => {
    const freeText = show({
      occupation: { profession: 'Ξυλουργός' },
      confidence: 'declared',
      isClassified: false,
      iscoCode: null,
    }).container.textContent;
    const classified = show({
      occupation: {
        profession: 'Σχεδιάστρια προϊόντος',
        escoUri: 'http://data.europa.eu/esco/occupation/product-designer',
        escoLabel: 'σχεδιαστής προϊόντος',
        iscoCode: '2163',
      },
      confidence: 'declared',
      isClassified: true,
      iscoCode: '2163',
    }).container.textContent;
    expect(freeText).not.toBe(classified);
  });
});

describe('Ο-6 🔒 Α4 — πουθενά ισχυρισμός δικαιώματος', () => {
  it('το κείμενο λέει «προτείνει», ποτέ «δίνει πρόσβαση»', () => {
    // Το επάγγελμα είναι **αυτο-δηλωμένο** (NIST SP 800-63 IAL1): κατάλληλο για
    // εξατομίκευση, ΠΟΤΕ για εξουσιοδότηση. Η άγκυρα κλειδώνει το λεξιλόγιο.
    const text = show(ENGINEER).container.textContent ?? '';
    expect(text).toContain('suggests');
    for (const forbidden of ['permission', 'grant', 'access', 'role']) {
      expect(text.toLowerCase()).not.toContain(forbidden);
    }
  });
});
