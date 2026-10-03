/**
 * =============================================================================
 * ΑΝΑΛΥΣΗ ΠΟΥ ΑΚΟΛΟΥΘΕΙ ΤΟ ZOOM — πάνελ προεπισκόπησης εικόνας (ADR-899 §4.1)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Σε αυτό το κουτί, σε αυτό το zoom, πόσα pixel χρειάζεται η εικόνα — και τα έχω ήδη;»*
 *
 * 🏆 **Πρακτική Immich / PhotoPrism / Deep Zoom**: προοδευτικές στρώσεις — μικρό παράγωγο στο άνοιγμα, μεγαλύτερο
 * **μόνο όταν το zoom το απαιτεί**, αλλαγή **αφού** φορτωθεί (χωρίς λευκό αναβόσβημα).
 * 🔑 **Πιο έξυπνα**: δεν πηδάμε στο πρωτότυπο με το πρώτο zoom. Ζητάμε τη **μικρότερη** βαθμίδα που καλύπτει
 * `κουτί × zoom × DPR` (`filePreviewWidthFor`)· το πρωτότυπο μόνο όταν η ανάγκη ξεπερνά την κορυφή της κλίμακας.
 * Η ανάλυση **μόνο ανεβαίνει**: ό,τι φορτώθηκε είναι ήδη στη μνήμη, το ξεζούμ δεν ξανακατεβάζει τίποτα.
 *
 * 📐 **Ό,τι ζωγραφίζεται, όχι ολόκληρο το κουτί** (ADR-899 §9 Ε2β, μετρημένο 2026-10-03): μέχρι τότε το κουτί μετριόταν ως
 * **max(πλάτος, ύψος)** — «άνω φράγμα για κάθε περιστροφή». Σε κουτί 2352×928 μια κάθετη 3000×4000 ζωγραφίζεται **696** px
 * (`object-contain`, φραγμένη από το ύψος) ⇒ δηλωνόταν 2352 ⇒ φορτωνόταν **`w=2560` (758 KB)** αντί για `w=640`, και το
 * πρωτότυπο ήδη στο 150%. Τώρα: `containedWidth` (SSoT `image-dimensions`) για την **τρέχουσα** περιστροφή — η στροφή
 * κατά 90° είναι απλώς άλλο κουτί για τον άξονα πλάτους της εικόνας, και όπως το zoom **ανεβάζει** βαθμίδα όταν χρειαστεί.
 * Χωρίς γνωστές διαστάσεις: ο άξονας του κουτιού που αντιστοιχεί στο πλάτος της εικόνας (ποτέ θόλωμα, `object-contain`).
 *
 * @module components/shared/files/preview/use-zoom-resolution
 * @see lib/files/file-preview-ladder — `filePreviewWidthFor`
 */

'use client';

import { useEffect, useState, type RefObject } from 'react';

import { steppedUpperBound, useElementSize, type ElementSize } from '@/hooks/media/useElementSize';
import { filePreviewWidthFor, type FilePreviewChoice } from '@/lib/files/file-preview-ladder';
import { containedWidth, type ImageDimensions } from '@/lib/images/image-dimensions';
import type { ProxyImagePreview } from '@/lib/storage/storage-object-url';

/** Σκαλοπάτι μέτρησης του κουτιού (css px) — ίδιο με το lightbox: νέα απόφαση μόνο σε ουσιαστική αλλαγή μεγέθους. */
const BOX_STEP_PX = 16;

/** Η σειρά μιας επιλογής: το πρωτότυπο πάνω από κάθε βαθμίδα. */
function rankOf(choice: FilePreviewChoice): number {
  return choice === 'original' ? Number.POSITIVE_INFINITY : choice;
}

/**
 * **Χρειάζεται αναβάθμιση;** — η νέα επιλογή αν είναι **αυστηρά** πάνω από την τρέχουσα, αλλιώς `null`.
 * Καθαρή συνάρτηση: ό,τι αποφασίζει ελέγχεται χωρίς DOM.
 */
export function zoomUpgradeOf(
  current: FilePreviewChoice,
  neededDevicePx: number,
  intrinsicWidth: number | null = null,
): FilePreviewChoice | null {
  const next = filePreviewWidthFor(neededDevicePx, intrinsicWidth);
  return rankOf(next) > rankOf(current) ? next : null;
}

/** Το URL μιας επιλογής — από την κλίμακα του αναγνώστη, ποτέ δεύτερη συναρμολόγηση. */
export function zoomSourceOf(preview: ProxyImagePreview, originalUrl: string, choice: FilePreviewChoice): string {
  if (choice === 'original') return originalUrl;
  return preview.ladder.find((rung) => rung.width === choice)?.src ?? originalUrl;
}

