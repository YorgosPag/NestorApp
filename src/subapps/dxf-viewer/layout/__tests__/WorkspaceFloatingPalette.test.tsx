/**
 * ADR-724 Φ3 — Η αιωρούμενη παλέτα: **αληθινό** σύρσιμο, όχι προσποιητό context.
 *
 * ── ΓΙΑΤΙ ΔΕΝ ΓΙΝΕΤΑΙ MOCK ΤΟ `useFloatingPanelContext` ──
 *
 * Ο εύκολος δρόμος είναι να αντικατασταθεί το context με `{ isDragging: true }`. Θα ήταν
 * **κενό**: ολόκληρο το ερώτημα της Φ3 §7.1 είναι «όταν το ADR-723 λέει ότι σέρνεται,
 * ακούει ο δικός μας παρατηρητής;». Με προσποιητό context το test θα έλεγχε τον εαυτό του και
 * θα έμενε πράσινο ακόμη κι αν το `WorkspaceDragObserver` δεν είχε ποτέ συνδεθεί στο panel.
 *
 * Εδώ ο δρόμος είναι ο πραγματικός: `mousedown` στην **αληθινή** επικεφαλίδα ⇒ το `useDraggable`
 * θέτει `isDragging` ⇒ το context του `FloatingPanel` το διαδίδει ⇒ ο παρατηρητής ξυπνά.
 *
 * ⚠️ Τι ΔΕΝ αποδεικνύεται εδώ: κανένα pixel. Το jsdom δεν κάνει διάταξη, οπότε το ορθογώνιο
 * του χώρου εργασίας δίνεται ρητά (stub `getBoundingClientRect`). Ελέγχεται η **πολιτική**:
 * ποιο συμβάν οδηγεί σε ποια αλλαγή κατάστασης. Η αίσθηση επαληθεύεται ζωντανά (§14.8).
 */

import React, { useRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

import { zIndex } from '@/styles/design-tokens';
import { WorkspaceFloatingPalette } from '../WorkspaceFloatingPalette';
import { WorkspacePaletteHeader } from '../WorkspacePaletteHeader';
import {
  getDockMode,
  setDockMode,
  setDockedWidth,
} from '../../systems/workspace/workspace-dock-store';

/** Ρεαλιστικός χώρος εργασίας: ο viewer κάθεται δεξιά της ράγας πλοήγησης. */
const WORKSPACE = { left: 100, top: 50, width: 1000, height: 800 };
const RIGHT_EDGE = WORKSPACE.left + WORKSPACE.width;

function Harness(): React.ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);
  return (
    <>
      <div
        data-testid="workspace"
        ref={(node) => {
          if (node) {
            // Το jsdom δεν κάνει διάταξη ⇒ το πραγματικό rect είναι 0×0. Το ορθογώνιο δίνεται
            // ρητά, ώστε τα κατώφλια των ζωνών να έχουν νόημα.
            node.getBoundingClientRect = () => ({
              ...WORKSPACE,
              right: RIGHT_EDGE,
              bottom: WORKSPACE.top + WORKSPACE.height,
              x: WORKSPACE.left,
              y: WORKSPACE.top,
              toJSON: () => WORKSPACE,
            } as DOMRect);
          }
          ref.current = node;
        }}
      />
      <WorkspaceFloatingPalette workspaceRef={ref}>
        <WorkspacePaletteHeader />
        <section data-testid="palette-body">περιεχόμενο</section>
      </WorkspaceFloatingPalette>
    </>
  );
}

/** Η λαβή: η γραμμή τίτλου της παλέτας — η ίδια που σέρνει ο χρήστης στην παραγωγή. */
function grabHandle(): HTMLElement {
  return screen.getByRole('heading', { name: 'workspaceDock.title' }).parentElement as HTMLElement;
}

function startDrag(): void {
  fireEvent.mouseDown(grabHandle(), { clientX: 500, clientY: 400 });
}

