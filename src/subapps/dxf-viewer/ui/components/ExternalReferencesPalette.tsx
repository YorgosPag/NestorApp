'use client';

/**
 * ADR-736 Φ4 — «Εξωτερικές Αναφορές» ως **modeless palette**.
 *
 * Κέλυφος-δίδυμο του {@link ./AdminLayerManagerPalette} (ADR-723): ίδιο `FloatingPanel`, ίδιο
 * πρωτόκολλο εστίασης/ESC, ίδια μόνιμη γεωμετρία. Η ομοιότητα είναι **σκόπιμη** — δύο παλέτες
 * του ίδιου εργαλείου που συμπεριφέρονται διαφορετικά είναι σφάλμα σχεδίασης, όχι ποικιλία.
 *
 * **Γιατί παλέτα και όχι βήμα εισαγωγής** (η απόφαση, με μία πρόταση): ένας σύνδεσμος σπάει και
 * **μετά** την εισαγωγή — μετακινήθηκε φάκελος, άνοιξε παλιό αρχείο, ήρθε σκηνή από τη δεύτερη
 * πόρτα που δεν τρέχει ποτέ επίλυση. Ένα βήμα wizard απαντά μία φορά και ποτέ ξανά· η παλέτα
 * απαντά **όποτε** ρωτηθεί. Ίδια απάντηση δίνουν AutoCAD (*External References*), Revit
 * (*Manage Links*) και ArchiCAD (*Hotlink Manager*).
 *
 * ⚠️ **Καμία `pushModalKeyboardScope()`** (ADR-711): ο καμβάς κρατά τους ~43 accelerators του
 * ενώ η παλέτα είναι ανοιχτή. Αυτή είναι όλη η διαφορά «παλέτα» vs «modal», και δεν είναι
 * στιλιστική.
 *
 * @see ../../stores/ExternalReferencesPaletteStore — η ορατότητα
 * @see ./ExternalReferencesManager — το περιεχόμενο (μητρώο + επίλυση)
 */

import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import { Link2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FloatingPanel } from '@/components/ui/floating';
import { ExternalReferencesPaletteStore } from '../../stores/ExternalReferencesPaletteStore';
import { ESC_PRIORITY, useEscapeHandler } from '../../systems/escape-bus';
import { PANEL_ANCHORING, PanelPositionCalculator } from '../../config/panel-tokens';
import { ExternalReferencesManager } from './ExternalReferencesManager';

/** DOM id της ρίζας — απαντά σε ερώτηση **παραγωγής** («είναι η εστίαση μέσα;»), όχι σε τεστ. */
const PALETTE_DOM_ID = 'dxf-external-references-palette';

/** Σταθερή για πάντα: αλλαγή = «ξέχασε τη θέση όλων των χρηστών». */
const PALETTE_PERSISTENCE_KEY = 'dxf.external-references';

/**
 * Τέσσερις στήλες κειμένου — σαφώς στενότερη από τον Διαχειριστή Στρώσεων (980×620), που
 * κουβαλά και πλαϊνή στήλη φίλτρων. Το ύψος χωρά ~10 αναφορές, όσες έχει το πραγματικό
 * τοπογραφικό, χωρίς κύλιση.
 */
const PALETTE_SIZE = { width: 620, height: 420 } as const;

/** Κάτω από αυτό, οι διαδρομές κόβονται τόσο που η στήλη «Όνομα» παύει να πληροφορεί. */
const PALETTE_MIN_SIZE = { width: 420, height: 240 } as const;

/** `true` όταν το `document.activeElement` βρίσκεται μέσα στην παλέτα. SSR-safe. */
function isFocusInsidePalette(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.getElementById(PALETTE_DOM_ID);
  const active = document.activeElement;
  if (!root || !active) return false;
  return root.contains(active);
}

export const ExternalReferencesPalette: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');

  const { isOpen } = useSyncExternalStore(
    ExternalReferencesPaletteStore.subscribe,
    ExternalReferencesPaletteStore.getSnapshot,
    ExternalReferencesPaletteStore.getSnapshot,
  );

  const handleClose = useCallback((): void => {
    ExternalReferencesPaletteStore.close();
  }, []);

  /**
   * ESC **μόνο** με εστίαση μέσα στην παλέτα — αλλιώς θα έτρωγε το «ακύρωση εντολής» του
   * καμβά, το συχνότερο πλήκτρο του σχεδιαστή. Ίδιο συμβόλαιο με τον Διαχειριστή Στρώσεων.
   */
  useEscapeHandler(
    isOpen
      ? {
          id: 'external-references-palette',
          priority: ESC_PRIORITY.FOCUSED_PALETTE,
          canHandle: isFocusInsidePalette,
          handle: (): boolean => {
            ExternalReferencesPaletteStore.close();
            return true;
          },
        }
      : null,
  );

  const getClientPosition = useCallback(
    () => PanelPositionCalculator.getTopRightPosition(PALETTE_SIZE.width),
    [],
  );

  const draggableOptions = useMemo(() => ({ getClientPosition }), [getClientPosition]);

  // Κλειστή ⇒ τίποτα στο DOM: κανένα listener, καμία συνδρομή στη σκηνή.
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
      <FloatingPanel.Header title={t('externalReferencesPalette.title')} icon={<Link2 />} />
      <FloatingPanel.Content>
        <ExternalReferencesManager />
      </FloatingPanel.Content>
    </FloatingPanel>
  );
};
