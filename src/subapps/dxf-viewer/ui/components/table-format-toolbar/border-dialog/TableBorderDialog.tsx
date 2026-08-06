'use client';

/**
 * ADR-750 Φ6 — **«Περισσότερα περιγράμματα…»**: το «Μορφοποίηση κελιών → Περίγραμμα» του Excel.
 *
 * ## 🔑 Το προσχέδιο ΕΙΝΑΙ ένα `PersistedTableModel` — και είναι δωρεάν
 * Ο διάλογος έχει «ΟΚ / Άκυρο», άρα τίποτα δεν αγγίζει το ζωντανό μοντέλο πριν το ΟΚ. Ο
 * πειρασμός είναι μια δεύτερη, «ελαφριά» αναπαράσταση («ποιες θέσεις άναψαν»), που θα ήταν
 * **δεύτερο μοντέλο περιγραμμάτων** και η μετάφρασή του το σημείο απόκλισης. Δεν χρειάζεται:
 * όλες οι πράξεις της μηχανής είναι καθαρές `model → model` **με εγγύηση by-reference**, οπότε
 * ένα τοπικό `useState<PersistedTableModel>` κάνει ακριβώς τη δουλειά — και το «Άκυρο» είναι
 * σκέτη απόρριψη μιας τοπικής μεταβλητής.
 *
 * ## ⚠️ ΤΟ ΜΟΛΥΒΙ ΕΙΝΑΙ ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΔΙΑΛΟΓΟΥ, ΟΧΙ ΙΔΙΟΤΗΤΑ ΤΩΝ ΑΚΜΩΝ
 * Αλλαγή στυλ ή χρώματος **δεν** πειράζει ό,τι έχει ήδη τοποθετηθεί: αφορά τις **επόμενες**
 * θέσεις που θα πατηθούν. Γι' αυτό το `pencil` υπολογίζεται τη στιγμή της πράξης και δεν
 * υπάρχει πουθενά εδώ «ξαναβάψε τα πάντα». Το αντίθετο μοντέλο είναι εύκολο να γραφτεί κατά
 * λάθος και αδύνατο να ξεγραφτεί: ο χρήστης που βάζει λεπτές εσωτερικές και μετά διαλέγει παχύ
 * για το εξωτερικό θα έχανε σιωπηλά τις εσωτερικές του.
 *
 * ## Ένα commit, ένα `Ctrl+Z`
 * Το ΟΚ παραδίδει **ένα** μοντέλο στον {@link onCommit}, που περνά από το `useLiveTableMutation`
 * — την ίδια διαδρομή με κάθε άλλη αλλαγή πίνακα (ADR-739 §6.6). Είκοσι κλικ μέσα στον διάλογο
 * = ένα βήμα αναίρεσης. Και αν το προσχέδιο γύρισε **ίδιο** by-reference, δεν γεννιέται καν
 * εντολή: «άνοιξα, πείραξα, το ξαναέφερα όπως ήταν, ΟΚ» δεν αφήνει ίχνος.
 *
 * ## 🔑 Φ6β — ΑΙΩΡΟΥΜΕΝΟ, ΟΧΙ MODAL (Giorgio, 2026-08-06)
 * Ήταν Radix `Dialog`: backdrop, focus trap, `pointer-events: none` στο υπόλοιπο δέντρο. Δηλαδή
 * ο χρήστης **δεν έβλεπε** τον πίνακα για τον οποίο μιλά ο διάλογος — και το παράθυρο δεν
 * μετακινούνταν για να τον ξεσκεπάσει. Το ίδιο το `@/components/ui/dialog` το γράφει: πάνελ που
 * πρέπει να συνυπάρχει με ό,τι είναι από πίσω **δεν είναι dialog**, και ούτε `modal={false}` το
 * σώζει (ο Radix κλείνει στο πρώτο κλικ εκτός — δηλαδή τη στιγμή που αγγίζεις τον πίνακα).
 *
 * ⚠️ Η **σημασιολογία μένει ακέραιη**: εξακολουθεί να υπάρχει προσχέδιο με «ΟΚ / Άκυρο». Αυτό
 * που έφυγε είναι η *modality* του κελύφους, όχι η δέσμευση. Το Excel κλειδώνει την οθόνη επειδή
 * ο διάλογός του είναι λειτουργικό σύστημα του 1995· η ίδια εργασία σε AutoCAD/Revit γίνεται από
 * modeless παλέτα. Ίδια κίνηση με τον Διαχειριστή Στρώσεων (ADR-723) — και για τον ίδιο λόγο.
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/border-dialog/TableBorderDialog
 * @see bim/table/table-border-dialog-draft.ts — οι μεταλλάξεις
 * @see bim/table/table-border-dialog-positions.ts — οι αναγνώσεις
 * @see docs/centralized-systems/reference/adrs/ADR-750-table-cell-borders.md §8.2 · §9.2 · §21
 * @see ADR-723 — modeless παλέτα · ADR-364 — Escape bus
 */

