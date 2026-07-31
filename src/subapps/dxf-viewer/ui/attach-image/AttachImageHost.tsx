'use client';

/**
 * ADR-736 §6 — Ο host της εντολής «Εικόνα»: το κρυφό `<input type="file">` + ο listener του
 * ribbon. Mirror του Tekton picker στο `DxfViewerDialogs` (ίδιο ιδίωμα: action → EventBus →
 * `input.click()`), αλλά σε δικό του αρχείο ώστε να μη φουσκώσει ο container (N.7.1).
 *
 * Δεν αποδίδει τίποτα ορατό — η απόφαση ζει στο `useAttachImage`, το κουμπί στο ribbon.
 *
 * @see ./useAttachImage.ts — τι γίνεται με το αρχείο
 * @see ../../app/dxf-special-actions.ts — ο εκπομπός του `dxf:attach-image-requested`
 */

import React from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { useAttachImage, ATTACH_IMAGE_ACCEPT } from './useAttachImage';

export function AttachImageHost(): React.JSX.Element {
  const attach = useAttachImage();
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Το `isPending` διαβάζεται σε event time μέσω ref: ένα δεύτερο πάτημα όσο τρέχει το
  // ανέβασμα δεν πρέπει να ανοίξει δεύτερο επιλογέα (θα κέρδιζε ο τελευταίος και ο χρήστης
  // θα έβλεπε να μπαίνει «λάθος» εικόνα), αλλά ο listener δεν πρέπει να ξαναδένεται.
  const pendingRef = React.useRef(attach.isPending);
  pendingRef.current = attach.isPending;

  React.useEffect(
    () =>
      EventBus.on('dxf:attach-image-requested', () => {
        if (!pendingRef.current) inputRef.current?.click();
      }),
    [],
  );

  return (
    <input
      ref={inputRef}
      type="file"
      accept={ATTACH_IMAGE_ACCEPT}
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        // Ο επιλογέας μηδενίζεται ΠΑΝΤΑ: αλλιώς η δεύτερη επιλογή του ΙΔΙΟΥ αρχείου δεν
        // εκπέμπει `change` και το κουμπί μοιάζει νεκρό (η κλασική παγίδα του file input).
        e.target.value = '';
        if (file) void attach.onFilePicked(file);
      }}
    />
  );
}
