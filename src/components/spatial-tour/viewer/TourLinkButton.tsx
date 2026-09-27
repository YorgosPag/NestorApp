'use client';

/**
 * @fileoverview **ΤΟ ΚΟΥΜΠΙ-ΒΕΛΑΚΙ** πάνω στη φωτογραφία — πάτημα = «πήγαινε εκεί»· στην οθόνη τοποθέτησης και
 * **σύρσιμο** = «το βελάκι είναι εδώ» (ADR-884 Φ1 · Φ2δ · §4.10, πρότυπο Kuula).
 * @related `TourPanoramaStage.tsx` (γράφει τη θέση του ανά καρέ) · `usePointerDragRelease.ts`
 * @module components/spatial-tour/viewer/TourLinkButton
 *
 * 🔑 **Πραγματικό `<button>`** (Tab · Enter · `aria-label`) και στις δύο χρήσεις. Χωριστό στοιχείο επειδή το σύρσιμο
 *   κρατά κατάσταση ανά κουμπί — hook μέσα σε `map` δεν επιτρέπεται.
 */

import { usePointerDragRelease } from './usePointerDragRelease';

const BUTTON_CLASS =
  'absolute left-0 top-0 rounded-full border border-border bg-background/85 px-3 py-1 text-sm font-medium text-foreground shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring';

interface TourLinkButtonProps {
  readonly label: { readonly text: string; readonly aria: string };
  readonly onGo: () => void;
  /** Παρόν μόνο στην οθόνη τοποθέτησης: πού αφέθηκε το βελάκι (συντεταγμένες οθόνης). */
  readonly onDrop?: (clientX: number, clientY: number) => void;
  readonly register: (el: HTMLButtonElement | null) => void;
}

function DraggableLinkButton({ label, onGo, onDrop, register }: TourLinkButtonProps & { readonly onDrop: (x: number, y: number) => void }) {
  const drag = usePointerDragRelease(onDrop);
  return (
    <button type="button" hidden ref={register} aria-label={label.aria} onClick={onGo} {...drag}
      className={`${BUTTON_CLASS} cursor-grab touch-none active:cursor-grabbing`}>
      {label.text}
    </button>
  );
}

export function TourLinkButton(props: TourLinkButtonProps) {
  const { label, onGo, onDrop, register } = props;
  if (onDrop !== undefined) return <DraggableLinkButton {...props} onDrop={onDrop} />;
  return (
    <button type="button" hidden ref={register} aria-label={label.aria} onClick={onGo} className={BUTTON_CLASS}>
      {label.text}
    </button>
  );
}
