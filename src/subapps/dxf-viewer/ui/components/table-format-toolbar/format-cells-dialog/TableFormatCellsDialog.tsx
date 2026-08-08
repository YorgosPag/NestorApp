'use client';

/**
 * 🔴 ADR-739 §60 / ADR-750 Φ6 — **ο διάλογος «Μορφοποίηση κελιών»**: η ΤΡΙΤΗ επιφάνεια
 * μορφοποίησης, δίπλα στο floating mini toolbar και στην contextual κορδέλα.
 *
 * ## 🔑 ΕΝΑΣ διάλογος, ΤΡΕΙΣ πελάτες — και έτσι ακριβώς το κάνει το Excel
 * Γεννήθηκε στο ADR-750 Φ6 ως «Περισσότερα περιγράμματα…» με **μία** ζωντανή καρτέλα και πέντε
 * δηλωμένες. Το §60 ζωντάνεψε τις δύο που είχαν αποκτήσει πελάτη:
 * ```
 *   Αριθμός    ← ADR-760 §9 «Στάδιο 2»: πόσα δεκαδικά; ποιο νόμισμα; ποια μορφή ημερομηνίας;
 *   Στοίχιση   ← ADR-739 §59: η ΕΛΕΥΘΕΡΗ γωνία και η ΕΣΟΧΗ (η κορδέλα δίνει μόνο preset)
 *   Περίγραμμα ← ADR-750 Φ6, αμετάβλητη
 * ```
 * Δεν «ενοποιήθηκε» τίποτα από ευκολία: το ίδιο παράθυρο του Excel έχει καρτέλα *Αριθμός* **και**
 * καρτέλα *Στοίχιση*, και η δεύτερη περιέχει ακριβώς τον επιλογέα γωνίας (`Μοίρες`, −90..+90) και
 * το spinner `Εσοχή` — επαληθευμένο στην τεκμηρίωση της Microsoft, όχι υποτεθειμένο.
 *
 * ## 🔑 Το προσχέδιο ΕΙΝΑΙ ένα `PersistedTableModel` — και είναι δωρεάν
 * Ο διάλογος έχει «ΟΚ / Άκυρο», άρα τίποτα δεν αγγίζει το ζωντανό μοντέλο πριν το ΟΚ. Ο
 * πειρασμός είναι μια δεύτερη, «ελαφριά» αναπαράσταση («ποια πεδία πείραξε ο χρήστης»), που θα
 * ήταν **δεύτερο μοντέλο μορφοποίησης** και η μετάφρασή του το σημείο απόκλισης. Δεν χρειάζεται:
 * κάθε γραφέας είναι καθαρός `model → model` **με εγγύηση by-reference**, οπότε ένα τοπικό
 * `useState<PersistedTableModel>` κάνει ακριβώς τη δουλειά — και το «Άκυρο» είναι σκέτη
 * απόρριψη μιας τοπικής μεταβλητής.
 *
 * 🔑 Και το ίδιο ισχύει για τις **αναγνώσεις**: οι τρεις καρτέλες ρωτούν το προσχέδιο με τις
 * **ίδιες** συναρτήσεις που ρωτούν το ζωντανό μοντέλο η κορδέλα και το mini toolbar. Καμία
 * «κατάσταση διαλόγου» δεν υπάρχει — άρα καμία δεν μπορεί να αποκλίνει.
 *
 * ## Ένα commit, ένα `Ctrl+Z`
 * Το ΟΚ παραδίδει **ένα** μοντέλο στον {@link onCommit} (θύρα: `TableFormatPort.commitModel`),
 * που περνά από την ίδια ουρά με κάθε άλλη αλλαγή πίνακα (§6.6). Είκοσι κλικ μέσα στον διάλογο
 * = ένα βήμα αναίρεσης. Και αν το προσχέδιο γύρισε **ίδιο** by-reference, δεν γεννιέται καν
 * εντολή: «άνοιξα, πείραξα, το ξαναέφερα όπως ήταν, ΟΚ» δεν αφήνει ίχνος.
 *
 * ## 🔑 Φ6β — ΑΙΩΡΟΥΜΕΝΟ, ΟΧΙ MODAL (Giorgio, 2026-08-06)
 * Ήταν Radix `Dialog`: backdrop, focus trap, `pointer-events: none` στο υπόλοιπο δέντρο. Δηλαδή
 * ο χρήστης **δεν έβλεπε** τον πίνακα για τον οποίο μιλά ο διάλογος. Το Excel κλειδώνει την
 * οθόνη επειδή ο διάλογός του είναι λειτουργικό σύστημα του 1995· η ίδια εργασία σε
 * AutoCAD/Revit γίνεται από modeless παλέτα. Ίδια κίνηση με τον Διαχειριστή Στρώσεων (ADR-723).
 *
 * ## 🔴 ΤΟ ΣΗΜΑΔΙ ΣΥΝΕΔΡΙΑΣ ΔΕΝ ΕΙΝΑΙ ΠΡΟΑΙΡΕΤΙΚΟ — και η Φ6 δεν το χρειαζόταν
 * Ο διάλογος περιγραμμάτων ζούσε **μέσα** στο mini toolbar, που φέρει ήδη το
 * {@link TABLE_CELL_SESSION_MARKER} — άρα το `closest()` του φύλακα το έβρισκε δωρεάν. Ο ίδιος
 * διάλογος **από την κορδέλα** ζει μέσα σε panel που φέρει μόνο το *keepalive* σημάδι, το οποίο
 * λέει άλλο πράγμα: «δέσμευσε, αλλά μη με κλείσεις» ⇒ ο φύλακας **ανακτά** το πληκτρολόγιο,
 * δηλαδή ξαναεστιάζει το κελί — και κλέβει την εστίαση από κάθε πεδίο που μόλις πάτησε ο
 * χρήστης. Με **επτά** πτυσσόμενα, ένα αριθμητικό πεδίο και τρία κουτάκια αυτό δεν είναι
 * ενόχληση — είναι διάλογος που **δεν συμπληρώνεται**.
 *
 * ⚠️ Ο περιτυλιγμένος `<div>` υπάρχει **μόνο** γι' αυτό: το `FloatingPanel` δεν απλώνει
 * αυθαίρετα `data-*` γνωρίσματα στη ρίζα του, και η ρίζα του είναι `fixed` — άρα ο περιτυλιγμένος
 * δεν έχει καμία επίπτωση στη διάταξη. Δεν είναι «div soup» (N.4): είναι **φορέας δήλωσης**,
 * και το σχόλιο είναι ο λόγος του.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/format-cells-dialog/TableFormatCellsDialog
 * @see bim/table/table-border-dialog-draft.ts — οι μεταλλάξεις της καρτέλας «Περίγραμμα»
 * @see bim/table/table-format-scope.ts — οι γραφείς των δύο νέων καρτελών
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §8.2 · §9.2 · §21
 */

