/**
 * ADR-724 Φ2/Φ3 — Η γραμμή τίτλου: **ένα** component, δύο καταστάσεις.
 *
 * Ο λόγος που αυτό το αρχείο υπάρχει χωριστά από το `WorkspaceFloatingPalette.test.tsx`: η
 * επικεφαλίδα είναι η **μόνη** επιφάνεια που πρέπει να λειτουργεί **και** μέσα **και** έξω από
 * `FloatingPanel`. Κάθε test εδώ τρέχει και στις δύο περιπτώσεις όπου έχει νόημα.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

import { WorkspacePaletteHeader } from '../WorkspacePaletteHeader';
import { FloatingPanel } from '@/components/ui/floating';
import { zIndex } from '@/styles/design-tokens';
import {
  getDockMode,
  setDockMode,
  getLastDockedSide,
} from '../../systems/workspace/workspace-dock-store';

/** Αγκυρωμένη: καμία `FloatingPanel` πρόγονος ⇒ το context είναι `null`. */
function renderDocked() {
  return render(<WorkspacePaletteHeader />);
}

/** Αιωρούμενη: ίδιο ακριβώς component, μέσα στο panel του ADR-723. */
function renderFloating() {
  return render(
    <FloatingPanel persistenceKey="dxf.workspace-sidebar" resizable>
      <WorkspacePaletteHeader />
    </FloatingPanel>,
  );
}

function header(): HTMLElement {
  return screen.getByRole('heading', { name: 'workspaceDock.title' }).parentElement as HTMLElement;
}

function menuButton(): HTMLElement {
  return screen.getByRole('button', { name: 'workspaceDock.menuLabel' });
}

/**
 * ⚠️ ΜΕ ΠΛΗΚΤΡΟ, ΟΧΙ ΜΕ `click` — ΚΑΙ ΕΙΝΑΙ ΚΑΛΥΤΕΡΟ ΕΤΣΙ.
 *
 * Το Radix ανοίγει τα μενού του σε `pointerdown`, όχι σε `click`. Το jsdom δεν υλοποιεί
 * `PointerEvent`, οπότε το `fireEvent.pointerDown` παράγει γενικό `Event` χωρίς `button`/
 * `ctrlKey` — και ο έλεγχος του Radix το απορρίπτει σιωπηλά. Ένα `fireEvent.click` δεν ανοίγει
 * ποτέ τίποτα.
 *
 * Το `Enter` είναι **πραγματικός** δρόμος χρήστη (WAI-ARIA menu button) και δουλεύει σε jsdom.
 * Άρα το test καλύπτει ταυτόχρονα τη λειτουργία **και** την προσβασιμότητα του μενού.
 */
function openMenu(): void {
  fireEvent.keyDown(menuButton(), { key: 'Enter', code: 'Enter' });
}

beforeEach(() => {
  localStorage.clear();
  setDockMode('docked-left');
});

