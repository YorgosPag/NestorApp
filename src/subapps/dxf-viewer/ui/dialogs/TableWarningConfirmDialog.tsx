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
}

export function TableWarningConfirmDialog(
  props: TableWarningConfirmDialogProps,
): React.ReactElement | null {
  const { title, message, undoNote, confirmLabel, cancelLabel, onConfirm, onCancel } = props;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="dxf-modal-overlay" role="dialog" aria-modal="true">
      <div className="dxf-modal-card dxf-modal-card-warning">
        <h2 className="dxf-modal-title dxf-modal-title-warning">{title}</h2>
        <p className="dxf-modal-note-warning">{message}</p>
        <p className="dxf-modal-body">{undoNote}</p>
        <div className="dxf-modal-actions dxf-modal-actions-stack">
          <button
            type="button"
            className="dxf-modal-button dxf-modal-button-warning"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
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