import React, { useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FloatingPanel, isFocusInsidePanel } from '@/components/ui/floating';
import { Button } from '@/components/ui/button';
import { ESC_PRIORITY, useEscapeHandler } from '../../../../systems/escape-bus';
import { PanelPositionCalculator } from '../../../../config/panel-tokens';
import { TABLE_CELL_SESSION_MARKER } from '../../../table-cell-editor/table-cell-session-focus';
import { tableFormatScopeBounds } from '../../../../bim/table/table-format-scope';
import type { FormatTarget } from '../../../table-cell-editor/table-format-snapshot';
import type { PersistedTableModel } from '../../../../types/table';
import {
  TABLE_FORMAT_CELLS_KEY,
  TABLE_FORMAT_COMMIT_REFUSAL_KEY,
  type TableFormatCellsTabId,
} from './table-format-cells-labels';
import type {
  TableFormatCommitPlan,
  TableFormatCommitRefusal,
} from '../../../../bim/table/table-format-commit-plan';
import { TableFormatCellsTabs } from './TableFormatCellsTabs';
import { TableFormatCellsBorderTab } from './TableFormatCellsBorderTab';
import { TableFormatCellsNumberTab } from './TableFormatCellsNumberTab';
import { TableFormatCellsAlignTab } from './TableFormatCellsAlignTab';
import styles from './TableFormatCellsDialog.module.css';

