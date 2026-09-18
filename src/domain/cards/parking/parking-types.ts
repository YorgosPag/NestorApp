/**
 * 🅿️ PARKING CARD — Shared Types (ADR-585)
 *
 * Adapter type shared by ParkingGridCard / ParkingListCard / useParkingCardModel.
 * Supports both ParkingSpot schemas (@/types/parking and @/hooks) — title comes
 * from `number` (hooks) or `code` (types/parking); level from `level`/`floor`.
 *
 * TODO: Centralize into a single canonical ParkingSpot type.
 */

export interface ParkingSpotAdapter {
  id: string;
  /** Title source — code (types/parking) */
  code?: string;
  /** Title source — number (hooks) */
  number?: string;
  /** Level (types/parking) */
  level?: string;
  /** Floor (hooks) */
  floor?: string;
  /** Spot type */
  type?: string;
  /** Availability status */
  status?: string;
  /** Area (m²) */
  area?: number;
  /** @deprecated flat price — διαβάζεται μόνο ως δίχτυ για παλιά έγγραφα (ADR-777 §8.60.18). */
  price?: number;
  /** Η διάθεση που οδηγεί την τιμή (ίδιο λεξιλόγιο με τα ακίνητα). */
  commercialStatus?: string | null;
  /** Τα ποσά ανά ρόλο — ο επιλυτής διαλέγει ποιο δείχνει η κάρτα, με τη μονάδα του. */
  commercial?: { askingPrice?: number | null; rentPrice?: number | null; finalPrice?: number | null } | null;
}
