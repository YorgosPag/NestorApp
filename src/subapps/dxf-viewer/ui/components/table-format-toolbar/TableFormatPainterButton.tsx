'use client';

/**
 * 🔴 ADR-768 Βήμα 5 — **ΤΟ ΚΟΥΜΠΙ ΤΟΥ ΠΙΝΕΛΟΥ ΜΟΡΦΟΠΟΙΗΣΗΣ**, ένα για **δύο** επιφάνειες.
 *
 * ## Γιατί βγήκε από το `TableFormatSection`
 * Εκείνο το αρχείο δηλώνει ρητά ότι «*ο τύπος των props μένει ΕΝΑΣ και ταξιδεύει αυτούσιος σε
 * όλα*» — και σωστά, γιατί κάθε θραύσμα του δείχνει **μορφοποίηση του στόχου**. Αυτό το κουμπί
 * δεν δείχνει μορφοποίηση: δείχνει **κατάσταση εργαλείου**. Δεν χρειάζεται ούτε `format`, ούτε
 * `onToggle`, ούτε κανέναν από τους έξι χειριστές — μόνο μία θέση roving.
 *
 * 🔑 Και έχει **δεύτερο ξενιστή**: την κορδέλα (`RibbonTableFormatPainterWidget`). Αν έμενε μέσα
 * στο τμήμα, η κορδέλα θα έπρεπε να κατασκευάσει ένα ψεύτικο `TableFormatSectionProps` με έξι
 * χειριστές που δεν καλούνται ποτέ — δηλαδή θα δήλωνε εξαρτήσεις που δεν έχει.
 *
 * ## 🔴 ΓΙΑΤΙ ΤΟ ΚΟΥΜΠΙ ΔΙΑΒΑΖΕΙ ΜΟΝΟ ΤΟΥ ΚΑΙ ΔΕΝ ΔΕΧΕΤΑΙ ΚΑΤΑΣΤΑΣΗ ΩΣ PROP
 * Είναι **φύλλο** (ADR-040): δύο συνδρομές χαμηλής συχνότητας, μηδέν πάνω από αυτό. Ένα
 * `state`/`onArm` ως props θα ανέβαζε την κατάσταση στους **δύο** ξενιστές — δηλαδή στο
 * `TableFormatToolbar` (που ζει σε portal μέσα σε μενού) **και** στην κορδέλα, με δύο
 * ευκαιρίες να διαφωνήσουν για το τι σημαίνει «κλειδωμένο».
 *
 * ⚠️ Οι δύο συνδρομές είναι **και οι δύο** χαμηλής συχνότητας, μετρημένα:
 *  - το store του πινέλου γράφεται μόνο σε `arm`/`disarm` (το `locked` **δεν** ειδοποιεί ανά βάψιμο)·
 *  - η έκδοση της θύρας αλλάζει μόνο σε αλλαγή **στόχου ή μοντέλου**, ποτέ ανά χαρακτήρα
 *    (`use-table-format-actions`, «ο παλμός ΔΕΝ γίνεται ανά χαρακτήρα»).
 *
 * ## Η χειρονομία (Α1) — Excel, χωρίς timer
 * ```
 *   μονό κλικ  σε ανενεργό  →  arm('once')     μία χρήση, μετά σβήνει μόνο του
 *   μονό κλικ  σε ενεργό    →  disarm()        ο ίδιος διακόπτης, ανάποδα
 *   διπλό κλικ              →  arm('locked')   βάφει μέχρι Esc / δεύτερο κλικ
 * ```
 * Ο browser στέλνει `click → click → dblclick`, άρα το διπλό κλικ περνά από `arm('once')` →
 * `disarm()` → `arm('locked')`. Η τελική κατάσταση προκύπτει από τη **σειρά**, όχι από κατώφλι
 * χρόνου που ο χρήστης ρυθμίζει στο λειτουργικό του. Το `armTableFormatPainter` είναι **ρητά μη
 * ιδεμποτές** («δύο `arm` = δύο προθέσεις»), άρα η ακολουθία είναι εντός συμβολαίου.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/TableFormatPainterButton
 * @see ui/table-cell-editor/use-table-format-painter-actions.ts — οι δύο πράξεις + το `Esc`
 * @see ui/ribbon/components/table/RibbonTableFormatWidgets.tsx — ο δεύτερος ξενιστής
 * @see docs/centralized-systems/reference/adrs/ADR-768-table-format-painter.md
 */

