'use client';

/**
 * 🔴 ADR-755 — **το κοινό σώμα των διαλόγων «ρώτα πριν χάσεις» του πίνακα**.
 *
 * ## Πώς βρέθηκε (CHECK 3.28, μετρημένο)
 * Ο διάλογος της συγχώνευσης αντέγραψε από εκείνον της μεταφοράς περιοχής **11 γραμμές / 59
 * tokens**: το portal, το `role="dialog"`, τις τρεις παραγράφους και τα δύο κουμπιά.
 *
 * ## 🔴 Η ΕΣΤΙΑΣΗ ΠΑΕΙ ΣΤΟ «ΑΚΥΡΟ», ΟΧΙ ΣΤΗΝ ΚΑΤΑΣΤΡΟΦΙΚΗ ΕΝΕΡΓΕΙΑ
 * Το Excel εστιάζει το `OK` — και αυτή είναι η μία θέση όπου το parity **δεν** ακολουθείται, με
 * μετρήσιμο λόγο: ο διάλογος γεννιέται μέσα σε **φύλλο υπολογισμού**, όπου το `Enter` είναι το
 * συχνότερο πλήκτρο που πατά ο χρήστης (κάθε καταχώριση κελιού τελειώνει με αυτό). Ένα
 * αντανακλαστικό `Enter` πάνω σε εστιασμένη «Αντικατάσταση» / «Συγχώνευση» θα ήταν **ακριβώς**
 * η σιωπηλή καταστροφή που ο διάλογος υπάρχει για να αποτρέψει — δηλαδή θα ρωτούσε τυπικά και
 * θα απαντούσε μόνος του. Η οδηγία της Nielsen Norman για καταστροφικές ενέργειες λέει το ίδιο:
 * *«the default focus should land on the safe or non-destructive option»*.
 *
 * Ο κανόνας ζει **εδώ**, σε ένα σημείο: γραμμένος σε κάθε διάλογο ξεχωριστά, ο επόμενος θα τον
 * ξεχνούσε — και η παράλειψη ενός `autoFocus` δεν φαίνεται σε καμία οπτική επιθεώρηση.
 *
 * ## Τι ΔΕΝ μπαίνει εδώ
 * Η **χειραψία** (ποιο store, ποια απάντηση) και το `Escape`. Κάθε διάλογος έχει δικό του store
 * και δικό του `id` στον escape-bus· κοινό είναι μόνο το σώμα.
 *
 * @module subapps/dxf-viewer/ui/dialogs/TableWarningConfirmDialog
 */

import React from 'react';
import { createPortal } from 'react-dom';