/**
 * DOM `id` της ρίζας. Είναι **όνομα παραγωγής**, όχι `data-testid`: απαντά στην ερώτηση
 * «βρίσκεται η εστίαση μέσα στην παλέτα;» που κρίνει αν το `Escape` ανήκει εδώ ή στον καμβά.
 */
const FORMAT_CELLS_PANEL_DOM_ID = 'dxf-table-format-cells-panel';

/**
 * Μέγεθος αναφοράς — **μετρημένο** από το κέλυφος που αντικαταστάθηκε (`size="lg"` ⇒ 672px
 * μέγιστο πλάτος) και από το ύψος του περιεχομένου.
 *
 * ⚠️ Δεν επιβάλλεται ως ύψος (χωρίς `resizable`/`persistenceKey` η παλέτα παίρνει ύψος από το
 * περιεχόμενο). Χρησιμεύει σε **δύο** υπολογισμούς που δεν έχουν άλλη πηγή: το αρχικό
 * κεντράρισμα και τα όρια συρσίματος. Λάθος τιμή εδώ δεν σπάει τίποτα — μετατοπίζει το κέντρο.
 */
const FORMAT_CELLS_PANEL_SIZE = { width: 600, height: 430 } as const;

/**
 * Ό,τι χρειάζεται ο διάλογος για να δουλέψει — **παγωμένο στο άνοιγμα**, από τον καλούντα.
 *
 * 🔑 Είναι ο **υπάρχων** {@link FormatTarget} και όχι νέο σχήμα: κάθε υποδοχή (ζώνες δείκτη ·
 * περιοχή κελιών · κορδέλα) τον κατασκευάζει ήδη, με τον ίδιο ακριβώς κανόνα «τι διάλεξε ο
 * χρήστης → πού γράφεται» (§52). Ένα δικό μας `{bounds, model, style}` θα ήταν **δεύτερη**
 * απάντηση στο ίδιο ερώτημα — και θα έχανε το `scope`, δηλαδή τη διαφορά ανάμεσα σε «γράψε στα
 * κελιά» και «γράψε στη στήλη».
 */
export type TableFormatCellsTarget = FormatTarget;

export interface TableFormatCellsDialogProps {
  readonly target: TableFormatCellsTarget;
  /**
   * 🔴 ADR-739 §61 — Ποια καρτέλα δείχνει **τώρα**. Ελεγχόμενη, ποτέ `initialTab` + `useState`.
   *
   * ## Γιατί αντιστράφηκε η ιδιοκτησία
   * Μέχρι το §60 ήταν `initialTab` και η τρέχουσα καρτέλα ζούσε εδώ. Δούλευε όσο η καρτέλα ήταν
   * **είσοδος**: κάθε εκκινητής ήξερε τη δική του και κανείς δεν ρωτούσε ποια βλέπει ο χρήστης.
   *
   * Το §61 έφερε δύο υποδοχές **χωρίς** καρτέλα (`Ctrl+1`, δεξί κλικ ▸ «Μορφοποίηση κελιών…»),
   * που κατά το Excel ανοίγουν στην **τελευταία που είδε ο χρήστης**. Η «τελευταία» δεν μπορεί
   * να είναι γνωστή σε κανέναν αν ζει σε `useState` ενός component που μόλις ξεμόνταρε — άρα η
   * καρτέλα ανέβηκε στο store, και εδώ μένει ό,τι είναι όντως δικό του: η **απόδοση**.
   */
  readonly tab: TableFormatCellsTabId;
  /** Ο χρήστης πάτησε άλλη καρτέλα. Ο καλών γράφει **και** την οθόνη **και** τη μνήμη. */
  readonly onTabSelect: (tab: TableFormatCellsTabId) => void;
  /**
   * Το ΟΚ: **ένα** μοντέλο, **ένα** commit — και **μία απάντηση**.
   *
   * 🔴 ADR-739 §63 — επιστρέφει το πλάνο, ποτέ `void`. Ο διάλογος είναι **αιωρούμενος**, άρα ζει
   * πέρα από τη συνεδρία που τον γέννησε: ανάμεσα στο άνοιγμα και το «ΟΚ» ο πίνακας μπορεί να
   * έχει φύγει ή να έχει αλλάξει. Ένα `void` σήμαινε ότι ο διάλογος έκλεινε **ό,τι κι αν γινόταν**
   * — και ο χρήστης πίστευε ότι εφάρμοσε. Δες `bim/table/table-format-commit-plan.ts`.
   */
  readonly onCommit: (
    target: TableFormatCellsTarget,
    model: PersistedTableModel,
  ) => TableFormatCommitPlan;
  /** Άκυρο / Escape / `✕` — και τα τρία σημαίνουν το ίδιο: πέτα το προσχέδιο. */
  readonly onClose: () => void;
}