import React, { useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FloatingPanel, isFocusInsidePanel } from '@/components/ui/floating';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ESC_PRIORITY, useEscapeHandler } from '../../../../systems/escape-bus';
import { PanelPositionCalculator } from '../../../../config/panel-tokens';
import { resolveLinetypePatternMm } from '../../../../rendering/linetype-dash-resolver';
import {
  tableBorderStylePencil,
  tableBorderStylePreset,
  type TableBorderStyleId,
} from '../../../../bim/table/table-border-style-catalog';
import {
  applyTableBorderDialogPreset,
  toggleTableBorderDialogPosition,
  type TableBorderDialogPresetId,
} from '../../../../bim/table/table-border-dialog-draft';
import {
  tableBorderDialogSnapshot,
  type TableBorderDialogPositionId,
} from '../../../../bim/table/table-border-dialog-positions';
import type { TableCellRangeBounds } from '../../../../bim/table/table-cell-range';
import type { TableStyle } from '../../../../bim/table/table-style';
import type { PersistedTableModel } from '../../../../types/table';
import { TABLE_BORDER_DIALOG_KEY } from './table-border-dialog-labels';
import { TableBorderDialogTabs } from './TableBorderDialogTabs';
import { TableBorderStyleListbox } from './TableBorderStyleListbox';
import { TableBorderDialogColor } from './TableBorderDialogColor';
import { TableBorderDialogPresets } from './TableBorderDialogPresets';
import { TableBorderProxyWidget } from './TableBorderProxyWidget';
import styles from './TableBorderDialog.module.css';

/**
 * Η θέση του listbox που είναι επιλεγμένη στο **άνοιγμα**.
 *
 * `'none'` επειδή αυτό δείχνει το μετρημένο στιγμιότυπο ελληνικού Excel (2026-08-04) — όχι
 * επειδή είναι η βολική προεπιλογή. Ονομασμένη σταθερά ακριβώς για να αλλάζει με **μία**
 * γραμμή αν ο ιδιοκτήτης αποφασίσει αλλιώς αφού το δει στην οθόνη.
 */
const INITIAL_TABLE_BORDER_STYLE_ID: TableBorderStyleId = 'none';

/**
 * DOM `id` της ρίζας. Είναι **όνομα παραγωγής**, όχι `data-testid`: απαντά στην ερώτηση
 * «βρίσκεται η εστίαση μέσα στην παλέτα;» που κρίνει αν το `Escape` ανήκει εδώ ή στον καμβά.
 */
const BORDER_PANEL_DOM_ID = 'dxf-table-border-panel';

/**
 * Μέγεθος αναφοράς — **μετρημένο** από το κέλυφος που αντικαταστάθηκε (`size="lg"` ⇒ 672px
 * μέγιστο πλάτος) και από το ύψος του περιεχομένου στο στιγμιότυπο της Φ6.
 *
 * ⚠️ Δεν επιβάλλεται ως ύψος (χωρίς `resizable`/`persistenceKey` η παλέτα παίρνει ύψος από το
 * περιεχόμενο). Χρησιμεύει σε **δύο** υπολογισμούς που δεν έχουν άλλη πηγή: το αρχικό κεντράρισμα
 * και τα όρια συρσίματος. Λάθος τιμή εδώ δεν σπάει τίποτα — απλώς μετατοπίζει λίγο το κέντρο.
 */
