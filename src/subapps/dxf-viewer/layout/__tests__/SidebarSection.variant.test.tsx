/**
 * ADR-724 Φ3 — Ποιος φοράει το «ένδυμα» της παλέτας (περίγραμμα · σκιά · στρογγύλεμα).
 *
 * ── ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ──
 *
 * Γράφτηκε **επειδή μια μετάλλαξη έμεινε πράσινη** (2026-07-29, M11): απενεργοποίησα τον
 * κλάδο `variant === 'floating'` του `SidebarSection` — δηλαδή η αιωρούμενη παλέτα ξαναφόραγε
 * το δικό της περίγραμμα **μέσα** στην κάρτα του `FloatingPanel`, διπλό πλαίσιο και διπλή σκιά —
 * και **καμία** από τις 177 δοκιμές δεν το είδε. Το `WorkspaceSplitLayout.test.tsx` δεν το
 * βλέπει (αντικαθιστά την αιωρούμενη παλέτα με δείκτη), και το
 * `WorkspaceFloatingPalette.test.tsx` δεν αποδίδει `SidebarSection`.
 *
 * Ένα κενό που ανακαλύπτεται με μετάλλαξη είναι το **μόνο** είδος κενού που ξέρεις σίγουρα ότι
 * υπάρχει. Γι' αυτό δεν τεκμηριώθηκε ως «καλύπτεται ζωντανά» — καλύφθηκε.
 *
 * ⚠️ Τα βαριά παιδιά αντικαθίστανται: το ερώτημα εδώ είναι **ένα** («ποιος είναι το εξωτερικό
 * δοχείο;») και δεν χρειάζεται ούτε καρτέλες, ούτε αυτόματη αποθήκευση, ούτε κλίμακα προβολής.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('../../ui/FloatingPanelContainer', () => ({
  FloatingPanelContainer: () => <div data-testid="palette-content" />,
}));
jest.mock('../../ui/components/AutoSaveStatus', () => ({ AutoSaveStatus: () => null }));
jest.mock('../../ui/components/CentralizedAutoSaveStatus', () => ({
  CentralizedAutoSaveStatus: () => null,
}));
jest.mock('../../systems/zoom/hooks/useViewScale', () => ({
  useViewScale: () => ({ label: '1:100' }),
}));
jest.mock('../WorkspacePaletteHeader', () => ({
  WorkspacePaletteHeader: () => <header data-testid="palette-header" />,
}));

import { SidebarSection, type SidebarVariant } from '../SidebarSection';
import type { FloatingPanelHandle } from '../../ui/FloatingPanelContainer';

const noopRef = { current: null } as unknown as React.RefObject<FloatingPanelHandle>;

function renderVariant(variant: SidebarVariant) {
  return render(
    <SidebarSection variant={variant} floatingRef={noopRef} currentScene={null} activeTool="select" />,
  );
}

/** Το `<section>` που φέρει (ή δεν φέρει) το ένδυμα. */
function shell(): HTMLElement {
  return screen.getByTestId('palette-content').closest('section') as HTMLElement;
}

describe('ADR-724 Φ3 — SidebarSection: ποιος είναι το εξωτερικό δοχείο', () => {
  it('αγκυρωμένη (inline) ⇒ η παλέτα ΕΙΝΑΙ η κάρτα: σκιά + περίγραμμα δικά της', () => {
    renderVariant('inline');
    expect(shell().className).toMatch(/shadow/);
  });

  it('συρτάρι (drawer) ⇒ ίδιο ένδυμα με inline — το Sheet δεν φέρει κάρτα', () => {
    renderVariant('drawer');
    expect(shell().className).toMatch(/shadow/);
  });

  it('🔴 αιωρούμενη (floating) ⇒ ΚΑΝΕΝΑ ένδυμα: το φέρει το FloatingPanel', () => {
    // Αλλιώς: διπλό περίγραμμα + διπλή σκιά μέσα στην κάρτα του ADR-723.
    renderVariant('floating');
    expect(shell().className).not.toMatch(/shadow/);
  });

  it('η προεπιλογή είναι «inline» — καμία σιωπηλή αλλαγή για τους υπάρχοντες καλούντες', () => {
    render(<SidebarSection floatingRef={noopRef} currentScene={null} activeTool="select" />);
    expect(shell().className).toMatch(/shadow/);
  });

  describe('ό,τι ΔΕΝ αλλάζει ανά μορφή (το συμβόλαιο του §14.8)', () => {
    it.each<SidebarVariant>(['inline', 'drawer', 'floating'])(
      '«%s»: ίδια επικεφαλίδα, ίδιο περιεχόμενο, ίδιο προσβάσιμο όνομα',
      (variant) => {
        renderVariant(variant);
        expect(screen.getByTestId('palette-header')).toBeInTheDocument();
        expect(screen.getByTestId('palette-content')).toBeInTheDocument();
        expect(screen.getByRole('complementary', { name: 'workspaceDock.sidebarLabel' }))
          .toBeInTheDocument();
      },
    );

    it('🔴 αιωρούμενη: το `<aside>` ΣΥΡΡΙΚΝΩΝΕΤΑΙ ώστε το περιεχόμενο να κυλά', () => {
      /*
        Μέσα σε `FloatingPanel` η παλέτα είναι flex item καθορισμένου ύψους. Με `h-full` αντί
        για `flex-1 min-h-0`, η προεπιλογή `min-height: auto` του flexbox δεν την αφήνει να
        συρρικνωθεί ⇒ το περιεχόμενο **ξεχειλίζει** αντί να κυλήσει, και η γραμμή κατάστασης
        βγαίνει εκτός panel. Κλασική παγίδα flexbox.
      */
      renderVariant('floating');
      const aside = screen.getByRole('complementary');
      expect(aside.className).toMatch(/min-h-0/);
      expect(aside.className).toMatch(/flex-1/);
    });
  });
});