/**
 * ⚠️ ΓΙΑΤΙ ΟΧΙ `fireEvent.pointerMove` — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΠΡΟΛΗΠΤΙΚΟ.
 *
 * Το jsdom **δεν υλοποιεί `PointerEvent`**. Το `fireEvent.pointerMove(window, { clientX })`
 * πέφτει πίσω σε γενικό `Event`, που **δεν μεταφέρει συντεταγμένες**: ο ακροατής λαμβάνει
 * `clientX === null`. Διαγνώστηκε ζωντανά (2026-07-29) με προσωρινό probe — τα tests των
 * ζωνών ήταν κόκκινα ενώ ο κώδικας παραγωγής ήταν σωστός.
 *
 * Το `MouseEvent` **υλοποιείται** πλήρως και φέρει `clientX`. Ο τύπος του συμβάντος είναι το
 * όνομα (`'pointermove'`), όχι η κλάση — ο ακροατής διαβάζει μόνο `clientX`, που είναι
 * ταυτόσημο και στα δύο interfaces. Άρα το υποκατάστατο είναι πιστό **ως προς ό,τι διαβάζεται**.
 *
 * ⛔ ΜΗΝ το «απλοποιήσεις» πίσω σε `fireEvent.pointerMove`: τα tests θα ξαναγίνουν κόκκινα και
 * το επόμενο ένστικτο θα είναι να χαλαρώσει ο κώδικας παραγωγής (ο έλεγχος `Number.isFinite`),
 * που είναι ακριβώς ο φύλακας που πρέπει να μείνει.
 */
function dispatchPointer(type: 'pointermove' | 'pointerup' | 'pointercancel', clientX: number): void {
  window.dispatchEvent(new MouseEvent(type, { clientX, clientY: 400, bubbles: true }));
}

function movePointerTo(clientX: number): void {
  dispatchPointer('pointermove', clientX);
}

function releaseAt(clientX: number): void {
  dispatchPointer('pointerup', clientX);
}

beforeEach(() => {
  localStorage.clear();
  setDockedWidth(384);
  /*
    ⚠️ Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, ΟΧΙ ΤΕΛΕΤΗ.

    Το store είναι module singleton: το `localStorage.clear()` **δεν** το επαναφέρει (η
    ενυδάτωση έγινε στο import). Χωρίς το ρητό `'docked-left'`, η «τελευταία πλευρά» επιζεί
    από το προηγούμενο test — και η γεωμετρία εκκίνησης, που την **διαβάζει**, θα γεννούσε την
    παλέτα δεξιά. Διαγνώστηκε ακριβώς έτσι (2026-07-29): x=692 αντί για 124.
  */
  setDockMode('docked-left');
  setDockMode('floating'); // η κατάσταση στην οποία ζει αυτό το component
});

