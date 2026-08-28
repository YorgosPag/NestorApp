'use client';

/**
 * 🔴 ADR-739 §69 — **ΤΟ ΠΛΑΙΣΙΟ ΟΝΟΜΑΤΟΣ**: πού είμαι, πόσο πιάνω, και πού θέλω να πάω.
 *
 * Ήταν `<span>{reference.a1}</span>` μέσα στη γραμμή τύπων — μισό πλαίσιο ονόματος. Το Excel
 * κάνει **τρία** πράγματα από την ίδια θέση, και τα δύο έλειπαν:
 *
 * | στιγμή | Excel | εδώ, πριν |
 * |---|---|---|
 * | ακίνητο χέρι | `A1` (**το ενεργό κελί**) | ✅ ίδιο |
 * | **όσο σέρνεις** | `2R x 2C` | ❌ έμενε στο `A1` |
 * | πληκτρολογείς `B7`+`Enter` | **πηγαίνεις** εκεί | ❌ αδρανές |
 *
 * ## 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΦΥΛΛΟ ΚΑΙ ΟΧΙ ΓΡΑΜΜΕΣ ΜΕΣΑ ΣΤΗΝ `TableFormulaBar` — ADR-040
 * Επειδή αυτό είναι το **μόνο** κομμάτι της γραμμής τύπων που αλλάζει σε **κάθε κελί που
 * διασχίζει το χέρι** μέσα σε μια σύρση. Ο κανόνας #4 του ADR-040 λέει ότι ο συνδρομητής
 * υψηλόσυχνης κατάστασης οφείλει να είναι **φύλλο**· η γραμμή τύπων φιλοξενεί το `<input>`
 * της τιμής, δηλαδή **το πεδίο μέσα στο οποίο πληκτρολογεί ο χρήστης**. Συνδρομή εκεί θα
 * σήμαινε re-render του πεδίου γραφής μία φορά ανά κελί σύρσης — για κείμενο έξι χαρακτήρων
 * που ζει σε άλλο κουτί.
 *
 * ## 🔴 ΓΙΑΤΙ ΤΟ ΚΕΙΜΕΝΟ ΠΟΥ ΠΛΗΚΤΡΟΛΟΓΕΙΤΑΙ ΖΕΙ ΣΕ `useState` ΕΔΩ
 * Φαινομενικά αντιφάσκει με το πρόχειρο του κελιού, που ζει **στο store** επειδή ένα
 * ξαναστήσιμο του επεξεργαστή έτρωγε πληκτρολόγηση (μετρημένο, 01/08). Η αιτία εκείνου ήταν
 * ότι ο επεξεργαστής **ξαναστηνόταν** από ασύγχρονη ανανέωση σκηνής. Αυτό εδώ έχει σταθερό
 * γονικό `key` (`table-formula-bar:${entity.id}` — ανά **πίνακα**, ρητή απόφαση του βήματος 7)
 * και **δεν εξαρτάται από τη σκηνή**: δεν μπορεί να ξαναστηθεί μέσα στη συνεδρία.
 *
 * Πιο σημαντικό: αυτό **δεν είναι πρόχειρο κελιού**. Δεν δεσμεύεται πουθενά, δεν γράφει
 * μοντέλο, δεν επιβιώνει της εστίασης. Είναι εφήμερο κείμενο ενός πεδίου **πλοήγησης** — και
 * ένα store γι' αυτό θα ήταν κατάσταση που κανείς άλλος δεν διαβάζει ποτέ.
 *
 * ## Η ιδιοκτησία πλήκτρων — τι αλλάζει και τι όχι
 * Το πεδίο είναι `<input>`, άρα ο δομικός φύλακας `isTextEntryTarget` απαντά `true` και οι
 * **43** window listeners παραιτούνται όσο γράφεις μέσα του: τα βέλη γράφουν γράμματα, δεν
 * κουνούν δρομέα. Και φέρει το {@link TABLE_CELL_SESSION_MARKER}, **υποχρεωτικά** — χωρίς
 * αυτό η εστίαση σε αυτό θα έκλεινε τη συνεδρία ένα καρέ αργότερα, το ακριβές σφάλμα που
 * τεκμηριώνει ολόκληρο το `table-cell-session-focus.ts`.
 *
 * ⚠️ **ΚΑΝΕΝΑΣ φρουρός `onMouseDown`**, σε αντίθεση με τα τρία κουμπιά της γραμμής τύπων. Ο
 * `keepTableCellKeyboardOwnership` αφαιρεί τη μεταφορά εστίασης — και εδώ η μεταφορά είναι
 * **ολόκληρος ο σκοπός**: πατάς το πλαίσιο ονόματος **για να γράψεις μέσα του**. Τα κουμπιά
 * δεν θέλουν ποτέ την εστίαση· αυτό δεν κάνει τίποτα χωρίς αυτήν.
 *
 * ## Έρευνα (Excel / Sheets / CAD)
 * - **Excel**: το `R x C` εμφανίζεται **μόνο** όσο το κουμπί είναι κάτω και εξαφανίζεται στο
 *   `mouseup` — επαληθευμένο. Το πεδίο δέχεται `$B$7` και ονομασμένες περιοχές.
 * - **Google Sheets**: ίδιο πλαίσιο, ίδια θέση· **δεν** δείχνει `R x C` κατά τη σύρση (το
 *   λέει η γραμμή κατάστασης). Ο ιδιοκτήτης ζήτησε ρητά τη συμπεριφορά του Excel.
 * - **AutoCAD**: δεν έχει πλαίσιο ονόματος — έχει `TABLEINDICATOR`, που εδώ **υπάρχει ήδη**
 *   (οι ζώνες `A B C` / `1 2 3`) και ανάβει συμπληρωματικά, χωρίς να λέει μέγεθος.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/TableNameBox
 * @see state/table-drag-span-store.ts — «τι σέρνεται τώρα» (ο ΕΝΑΣ γραφέας: η σύρση)
 * @see bim/table/table-name-box-reference.ts — «πού με στέλνει ο άνθρωπος» (καθαρό)
 * @see bim/table/table-cell-range.ts — `tableSelectionSize`, η ΜΙΑ μετάφραση σε αριθμούς
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §69
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { tableSelectionSize } from '../../bim/table/table-cell-range';
import { useTableDragSpan } from '../../state/table-drag-span-store';
import { TABLE_CELL_SESSION_MARKER } from './table-cell-session-focus';
// 🔴 CHECK 3.7 / ADR-364 — ο **ΕΝΑΣ** ορισμός του «τοπικό πεδίο: Enter επιβεβαιώνει,
// Escape ακυρώνει». Δες τον χειριστή παρακάτω για το γιατί ΔΕΝ είναι ο escape-bus.
import { handleInlineRenameKey } from '../utils/inline-rename-keyboard';
import type { TableCellReference } from '../../bim/table/table-cell-reference';
import type { TableModel } from '../../types/table';

export interface TableNameBoxProps {
  /** Το μοντέλο του **ζωντανού** πίνακα — για τη μέτρηση και για τη μετάφραση αναφοράς. */
  readonly model: TableModel;
  /** Η ονομασία του ενεργού κελιού· `null` όταν η ταυτότητα δεν λύνεται (μπαγιάτικος δρομέας). */
  readonly reference: TableCellReference | null;
  /**
   * 🔴 Πήγαινε εκεί. Ο **καλών** κατέχει τη σειρά «δέσμευσε πρόχειρο → μετακίνησε δρομέα →
   * γράψε περιοχή → επίστρεψε το πληκτρολόγιο στο πλέγμα» — δες `use-table-name-box-goto`.
   *
   * ⚠️ **Δεν** μπαίνει στο `TableCellSessionHandlers`: το κριτήριο εκείνου του συμβολαίου
   * είναι «το χρειάζονται **και τα δύο** πεδία;» (κελί + γραμμή τύπων). Αυτό είναι **τρίτο**
   * πεδίο, με δικό του κύκλο, και καμία από τις δύο άλλες επιφάνειες δεν το καλεί ποτέ.
   */
  readonly onGoTo: (text: string) => boolean;
}

