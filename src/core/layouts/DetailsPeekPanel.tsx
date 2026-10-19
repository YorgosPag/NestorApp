'use client';
/**
 * @fileoverview **Το πλευρικό panel λεπτομερειών του πλέγματος** (desktop) — η εγγραφή που διάλεξες σε προβολή πλέγματος
 *   ανοίγει **δίπλα** στο πλέγμα, με την ίδια μπάρα (✕ · τίτλος · ενέργειες) που έχει το φύλλο του κινητού.
 * @related ADR-912 §12.17 · `details-sheet-frame.tsx` (η κοινή μπάρα) · `ListDetailsSplit` (ο μόνος καλών)
 * @module core/layouts/DetailsPeekPanel
 *
 * 🔴 **Η αφορμή, μετρημένη 2026-10-19 στα 2400px** (επαφές · έργα · κτίρια): κλικ σε κάρτα του πλέγματος ⇒ η κάρτα
 *   φωτιζόταν, το URL άλλαζε, και **0** κουμπιά «Επεξεργασία» στην οθόνη. Οι λεπτομέρειες ζούσαν μόνο στο φύλλο του
 *   κινητού (`md:hidden`) — στις επαφές και στα έργα **στημένες αθέατες**, στα κτίρια ούτε καν στημένες.
 * 🔑 **Πρακτική**: Notion *side peek* · HubSpot *record preview* · Attio side panel — η εγγραφή ανοίγει δίπλα, το
 *   πλέγμα μένει ζωντανό από κάτω. **Καλύτερα από αυτούς**: (α) panel **στη ροή**, όχι επικάλυψη — το πλέγμα
 *   ξαναμοιράζει στήλες, καμία κάρτα δεν κρύβεται κάτω από το panel· (β) **μη modal** — κλικ σε άλλη κάρτα αλλάζει
 *   την εγγραφή επιτόπου, χωρίς κλείσε-άνοιξε· (γ) οι ενέργειες **δεν ξαναγράφονται**: η κεφαλίδα της οντότητας τις
 *   στέλνει στη μπάρα όπως στο κινητό (ADR-912 §12), άρα ό,τι ισχύει εκεί (κάδος = μόνο ανάγνωση, Ακύρωση-ως-✕,
 *   ερώτηση πριν χαθούν αλλαγές) ισχύει και εδώ, χωρίς δεύτερη υλοποίηση.
 * 🔑 **Πληκτρολόγιο** (WAI-ARIA APG, μη modal panel): στο άνοιγμα το focus πάει στο panel· Esc ⇒ ίδια έξοδος με
 *   τον ✕· στο κλείσιμο το focus γυρνά στην κάρτα που το άνοιξε. Το Esc **δεν** κλέβεται από μενού/διάλογο που
 *   άνοιξε από μέσα (portal ⇒ εκτός του DOM του panel ⇒ δεν το βλέπουμε).
 */
import React from 'react';
import { captureFocusReturnTarget, returnFocus } from '@/lib/a11y/focus-return';
import { DirtyFormProvider } from '@/providers/DirtyFormProvider';
import { cn } from '@/lib/utils';
import { DetailsSheetFrame } from './details-sheet-frame';

/**
 * Το πλάτος του panel: αρκετό για φόρμα δύο στηλών, ποτέ πάνω από το μισό της περιοχής — το πλέγμα κρατά πάντα το
 * μεγαλύτερο κομμάτι (μετρημένο 2026-10-19: 2400px ⇒ ~768px panel, πλέγμα 5 στηλών αντί για 8).
 */
export const DETAILS_PEEK_WIDTH = 'w-[clamp(24rem,38%,48rem)] shrink-0';

/** Παροδικές στρώσεις (portal) — η εστίαση μέσα τους δεν αλλάζει τον opener του panel. */
const TRANSIENT_LAYER = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper]';

interface DetailsPeekPanelProps {
  readonly onClose: () => void;
  readonly title: string;
  readonly children: React.ReactNode;
}

/**
 * Focus στο panel όταν ανοίγει· στο κλείσιμο πίσω σε ό,τι το άνοιξε — αν το focus ήταν μέσα του ή χάθηκε.
 * 🔑 Μη modal ⇒ ο άνθρωπος πατά **άλλη** κάρτα με το panel ανοιχτό: «ό,τι το άνοιξε» είναι η **τελευταία** εστίαση
 *   έξω από το panel, όχι η πρώτη.
 */
function usePeekFocus(): React.RefCallback<HTMLElement> {
  const [panel, setPanel] = React.useState<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    if (!panel) return undefined;
    let opener = captureFocusReturnTarget(); // πριν πάρει το focus το panel
    const trackOpener = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || panel.contains(target)) return;
      // Μενού/διάλογος που άνοιξε ΑΠΟ το panel (portal) δεν είναι «ό,τι άνοιξε το panel» — θα έκλεινε πριν από αυτό.
      if (target.closest(TRANSIENT_LAYER)) return;
      opener = captureFocusReturnTarget();
    };
    document.addEventListener('focusin', trackOpener);
    panel.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('focusin', trackOpener);
      const active = document.activeElement;
      const focusLost = !active || active === document.body || panel.contains(active);
      if (focusLost) returnFocus(opener, { preventScroll: true });
    };
  }, [panel]);
  return setPanel;
}

export function DetailsPeekPanel({ onClose, title, children }: DetailsPeekPanelProps) {
  return (
    // `DirtyFormProvider`: η εμβέλεια των φορμών του panel — ο ✕ και το Esc ρωτούν ΑΥΤΗΝ (ADR-912 §12.5).
    <DirtyFormProvider>
      <OpenDetailsPeek onClose={onClose} title={title}>{children}</OpenDetailsPeek>
    </DirtyFormProvider>
  );
}

function OpenDetailsPeek({ onClose, title, children }: DetailsPeekPanelProps) {
  const panelRef = usePeekFocus();

  return (
    <DetailsSheetFrame
      onClose={onClose}
      title={title}
      surface={({ titleId, leave }, body) => (
        <aside
          ref={panelRef}
          aria-labelledby={titleId}
          tabIndex={-1}
          data-details-peek=""
          onKeyDown={(event) => {
            // Μόνο ό,τι συνέβη στο DOM του panel: τα γεγονότα της React ανεβαίνουν και από portals (μενού · διάλογοι).
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            if (!event.currentTarget.contains(event.target as Node)) return;
            event.preventDefault();
            leave();
          }}
          className={cn(
            DETAILS_PEEK_WIDTH,
            'flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card shadow-sm outline-none',
            'animate-in slide-in-from-right-4 fade-in-0 duration-200',
          )}
        >
          {body}
        </aside>
      )}
    >
      {children}
    </DetailsSheetFrame>
  );
}
