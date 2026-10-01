/**
 * @fileoverview **Οι τύποι του χώρου εργασίας σημείων λήψης** — χωρίς καμία οθόνη (ADR-897 Φ3).
 * @module components/listings/capture-spots/capture-spot-types
 *
 * 🔴 **ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (CHECK 3.34 Κ2, ADR-744)**: ο φιλοξενούμενος (`CaptureSpotControl`, η φόρμα του φακέλου, το
 *   πάνελ του γραφείου) χρειάζεται **μόνο τα σχήματα**. Αν τα εισήγαγε από τον διάλογο ή τη λίστα, η στατική κλειστότητα
 *   του route slice θα περνούσε το όριο `next/dynamic` και θα κουβαλούσε **όλα** τα κλειδιά του χώρου εργασίας στο πρώτο
 *   καρέ — μετρημένο: `/o/[workspace]/listings/mandates/new` 21.801 > 19.860 και `/offers/[offerId]` 32.711 > 31.056.
 */

import type { FocalPointPhoto } from '../focal-point/use-photo-source';

/** Μια φωτογραφία της αγγελίας, όπως τη χρειάζεται ο επεξεργαστής. */
export interface CaptureSpotPhoto {
  readonly id: string;
  readonly name: string;
  /** Μικρογραφία, όταν υπάρχει· αλλιώς εικονίδιο. */
  readonly thumbnailUrl: string | null;
}

/** Μια **δηλωμένη** κάτοψη της αγγελίας — τα bytes από τον φρουρούμενο δρόμο (`use-photo-source`). */
export interface CaptureSpotFloorplan {
  readonly id: string;
  readonly name: string;
  readonly source: FocalPointPhoto;
}
