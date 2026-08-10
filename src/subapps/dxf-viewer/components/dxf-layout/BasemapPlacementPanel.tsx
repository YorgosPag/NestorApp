'use client';

/**
 * ADR-782 §23 — η μπάρα εργαλείων της **χειροκίνητης τοποθέτησης** υποβάθρου.
 *
 * ## Γιατί δεν ζει μέσα στις ρυθμίσεις υποβάθρου
 * Οι ρυθμίσεις είναι `Popover`: κλείνει στο πρώτο κλικ **εκτός** της. Η τοποθέτηση όμως *είναι*
 * κλικ εκτός της — σε κάθε σύρσιμο. Μια μπάρα εκεί θα εξαφανιζόταν στην πρώτη κίνηση του χρήστη,
 * δηλαδή θα ήταν διεπαφή που καταστρέφεται από τη χρήση της.
 *
 * Είναι **αγκυρωμένη στην οθόνη** (κάτω-κέντρο), όπως η γραμμή εντολών κάθε CAD όσο τρέχει
 * λειτουργία: ο χρήστης πρέπει να βλέπει «τι κάνω τώρα» χωρίς να ψάχνει.
 *
 * ADR-040: χαμηλή συχνότητα (πατήματα, όχι κινήσεις) ⇒ `useSyncExternalStore` επιτρέπεται.
 * N.11: κάθε κείμενο από i18n. N.4: `<section>` + `<ul>`, κανένα άσκοπο `div`.
 */

import React, { useSyncExternalStore } from 'react';
import { Check, Move, RotateCcw, Target } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import {
  clearPlacementCorrespondences,
  endBasemapPlacement,
  getBasemapPlacementSession,
  setBasemapPlacementTool,
  subscribeBasemapPlacementSession,
  type BasemapPlacementSession,
  type BasemapPlacementTool,
} from '../../systems/basemap/basemap-placement-session';
import { clearBasemapPlacement } from '../../systems/basemap/basemap-placement-store';
import { pointPairScaleRatio } from '../../systems/geo-referencing/geo-transform';

/** Πάνω από αυτή την ασυμφωνία μηκών, οι δύο αντιστοιχίες δεν περιγράφουν το ίδιο σχήμα. */
const SCALE_WARNING_TOLERANCE = 0.05;

const TOOL_ICON: Record<BasemapPlacementTool, React.ComponentType<{ size?: number }>> = {
  drag: Move,
  match: Target,
};

interface ToolButtonProps {
  readonly tool: BasemapPlacementTool;
  readonly active: boolean;
  readonly label: string;
}

const ToolButton: React.FC<ToolButtonProps> = ({ tool, active, label }) => {
  const colors = useSemanticColors();
  const Icon = TOOL_ICON[tool];
  return (
    <li>
      <button
        type="button"
        aria-pressed={active}
        onClick={() => setBasemapPlacementTool(tool)}
        className={`flex items-center ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.SPACING.COMPACT} ` +
          `${PANEL_LAYOUT.ROUNDED.TOP} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ` +
          `${PANEL_LAYOUT.INTERACTIVE.TRANSITION} ` +
          (active ? colors.text.primary : colors.text.muted)}
      >
        <Icon size={13} />
        {label}
      </button>
    </li>
  );
};

/**
 * Τι πρέπει να κάνει ο χρήστης **τώρα** — η κατάσταση, όχι εγχειρίδιο.
 *
 * ⚠️ Το εργαλείο αντιστοίχισης έχει **δύο** μηνύματα και όχι ένα: «δείξε σημείο» και «δείξε το
 * ίδιο σημείο στον χάρτη» είναι διαφορετικές πράξεις, και ένα κοινό κείμενο θα άφηνε τον χρήστη
 * να μαντεύει σε ποιο από τα δύο μισά βρίσκεται.
 */
function hintKeyFor(tool: BasemapPlacementTool, awaitingMapPoint: boolean): string {
  if (tool === 'drag') return 'basemap.placement.hint.drag';
  return awaitingMapPoint ? 'basemap.placement.hint.matchMap' : 'basemap.placement.hint.matchDrawing';
}

