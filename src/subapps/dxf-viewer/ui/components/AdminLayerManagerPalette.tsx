'use client';

/**
 * ADR-723 — «Διαχειριστής Στρώσεων» ως **modeless palette**.
 *
 * ── ΤΙ ΑΛΛΑΞΕ ΚΑΙ ΓΙΑΤΙ ──
 *
 * Μέχρι το ADR-391 ο Διαχειριστής άνοιγε ως Radix `Dialog`: focus trap, backdrop, `inert` στο
 * υπόλοιπο δέντρο. Πρακτικά: **δεν μπορούσες να κρύψεις στρώση και ταυτόχρονα να δουλέψεις στο
 * σχέδιο** — δηλαδή ακριβώς η μία δουλειά για την οποία υπάρχει ο Διαχειριστής.
 *
 * Η modality ήταν η ανωμαλία, όχι το floating. Ο κλάδος είναι ομόφωνος:
 *   • AutoCAD `LAYER` → modeless palette, οι αλλαγές εφαρμόζονται **άμεσα**, χωρίς OK.
 *   • Revit Properties → modeless, μένει ανοιχτή όσο δουλεύεις.
 *   • Cinema 4D Layer Manager → dockable manager σε δικό του tab.
 *   • Figma Layers → μόνιμα ορατό, μηδενική modality.
 *
 * ── ΤΙ **ΔΕΝ** ΑΛΛΑΞΕ (επίτηδες) ──
 *
 * Το περιεχόμενο (`AdminLayerManager` → `useLayerManagerState` → `LayerStore` → έγγραφο) είναι
 * ήδη σωστό μετά το ADR-721: μία αλήθεια, μία πόρτα γραφής. **Μόνο το κέλυφος** αλλάζει εδώ.
 *
 * ── ΤΟ ΚΛΕΙΔΙ ΤΗΣ ΣΥΝΥΠΑΡΞΗΣ ΜΕ ΤΟΝ ΚΑΜΒΑ ──
 *
 * Ο καμβάς παραμένει πλήρως λειτουργικός επειδή αυτή η παλέτα **δεν** καλεί
 * `pushModalKeyboardScope()` (ADR-711). Οι ~43 global accelerators του viewer ρωτούν
 * `shouldGlobalShortcutYield`, που κοιτά (α) ενεργό modal scope και (β) αν το εστιασμένο
 * στοιχείο καταναλώνει τον χαρακτήρα. Χωρίς modal scope, το (α) είναι πάντα `false` ⇒ οι
 * συντομεύσεις ζουν. Και όταν ο χρήστης γράφει στο πεδίο αναζήτησης της παλέτας, το (β) γίνεται
 * `true` ⇒ ο καμβάς δεν κλέβει τα γράμματα. Το ίδιο πρωτόκολλο απαντά σωστά **και στις δύο**
 * καταστάσεις, χωρίς ούτε έναν νέο listener.
 *
 * @see ADR-723 — modeless παλέτα, γεωμετρία, ιδιοκτησία πληκτρολογίου
 * @see ADR-721 — η αλήθεια της ορατότητας στρώσεων (το περιεχόμενο)
 * @see ADR-711 / ADR-364 — ιδιοκτησία πληκτρολογίου & Escape bus
 */

import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import { Layers } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FloatingPanel } from '@/components/ui/floating';
import { LazyAdminLayerManager } from './LazyLoadWrapper';
import { LayerManagerPaletteStore } from '../../stores/LayerManagerPaletteStore';
import { ESC_PRIORITY, useEscapeHandler } from '../../systems/escape-bus';
import { PANEL_ANCHORING, PanelPositionCalculator } from '../../config/panel-tokens';

/**
 * DOM id της ρίζας. Χρειάζεται ΟΝΟΜΑ (όχι `data-testid`) γιατί απαντά σε ερώτηση **παραγωγής**:
 * «βρίσκεται η εστίαση μέσα στην παλέτα;» — δες {@link isFocusInsidePalette}.
 */
const PALETTE_DOM_ID = 'dxf-layer-manager-palette';

/**
 * Ταυτότητα για τη μόνιμη γεωμετρία. **Σταθερή για πάντα**: αλλαγή της ισοδυναμεί με «ξέχασε τη
 * θέση όλων των χρηστών».
 */
const PALETTE_PERSISTENCE_KEY = 'dxf.layer-manager';

/**
 * Προεπιλεγμένο μέγεθος — χωρά την πλαϊνή στήλη φίλτρων + τον πίνακα στρώσεων χωρίς οριζόντια
 * κύλιση στο συνηθισμένο 1920×1080. Ισχύει **μόνο** την πρώτη φορά· μετά κυριαρχεί η προτίμηση
 * του χρήστη.
 */
const PALETTE_SIZE = { width: 980, height: 620 } as const;

/**
 * Κάτω όριο. Κάτω από αυτό η στήλη φίλτρων και ο πίνακας δεν συνυπάρχουν αναγνώσιμα — η παλέτα
 * θα ήταν «μικρή» αντί για χρήσιμη.
 */
