/**
 * @fileoverview **ΣΥΝΔΕΣΜΟΙ ΠΡΟΣ ΕΞΩΤΕΡΙΚΟΥΣ ΧΑΡΤΕΣ** — μία πηγή για κάθε URL (ADR-841 §7 Α21.16).
 * @module lib/geo/map-links
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ** (N.0.2): ο πίνακας των έξι παρόχων αναζήτησης ήταν γραμμένος **αυτούσιος
 * δύο φορές** — `AddressMapPicker` (web) και `base-email-template` (email) — και η κάρτα της
 * βιτρίνας έφερε **τρίτο** καταναλωτή (οδηγίες μετάβασης). Τρίτο αντίγραφο θα ήταν η στιγμή που
 * ο ένας πάροχος αλλάζει μορφή URL στο ένα αρχείο και όχι στο άλλο.
 *
 * 🔑 Χωρίς κλειδί API, χωρίς βιβλιοθήκη: ανοίγει την εφαρμογή στο κινητό και τη σελίδα στον
 * υπολογιστή — κανένα cookie τρίτου στη σελίδα μας.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, ασφαλές σε client, server και email template.
 */

import type { GeoPoint } from '@/types/geo/coordinates';

export type MapSearchProvider = 'googleMaps' | 'googleEarth' | 'bing' | 'apple' | 'osm' | 'waze';

/** **Αναζήτηση κειμένου** ανά πάροχο — όταν έχουμε διεύθυνση, όχι σημείο. */
export const MAP_SEARCH_URLS: Readonly<Record<MapSearchProvider, (query: string) => string>> = {
  googleMaps: (query) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
  googleEarth: (query) => `https://earth.google.com/web/search/${encodeURIComponent(query)}`,
  bing: (query) => `https://www.bing.com/maps?q=${encodeURIComponent(query)}`,
  apple: (query) => `https://maps.apple.com/?q=${encodeURIComponent(query)}`,
  osm: (query) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`,
  waze: (query) => `https://www.waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`,
};

/** Ονόματα εμπορικών σημάτων — **κύρια ονόματα**, δεν μεταφράζονται (ADR-312 Φ9.3). */
export const MAP_SEARCH_PROVIDER_BRANDS: Readonly<Record<MapSearchProvider, string>> = {
  googleMaps: 'Google Maps',
  googleEarth: 'Google Earth',
  bing: 'Bing Maps',
  apple: 'Apple Maps',
  osm: 'OpenStreetMap',
  waze: 'Waze',
};

/** Η σειρά εμφάνισης — δηλωμένη, ώστε web και email να δείχνουν τους παρόχους **ίδια**. */
export const MAP_SEARCH_PROVIDERS: readonly MapSearchProvider[] = ['googleMaps', 'googleEarth', 'bing', 'apple', 'osm', 'waze'];

/**
 * **Οδηγίες μετάβασης προς σημείο.** Συντεταγμένες και όχι κείμενο: η διεύθυνση μπορεί να μην
 * γεωκωδικοποιείται μοναδικά («Τσιμισκή 12» υπάρχει σε πολλές πόλεις) — το σημείο είναι μοναδικό.
 */
export function googleMapsDirectionsUrl(point: GeoPoint): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
}
