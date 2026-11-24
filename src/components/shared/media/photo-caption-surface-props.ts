/**
 * @fileoverview Τα **props** των τεμπέλικων επιφανειών της λεζάντας — μόνο τύποι.
 * @related ./photo-caption-surfaces (το μητρώο) · ./PhotoCaptionLine · listings/photo-caption/PhotoCaptionDialog
 * @module components/shared/media/photo-caption-surface-props
 *
 * ⚠️ **Γιατί χωριστό αρχείο** (ίδιος λόγος με το `terrain-surface-props`): ο γράφος της πύλης 3.34 μετρά και το
 *   `import type` ως ακμή. Αν το μητρώο εισήγαγε τον τύπο από το ίδιο το component, θα έσερνε την επιφάνεια και τις 26
 *   ετικέτες είδους πίσω στη στατική κλειστότητα κάθε σελίδας. Εδώ ζουν μόνο τύποι, χωρίς κανένα component.
 */

import type { PhotoCaption } from '@/lib/listings/photo-caption';

/** Η εικόνα του επεξεργαστή: φορτώνει · έτοιμη · απέτυχε — δομικά ίδιο με το `PhotoSource` του `use-photo-source`. */
export type PhotoCaptionSource =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly src: string }
  | { readonly kind: 'failed' };

export interface PhotoCaptionLineProps {
  /** **Ήδη διαβασμένη** (`readPhotoCaption`) — ο καλών αποφασίζει αν θα αποδώσει καν τη γραμμή. */
  readonly caption: PhotoCaption;
}

export interface PhotoCaptionDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly source: PhotoCaptionSource;
  readonly name: string;
  readonly declared: PhotoCaption | null;
  /** `null` ⇒ «χωρίς λεζάντα» (η γραμμή φεύγει από τη δήλωση). */
  readonly onApply: (next: PhotoCaption | null) => void;
}