const BORDER_PANEL_SIZE = { width: 600, height: 430 } as const;

/**
 * 🔴 `overflow-visible` — ΟΧΙ καλλωπισμός: **χωρίς αυτό το «Χρώμα:» είναι πρακτικά νεκρό.**
 *
 * Η ρίζα του `FloatingPanel` είναι `<Card>`, και το `Card` φέρει `overflow-hidden` στη βάση του.
 * Η παλέτα χρωμάτων ανοίγει ως `position: absolute` **κάτω** από το χειριστήριο, το οποίο κάθεται
 * κοντά στο κάτω χείλος ⇒ κόβεται ολόκληρη. Ο χρήστης πατά και **δεν συμβαίνει τίποτα ορατό**.
 *
 * ⚠️ Γεννήθηκε μαζί με τη Φ6β: ο Radix `DialogContent` που αντικαταστάθηκε **δεν** έκοβε. Είναι
 * το τίμημα κάθε αλλαγής κελύφους — ιδιότητες που τις έδινε δωρεάν ο προηγούμενος ιδιοκτήτης.
 *
 * Το `cn` είναι `tailwind-merge`: το `overflow-visible` του καταναλωτή νικά **ντετερμινιστικά**
 * το `overflow-hidden` της βάσης (ίδια ομάδα utility ⇒ κερδίζει το τελευταίο). Ένας κανόνας CSS
 * module ίδιας ειδικότητας θα άφηνε την απόφαση στη σειρά του bundle — δηλαδή στην τύχη.
 *
 * Ασφαλές εδώ επειδή η παλέτα **δεν κυλά**: χωρίς `resizable`/`persistenceKey` παίρνει ύψος από
 * το περιεχόμενο, άρα δεν υπάρχει τίποτα να κοπεί.
 */
const PANEL_CLASSNAME = cn(styles.panel, 'overflow-visible');

/** Ό,τι χρειάζεται ο διάλογος για να δουλέψει — **παγωμένο στο άνοιγμα**, από τον καλούντα. */
export interface TableBorderDialogTarget {
  readonly bounds: TableCellRangeBounds;
  /** Το ζωντανό μοντέλο τη στιγμή του ανοίγματος — η **αφετηρία** του προσχεδίου. */
  readonly model: PersistedTableModel;
  /** Το ενεργό στυλ του πίνακα — η κληρονομιά κάθε πεδίου που ο χρήστης δεν άγγιξε (Α20). */
  readonly style: TableStyle;
}

export interface TableBorderDialogProps extends TableBorderDialogTarget {
  /** Το ΟΚ: **ένα** μοντέλο, **ένα** commit. */
  readonly onCommit: (model: PersistedTableModel) => void;
  /** Άκυρο / Escape / `✕` — και τα τρία σημαίνουν το ίδιο: πέτα το προσχέδιο. */
  readonly onClose: () => void;
}

