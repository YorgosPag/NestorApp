/**
 * ADR-724 Φ1 — Ο χώρος εργασίας: αγκυρωμένη παλέτα με αλλαγή πλάτους.
 *
 * ⚠️ Τι ΔΕΝ αποδεικνύουν αυτά τα tests: το jsdom δεν έχει διάταξη και ο `ResizeObserver` είναι
 * mock (jest.setup) ⇒ **κανένα πραγματικό pixel δεν μετριέται εδώ**. Ελέγχεται η *δομή* και η
 * *πολιτική* — ό,τι θα έσπαγε σιωπηλά σε refactor. Η αίσθηση του συρσίματος και η απόδοση
 * ελέγχονται ζωντανά (ADR-724 §4.3).
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Ο `t()` επιστρέφει το κλειδί ⇒ ένα hardcoded string θα φαινόταν αμέσως στα assertions.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

// Το store περνά ΑΥΤΟΥΣΙΟ (requireActual) — μόνο η ανάγνωση καταγράφεται, ώστε να αποδεικνύεται
// ότι το αρχικό πλάτος έρχεται από την αποθηκευμένη προτίμηση και όχι από σταθερά (βλ. §8.1:
// το `defaultSize` είναι ΚΑΙ ο στόχος του διπλού κλικ, άρα μια σταθερά εκεί χαλά δύο πράγματα).
const mockGetDockedWidth = jest.fn();
jest.mock('../../systems/workspace/workspace-dock-store', () => {
  const actual = jest.requireActual('../../systems/workspace/workspace-dock-store');
  return {
    ...actual,
    getDockedWidth: (): number => {
      mockGetDockedWidth();
      return actual.getDockedWidth();
    },
  };
});

/*
  ADR-724 Φ3 — Η αιωρούμενη παλέτα αντικαθίσταται με δείκτη, ΕΠΙΤΗΔΕΣ.

  Το `WorkspaceFloatingPalette` σέρνει μαζί του `FloatingPanel` → `useDraggable` →
  `useResizable` → design tokens → localStorage. Αν αποδιδόταν εδώ, αυτό το αρχείο θα έπαυε να
  ελέγχει **διακλάδωση διάταξης** και θα γινόταν integration test της αιώρησης — δηλαδή θα
  κοκκίνιζε για λόγους άσχετους με τον σκοπό του. Η ίδια η αιώρηση ελέγχεται στο δικό της
  αρχείο (`WorkspaceFloatingPalette.test.tsx`).
*/
jest.mock('../WorkspaceFloatingPalette', () => ({
  WorkspaceFloatingPalette: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="floating-palette">{children}</div>
  ),
}));

import { WorkspaceSplitLayout } from '../WorkspaceSplitLayout';
import { getDockedWidth, setDockedWidth, setDockMode } from '../../systems/workspace/workspace-dock-store';
// ADR-724 §5.2 — το πληκτρολόγιο του splitter ΔΕΝ ζει σε αυτό το αρχείο· ζει στον φύλακα
// ιδιοκτησίας πλήκτρων (ADR-711). Το test το ρωτά εκεί ακριβώς επειδή εκεί είναι η αιτία.
import { shouldGlobalShortcutYield } from '@/lib/a11y/keyboard-scope';

const SIDEBAR = <aside data-testid="sidebar">παλέτα</aside>;
const CANVAS = <section data-testid="canvas">καμβάς</section>;

/**
 * Ποια **μορφή** ζήτησε η διάταξη από την παλέτα στο τελευταίο render (ADR-724 Φ3).
 *
 * Το `variant` δεν είναι διακοσμητικό: αποφασίζει ποιος φοράει το περίγραμμα/σκιά. Λάθος τιμή
 * ⇒ διπλή κάρτα μέσα στο `FloatingPanel`. Είναι παρατηρήσιμο **μόνο** από τον καλούντα, γι'
 * αυτό καταγράφεται εδώ.
 */
let requestedVariant: string | null = null;