/**
 * Ο λόγος μηκών των δύο αντιστοιχιών, ή `null` όταν δεν υπάρχουν δύο ή όταν συμφωνούν.
 *
 * ⚠️ Καθαρή συνάρτηση της συνεδρίας και **όχι** hook που ξαναδιαβάζει το store: ο καλών το έχει
 * ήδη διαβάσει, και δύο αναγνώσεις της ίδιας κατάστασης μέσα σε ένα render είναι δύο ευκαιρίες
 * να διαφωνήσουν.
 */
function scaleMismatchOf(session: BasemapPlacementSession): number | null {
  const [a, b] = session.correspondences;
  if (!a || !b) return null;
  const ratio = pointPairScaleRatio(a.drawing, b.drawing, a.world, b.world);
  return Math.abs(ratio - 1) > SCALE_WARNING_TOLERANCE ? ratio : null;
}

/**
 * Οι πράξεις: δύο εργαλεία + επαναφορά + έξοδος.
 *
 * ⚠️ Η **επαναφορά** σβήνει ΚΑΙ τις αντιστοιχίες: αφήνοντάς τες, το επόμενο κλικ θα ξανάλυνε πάνω
 * σε ζεύγη που ο χρήστης μόλις δήλωσε ότι δεν θέλει, και ο χάρτης θα πηδούσε πίσω «μόνος του».
 */
const PlacementActions: React.FC<{ readonly tool: BasemapPlacementTool }> = ({ tool }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const actionClass =
    `flex items-center ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.SPACING.COMPACT} ` +
    `${PANEL_LAYOUT.TYPOGRAPHY.XS} `;

  return (
    <ul className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
      <ToolButton tool="drag" active={tool === 'drag'} label={t('basemap.placement.tool.drag')} />
      <ToolButton tool="match" active={tool === 'match'} label={t('basemap.placement.tool.match')} />
      <li>
        <button
          type="button"
          onClick={() => {
            clearBasemapPlacement();
            clearPlacementCorrespondences();
          }}
          className={actionClass + colors.text.muted}
        >
          <RotateCcw size={13} aria-hidden="true" />
          {t('basemap.placement.reset')}
        </button>
      </li>
      <li>
        <button type="button" onClick={endBasemapPlacement} className={actionClass + colors.text.primary}>
          <Check size={13} aria-hidden="true" />
          {t('basemap.placement.done')}
        </button>
      </li>
    </ul>
  );
};

/**
 * Η κατάσταση: τι να κάνει ο χρήστης τώρα, πόσες αντιστοιχίες έχει, και η **προειδοποίηση κλίμακας**.
 *
 * ADR-650 M10: οι μεγάλοι ΠΟΤΕ δεν κλιμακώνουν σιωπηλά μια γεωαναφορά. Ο λόγος μηκών είναι ο
 * δείκτης που το λέει — και έρχεται από το SSoT `pointPairScaleRatio`, όχι από αριθμητική εδώ.
 */
const PlacementStatus: React.FC<{ readonly session: BasemapPlacementSession }> = ({ session }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const mismatch = scaleMismatchOf(session);
  const lineClass = `${PANEL_LAYOUT.TYPOGRAPHY.XS} `;

  return (
    <>
      <p className={lineClass + colors.text.muted}>
        {t(hintKeyFor(session.tool, session.pendingDrawing !== null))}
      </p>
      {session.tool === 'match' && (
        <p className={lineClass + colors.text.muted}>
          {t('basemap.placement.pairs', { done: session.correspondences.length })}
        </p>
      )}
      {mismatch !== null && (
        <p className={lineClass + colors.text.warning} role="status">
          {t('basemap.placement.scaleMismatch', { ratio: mismatch.toFixed(2) })}
        </p>
      )}
    </>
  );
};

export const BasemapPlacementPanel: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const session = useSyncExternalStore(
    subscribeBasemapPlacementSession,
    getBasemapPlacementSession,
    getBasemapPlacementSession,
  );

  return (
    <section
      aria-label={t('basemap.placement.title')}
      className={`flex flex-col ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.SPACING.COMPACT} ` +
        `${PANEL_LAYOUT.ROUNDED.TOP} ${colors.bg.overlay} ${colors.border.default} border ` +
        PANEL_LAYOUT.SHADOW.MD}
    >
      <PlacementActions tool={session.tool} />
      <PlacementStatus session={session} />
    </section>
  );
};
