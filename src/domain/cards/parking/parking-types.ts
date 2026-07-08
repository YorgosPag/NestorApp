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
  /** Price (EUR) */
  price?: number;
}