export function TableFormatCellsDialog(
  props: TableFormatCellsDialogProps,
): React.ReactElement {
  const { target, tab, onTabSelect, onCommit, onClose } = props;
  const { t } = useTranslation('dxf-viewer');
  const panelId = useId();
  const hintId = useId();

  const [draft, setDraft] = useState<PersistedTableModel>(target.model);

  /**
   * 🔴 ADR-739 §63 — **ο λόγος που το «ΟΚ» δεν έγραψε**· `null` όσο δεν έχει απορριφθεί τίποτα.
   *
   * Ζει σε `useState` και όχι σε store, σε αντίθεση με την καρτέλα (§61): η καρτέλα είναι **μνήμη**
   * που οφείλει να επιβιώσει του κλεισίματος, ενώ αυτό είναι **γεγονός μιας προσπάθειας** — και
   * μια άρνηση που επιβίωνε του κλεισίματος θα εμφανιζόταν στο επόμενο άνοιγμα, όπου δεν σημαίνει
   * τίποτα.
   */
  const [refusal, setRefusal] = useState<TableFormatCommitRefusal | null>(null);

  /**
   * Ο στόχος ως **ορθογώνιο** — ό,τι δέχεται η καρτέλα «Περίγραμμα».
   *
   * Υπολογίζεται από το **προσχέδιο** και όχι από το αρχικό μοντέλο, και αυτό είναι ουδέτερο
   * σήμερα (καμία καρτέλα δεν προσθέτει ή σβήνει γραμμές) αλλά **σωστό αύριο**: η μέρα που ο
   * διάλογος αποκτήσει δομική πράξη, ένα παγωμένο ορθογώνιο θα έδειχνε σε δείκτες που δεν
   * υπάρχουν πια.
   */
  const bounds = useMemo(
    () => tableFormatScopeBounds(draft, target.scope),
    [draft, target.scope],
  );

  /**
   * Το προσχέδιο **όπως το βλέπουν οι αναγνώσεις**: ο ίδιος στόχος, με το μοντέλο του διαλόγου.
   *
   * Ο τύπος είναι ο ίδιος {@link FormatTarget} που δέχονται όλες οι υπάρχουσες αναγνώσεις, οπότε
   * καμία καρτέλα δεν χρειάζεται να μάθει ότι υπάρχει «προσχέδιο».
   */
  const draftTarget = useMemo<FormatTarget>(
    () => ({ ...target, model: draft }),
    [target, draft],
  );

  /**
   * ESC — **μόνο** με την εστίαση μέσα στην παλέτα.
   *
   * ⚠️ Ο έλεγχος εστίασης ΔΕΝ είναι προαιρετικός. Χωρίς αυτόν μια ανοιχτή παλέτα θα κατανάλωνε
   * κάθε ESC της εφαρμογής και θα σκότωνε το «ακύρωση εντολής / αποεπιλογή» του καμβά — το
   * συχνότερο πλήκτρο του σχεδιαστή. Ίδιο πρωτόκολλο με τον Διαχειριστή Στρώσεων (ADR-723).
   *
   * Σημασιολογικά είναι **Άκυρο**: το προσχέδιο πετιέται, όπως και με το `✕`.
   */
  useEscapeHandler({
    id: 'table-format-cells-panel',
    priority: ESC_PRIORITY.FOCUSED_PALETTE,
    canHandle: () => isFocusInsidePanel(FORMAT_CELLS_PANEL_DOM_ID),
    handle: (): boolean => {
      onClose();
      return true;
    },
  });

  /**
   * Αρχική τοποθέτηση: στο κέντρο — **εκεί που καθόταν ο modal διάλογος**. Η αλλαγή πρέπει να
   * διαβάζεται ως «τώρα σέρνεται», όχι ως «πήδηξε αλλού». Τρέχει μία φορά μετά το mount.
   */
  const getClientPosition = useCallback(
    () => PanelPositionCalculator.getCenteredPosition(
      FORMAT_CELLS_PANEL_SIZE.width, FORMAT_CELLS_PANEL_SIZE.height,
    ),
    [],
  );
  const draggableOptions = useMemo(() => ({ getClientPosition }), [getClientPosition]);

  return (
    <div {...TABLE_CELL_SESSION_MARKER}>
      <FloatingPanel
        id={FORMAT_CELLS_PANEL_DOM_ID}
        data-testid={FORMAT_CELLS_PANEL_DOM_ID}
        className={styles.panel}
        dimensions={FORMAT_CELLS_PANEL_SIZE}
        draggableOptions={draggableOptions}
        onClose={onClose}
      >
        <FloatingPanel.Header title={t(`${TABLE_FORMAT_CELLS_KEY}.title`)} />
        <FloatingPanel.Content>
          <TableFormatCellsTabs
            panelId={panelId}
            hintId={hintId}
            active={tab}
            onSelect={onTabSelect}
          />

          <section
            id={panelId}
            role="tabpanel"
            aria-labelledby={`${panelId}-tab-${tab}`}
            className={styles.tabPanel}
          >
            {tab === 'number' ? (
              <TableFormatCellsNumberTab target={draftTarget} onDraft={setDraft} />
            ) : null}
            {tab === 'alignment' ? (
              <TableFormatCellsAlignTab target={draftTarget} onDraft={setDraft} />
            ) : null}
            {tab === 'border' && bounds !== null ? (
              <TableFormatCellsBorderTab
                bounds={bounds}
                draft={draft}
                style={target.style}
                onDraft={setDraft}
              />
            ) : null}
          </section>

          {/*
            🔴 ADR-739 §63 — η άρνηση είναι **μέρος του διαλόγου**, όχι ειδοποίηση που περνά.
            Ζει δίπλα στα κουμπιά (εκεί κοιτάζει ο χρήστης όταν πατά «ΟΚ» και δεν κλείνει) και
            είναι `role="alert"`, ώστε ο αναγνώστης οθόνης να το ανακοινώσει χωρίς να μετακινηθεί
            η εστίαση — ο χρήστης μένει πάνω στο κουμπί που μόλις πάτησε.
          */}
          {refusal !== null ? (
            <p role="alert" className={styles.refusal}>
              {t(TABLE_FORMAT_COMMIT_REFUSAL_KEY[refusal])}
            </p>
          ) : null}

          <footer className={styles.footer}>
            <Button variant="outline" size="sm" onClick={onClose}>
              {t(`${TABLE_FORMAT_CELLS_KEY}.cancel`)}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const plan = onCommit(target, draft);
                // 🔴 §63 — **ΤΟ ΚΛΕΙΣΙΜΟ ΕΞΑΡΤΑΤΑΙ ΑΠΟ ΤΗΝ ΑΠΑΝΤΗΣΗ.** Ήταν άνευ όρων: ο διάλογος
                // έκλεινε ακόμη κι όταν δεν γράφτηκε τίποτα. Σε άρνηση μένει ανοιχτός **κρατώντας
                // το προσχέδιο** — ο χρήστης δεν χάνει οκτώ ρυθμίσεις για να μάθει ότι απέτυχε.
                if (plan.status === 'refused') {
                  setRefusal(plan.reason);
                  return;
                }
                // Το `unchanged` κλείνει κανονικά: «άνοιξα, πείραξα, το ξαναέφερα όπως ήταν, ΟΚ»
                // είναι επιτυχία που δεν έχει τι να γράψει, όχι αποτυχία (§60).
                onClose();
              }}
            >
              {t(`${TABLE_FORMAT_CELLS_KEY}.ok`)}
            </Button>
          </footer>
        </FloatingPanel.Content>
      </FloatingPanel>
    </div>
  );
}
