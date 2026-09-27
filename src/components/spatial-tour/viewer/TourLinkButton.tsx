'use client';

/**
 * @fileoverview **ΤΟ ΚΟΥΜΠΙ-ΒΕΛΑΚΙ** πάνω στη φωτογραφία — πάτημα = «πήγαινε εκεί»· στην οθόνη τοποθέτησης και
 * **σύρσιμο** = «το βελάκι είναι εδώ» (ADR-884 Φ1 · Φ2δ · §4.10, πρότυπο Kuula).
 * @related `TourPanoramaStage.tsx` (γράφει τη θέση του ανά καρέ) · `usePointerDragRelease.ts`
 * @module components/spatial-tour/viewer/TourLinkButton
 *
 * 🔑 **Πραγματικό `<button>`** (Tab · Enter · `aria-label`) και στις δύο χρήσεις. Χωριστό στοιχείο επειδή το σύρσιμο
 *   κρατά κατάσταση ανά κουμπί — hook μέσα σε `map` δεν επιτρέπεται.
 * 🔑 **Πρόθεση** (`onIntent`, ADR-884 Φ2ε · §4.11): δείκτης πάνω στο βελάκι **ή** εστίαση πληκτρολογίου ⇒ ο θεατής
 *   προφορτώνει τα πλακίδια της άφιξης (πρότυπο instant.page: το hover προηγείται του κλικ κατά ~300 ms).
 * 🏆 **Θέαση = βελάκι στο πάτωμα** (Φ2στ · §4.12, πρότυπο Zillow 3D Home): το **όνομα του χώρου** από πάνω, από κάτω μια
 *   έλλειψη «ξαπλωμένη» στο πάτωμα με σεβρόν που δείχνει τον δρόμο. Τη γωνία τη γράφει η σκηνή ανά καρέ στη μεταβλητή
 *   `--tour-arrow-turn` (`floorArrowTurnDeg`) — κανένα re-render. Ο επεξεργαστής κρατά το συρόμενο «χάπι».
 */

import { ChevronUp } from 'lucide-react';

import { usePointerDragRelease } from './usePointerDragRelease';

const BUTTON_CLASS =
  'absolute left-0 top-0 rounded-full border border-border bg-background/85 px-3 py-1 text-sm font-medium text-foreground shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring';

/**
 * ⚠️ **ΚΑΜΙΑ κλάση display στο ίδιο το κουμπί** (ζωντανά 2026-09-27): η σκηνή κρύβει το βελάκι εκτός κάδρου με `el.hidden`,
 * και ένα `flex` στην κλάση **νικά** το `[hidden] { display: none }` του browser ⇒ το βελάκι έμενε ορατό στο (0,0). Η διάταξη
 * ζει στο εσωτερικό `span` (`FLOOR_ARROW_BODY_CLASS`). Άγκυρα: `TourLinkButton.test.tsx`.
 */
const FLOOR_ARROW_CLASS =
  'group absolute left-0 top-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring';
const FLOOR_ARROW_BODY_CLASS = 'flex flex-col items-center gap-1';

interface TourLinkButtonProps {
  readonly label: { readonly text: string; readonly aria: string };
  readonly onGo: () => void;
  /** Παρόν μόνο στην οθόνη τοποθέτησης: πού αφέθηκε το βελάκι (συντεταγμένες οθόνης). */
  readonly onDrop?: (clientX: number, clientY: number) => void;
  readonly register: (el: HTMLButtonElement | null) => void;
  /** Ο επισκέπτης **μάλλον** θα πάει εκεί — ώρα για προφόρτωση. */
  readonly onIntent?: () => void;
}

function DraggableLinkButton({ label, onGo, onDrop, register, onIntent }: TourLinkButtonProps & { readonly onDrop: (x: number, y: number) => void }) {
  const drag = usePointerDragRelease(onDrop);
  return (
    <button type="button" hidden ref={register} aria-label={label.aria} onClick={onGo} onPointerEnter={onIntent} onFocus={onIntent} {...drag}
      className={`${BUTTON_CLASS} cursor-grab touch-none active:cursor-grabbing`}>
      {label.text}
    </button>
  );
}

export function TourLinkButton(props: TourLinkButtonProps) {
  const { label, onGo, onDrop, register, onIntent } = props;
  if (onDrop !== undefined) return <DraggableLinkButton {...props} onDrop={onDrop} />;
  return (
    <button type="button" hidden ref={register} aria-label={label.aria} onClick={onGo} onPointerEnter={onIntent} onFocus={onIntent} className={FLOOR_ARROW_CLASS}>
      <span className={FLOOR_ARROW_BODY_CLASS}>
        <span className="rounded-md bg-background/75 px-2 py-0.5 text-sm font-medium text-foreground shadow">{label.text}</span>
        {/* Πάνω στη ΦΩΤΟΓΡΑΦΙΑ, όχι στο θέμα της εφαρμογής: λευκό όπως η Zillow (και όπως τα χειριστήρια του `VideoPlayer`)·
            ζωντανά 2026-09-27 το `border-background` έβγαινε σκούρο πάνω σε σκούρο πάτωμα στο σκοτεινό θέμα. */}
        <span aria-hidden className="grid h-9 w-20 place-items-center rounded-[50%] border-2 border-white/90 bg-white/20 shadow-md transition-colors group-hover:bg-white/40">
          <ChevronUp className="h-6 w-6 rotate-[var(--tour-arrow-turn,0deg)] text-white drop-shadow" />
        </span>
      </span>
    </button>
  );
}
