export const PROPERTY_TYPES = [
  { value: "Στούντιο", label: "Στούντιο" },
  { value: "Γκαρσονιέρα", label: "Γκαρσονιέρα" },
  { value: "Διαμέρισμα 2Δ", label: "Διαμέρισμα 2Δ" },
  { value: "Μεζονέτα", label: "Μεζονέτα" },
  { value: "Κατάστημα", label: "Κατάστημα" },
  { value: "Αποθήκη", label: "Αποθήκη" },
] as const;

export const AVAILABILITY = [
  { value: "for-sale", label: "Προς Πώληση" },
  { value: "for-rent", label: "Προς Ενοικίαση" },
  { value: "reserved", label: "Δεσμευμένα" },
] as const;

export const PRICE_MIN = 0;
export const PRICE_MAX = 200_000;
export const PRICE_STEP = 5_000;

export const AREA_MIN = 0;
export const AREA_MAX = 100;
export const AREA_STEP = 5;
