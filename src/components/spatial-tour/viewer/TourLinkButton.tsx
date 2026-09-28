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
 * 🏆 **Θέαση = βελάκι ΞΑΠΛΩΜΕΝΟ στο πάτωμα** (Φ2στ-γ · §4.14, πρότυπο Zillow 3D Home): ένας δίσκος — λευκός ημιδιαφανής, με
 *   **σκούρο γκρι** σεβρόν — που η σκηνή απλώνει ανά καρέ πάνω στο επίπεδο του πατώματος με CSS `matrix3d` (ομογραφία,
 *   `lib/geometry/css-homography.ts`), και από πάνω του **όρθια** ετικέτα με το όνομα του χώρου. Διανυσματικό ⇒ ευκρινές σε
 *   κάθε κλίση· ο browser κάνει hit-test στο παραμορφωμένο σχήμα. Η στροφή του σεβρόν (`--tour-arrow-turn`) ζει **μέσα**
 *   στο επίπεδο του δίσκου, άρα η προοπτική την παραμορφώνει σωστά. Ο επεξεργαστής κρατά το συρόμενο «χάπι».
 */

import { ChevronUp } from 'lucide-react';

import { usePointerDragRelease } from './usePointerDragRelease';

const BUTTON_CLASS =
  'absolute left-0 top-0 rounded-full border border-border bg-background/85 px-3 py-1 text-sm font-medium text-foreground shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring';

/**
 * ⚠️ **ΚΑΜΙΑ κλάση display στο ίδιο το κουμπί** (ζωντανά 2026-09-27): η σκηνή κρύβει το βελάκι εκτός κάδρου με `el.hidden`,
 * και ένα `flex` στην κλάση **νικά** το `[hidden] { display: none }` του browser ⇒ το βελάκι έμενε ορατό στο (0,0). Άγκυρα:
 * `TourLinkButton.test.tsx`. Το κουμπί είναι σημείο μηδενικού μεγέθους στη γωνία της σκηνής· δίσκος και ετικέτα είναι
 * παιδιά του με δική τους θέση ⇒ η εστίαση φαίνεται **στον δίσκο** (`group-focus-visible`), όχι σε ένα αόρατο κουτί.
 */
const FLOOR_ARROW_CLASS = 'group absolute left-0 top-0 outline-none';

/** Πλευρά (CSS px) του τετράγωνου στοιχείου που ξαπλώνει στο πάτωμα — το μέγεθος οθόνης το ορίζει ο πίνακας, όχι αυτό. */
export const FLOOR_DISC_PX = 100;

/** Πάνω σε ΦΩΤΟΓΡΑΦΙΑ, όχι στο θέμα της εφαρμογής: λευκός δίσκος, σκούρο σεβρόν — όπως η Zillow (§4.12 (β)). */
const FLOOR_DISC_CLASS =
  'absolute left-0 top-0 grid h-[100px] w-[100px] origin-top-left place-items-center rounded-full border-2 border-white/90 bg-white/55 shadow-md transition-colors group-hover:bg-white/80 group-focus-visible:ring-4 group-focus-visible:ring-ring';
const FLOOR_LABEL_CLASS =
  'absolute left-0 top-0 whitespace-nowrap rounded-md bg-black/35 px-2 py-0.5 text-sm font-medium text-white drop-shadow';

/** Τα δύο κομμάτια που τοποθετεί η σκηνή ανά καρέ — `null` στο συρόμενο «χάπι» του επεξεργαστή. */
export function floorArrowParts(el: HTMLElement): { readonly disc: HTMLElement; readonly label: HTMLElement } | null {
  const disc = el.querySelector<HTMLElement>('[data-floor-disc]');
  const label = el.querySelector<HTMLElement>('[data-floor-label]');
  return disc === null || label === null ? null : { disc, label };
}

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
      <span aria-hidden data-floor-disc className={FLOOR_DISC_CLASS}>
        <ChevronUp strokeWidth={3} className="h-12 w-12 rotate-[var(--tour-arrow-turn,0deg)] text-black/70" />
      </span>
      <span aria-hidden data-floor-label className={FLOOR_LABEL_CLASS}>{label.text}</span>
    </button>
  );
}