export function TableBorderDialog({
  bounds, model, style, onCommit, onClose,
}: TableBorderDialogProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  const panelId = useId();
  const hintId = useId();
  const helpId = useId();

  const [draft, setDraft] = useState<PersistedTableModel>(model);
  const [styleId, setStyleId] = useState<TableBorderStyleId>(INITIAL_TABLE_BORDER_STYLE_ID);
  const [colorHex, setColorHex] = useState<string | undefined>(undefined);

  /**
   * Το μολύβι **που θα εφαρμοστεί στο επόμενο κλικ**.
   *
   * Περνά από την ίδια `tableBorderStylePencil` που θα εκτελέσει η πράξη — και το `dashMm`
   * λύνεται εδώ επειδή η μηχανή είναι επίτηδες ντετερμινιστική (η μετάφραση ονόματος → μοτίβο
   * θέλει το `LinetypeRegistry`, δηλαδή κατάσταση).
   */
  const pencil = useMemo(() => {
    const pen = tableBorderStylePreset(styleId)?.pen;
    const dashMm = pen ? resolveLinetypePatternMm(pen.linetypeName) : [];
    return tableBorderStylePencil(styleId, style, dashMm, colorHex);
  }, [styleId, style, colorHex]);

  const snapshot = useMemo(() => tableBorderDialogSnapshot(draft, bounds), [draft, bounds]);

  const toggle = useCallback(
    (id: TableBorderDialogPositionId) => {
      setDraft((current) => toggleTableBorderDialogPosition(current, bounds, id, pencil));
    },
    [bounds, pencil],
  );

  const applyPreset = useCallback(
    (preset: TableBorderDialogPresetId) => {
      setDraft((current) => applyTableBorderDialogPreset(current, bounds, preset, pencil));
    },
    [bounds, pencil],
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
    id: 'table-border-panel',
    priority: ESC_PRIORITY.FOCUSED_PALETTE,
    canHandle: () => isFocusInsidePanel(BORDER_PANEL_DOM_ID),
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
      BORDER_PANEL_SIZE.width, BORDER_PANEL_SIZE.height,
    ),
    [],
  );
  const draggableOptions = useMemo(() => ({ getClientPosition }), [getClientPosition]);

  return (
    <FloatingPanel
      id={BORDER_PANEL_DOM_ID}
      data-testid={BORDER_PANEL_DOM_ID}
      className={PANEL_CLASSNAME}
      dimensions={BORDER_PANEL_SIZE}
      draggableOptions={draggableOptions}
      aria-describedby={helpId}
      onClose={onClose}
    >
      <FloatingPanel.Header title={t(`${TABLE_BORDER_DIALOG_KEY}.title`)} />
      <FloatingPanel.Content>
        <TableBorderDialogTabs panelId={panelId} hintId={hintId} />

        <section
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${panelId}-tab-border`}
          className={styles.layout}
        >
          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
              {t(`${TABLE_BORDER_DIALOG_KEY}.line.section`)}
            </legend>
            <span className={styles.fieldLabel}>{t(`${TABLE_BORDER_DIALOG_KEY}.line.style`)}</span>
            <TableBorderStyleListbox
              selected={styleId}
              onSelect={setStyleId}
              colorHex={colorHex}
              label={t(`${TABLE_BORDER_DIALOG_KEY}.line.style`)}
            />
            <TableBorderDialogColor
              selected={colorHex}
              onSelect={setColorHex}
              resolvedHex={pencil.colorHex}
            />
          </fieldset>

          <div className={styles.section}>
            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>
                {t(`${TABLE_BORDER_DIALOG_KEY}.presets.section`)}
              </legend>
              <TableBorderDialogPresets bounds={bounds} onApply={applyPreset} />
            </fieldset>

            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>
                {t(`${TABLE_BORDER_DIALOG_KEY}.border.section`)}
              </legend>
              <TableBorderProxyWidget snapshot={snapshot} onToggle={toggle} />
            </fieldset>
          </div>
        </section>

        {/*
          Το κείμενο βοήθειας **είναι** η περιγραφή της παλέτας: δηλώνει τη ροή («πρώτα στυλ,
          μετά πού»). Ήταν `DialogDescription`· τώρα το `helpId` ταξιδεύει ρητά ως
          `aria-describedby` στη ρίζα, ώστε ο αναγνώστης οθόνης να το ακούει στο άνοιγμα όπως και
          πριν. Χωρίς αυτή τη σύνδεση η αλλαγή κελύφους θα ήταν **σιωπηλή απώλεια** a11y.
        */}
        <p id={helpId} className={styles.help}>
          {t(`${TABLE_BORDER_DIALOG_KEY}.helpText`)}
        </p>

        <footer className={styles.footer}>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t(`${TABLE_BORDER_DIALOG_KEY}.cancel`)}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onCommit(draft);
              onClose();
            }}
          >
            {t(`${TABLE_BORDER_DIALOG_KEY}.ok`)}
          </Button>
        </footer>
      </FloatingPanel.Content>
    </FloatingPanel>
  );
}