export interface TableWarningConfirmDialogProps {
  readonly title: string;
  /** Ο **αριθμός** είναι το περιεχόμενο του μηνύματος: «# κελιά», ποτέ «είσαι σίγουρος;». */
  readonly message: string;
  /** NN/g: πες αν είναι **ανακτήσιμο**. Είναι — ΕΝΑ βήμα undo. */
  readonly undoNote: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /**
   * 🔴 ADR-833 §1.4 → Φάση 4 — **οι μη καταστροφικές απαντήσεις**, προαιρετικές: πράξεις που
   * δίνουν στον χρήστη ό,τι ζητά **χωρίς** την καταστροφή («Προσθήκη ως φύλλα», «Νέος πίνακας
   * δίπλα»).
   *
   * Κενές/απούσες ⇒ ο διάλογος μένει **ακριβώς** ο δυαδικός που ήταν, με τα ίδια δύο κουμπιά:
   * κανένας από τους δεκατρείς υπάρχοντες καταναλωτές δεν αλλάζει. Πίνακας και όχι δεύτερο
   * component, γιατί ο κανόνας εστίασης (δες κεφαλίδα) πρέπει να μείνει σε **ένα** σημείο — ένα
   * δεύτερο σώμα θα ήταν ακριβώς ο κλώνος 11 γραμμών που γέννησε αυτό το αρχείο.
   *
   * ⚠️ **Πίνακας, όχι δεύτερο προαιρετικό ζεύγος** (`alternative2Label`/`onAlternative2`): η
   * Φάση 4 έφερε τη **δεύτερη** ασφαλή διέξοδο, και ένα δεύτερο ζεύγος θα καλούσε το τρίτο.
   * Το πλήθος είναι δεδομένο του καλούντος, όχι του σώματος.
   *
   * Κάθονται **ανάμεσα** στην καταστροφική και στο «Άκυρο»: οι NN/g συνιστούν τη σειρά
   * «επικίνδυνο → εναλλακτικά → άρνηση», ώστε το μάτι να συναντά την ασφαλή διέξοδο τελευταίο
   * και το πληκτρολόγιο να την έχει ήδη εστιασμένη.
   */
  readonly alternatives?: readonly TableWarningAlternative[];
  /**
   * 🔴 ADR-833 §5.7.5 — **η απαρίθμηση**: τι δεν κρατιέται, με τον αριθμό του, **πριν** ο
   * χρήστης απαντήσει.
   *
   * Ομαδοποιημένη λίστα και όχι πρόταση μέσα στο {@link message}: το μήνυμα απαντά στο *«τι θα
   * γίνει;»*, αυτό στο *«τι θα χάσω;»* — δύο ερωτήσεις, και η δεύτερη έχει **πλήθος**. Χωμένη
   * στο μήνυμα θα ήταν παράγραφος που ο χρήστης προσπερνά, δηλαδή η σιωπηλή απώλεια από την
   * πίσω πόρτα (§5.6.5).
   *
   * Κενή/απούσα ⇒ ο διάλογος μένει **ακριβώς** ο ίδιος· κανένας από τους δεκατρείς υπάρχοντες
   * καταναλωτές δεν αλλάζει, με το ίδιο σκεπτικό του {@link alternatives}.
   */
  readonly details?: readonly TableWarningDetailGroup[];
}

/** Μία βαθμίδα της απαρίθμησης: ο τίτλος της και οι γραμμές της. */
export interface TableWarningDetailGroup {
  readonly title: string;
  readonly items: readonly string[];
}

/** Μια μη καταστροφική διέξοδος του διαλόγου: τι λέει, τι κάνει. */
export interface TableWarningAlternative {
  readonly label: string;
  readonly onSelect: () => void;
}

export function TableWarningConfirmDialog(
  props: TableWarningConfirmDialogProps,
): React.ReactElement | null {
  const { title, message, undoNote, confirmLabel, cancelLabel, onConfirm, onCancel } = props;
  const alternatives = props.alternatives ?? [];
  const details = props.details ?? [];
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card dxf-modal-card-warning">
        <h2 className="dxf-modal-title dxf-modal-title-warning">{title}</h2>
        <p className="dxf-modal-note-warning">{message}</p>
        {/* 🔴 ADR-833 §5.7.5 — ό,τι δεν κρατιέται, **πριν** την απάντηση. Σημασιολογικά
            λίστες: είναι απαρίθμηση, όχι παράγραφος (κανόνας N.4). */}
        {details.map((group) => (
          <section key={group.title} className="dxf-modal-body">
            <strong>{group.title}</strong>
            <ul>
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="dxf-modal-body">{undoNote}</p>
        <div className="dxf-modal-actions dxf-modal-actions-stack">
          <button
            type="button"
            className="dxf-modal-button dxf-modal-button-warning"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          {/* Οι ασφαλείς διέξοδοι, με τη σειρά που τις έδωσε ο καλών: ό,τι ζητά ο χρήστης,
              χωρίς την καταστροφή. Κλειδί η **ετικέτα** — είναι ό,τι διακρίνει τη μία από την
              άλλη, και δεν επιτρέπεται να επαναληφθεί μέσα στον ίδιο διάλογο. */}
          {alternatives.map((alternative) => (
            <button
              key={alternative.label}
              type="button"
              className="dxf-modal-button"
              onClick={alternative.onSelect}
            >
              {alternative.label}
            </button>
          ))}
          {/* 🔴 Η εστίαση στο ΑΣΦΑΛΕΣ — δες την κεφαλίδα για τη μέτρηση πίσω από αυτό. */}
          <button type="button" autoFocus className="dxf-modal-button" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
