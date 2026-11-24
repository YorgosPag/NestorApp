'use client';

/**
 * @fileoverview **Η γραμμή λεζάντας κάτω από μια φωτογραφία** — `<figcaption>` μέσα στο `<figure>` του καλούντα.
 * @related shared/media/photo-caption-labels (το κείμενο) · lib/listings/photo-caption (ο αναγνώστης)
 * @module components/shared/media/PhotoCaptionLine
 *
 * 🔑 **Παίρνει τη λεζάντα ΗΔΗ ΔΙΑΒΑΣΜΕΝΗ** (`PhotoCaption`, ποτέ ωμό πεδίο): ο καλών ρωτά το `readPhotoCaption` για να
 * αποφασίσει **αν** θα αποδώσει καν αυτό το component — και επειδή είναι τεμπέλικη επιφάνεια (`photo-caption-surfaces`), χωρίς λεζάντα
 * δεν κατεβαίνει ούτε ο κώδικας ούτε οι ετικέτες του.
 *
 * ♿ `<figcaption>`: ο αναγνώστης οθόνης δένει τη λεζάντα με την εικόνα χωρίς δεύτερο `aria-*`.
 */

import { usePhotoCaptionText } from './photo-caption-labels';
import type { PhotoCaptionLineProps } from './photo-caption-surface-props';

export default function PhotoCaptionLine({ caption }: PhotoCaptionLineProps) {
  const text = usePhotoCaptionText()(caption);
  if (text === null) return null;
  return <figcaption className="mt-1 line-clamp-2 text-xs text-muted-foreground">{text}</figcaption>;
}