const PALETTE_MIN_SIZE = { width: 520, height: 300 } as const;

interface AdminLayerManagerPaletteProps {
  projectId?: string | null;
  projectName?: string;
}

/** `true` όταν το `document.activeElement` βρίσκεται μέσα στην παλέτα. SSR-safe. */
function isFocusInsidePalette(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.getElementById(PALETTE_DOM_ID);
  const active = document.activeElement;
  if (!root || !active) return false;
  return root.contains(active);
}

export const AdminLayerManagerPalette: React.FC<AdminLayerManagerPaletteProps> = ({
  projectId = null,
  projectName = '',
}) => {
  const { t } = useTranslation('dxf-viewer-shell');

  const { isOpen } = useSyncExternalStore(
    LayerManagerPaletteStore.subscribe,
    LayerManagerPaletteStore.getSnapshot,
    LayerManagerPaletteStore.getSnapshot,
  );

  const handleClose = useCallback((): void => {
    LayerManagerPaletteStore.close();
  }, []);

  /**
   * ESC — **μόνο** όταν η εστίαση είναι μέσα στην παλέτα.
   *
   * ⚠️ Ο έλεγχος εστίασης ΔΕΝ είναι προαιρετικός. Χωρίς αυτόν, μια ανοιχτή παλέτα θα κατανάλωνε
   * κάθε ESC της εφαρμογής και θα σκότωνε το «ακύρωση εντολής / αποεπιλογή» του καμβά — το
   * συχνότερο πλήκτρο του σχεδιαστή. Δες {@link ESC_PRIORITY.FOCUSED_PALETTE}.
   *
   * ── ΓΙΑΤΙ ΚΑΘΟΛΟΥ ESC, ΑΦΟΥ ΟΙ ΜΕΓΑΛΟΙ ΔΕΝ ΤΟ ΚΑΝΟΥΝ; ──
   *
   * Σε Revit / AutoCAD / Figma το ESC με εστίαση σε παλέτα **δεν κάνει τίποτα** — νεκρό πλήκτρο.
   * Το WAI-ARIA για non-modal dialogs το ζητά. Επειδή είναι φραγμένο στην εστίαση, δεν μπορεί
   * δομικά να ενοχλήσει τον καμβά: είναι **γνήσια προσθήκη** πάνω από την πρακτική του κλάδου,
   * όχι απόκλιση από αυτήν.
   *
   * Όταν ο χρήστης γράφει στο πεδίο αναζήτησης, ο ίδιος ο bus παραιτείται
   * (`isTextEntryTarget`, ADR-364) ⇒ το ESC ακυρώνει **πρώτα** το πεδίο, όπως παντού.
   *
   * `null` όσο είναι κλειστή: καμία εγγραφή στον bus, μηδενικό κόστος διάσχισης.
   */
  useEscapeHandler(
    isOpen
      ? {
          id: 'layer-manager-palette',
          priority: ESC_PRIORITY.FOCUSED_PALETTE,
          canHandle: isFocusInsidePalette,
          handle: (): boolean => {
            LayerManagerPaletteStore.close();
            return true;
          },
        }
      : null,
  );

  /**
   * Αρχική τοποθέτηση: πάνω-δεξιά, κάτω από τη γραμμή εργαλείων — η θέση της παλέτας Properties
   * του Revit. Μετράται από το DOM μέσω του SSoT `PanelPositionCalculator` (ADR-029), όχι με
   * σταθερές: το ύψος του ribbon αλλάζει ανά καρτέλα.
   *
   * Αγνοείται σιωπηλά όταν υπάρχει αποθηκευμένη προτίμηση — δες `useFloatingPanelGeometry`.
   */
  const getClientPosition = useCallback(
    () => PanelPositionCalculator.getTopRightPosition(PALETTE_SIZE.width),
    [],
  );

  const draggableOptions = useMemo(() => ({ getClientPosition }), [getClientPosition]);

  // Κλειστή ⇒ τίποτα στο DOM: κανένα listener συρσίματος, κανένα render των 58 σειρών.
  if (!isOpen) return null;

  return (
    <FloatingPanel
      id={PALETTE_DOM_ID}
      data-testid={PALETTE_DOM_ID}
      resizable
      persistenceKey={PALETTE_PERSISTENCE_KEY}
      dimensions={PALETTE_SIZE}
      minSize={PALETTE_MIN_SIZE}
      defaultPosition={{ x: PANEL_ANCHORING.OFFSETS.VIEWPORT_MARGIN, y: PANEL_ANCHORING.FALLBACKS.TOOLBAR_BOTTOM }}
      draggableOptions={draggableOptions}
      onClose={handleClose}
    >
      <FloatingPanel.Header title={t('layerManagerPalette.title')} icon={<Layers />} />
      <FloatingPanel.Content>
        <LazyAdminLayerManager projectId={projectId} projectName={projectName} />
      </FloatingPanel.Content>
    </FloatingPanel>
  );
};