describe('ADR-724 — WorkspacePaletteHeader', () => {
  describe('διπλό κλικ = dock ⇄ float (§8, χειρονομία Revit)', () => {
    it('αγκυρωμένη ⇒ αιωρεί', () => {
      renderDocked();
      act(() => { fireEvent.doubleClick(header()); });
      expect(getDockMode()).toBe('floating');
    });

    it('αιωρούμενη ⇒ επιστρέφει στην τελευταία πλευρά, όχι στην προεπιλογή', () => {
      setDockMode('docked-right');
      setDockMode('floating');
      renderFloating();

      act(() => { fireEvent.doubleClick(header()); });

      expect(getDockMode()).toBe('docked-right');
      expect(getLastDockedSide()).toBe('docked-right');
    });

    it('🔴 διπλό κλικ ΠΑΝΩ ΣΤΟ ΚΟΥΜΠΙ ΜΕΝΟΥ δεν εναλλάσσει τίποτα', () => {
      /*
        Το «⋮» ζει ΜΕΣΑ στη λαβή. Χωρίς φύλακα, δύο γρήγορα κλικ για να ανοίξει και να
        κλείσει το μενού θα πετούσαν την παλέτα στον αέρα — μια ενέργεια που ο χρήστης δεν
        ζήτησε και δεν μπορεί να προβλέψει.
      */
      renderDocked();
      act(() => { fireEvent.doubleClick(menuButton()); });
      expect(getDockMode()).toBe('docked-left');
    });
  });

  describe('🔴 η λαβή σέρνει — αλλά ΟΧΙ από τα χειριστήριά της', () => {
    it('αιωρούμενη: η επικεφαλίδα δηλώνει «πιάσε με»', () => {
      renderFloating();
      expect(header()).toHaveClass('cursor-grab');
    });

    it('αγκυρωμένη: ΔΕΝ δηλώνει «πιάσε με» — δεν υπάρχει τίποτα να συρθεί', () => {
      renderDocked();
      expect(header()).toHaveClass('cursor-default');
      expect(header()).not.toHaveClass('cursor-grab');
    });

    it('mousedown στη λαβή ξεκινά σύρσιμο', () => {
      renderFloating();
      act(() => { fireEvent.mouseDown(header(), { clientX: 300, clientY: 200 }); });
      expect(header()).toHaveClass('cursor-grabbing');
    });

    it('🔴 mousedown ΣΤΟ ΚΟΥΜΠΙ ΜΕΝΟΥ ΔΕΝ ξεκινά σύρσιμο', () => {
      /*
        Η ΑΚΡΙΒΗΣ ΠΑΓΙΔΑ ΠΟΥ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ TEST:

        Το `useDraggable` θεωρεί **λαβή** οτιδήποτε ταιριάζει σε `.cursor-grab` και τότε
        **παρακάμπτει** τον δικό του αποκλεισμό κουμπιών. Η επικεφαλίδα φέρει `cursor-grab`
        (σωστή ένδειξη για ΟΛΟ το πλάτος της), οπότε ένα `closest('.cursor-grab')` από το «⋮»
        βρίσκει τη λαβή ⇒ το `mousedown` θα περνούσε ως σύρσιμο, θα καλούσε `preventDefault()`
        και **το μενού δεν θα άνοιγε ποτέ με το ποντίκι**.

        Γι' αυτό το φιλτράρισμα γίνεται στον δικό μας handler, ΠΡΙΝ την ανάθεση.
      */
      renderFloating();
      act(() => { fireEvent.mouseDown(menuButton(), { clientX: 300, clientY: 200 }); });
      expect(header()).not.toHaveClass('cursor-grabbing');
      expect(header()).toHaveClass('cursor-grab');
    });
  });

  describe('το μενού', () => {
    it('η εντολή «Αιωρούμενη» εμφανίζεται ΜΟΝΗ της από το DOCK_MODES', () => {
      renderDocked();
      act(() => { openMenu(); });
      expect(screen.getByText('workspaceDock.floating')).toBeInTheDocument();
    });

    it('και οι τρεις καταστάσεις + η επαναφορά είναι παρούσες', () => {
      renderDocked();
      act(() => { openMenu(); });
      expect(screen.getByText('workspaceDock.dockLeft')).toBeInTheDocument();
      expect(screen.getByText('workspaceDock.dockRight')).toBeInTheDocument();
      expect(screen.getByText('workspaceDock.floating')).toBeInTheDocument();
      expect(screen.getByText('workspaceDock.resetLayout')).toBeInTheDocument();
    });
  });

  describe('🔴 το μενού πρέπει να ζωγραφίζεται ΠΑΝΩ από την παλέτα', () => {
    /*
      ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΦΥΛΑΕΙ ΑΥΤΟ ΤΟ describe (αναφορά Giorgio, 2026-07-29):
      *«όταν είναι ξεκρεμασμένο, οι τελίτσες δεν ακούν»*.

      Το μενού άνοιγε κανονικά — αλλά με `z-index: 50` ενώ η αιωρούμενη παλέτα ήταν στα 1700,
      οπότε ζωγραφιζόταν ΟΛΟΚΛΗΡΟ πίσω της. Ένα κουμπί που ανοίγει κάτι αόρατο είναι, για τον
      χρήστη, ένα κουμπί χαλασμένο.

      Ο έλεγχος είναι **σχεσιακός**: «το μενού πάνω από την παλέτα», όχι «το μενού είναι 1500».
      Έτσι κοκκινίζει και αν αλλάξει το στρώμα της παλέτας, όχι μόνο αν αλλάξει του μενού.
    */
    function menuLayer(): number {
      openMenu();
      return Number(screen.getByRole('menu').style.zIndex);
    }

    it.each([['αγκυρωμένη', renderDocked], ['αιωρούμενη', renderFloating]])(
      '%s: το μενού δηλώνει ΡΗΤΑ το στρώμα των popover — μία συμπεριφορά, όχι δύο κλάδοι',
      (_label, renderIt) => {
        renderIt();
        // Χωρίς τη ρητή δήλωση, το Radix το αφήνει στο `z-50` του `component-sizes.ts` —
        // δηλαδή **κάτω** από κάθε αιωρούμενο panel.
        expect(menuLayer()).toBe(zIndex.popover);
      },
    );

    /*
      ⚠️ Η ΣΧΕΣΗ «μενού πάνω από την παλέτα» ΔΕΝ ελέγχεται εδώ, ΕΠΙΤΗΔΕΣ.

      Το `renderFloating()` αυτού του αρχείου στήνει ένα **γυμνό** `FloatingPanel` (προεπιλογή
      `zIndex.toast` = 1700) — δεν είναι η παλέτα του χώρου εργασίας, που δηλώνει ρητά
      `dxfZIndex.ui.sidebar`. Ένα assertion εδώ θα μετρούσε το harness, όχι το προϊόν.
      Η σχέση ελέγχεται εκεί που συντίθενται πραγματικά τα δύο:
      `WorkspaceFloatingPalette.test.tsx` → «κάθεται στο στρώμα ΤΗΣ ΠΑΛΕΤΑΣ».
    */
  });

  describe('προσβασιμότητα της αόρατης χειρονομίας', () => {
    it('η επικεφαλίδα περιγράφει τι κάνει το διπλό κλικ, ανά κατάσταση', () => {
      // Η χειρονομία του Revit είναι αόρατη· ένα `title=` δεν τη λέει σε αναγνώστη οθόνης
      // (και είναι ratchet, CHECK 3.23). Η περιγραφή ζει στο δέντρο προσβασιμότητας.
      renderDocked();
      expect(header()).toHaveAccessibleDescription('workspaceDock.dockHandleHint');
    });

    it('…και αλλάζει όταν αιωρείται (τότε η λαβή ΚΑΙ σέρνει)', () => {
      renderFloating();
      expect(header()).toHaveAccessibleDescription('workspaceDock.dragHandleHint');
    });
  });
});