export interface ZoomResolutionSource {
  readonly src: string;
  readonly srcSet?: string;
  readonly sizes?: string;
}

interface Upgrade {
  /** Σε ποιο αρχείο ανήκει — η αναβάθμιση άλλου αρχείου αγνοείται χωρίς effect επαναφοράς. */
  readonly key: string;
  readonly choice: FilePreviewChoice;
  readonly src: string;
}

function devicePixelRatioOf(): number {
  return typeof window !== 'undefined' && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
}

/**
 * **Πόσα css px πλάτους ζωγραφίζει η εικόνα στο zoom 1** — καθαρή συνάρτηση. Περιστροφή κατά περιττό αριθμό τετάρτων ⇒ ο
 * άξονας πλάτους της εικόνας τρέχει κατά το **ύψος** του κουτιού. `0` = κουτί που δεν μετρήθηκε.
 */
export function paintedWidthOf(box: ElementSize, dimensions: ImageDimensions | null, rotationDeg: number): number {
  const sideways = Math.abs(Math.round(rotationDeg / 90)) % 2 === 1;
  const oriented = sideways ? { width: box.height, height: box.width } : box;
  if (!(oriented.width > 0) || !(oriented.height > 0)) return 0;
  return dimensions ? containedWidth(oriented, dimensions) : oriented.width;
}

/**
 * Φορτώνει το `src` στο παρασκήνιο και καλεί το `onDecoded` **μόνο** όταν τα bytes είναι αποκωδικοποιημένα — αλλιώς ο
 * άνθρωπος βλέπει κενό στη μέση του zoom. Επιστρέφει την ακύρωση (cleanup του effect).
 */
function loadDecoded(src: string, onDecoded: () => void): () => void {
  let cancelled = false;
  const loader = new Image();
  loader.src = src;
  loader
    .decode()
    .then(() => {
      if (!cancelled) onDecoded();
    })
    .catch(() => {
      // Η τρέχουσα εικόνα μένει: θόλωμα σε βαθύ zoom είναι καλύτερο από σπασμένη εικόνα.
    });
  return () => {
    cancelled = true;
  };
}

/**
 * **Η πηγή του `<img>` για το τρέχον zoom.** Χωρίς `preview` (τύπος που δεν προεπισκοπείται, δημόσια κοινή χρήση) ⇒
 * το `url` αυτούσιο — η συμπεριφορά πριν από το ADR-899.
 */
export function useZoomResolution(
  url: string,
  preview: ProxyImagePreview | null | undefined,
  containerRef: RefObject<HTMLElement | null>,
  zoom: number,
  rotationDeg = 0,
): ZoomResolutionSource {
  const box = steppedUpperBound(useElementSize(containerRef, BOX_STEP_PX), BOX_STEP_PX);
  const paintedPx = Math.ceil(paintedWidthOf(box, preview?.dimensions ?? null, rotationDeg));
  // Ταυτότητα από **συμβολοσειρές**: ο καλών μπορεί να ξαναφτιάχνει το αντικείμενο `preview` σε κάθε render.
  const key = `${url}
${preview?.src ?? ''}`;
  const [stored, setStored] = useState<Upgrade | null>(null);
  const upgrade = stored?.key === key ? stored : null;

  useEffect(() => {
    // Καμία ειδική περίπτωση για zoom ≤ 1: εκεί η ανάγκη ≤ τρέχουσας βαθμίδας ⇒ το `zoomUpgradeOf` απαντά `null`.
    if (!preview || paintedPx === 0) return;
    const dpr = devicePixelRatioOf();
    // Με γνωστό πλάτος πρωτοτύπου (ADR-899 §3.7) καμία βαθμίδα πάνω από αυτό· ανάγκη πέρα από τα pixel του ⇒ το πρωτότυπο.
    const intrinsicWidth = preview.dimensions?.width ?? null;
    const current = upgrade?.choice ?? filePreviewWidthFor(paintedPx * dpr, intrinsicWidth);
    const next = zoomUpgradeOf(current, paintedPx * zoom * dpr, intrinsicWidth);
    if (next === null) return;

    const src = zoomSourceOf(preview, url, next);
    return loadDecoded(src, () => setStored({ key, choice: next, src }));
    // `preview` διαβάζεται μέσω `key` (ίδιο src ⇒ ίδια κλίμακα)· το αντικείμενο δεν μπαίνει στις εξαρτήσεις.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, url, paintedPx, zoom, upgrade]);

  if (!preview) return { src: url };
  if (upgrade) return { src: upgrade.src };
  return { src: preview.src, srcSet: preview.srcSet, sizes: paintedPx > 0 ? `${paintedPx}px` : undefined };
}