export function TableNameBox(props: TableNameBoxProps): React.ReactElement {
  const { model, reference, onGoTo } = props;
  const { t } = useTranslation('dxf-viewer');
  /**
   * 🔴 ADR-040 — **η ΜΟΝΗ υψηλόσυχνη συνδρομή αυτής της γραμμής**, και ζει σε φύλλο.
   * `null` όταν κανείς δεν κρατά πατημένο, που είναι η κανονική κατάσταση κάθε καρέ.
   */
  const dragSpan = useTableDragSpan();
  /** Τι έγραψε ο άνθρωπος· `null` ⇒ **δεν γράφει** και το πεδίο δείχνει την αλήθεια. */
  const [typed, setTyped] = useState<string | null>(null);

  /**
   * Το κείμενο του πεδίου, με **αυστηρή** προτεραιότητα — και η σειρά είναι σημασία:
   *
   *  1. **ό,τι γράφει ο άνθρωπος** νικά τα πάντα (αλλιώς το πεδίο θα του έσβηνε τα γράμματα)·
   *  2. **η ζωντανή σύρση** (`2R x 2C`) — δεν συνυπάρχει ποτέ με το (1): για να σέρνεις
   *     πρέπει να πατήσεις στον καμβά, που παίρνει την εστίαση από εδώ·
   *  3. **η ταυτότητα του ενεργού κελιού** — η ιστορική συμπεριφορά, αμετάβλητη.
   */
  const value = useMemo(() => {
    if (typed !== null) return typed;
    if (dragSpan !== null) {
      const size = tableSelectionSize(model, dragSpan);
      // `null` ⇒ μπαγιάτικο άκρο: πέφτουμε στην αναφορά αντί να δείξουμε μαντεψιά.
      if (size !== null) {
        return t('table.formulaBar.dragSize', {
          rows: String(size.rows),
          cols: String(size.columns),
        });
      }
    }
    return reference?.a1 ?? '';
  }, [typed, dragSpan, model, reference, t]);

  /** Σταμάτα να γράφεις: το πεδίο ξαναδείχνει την αλήθεια, χωρίς καμία μετακίνηση. */
  const revert = useCallback(() => setTyped(null), []);

  /**
   * 🔴 ADR-364 / CHECK 3.7 — **ο ΕΝΑΣ ορισμός του «τοπικό πεδίο»**, ο ίδιος που εξυπηρετεί τα
   * inline-rename cards και το `useNumericField`: `Enter` επιβεβαιώνει, `Escape` ακυρώνει.
   *
   * ## Γιατί ΔΕΝ περνά από τον escape-bus — και γιατί αυτό ΔΕΝ είναι εξαίρεση
   * Ο bus είναι για **καθολικό** window/document dispatch και **σκιπάρει επίτηδες editable
   * focus** (ADR-364): ένα εστιασμένο πεδίο κειμένου χειρίζεται το δικό του `Escape` τοπικά,
   * όπως κάθε text field. Το ίδιο ακριβώς επιχείρημα που κρατά το `'Escape'` literal μέσα
   * στο {@link handleInlineRenameKey} ισχύει αυτούσιο εδώ — γι' αυτό καταναλώνεται εκείνο,
   * αντί να γραφτεί τέταρτο αντίγραφο της ίδιας σύγκρισης.
   *
   * ⚠️ **Το `stopPropagation` ζει στην ΑΚΥΡΩΣΗ και είναι ουσιώδες**: χωρίς αυτό το `Escape`
   * ανεβαίνει και ο κοινός χειριστής της συνεδρίας ακυρώνει τη **γραφή του κελιού**
   * (`cancelTableCellCursorSession`) — δηλαδή μια μισογραμμένη διεύθυνση εδώ θα πετούσε
   * δουλειά που ζει σε **άλλο κουτί**. Το Excel ακυρώνει μόνο το πλαίσιο ονόματος.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      // Η αναφορά κρατιέται πριν από τα callbacks: το `currentTarget` ισχύει μόνο όσο τρέχει
      // ο χειριστής, και το `blur()` είναι το τελευταίο που κάνουμε και στις δύο διαδρομές.
      const field = event.currentTarget;
      handleInlineRenameKey(event, {
        // Άκυρη ή εκτός πλέγματος αναφορά ⇒ **καμία μετακίνηση**· το πεδίο επαναφέρεται και ο
        // χρήστης βλέπει ξανά πού βρίσκεται. Ίδια συντηρητική στάση με όλους τους μεταφραστές
        // αναφοράς. Το πληκτρολόγιο γυρίζει στο πλέγμα ό,τι κι αν έγινε: ο χρήστης πάτησε
        // `Enter`, δηλαδή δήλωσε ότι τελείωσε με αυτό το πεδίο.
        onConfirm: () => {
          onGoTo(typed ?? value);
          revert();
          field.blur();
        },
        onCancel: () => {
          event.stopPropagation();
          revert();
          field.blur();
        },
      });
    },
    [onGoTo, typed, value, revert],
  );

  return (
    <span className="flex shrink-0 items-center gap-1.5 border-r border-border pr-2">
      <input
        type="text"
        spellCheck={false}
        value={value}
        // Όσο σέρνεται το χέρι το πεδίο δείχνει **μέτρηση**, όχι διεύθυνση: δεν υπάρχει
        // τίποτα να πληκτρολογήσεις σε έναν αριθμό που αλλάζει με το χέρι.
        readOnly={dragSpan !== null}
        className="w-20 bg-transparent px-2 font-mono text-xs font-semibold text-foreground outline-none"
        aria-label={t('table.formulaBar.referenceAriaLabel')}
        // Δες `table-cell-session-focus.ts`: αυτό είναι που εμποδίζει το πλαίσιο ονόματος να
        // κλείσει τον δρομέα τη στιγμή που το πατάς.
        {...TABLE_CELL_SESSION_MARKER}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={handleKeyDown}
        // Έφυγε η εστίαση χωρίς `Enter`: **καμία** μετακίνηση (Excel). Ό,τι γράφτηκε ήταν
        // πρόθεση που ο χρήστης δεν επιβεβαίωσε ποτέ.
        onBlur={revert}
      />
      {/* Η **κεφαλίδα της στήλης** ως συμφραζόμενο — ποτέ μέρος της ταυτότητας (δες την
          κεφαλίδα του `table-cell-reference.ts`). Λείπει σιωπηλά όταν ο πίνακας δεν έχει
          γραμμή κεφαλίδας: φυσιολογικό σε πίνακα υπομνήματος, όχι σφάλμα.
          🔴 Κρύβεται όσο σέρνεται το χέρι: εκεί δεν υπάρχει **μία** στήλη να ονομαστεί, και
          η κεφαλίδα της άγκυρας δίπλα σε `3R x 4C` θα διεκδικούσε ολόκληρη την περιοχή. */}
      {dragSpan === null && reference?.columnHeader ? (
        <em className="max-w-32 truncate font-sans text-[10px] font-normal not-italic text-muted-foreground">
          {reference.columnHeader}
        </em>
      ) : null}
    </span>
  );
}