import React, { useSyncExternalStore } from 'react';
import { Lock, Paintbrush } from 'lucide-react';
// Ο ΕΝΑΣ resolver του έργου (ADR-279/280), ο ίδιος με κάθε άλλο κουμπί της γραμμής — ποτέ
// απευθείας `react-i18next`.
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  getTableFormatPainterState,
  subscribeTableFormatPainter,
  type TableFormatPainterState,
} from '../../../state/table-format-painter-store';
import {
  getTableFormatPort,
  getTableFormatRevision,
  subscribeTableFormatPort,
} from '../../table-cell-editor/table-format-port';
import { ToolbarButton } from './ToolbarButton';
import type { RovingItemProps } from './use-roving-toolbar';

/** Η κατάσταση στον server / πριν το πρώτο mount: κανένα πινέλο δεν είναι οπλισμένο. */
const IDLE: TableFormatPainterState = 'idle';

export interface TableFormatPainterButtonProps {
  /** Η θέση roving **αυτού** του κουμπιού. Στην κορδέλα δίνεται αδρανής (δεν είναι toolbar). */
  readonly roving: RovingItemProps;
}

/**
 * **Σειρά 2, θέση 9** του mini toolbar — και ένα widget της κορδέλας.
 *
 * Σβηστό όταν δεν υπάρχει τι να ρουφήξει· **ποτέ** σβηστό όσο είναι οπλισμένο, αλλιώς ο χρήστης
 * θα έχανε τον έναν από τους δύο δρόμους εξόδου (ο άλλος είναι το `Esc`, που δεν ξέρει ότι
 * υπάρχει).
 */
export function TableFormatPainterButton(
  props: TableFormatPainterButtonProps,
): React.ReactElement {
  const { roving } = props;
  const { t } = useTranslation('dxf-viewer');

  const state = useSyncExternalStore(subscribeTableFormatPainter, getTableFormatPainterState, () => IDLE);
  // Η **δεύτερη** ερώτηση: «υπάρχει στόχος να ρουφήξω;». Αλλάζει με τον δρομέα και το μοντέλο,
  // δηλαδή με την έκδοση της θύρας — ο ίδιος δρόμος που χρησιμοποιούν ήδη τα widgets της κορδέλας.
  useSyncExternalStore(subscribeTableFormatPort, getTableFormatRevision, () => 0);

  const armed = state !== 'idle';
  const canArm = getTableFormatPort()?.painter.canArm() === true;

  return (
    <ToolbarButton
      roving={roving}
      title={t('table.formatToolbar.formatPainter')}
      hint={t('table.formatToolbar.formatPainterHint')}
      pressed={armed}
      badge={state === 'locked' ? <Lock size={9} /> : undefined}
      disabled={!armed && !canArm}
      // 🔴 Η θύρα ξαναδιαβάζεται **μέσα** στον χειριστή και ποτέ δεν παγώνει στο render: ένα
      // `Ctrl+Z` ανάμεσα στην απόδοση και το κλικ σημαίνει «καμία πράξη», ποτέ ρούφηγμα από
      // κελιά που δεν υπάρχουν πια (ADR-040 κανόνας #2).
      onActivate={() => {
        const painter = getTableFormatPort()?.painter;
        if (!painter) return;
        if (painter.state() === 'idle') painter.arm('once');
        else painter.disarm();
      }}
      onActivateLocked={() => getTableFormatPort()?.painter.arm('locked')}
    >
      <Paintbrush size={15} />
    </ToolbarButton>
  );
}
