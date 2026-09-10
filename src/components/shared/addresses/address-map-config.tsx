/* eslint-disable custom/no-hardcoded-strings */
/**
 * =============================================================================
 * 🗺️ ADDRESS MAP — Configuration, Types & SVG Components
 * =============================================================================
 *
 * Extracted from AddressMap.tsx for Google SRP compliance (<500 lines).
 * Contains: PIN_COLORS, BRANCH_PIN_COLORS, AUTO_PAN, DraggableMarkerPin,
 * AddressMapProps interface, and helper types.
 *
 * @file address-map-config.tsx
 * @created 2026-03-28
 * @see AddressMap.tsx
 */

import React from 'react';
import { colors } from '@/styles/design-tokens';
import { getStatusColor } from '@/lib/design-system';
import type { ProjectAddress } from '@/types/project/addresses';
import type { PinDrop } from '@/components/shared/addresses/pin-drop';
import type { GeocodingServiceResult } from '@/lib/geocoding/geocoding-service';
import type { AddressMapHeightPreset } from '@/config/address-map-config';

// =============================================================================
// PIN COLOR CONSTANTS
// =============================================================================

/**
 * Map pin SVG colors — SSoT: design-tokens.
 * `labelClass` uses semantic theme tokens (bg-background / text-foreground)
 * so the pill is legible on both light and dark map styles. Previous attempt
 * piped through `getStatusColor('pending')` / `getStatusColor('construction')`
 * but 'pending' / 'construction' are not registered status domains — the
 * helper returned empty strings, leaving the label unstyled (white-on-white).
 */
export const PIN_COLORS = {
  body: colors.blue['500'],          // #3b82f6 — primary brand
  stroke: colors.background.primary, // white
  innerCircle: colors.background.primary, // white
  // eslint-disable-next-line design-system/no-hardcoded-colors
  shadow: 'rgba(0,0,0,0.3)',         // subtle shadow
  labelClass: 'bg-background/95 text-foreground border border-border',
} as const;

/** Branch pin colors — visually distinct from HQ */
export const BRANCH_PIN_COLORS = {
  body: colors.orange['500'],        // #f97316 — orange for branches
  stroke: colors.background.primary,
  innerCircle: colors.background.primary,
  // eslint-disable-next-line design-system/no-hardcoded-colors
  shadow: 'rgba(0,0,0,0.3)',
  labelClass: 'bg-background/95 text-foreground border border-border',
} as const;

/** Active-editing pin colors — yellow, maximally visible during inline edit */
export const EDITING_PIN_COLORS = {
  body: colors.yellow['400'],        // #facc15 — yellow signals "you are editing this"
  stroke: colors.background.primary,
  innerCircle: colors.background.primary,
  // eslint-disable-next-line design-system/no-hardcoded-colors
  shadow: 'rgba(250,204,21,0.5)',
  labelClass: 'bg-background/95 text-foreground border border-border',
} as const;

/** Auto-pan configuration for edge dragging */
export const AUTO_PAN = {
  EDGE_THRESHOLD: 60,   // pixels from viewport edge to start panning
  PAN_SPEED: 8,         // pixels per pan step
} as const;

// =============================================================================
// COMPONENT INTERFACES
// =============================================================================

export interface AddressMapProps {
  /** Addresses to display on map */
  addresses: ProjectAddress[];

  /** Highlight primary address με larger marker */
  highlightPrimary?: boolean;

  /** Show geocoding status badges */
  showGeocodingStatus?: boolean;

  /** Map container height preset (centralized layout tokens) */
  heightPreset?: AddressMapHeightPreset;

  /** Enable click-to-focus interaction */
  enableClickToFocus?: boolean;

  /** Marker click callback */
  onMarkerClick?: (address: ProjectAddress, index: number) => void;

  /** Geocoding complete callback */
  onGeocodingComplete?: (results: Map<string, GeocodingServiceResult>) => void;

  /** Show "Locate me" button for user GPS position (default: true) */
  showLocateMe?: boolean;

  /** Enable draggable markers (for add/edit mode) */
  draggableMarkers?: boolean;

  /**
   * Όταν ο άνθρωπος αφήνει μια πινέζα — **πάντα** με το σημείο αφής, και με το κείμενο της
   * αντίστροφης γεωκωδικοποίησης όταν υπάρχει (ADR-332 D27 Βήμα Β · `PinDrop`).
   */
  onAddressDragUpdate?: (drop: PinDrop, addressIndex: number) => void;

