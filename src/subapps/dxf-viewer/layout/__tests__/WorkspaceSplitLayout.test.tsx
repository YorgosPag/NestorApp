/**
 * ADR-724 Φ1 — Ο χώρος εργασίας: αγκυρωμένη παλέτα με αλλαγή πλάτους.
 *
 * ⚠️ Τι ΔΕΝ αποδεικνύουν αυτά τα tests: το jsdom δεν έχει διάταξη και ο `ResizeObserver` είναι
 * mock (jest.setup) ⇒ **κανένα πραγματικό pixel δεν μετριέται εδώ**. Ελέγχεται η *δομή* και η
 * *πολιτική* — ό,τι θα έσπαγε σιωπηλά σε refactor. Η αίσθηση του συρσίματος και η απόδοση
 * ελέγχονται ζωντανά (ADR-724 §4.3).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

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

import { WorkspaceSplitLayout } from '../WorkspaceSplitLayout';
import { getDockedWidth, setDockedWidth } from '../../systems/workspace/workspace-dock-store';
// ADR-724 §5.2 — το πληκτρολόγιο του splitter ΔΕΝ ζει σε αυτό το αρχείο· ζει στον φύλακα
// ιδιοκτησίας πλήκτρων (ADR-711). Το test το ρωτά εκεί ακριβώς επειδή εκεί είναι η αιτία.
import { shouldGlobalShortcutYield } from '@/lib/a11y/keyboard-scope';

const SIDEBAR = <aside data-testid="sidebar">παλέτα</aside>;
const CANVAS = <section data-testid="canvas">καμβάς</section>;

function renderLayout(split: boolean) {
  return render(
    <WorkspaceSplitLayout split={split} sidebar={SIDEBAR}>
      {CANVAS}
    </WorkspaceSplitLayout>,
  );
}

beforeEach(() => {
  localStorage.clear();
  setDockedWidth(384);
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
