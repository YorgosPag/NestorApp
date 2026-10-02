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
 * ⚠️ Το κουτί μετριέται ως **max(πλάτος, ύψος)**: άνω φράγμα για κάθε περιστροφή (90° ανταλλάσσει τους άξονες) —
 * ποτέ θόλωμα· το κόστος είναι το πολύ μία βαθμίδα σε ακραία κουτιά.
 *
 * @module components/shared/files/preview/use-zoom-resolution
 * @see lib/files/file-preview-ladder — `filePreviewWidthFor`
 */

'use client';

import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

import { filePreviewWidthFor, type FilePreviewChoice } from '@/lib/files/file-preview-ladder';
import type { ProxyImagePreview } from '@/lib/storage/storage-object-url';

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

/** Το μετρημένο κουτί (CSS px), ζωντανά με το `ResizeObserver`. `0` πριν τη μέτρηση. */
function useBoxPx(containerRef: RefObject<HTMLElement | null>): number {
  const [boxPx, setBoxPx] = useState(0);
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setBoxPx(Math.round(Math.max(rect.width, rect.height)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);
  return boxPx;
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
): ZoomResolutionSource {
  const boxPx = useBoxPx(containerRef);
  // Ταυτότητα από **συμβολοσειρές**: ο καλών μπορεί να ξαναφτιάχνει το αντικείμενο `preview` σε κάθε render.
  const key = `${url}
${preview?.src ?? ''}`;
  const [stored, setStored] = useState<Upgrade | null>(null);
  const upgrade = stored?.key === key ? stored : null;

  useEffect(() => {
    // Καμία ειδική περίπτωση για zoom ≤ 1: εκεί η ανάγκη ≤ τρέχουσας βαθμίδας ⇒ το `zoomUpgradeOf` απαντά `null`.
    if (!preview || boxPx === 0) return;
    const dpr = devicePixelRatioOf();
    // Με γνωστό πλάτος πρωτοτύπου (ADR-899 §3.7) καμία βαθμίδα πάνω από αυτό· ανάγκη πέρα από τα pixel του ⇒ το πρωτότυπο.
    const current = upgrade?.choice ?? filePreviewWidthFor(boxPx * dpr, preview.intrinsicWidth);
    const next = zoomUpgradeOf(current, boxPx * zoom * dpr, preview.intrinsicWidth);
    if (next === null) return;

    let cancelled = false;
    const src = zoomSourceOf(preview, url, next);
    const loader = new Image();
    loader.src = src;
    // Αλλαγή ΜΟΝΟ όταν τα bytes είναι αποκωδικοποιημένα — αλλιώς ο άνθρωπος βλέπει κενό στη μέση του zoom.
    loader
      .decode()
      .then(() => {
        if (!cancelled) setStored({ key, choice: next, src });
      })
      .catch(() => {
        // Η τρέχουσα εικόνα μένει: θόλωμα σε βαθύ zoom είναι καλύτερο από σπασμένη εικόνα.
      });
    return () => {
      cancelled = true;
    };
    // `preview` διαβάζεται μέσω `key` (ίδιο src ⇒ ίδια κλίμακα)· το αντικείμενο δεν μπαίνει στις εξαρτήσεις.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, url, boxPx, zoom, upgrade]);

  if (!preview) return { src: url };
  if (upgrade) return { src: upgrade.src };
  return { src: preview.src, srcSet: preview.srcSet, sizes: boxPx > 0 ? `${boxPx}px` : undefined };
}
