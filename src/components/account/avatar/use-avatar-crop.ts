'use client';

/**
 * Η **αλληλεπίδραση** της περικοπής: ζουμ + σύρσιμο (ADR-798 §16).
 *
 * 🔑 **ΜΙΑ ΜΑΘΗΜΑΤΙΚΗ ΑΛΗΘΕΙΑ, ΔΥΟ ΚΑΤΑΝΑΛΩΤΕΣ.** Η προεπισκόπηση ζωγραφίζεται
 * με το **ίδιο** {@link computeSourceRect} που παράγει και το τελικό αρχείο.
 * Δεν είναι κομψότητα: αν η προεπισκόπηση είχε δικά της μαθηματικά, το «αυτό
 * που είδα» και το «αυτό που αποθηκεύτηκε» θα ήταν **δύο αλήθειες ελεύθερες να
 * αποκλίνουν** (ADR-749) — και η απόκλιση θα φαινόταν μόνο **μετά** την
 * αποθήκευση, στο avatar που βλέπουν οι άλλοι.
 *
 * @module components/account/avatar/use-avatar-crop
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { computeSourceRect, type SourceSize } from '@/services/profile/avatar-image';

/** Η πλευρά του τετραγώνου προεπισκόπησης, σε CSS pixels. */
export const AVATAR_PREVIEW_SIZE = 288;

export interface AvatarCropState {
  readonly zoom: number;
  readonly offset: { readonly x: number; readonly y: number };
}

export interface UseAvatarCrop extends AvatarCropState {
  /**
   * 🔴 **CALLBACK REF, ΟΧΙ `useRef` — ΚΑΙ ΤΟ ΕΔΕΙΞΕ Η ΟΘΟΝΗ, ΟΧΙ Ο ΚΩΔΙΚΑΣ.**
   *
   * Με `useRef` η προεπισκόπηση **δεν ζωγραφιζόταν ΠΟΤΕ**. Ο καμβάς ζει μέσα σε
   * Radix Dialog, που τον προσαρτά σε **portal** — άρα την ώρα που έτρεχε το
   * effect, το `canvasRef.current` ήταν `null`. Το effect έκανε σωστά
   * early-return… και οι εξαρτήσεις του (`image`, `size`, `state`) **δεν
   * άλλαζαν ποτέ ξανά**, οπότε δεύτερη ευκαιρία δεν υπήρξε.
   *
   * Μετρημένο ζωντανά: ο καμβάς έμενε **300×150** — το *προεπιλεγμένο* μέγεθος
   * του HTML — με μαύρα pixels. Ένα «κενό πλαίσιο» που δεν σκάει πουθενά, δεν
   * κοκκινίζει κανένα test, και φαίνεται **μόνο** αν δειγματοληπτήσεις pixel.
   *
   * Το callback ref τρέχει **τη στιγμή που προσαρτάται ο κόμβος**, οπότε η
   * ζωγραφική δεν εξαρτάται πια από το πότε θα ανοίξει το portal.
   */
  canvasRef(node: HTMLCanvasElement | null): void;
  setZoom(zoom: number): void;
  reset(): void;
  onPointerDown(event: React.PointerEvent<HTMLElement>): void;
  onPointerMove(event: React.PointerEvent<HTMLElement>): void;
  onPointerUp(event: React.PointerEvent<HTMLElement>): void;
}

const INITIAL: AvatarCropState = { zoom: 1, offset: { x: 0, y: 0 } };

/**
 * @param image  η αποκωδικοποιημένη πηγή, ή `null` όσο δεν υπάρχει επιλογή
 * @param size   οι διαστάσεις της πηγής — χωριστά από το `image`, ώστε τα
 *               μαθηματικά να μη χρειάζονται ποτέ το ίδιο το bitmap
 */
export function useAvatarCrop(image: CanvasImageSource | null, size: SourceSize | null): UseAvatarCrop {
  const [state, setState] = useState<AvatarCropState>(INITIAL);
  // Ο κόμβος ως **κατάσταση**: έτσι η προσάρτησή του είναι γεγονός που μπορεί να
  // πυροδοτήσει ζωγραφική. Ένα `useRef` δεν ειδοποιεί κανέναν όταν γεμίσει.
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const canvasRef = useCallback((node: HTMLCanvasElement | null) => setCanvas(node), []);
  const dragOrigin = useRef<{ x: number; y: number; offset: { x: number; y: number } } | null>(null);

  // Νέα πηγή ⇒ καθαρή αφετηρία. Χωρίς αυτό, το ζουμ της προηγούμενης εικόνας
  // εφαρμοζόταν σε φωτογραφία άλλων διαστάσεων — «γιατί μπήκε ήδη μεγεθυσμένη;».
  useEffect(() => { setState(INITIAL); }, [image]);

  useEffect(() => {
    if (!canvas || !image || !size) return;
    drawPreview(canvas, image, size, state);
  }, [canvas, image, size, state]);

  const setZoom = useCallback((zoom: number) => {
    setState((prev) => ({ ...prev, zoom }));
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setState((prev) => {
      dragOrigin.current = { x: event.clientX, y: event.clientY, offset: prev.offset };
      return prev;
    });
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    setState((prev) => ({
      ...prev,
      offset: {
        x: origin.offset.x + (event.clientX - origin.x),
        y: origin.offset.y + (event.clientY - origin.y),
      },
    }));
  }, []);

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
    dragOrigin.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return { ...state, canvasRef, setZoom, reset, onPointerDown, onPointerMove, onPointerUp };
}

/**
 * Ζωγραφίζει την προεπισκόπηση στο **φυσικό** μέγεθος pixel της οθόνης.
 *
 * ⚠️ Χωρίς `devicePixelRatio`, σε οθόνη 2× η προεπισκόπηση φαίνεται **θολή** ενώ
 * το αποθηκευμένο 512άρι είναι καθαρό — και ο άνθρωπος κρίνει την ποιότητα από
 * αυτό που βλέπει, οπότε θα ξαναπροσπαθούσε για πρόβλημα που δεν υπάρχει.
 */
function drawPreview(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  size: SourceSize,
  state: AvatarCropState,
): void {
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 3);
  const pixels = Math.round(AVATAR_PREVIEW_SIZE * dpr);
  if (canvas.width !== pixels) canvas.width = pixels;
  if (canvas.height !== pixels) canvas.height = pixels;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, pixels, pixels);
  ctx.imageSmoothingQuality = 'high';

  const rect = computeSourceRect({
    source: size,
    viewport: AVATAR_PREVIEW_SIZE,
    zoom: state.zoom,
    offset: state.offset,
  });
  ctx.drawImage(image, rect.sx, rect.sy, rect.size, rect.size, 0, 0, pixels, pixels);
}