  /**
   * IDs of addresses that must render as read-only pins even in draggable mode.
   * Use for live-derived items (ADR-318) — they belong to the map but must not
   * be dragged because their source of truth lives elsewhere.
   */
  readOnlyAddressIds?: Set<string>;

  /**
   * Στοιχεία που ζωγραφίζονται **ΜΕΣΑ** στον ίδιο χάρτη — `Marker` / `Source` / `Layer`
   * του `react-map-gl`, ή επικαλύψεις σε συντεταγμένες οθόνης (ADR-332 **D26**).
   *
   * 🔑 **Δεν είναι νέα τρύπα· είναι τοίχος που έπεφτε κατά λάθος.** Ο `InteractiveMap`
   * δέχεται `children` εδώ και καιρό (`InteractiveMapContainer:393`) και ο `AddressMap`
   * απλώς **τα κατάπινε**: κάθε καλών που ήθελε να προσθέσει κάτι στον ίδιο χάρτη έπρεπε
   * να στήσει **δεύτερο** χάρτη ή να περάσει τα δικά του σημεία ως ψεύτικες διευθύνσεις.
   *
   * ⛔ **Το περιεχόμενο ΔΕΝ είναι διεύθυνση**: δεν γεωκωδικοποιείται, δεν μπαίνει στο
   * fit-bounds, δεν σύρεται, δεν μετράει στην αρίθμηση δεικτών του `onAddressDragUpdate`.
   * Αυτό είναι ολόκληρος ο λόγος που υπάρχει ξεχωριστά από το `addresses`: μια πρόταση
   * γεωκωδικοποίησης που περνούσε ως `ProjectAddress` θα ξεκινούσε την ίδια μηχανή
   * *(σάρωση παλαιότητας, σειρά συρσίματος, αυτόματο ζουμ)* για κάτι που **δεν είναι
   * δεδομένο** — και το αυτόματο ζουμ είναι ακριβώς η συμπεριφορά που απορρίφθηκε.
   */
  overlay?: React.ReactNode;

  /** Additional CSS classes */
  className?: string;

  /**
   * ID of the address currently open in the inline edit/add form.
   * That pin renders in amber + bounce to signal "this is the one you are editing".
   */
  activeEditingAddressId?: string;

  /**
   * Increment this counter to clear all drag positions and re-fit bounds.
   * Used to sync the map after undo/redo in the address editor — the pin
   * must revert to the geocoded position for the restored address fields.
   */
  dragResetKey?: number;
}

// =============================================================================
// GEOCODING TYPES
// =============================================================================

/** Status of the geocoding process.
 *
 * `stale` — at least one address has cached `coordinates` but the user has
 * since edited an address-relevant field (street/number/city/neighborhood/
 * postalCode/municipality/region/regionalUnit). The map is showing the OLD
 * pin position; user must hit "force re-geocode" to refresh. Google-style
 * staleness indicator (vs silent ignore).
 */
export type GeocodingStatus = 'idle' | 'loading' | 'success' | 'partial' | 'stale' | 'error';

/** Fields whose change invalidates cached `coordinates` and triggers stale state. */
export const ADDRESS_GEOCODING_FIELDS = [
  'street',
  'number',
  'city',
  'neighborhood',
  'postalCode',
  'municipality',
  'region',
  'regionalUnit',
  'country',
] as const satisfies readonly (keyof import('@/types/project/addresses').ProjectAddress)[];

/** Position for a dragged marker */
export interface DragPosition {
  lng: number;
  lat: number;
}

// =============================================================================
// DRAGGABLE MARKER PIN — SVG Component
// =============================================================================

interface DraggableMarkerPinProps {
  isPrimary?: boolean;
  /** Show pulsating glow for new empty pins */
  pulsate?: boolean;
  /** Label shown below the pin */
  label?: string;
  /** Amber color + bounce — pin is the active inline-edit target */
  isEditing?: boolean;
}

/**
 * Γεωμετρία της πινέζας σε μονάδες viewBox. Η **μύτη** (`PIN_TIP_Y`) είναι το σημείο
 * που δείχνει η πινέζα — και το viewBox **τελειώνει ακριβώς εκεί**.
 */