describe('ADR-724 Φ3 — WorkspaceFloatingPalette', () => {
  describe('η παλέτα υπάρχει και είναι μία', () => {
    it('αποδίδει το περιεχόμενο μέσα σε αιωρούμενο διάλογο', () => {
      render(<Harness />);
      expect(screen.getByTestId('palette-body')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toContainElement(screen.getByTestId('palette-body'));
    });

    it('ο διάλογος ΔΕΝ είναι modal — ο καμβάς παραμένει χρησιμοποιήσιμος από πίσω', () => {
      render(<Harness />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false');
    });

    it('🔴 κάθεται στο στρώμα ΤΗΣ ΠΑΛΕΤΑΣ, όχι στο στρώμα των ειδοποιήσεων', () => {
      /*
        Η προεπιλογή του `FloatingPanel` είναι `zIndex.toast` (1700) — πάνω από τα μενού (1000)
        **και** από τους διαλόγους (1400). Με αυτή, το μενού της ίδιας της παλέτας άνοιγε πίσω
        της και ο χρήστης έβλεπε ένα κουμπί που «δεν ακούει» (αναφορά Giorgio, §14.9).
        Ο έλεγχος είναι **σχεσιακός**, όχι μαγικός αριθμός: κάτω από το στρώμα των μενού.
      */
      render(<Harness />);
      const z = Number(screen.getByRole('dialog').style.zIndex);
      expect(z).toBeGreaterThan(0);
      expect(z).toBeLessThan(zIndex.popover);
      expect(z).toBeLessThan(zIndex.modal);
    });

    it('μία μόνο επικεφαλίδα — όχι μία της παλέτας και μία του FloatingPanel', () => {
      // Διπλή επικεφαλίδα θα ήταν το sibling clone που περιγράφει το N.18.
      render(<Harness />);
      expect(screen.getAllByRole('heading', { name: 'workspaceDock.title' })).toHaveLength(1);
    });
  });

  describe('🔴 ζώνες απόθεσης (§7.1) — με ΑΛΗΘΙΝΟ σύρσιμο', () => {
    it('σύρσιμο μέσα στην αριστερή ζώνη δείχνει περίγραμμα-προεπισκόπηση', () => {
      render(<Harness />);
      expect(screen.queryByLabelText('workspaceDock.dropPreviewLeft')).not.toBeInTheDocument();

      act(() => startDrag());
      act(() => movePointerTo(WORKSPACE.left + 10));

      expect(screen.getByLabelText('workspaceDock.dropPreviewLeft')).toBeInTheDocument();
    });

    it('η προεπισκόπηση ΕΞΑΦΑΝΙΖΕΤΑΙ όταν ο δείκτης φύγει από τη ζώνη', () => {
      render(<Harness />);
      act(() => startDrag());
      act(() => movePointerTo(WORKSPACE.left + 10));
      act(() => movePointerTo(WORKSPACE.left + 500));

      expect(screen.queryByLabelText('workspaceDock.dropPreviewLeft')).not.toBeInTheDocument();
    });

    it('απόθεση στην αριστερή ζώνη ⇒ αγκύρωση αριστερά', () => {
      render(<Harness />);
      act(() => startDrag());
      act(() => movePointerTo(WORKSPACE.left + 10));
      act(() => releaseAt(WORKSPACE.left + 10));

      expect(getDockMode()).toBe('docked-left');
    });

    it('απόθεση στη δεξιά ζώνη ⇒ αγκύρωση δεξιά', () => {
      render(<Harness />);
      act(() => startDrag());
      act(() => movePointerTo(RIGHT_EDGE - 10));
      act(() => releaseAt(RIGHT_EDGE - 10));

      expect(getDockMode()).toBe('docked-right');
    });

    it('🔴 απόθεση στη ΜΕΣΗ ⇒ η παλέτα μένει αιωρούμενη', () => {
      // Ο πήχης της υπερδιόρθωσης: αν κάθε απόθεση αγκύρωνε, η αιώρηση θα ήταν αδύνατη.
      render(<Harness />);
      act(() => startDrag());
      act(() => movePointerTo(600));
      act(() => releaseAt(600));

      expect(getDockMode()).toBe('floating');
    });

    it('🔴 ακύρωση χειρονομίας (pointercancel) ⇒ ΚΑΜΙΑ αγκύρωση, καμία προεπισκόπηση', () => {
      render(<Harness />);
      act(() => startDrag());
      act(() => movePointerTo(WORKSPACE.left + 10));
      act(() => { dispatchPointer('pointercancel', WORKSPACE.left + 10); });

      expect(screen.queryByLabelText('workspaceDock.dropPreviewLeft')).not.toBeInTheDocument();
      expect(getDockMode()).toBe('floating');
    });

    it('🔴 κίνηση δείκτη ΧΩΡΙΣ σύρσιμο δεν αγκυρώνει τίποτα', () => {
      /*
        Ο παρατηρητής ακούει στο `window`. Αν η συνδρομή δεν ήταν δεμένη στο `isDragging`, μια
        απλή κίνηση του ποντικιού πάνω από την ακμή θα αγκύρωνε την παλέτα μόνη της.
      */
      render(<Harness />);
      act(() => movePointerTo(WORKSPACE.left + 10));
      act(() => releaseAt(WORKSPACE.left + 10));

      expect(getDockMode()).toBe('floating');
    });
  });

  describe('η αποθηκευμένη γεωμετρία νικά τη γεωμετρία εκκίνησης (§7, κανόνας Revit)', () => {
    it('χωρίς αποθηκευμένη ⇒ η παλέτα ξεκινά ΜΕΣΑ στον χώρο εργασίας', () => {
      render(<Harness />);
      const dialog = screen.getByRole('dialog');
      // 24px μετατόπιση από την ακμή του ΧΩΡΟΥ ΕΡΓΑΣΙΑΣ (100), όχι του παραθύρου.
      expect(dialog).toHaveStyle({ left: '124px', top: '74px' });
    });

    it('η εκκίνηση ακολουθεί την ΤΕΛΕΥΤΑΙΑ ΠΛΕΥΡΑ — δεν γεννιέται πάντα αριστερά', () => {
      // Ήταν δεξιά, την αιώρησε: πρέπει να «σηκωθεί» από τη δεξιά ακμή, εκεί που την είδε.
      setDockMode('docked-right');
      setDockMode('floating');
      render(<Harness />);
      // 100 + 1000 − 384 − 24
      expect(screen.getByRole('dialog')).toHaveStyle({ left: '692px' });
    });

    it('🔴 με αποθηκευμένη ⇒ επιστρέφει ΕΚΕΙ ΠΟΥ ΤΗΝ ΑΦΗΣΕΣ, αγνοώντας την εκκίνηση', () => {
      localStorage.setItem(
        'nestor:floating-panel-geometry:v1:dxf.workspace-sidebar',
        JSON.stringify({ x: 640, y: 300, width: 420, height: 500 }),
      );
      render(<Harness />);
      expect(screen.getByRole('dialog')).toHaveStyle({ left: '640px', top: '300px' });
    });
  });
});