function renderLayout(split: boolean) {
  return render(
    <WorkspaceSplitLayout
      split={split}
      sidebar={(variant) => { requestedVariant = variant; return SIDEBAR; }}
    >
      {CANVAS}
    </WorkspaceSplitLayout>,
  );
}

beforeEach(() => {
  localStorage.clear();
  requestedVariant = null;
  setDockedWidth(384);
  setDockMode('docked-left'); // το store είναι module singleton — η πλευρά επιζεί των tests
});

describe('ADR-724 Φ1 — WorkspaceSplitLayout', () => {
  describe('split={false} — tablet/mobile (§4.5: τίποτα δεν αλλάζει)', () => {
    it('αποδίδει παλέτα και καμβά ως αδέλφια, χωρίς κανένα wrapper', () => {
      const { container } = renderLayout(false);
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
      // Fragment ⇒ τα δύο παιδιά είναι ΑΜΕΣΑ παιδιά του container: μηδέν επιπλέον DOM.
      expect(container.children).toHaveLength(2);
    });

    it('ΔΕΝ υπάρχει διαχωριστικό — δεν υπάρχει πλάτος να αλλάξει σε συρτάρι', () => {
      renderLayout(false);
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });
  });

  describe('split={true} — desktop', () => {
    it('αποδίδει και τα δύο panel', () => {
      renderLayout(true);
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    it('το διαχωριστικό είναι WAI-ARIA splitter με προσβάσιμο όνομα από τα locales', () => {
      renderLayout(true);
      const separator = screen.getByRole('separator');
      // Ο t() στο περιβάλλον test επιστρέφει το κλειδί ⇒ αποδεικνύει ότι ΔΕΝ είναι hardcoded.
      expect(separator).toHaveAccessibleName('workspaceDock.separatorLabel');
    });

    it('το διαχωριστικό είναι εστιάσιμο (WAI-ARIA window splitter)', () => {
      renderLayout(true);
      expect(screen.getByRole('separator')).toHaveAttribute('tabindex', '0');
    });

    // ── ADR-724 §5.2 — Ο ΛΟΓΟΣ ΠΟΥ ΑΥΤΟ ΤΟ TEST ΞΑΝΑΓΡΑΦΤΗΚΕ ──
    //
    // Εδώ ζούσε ένα test με όνομα «αλλαγή πλάτους από πληκτρολόγιο (το VS Code ΔΕΝ το
    // έχει)» που έλεγχε **μόνο** `tabIndex === 0`. Ήταν πράσινο ενώ η δυνατότητα ήταν
    // νεκρή: μετρημένο ζωντανά, 3× ArrowLeft με εστίαση στο διαχωριστικό άφηναν το
    // πλάτος 670→670 και μετακινούσαν το ΣΧΕΔΙΟ (offsetX 3883→4123).
    //
    // Η εστιασιμότητα δεν αποδεικνύει ιδιοκτησία πλήκτρου. Η αιτία ήταν ότι οι global
    // accelerators (window **capture**) έτρεχαν πριν τον handler της βιβλιοθήκης
    // (element-level **bubble**, `if (e.defaultPrevented) return;`). Άρα το πραγματικό
    // συμβόλαιο είναι: **ο accelerator παραιτείται**. Αυτό ελέγχεται εδώ.
    it('ο ρόλος του διαχωριστικού κάνει τους global accelerators να παραιτούνται από τα βέλη', () => {
      renderLayout(true);
      const separator = screen.getByRole('separator');

      expect(shouldGlobalShortcutYield({ target: separator, key: 'ArrowLeft' })).toBe(true);
      expect(shouldGlobalShortcutYield({ target: separator, key: 'End' })).toBe(true);
    });

    it('…αλλά ΟΧΙ από τα γράμματα — οι εντολές του viewer μένουν ζωντανές', () => {
      // Ο πήχης της υπερδιόρθωσης: με εστίαση στο διαχωριστικό, το «Z» (zoom) πρέπει να
      // φτάνει κανονικά. Μόνο τα πλοηγικά πλήκτρα ανήκουν στο splitter.
      renderLayout(true);
      expect(shouldGlobalShortcutYield({ target: screen.getByRole('separator'), key: 'z' }))
        .toBe(false);
    });

    it('εκθέτει τις τιμές του splitter (aria-valuenow/min/max) για αναγνώστες οθόνης', () => {
      const separator = renderLayout(true).getByRole('separator');
      expect(separator).toHaveAttribute('aria-valuenow');
      expect(separator).toHaveAttribute('aria-valuemin');
      expect(separator).toHaveAttribute('aria-valuemax');
    });

    it('τα ΑΜΕΣΑ παιδιά του group είναι ακριβώς panel · separator · panel (§4.7)', () => {
      const { container } = renderLayout(true);
      const group = container.querySelector('[data-group]');
      expect(group).not.toBeNull();
      const roles = Array.from(group?.children ?? []).map((child) =>
        child.hasAttribute('data-panel') ? 'panel'
          : child.hasAttribute('data-separator') ? 'separator'
            : child.tagName,
      );
      expect(roles).toEqual(['panel', 'separator', 'panel']);
    });
  });

  describe('η αποθηκευμένη προτίμηση φτάνει στο `defaultSize`', () => {
    it('το αρχικό πλάτος διαβάζεται από το store στο mount, όχι από σταθερά', () => {
      mockGetDockedWidth.mockClear();
      setDockedWidth(640);
      renderLayout(true);
      expect(mockGetDockedWidth).toHaveBeenCalled();
      expect(getDockedWidth()).toBe(640);
    });

    // ⚠️ Το ΠΟΣΑ pixels κατέληξε το panel ΔΕΝ ελέγχεται εδώ: το jsdom δεν κάνει διάταξη, οπότε
    // η βιβλιοθήκη πέφτει σε ισομερή κατανομή (`flex-grow: 50` και στα δύο) και κάθε assertion
    // σε pixels θα επιβεβαίωνε τεχνούργημα του περιβάλλοντος, όχι συμπεριφορά. Το ίδιο ισχύει
    // για το «μετά το διπλό κλικ το store ακολουθεί τη βιβλιοθήκη». Επαληθεύονται ζωντανά.
  });

  // ── ADR-724 §14.2 Ε3 — Η ΕΓΓΡΑΦΗ ΤΟΥ ΠΛΗΚΤΡΟΛΟΓΙΟΥ ──
  //
  // Μετρημένο ζωντανά 2026-07-28 σε καθαρό build: με **σύρσιμο** το store έγραφε σωστά· με
  // **πλήκτρο** το πλάτος άλλαζε (531,1 → 647,5) αλλά η εγγραφή **δεν γινόταν ποτέ** ⇒ το
  // keyboard resize ξεχνιόταν στο επόμενο άνοιγμα. Η βιβλιοθήκη τεκμηριώνει το
  // `onLayoutChanged` ως «μετά την απελευθέρωση του δείκτη» — και το πληκτρολόγιο **δεν έχει**
  // απελευθέρωση δείκτη. Γι' αυτό η εγγραφή σκανδαλίζεται ΚΑΙ από το `onKeyDown`.
  //
  // ⚠️ Το jsdom δεν κάνει διάταξη, οπότε το `getBoundingClientRect().width` του panel είναι
  // mock-αρισμένο: εδώ κλειδώνεται **ότι η εγγραφή πυροδοτείται** και **με ποια τιμή**, όχι το
  // πόσα pixel υπολόγισε η βιβλιοθήκη (αυτό μετριέται ζωντανά).
  describe('το πλήκτρο αποθηκεύει το πλάτος (δεν περιμένει `onLayoutChanged`)', () => {
    /**
     * Η εγγραφή αναβάλλεται ΕΝΑ καρέ (το layout δεν έχει γίνει flush τη στιγμή του keydown).
     * ⚠️ Σε **κρυφή** καρτέλα το `requestAnimationFrame` παγώνει — γι' αυτό η ζωντανή
     * επαλήθευση απαιτεί ενεργή καρτέλα (ADR-711 §7.2, ίδια παγίδα).
     */
    async function flushFrame(): Promise<void> {
      await act(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      });
    }

    /** Οι εγγραφές **του δικού μας κλειδιού** — το jsdom localStorage το μοιράζονται όλοι. */
    function dockWrites(spy: jest.SpyInstance): unknown[] {
      return spy.mock.calls.filter(([key]) => String(key).includes('workspace-dock'));
    }

    // ⚠️⚠️ ΤΙ **ΔΕΝ** ΜΠΟΡΕΙ ΝΑ ΕΛΕΓΧΘΕΙ ΕΔΩ — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΓΡΑΦΤΗΚΕ ΨΕΥΤΙΚΟ TEST
    //
    // Το «`ArrowLeft` ⇒ γίνεται εγγραφή» **είναι** το ελάττωμα που διορθώθηκε, αλλά είναι
    // **αδύνατο** να ελεγχθεί σε jsdom: ο **native** keydown listener της βιβλιοθήκης τρέχει
    // πριν από τον δικό μας (React delegated) και πετά «Previous layout not found» — δεν
    // υπάρχει πραγματική διάταξη να μεταβάλει. Μετρημένο: όταν πετάει, ο δικός μας handler
    // **δεν τρέχει καθόλου**, ούτε με `try/catch` γύρω από το `fireEvent`.
    //
    // Άρα κάθε assertion εδώ θα μετρούσε **το jsdom**, όχι τον κώδικά μας — και ένα test που
    // περνά για λάθος λόγο είναι χειρότερο από κανένα (βλ. το ξαναγραμμένο test παραπάνω).
    // ➜ Επαληθεύεται **ζωντανά**, σε **ενεργή** καρτέλα: σε κρυφή καρτέλα το
    //   `requestAnimationFrame` παγώνει και η εγγραφή δεν προλαβαίνει ποτέ να τρέξει.
    //
    // Ό,τι ΜΠΟΡΕΙ να ελεγχθεί ελέγχεται: ότι ένα **μη**-resize πλήκτρο δεν γράφει (η
    // βιβλιοθήκη δεν το αγγίζει, άρα δεν πετά, άρα ο handler μας τρέχει κανονικά).

    it('πλήκτρο που ΔΕΝ αλλάζει πλάτος (Tab) δεν γράφει τίποτα', async () => {
      renderLayout(true);
      const spy = jest.spyOn(Storage.prototype, 'setItem');

      fireEvent.keyDown(screen.getByRole('separator'), { key: 'Tab' });
      await flushFrame();

      // Αλλιώς κάθε πλοήγηση με Tab πάνω από το διαχωριστικό θα ξανάγραφε την προτίμηση.
      expect(dockWrites(spy)).toHaveLength(0);
      spy.mockRestore();
    });

  });

  // ══════════════════════════════════════════════════════════════════════════
  // ADR-724 Φ2 — αγκύρωση δεξιά
  // ══════════════════════════════════════════════════════════════════════════

  describe('Φ2 — η πλευρά αλλάζει τη ΣΕΙΡΑ, όχι τη σύσταση', () => {
    /** Τα άμεσα παιδιά του group, χαρακτηρισμένα με το τι περιέχουν. */
    function groupOrder(container: HTMLElement): string[] {
      const group = container.querySelector('[data-group]');
      return Array.from(group?.children ?? []).map((child) => {
        if (child.hasAttribute('data-separator')) return 'separator';
        if (child.querySelector('[data-testid="sidebar"]')) return 'sidebar';
        if (child.querySelector('[data-testid="canvas"]')) return 'canvas';
        return child.tagName;
      });
    }

    it('αριστερά (προεπιλογή) ⇒ παλέτα · διαχωριστικό · καμβάς', () => {
      const { container } = renderLayout(true);
      expect(groupOrder(container)).toEqual(['sidebar', 'separator', 'canvas']);
    });

    it('δεξιά ⇒ καμβάς · διαχωριστικό · παλέτα', () => {
      setDockMode('docked-right');
      const { container } = renderLayout(true);
      expect(groupOrder(container)).toEqual(['canvas', 'separator', 'sidebar']);
    });

    it('ο δομικός περιορισμός §4.7 (panel·separator·panel) ισχύει ΚΑΙ δεξιά', () => {
      setDockMode('docked-right');
      const { container } = renderLayout(true);
      const group = container.querySelector('[data-group]');
      const roles = Array.from(group?.children ?? []).map((child) =>
        child.hasAttribute('data-panel') ? 'panel'
          : child.hasAttribute('data-separator') ? 'separator'
            : child.tagName,
      );
      expect(roles).toEqual(['panel', 'separator', 'panel']);
    });

    /**
     * ⚠️⚠️ ΤΟ ΣΗΜΑΝΤΙΚΟΤΕΡΟ TEST ΑΥΤΟΥ ΤΟΥ ΑΡΧΕΙΟΥ.
     *
     * Η αντιστροφή σειράς είναι μία γραμμή· το **κόστος** της είναι ολόκληρο το υποδέντρο του
     * καμβά. Χωρίς σταθερά `key`, ο React ταιριάζει τα παιδιά **κατά θέση** και ξαναφτιάχνει
     * και τα δύο panel ⇒ ο πραγματικός `<canvas>` **χάνει το WebGL context του**, η σκηνή
     * ξαναχτίζεται και το bitmap cache ακυρώνεται — δευτερόλεπτα παγώματος για μια εντολή
     * μενού. Στο jsdom δεν υπάρχει WebGL για να χαθεί, γι' αυτό ο έλεγχος γίνεται στο **μόνο**
     * παρατηρήσιμο ίχνος: την **ταυτότητα του κόμβου**.
     *
     * `toBe` (ταυτότητα αντικειμένου), **όχι** `toBeInTheDocument`: ένας νέος κόμβος με ίδιο
     * περιεχόμενο θα περνούσε το δεύτερο και θα έκρυβε ακριβώς την παλινδρόμηση.
     */
    it('η αλλαγή πλευράς ΜΕΤΑΚΙΝΕΙ τους κόμβους — δεν τους ξαναφτιάχνει', () => {
      renderLayout(true);
      const canvasBefore = screen.getByTestId('canvas');
      const sidebarBefore = screen.getByTestId('sidebar');

      act(() => { setDockMode('docked-right'); });

      expect(screen.getByTestId('canvas')).toBe(canvasBefore);
      expect(screen.getByTestId('sidebar')).toBe(sidebarBefore);
    });

    it('η αλλαγή πλευράς ΔΕΝ γράφει πλάτος (το `onLayoutChanged` δεν είναι πρόθεση χρήστη)', () => {
      renderLayout(true);
      const spy = jest.spyOn(Storage.prototype, 'setItem');

      act(() => { setDockMode('docked-right'); });

      // Ο φύλακας «πρόθεσης χρήστη» πρέπει να κρατήσει: αλλιώς η αναδιάταξη θα κατέγραφε ως
      // «προτίμηση» ό,τι πλάτος έτυχε να μετρήσει η βιβλιοθήκη κατά την αναδιάταξη.
      const widthWrites = spy.mock.calls
        .filter(([key]) => String(key).includes('workspace-dock-width'));
      expect(widthWrites).toHaveLength(0);
      spy.mockRestore();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ADR-724 Φ3 — αιωρούμενη
  // ══════════════════════════════════════════════════════════════════════════

  describe('🔴 Φ3 — η αιώρηση ΔΕΝ επιτρέπεται να πέσει στον κλάδο της αγκύρωσης', () => {
    /*
      ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ describe (handoff §4β, ADR-724 §14.8):

      Μέχρι τη Φ2 η διάταξη ρωτούσε `isDockedRight(mode) ? [καμβάς,δ,παλέτα] : [παλέτα,δ,καμβάς]`.
      Ένα **δυαδικό** predicate πάνω σε **τριμερή** ένωση δεν παράγει σφάλμα μεταγλώττισης: το
      `'floating'` απαντά «όχι δεξιά» και πέφτει στο `else`. Αποτέλεσμα: ο χρήστης επιλέγει
      «Αιωρούμενη» και παίρνει **αγκυρωμένη αριστερά** — με διαχωριστικό, με splitter, με τα πάντα.

      Κάθε test εδώ κοκκινίζει αν κάποιος επαναφέρει το δυαδικό predicate.
    */
    it('καμία ομάδα splitter — η αιωρούμενη παλέτα δεν μοιράζεται χώρο με τίποτα', () => {
      setDockMode('floating');
      const { container } = renderLayout(true);
      expect(container.querySelector('[data-group]')).toBeNull();
    });

    it('κανένα διαχωριστικό — δεν υπάρχει πλάτος panel να αλλάξει', () => {
      setDockMode('floating');
      renderLayout(true);
      expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    });

    it('η παλέτα αποδίδεται ΜΕΣΑ στο αιωρούμενο δοχείο, όχι σε panel', () => {
      setDockMode('floating');
      renderLayout(true);
      const host = screen.getByTestId('floating-palette');
      expect(host).toContainElement(screen.getByTestId('sidebar'));
      // Και ο καμβάς **έξω** από αυτό: αν ήταν μέσα, η παλέτα θα «περιείχε» τον καμβά.
      expect(host).not.toContainElement(screen.getByTestId('canvas'));
    });

    it('ο καμβάς παραμένει ορατός — η αιώρηση δεν είναι απόκρυψη', () => {
      setDockMode('floating');
      renderLayout(true);
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });
  });

  describe('Φ3 — ποια μορφή ζητείται από την παλέτα', () => {
    it('αγκυρωμένη ⇒ «inline» (η παλέτα ΕΙΝΑΙ η κάρτα)', () => {
      renderLayout(true);
      expect(requestedVariant).toBe('inline');
    });

    it('αιωρούμενη ⇒ «floating» (η κάρτα είναι το FloatingPanel ⇒ μηδέν διπλό περίγραμμα)', () => {
      setDockMode('floating');
      renderLayout(true);
      expect(requestedVariant).toBe('floating');
    });

    it('🔴 κινητό ⇒ «drawer» ΑΚΟΜΗ ΚΑΙ ΜΕ αποθηκευμένο «floating»', () => {
      // Το dock system είναι desktop-only (§4.5). Ένας χρήστης που άφησε την παλέτα
      // αιωρούμενη στο desktop και άνοιξε τον viewer σε tablet ΔΕΝ πρέπει να πάρει
      // αιωρούμενο panel μέσα σε συρτάρι. Ο έλεγχος `split` προηγείται — και αυτό το test
      // είναι ο λόγος που τα δύο ερωτήματα δεν συγχωνεύτηκαν σε έναν διακόπτη.
      setDockMode('floating');
      renderLayout(false);
      expect(requestedVariant).toBe('drawer');
      expect(screen.queryByTestId('floating-palette')).not.toBeInTheDocument();
    });
  });

  describe('ADR-040 — το αρχικό πλάτος διαβάζεται ΜΙΑ φορά', () => {
    it('αλλαγή του store μετά το mount ΔΕΝ ξαναστήνει τη διάταξη πάνω από τον χρήστη', () => {
      renderLayout(true);
      const separator = screen.getByRole('separator');
      const before = separator.getAttribute('aria-valuenow');

      setDockedWidth(700); // καμία συνδρομή ⇒ κανένα re-render

      expect(screen.getByRole('separator').getAttribute('aria-valuenow')).toBe(before);
    });
  });
});