const PIN_VIEWBOX_WIDTH = 40;
const PIN_TIP_Y = 45;

/**
 * SVG map pin component — used for both draggable and read-only markers.
 *
 * 🔑 **Η ΜΥΤΗ ΕΙΝΑΙ Η ΑΓΚΥΡΑ — ΕΚ ΚΑΤΑΣΚΕΥΗΣ** (ADR-332 D27 Β8). Ο `Marker` δένεται με
 * `anchor="bottom"`, δηλαδή η μηχανή βάζει το σημείο στο **κάτω άκρο του κουτιού** αυτού του
 * στοιχείου. Άρα το κουτί πρέπει να τελειώνει στη μύτη, και **τίποτα άλλο** να μη μετρά σε αυτό:
 * - το viewBox κόβεται στη μύτη· η σκιά εδάφους ξεχειλίζει (`overflow="visible"`) κεντραρισμένη **πάνω της**
 * - η ετικέτα είναι `absolute` (εκτός ροής) — πρακτική Google Maps: `Icon.anchor` ≠ `labelOrigin`
 * - το `flex` μένει: μπλοκοποιεί το svg, αλλιώς το κενό της γραμμής βάσης μπαίνει κάτω από τη μύτη
 * - ⛔ **καμία** κίνηση στο σώμα της πινέζας: η ένδειξη «επεξεργάζεσαι αυτή» είναι δακτύλιος **στο έδαφος**.
 *
 * ⚠️ **ΙΣΤΟΡΙΚΟ**: από 2026-03-07 η ετικέτα ήταν μέσα στη ροή ⇒ η μηχανή αγκύρωνε τη **βάση της
 * ετικέτας**, ~28 px κάτω από τη μύτη (μετρημένο ζωντανά: ~6 μ. στο ζουμ 18, ~25 μ. στο 16), και
 * το `animate-bounce` σήκωνε τη μύτη 25% πάνω από το σημείο τον περισσότερο χρόνο. Ό,τι έβλεπε ο
 * άνθρωπος **δεν** ήταν ό,τι αποθηκευόταν. Φρουρός: `__tests__/map-pin-anchor.test.tsx`.
 */
export function DraggableMarkerPin({ isPrimary, pulsate, label, isEditing }: DraggableMarkerPinProps) {
  const size = isPrimary ? 40 : 32;
  const height = (size * PIN_TIP_Y) / PIN_VIEWBOX_WIDTH;
  const pinColors = isEditing ? EDITING_PIN_COLORS : isPrimary ? PIN_COLORS : BRANCH_PIN_COLORS;
  const shouldAnimate = pulsate || isEditing;
  return (
    <figure className="relative m-0 flex flex-col items-center">
      <svg
        width={size}
        height={height}
        viewBox={`0 0 ${PIN_VIEWBOX_WIDTH} ${PIN_TIP_Y}`}
        overflow="visible"
        xmlns="http://www.w3.org/2000/svg"
        className="cursor-grab active:cursor-grabbing drop-shadow-md"
      >
        {shouldAnimate && (
          <circle
            data-pin-ground-ring
            cx="20"
            cy={PIN_TIP_Y}
            r="7"
            fill="none"
            stroke={pinColors.body}
            strokeWidth="2"
            className="origin-center [transform-box:fill-box] motion-safe:animate-ping"
          />
        )}
        <ellipse cx="20" cy={PIN_TIP_Y} rx="8" ry="3" fill={pinColors.shadow} />
        <path
          d="M 20 0 C 11.163 0 4 7.163 4 16 C 4 25 20 45 20 45 C 20 45 36 25 36 16 C 36 7.163 28.837 0 20 0 Z"
          fill={pinColors.body}
          stroke={pinColors.stroke}
          strokeWidth="2"
        />
        <circle cx="20" cy="16" r="6" fill={pinColors.innerCircle} />
      </svg>
      {label && (
        <figcaption
          className={`absolute left-1/2 top-full mt-0.5 -translate-x-1/2 text-[10px] font-semibold leading-none whitespace-nowrap rounded px-1 py-0.5 shadow-sm ${pinColors.labelClass}`}
        >
          {label}
        </figcaption>
      )}
    </figure>
  );
}
