export const COLUMN_KEYS = [
  "select", "code", "type", "propertyCode", "level", "area", "price",
  "value", "valueWithSyndicate", "status", "owner", "floorPlan",
  "constructedBy", "actions",
] as const;

export const COLUMNS = [
  { key: "select", label: "" },
  { key: "code", label: "Κωδικός" },
  { key: "type", label: "Τύπος" },
  { key: "propertyCode", label: "Ακίνητο" },
  { key: "level", label: "Επίπεδο" },
  { key: "area", label: "τ.μ." },
  { key: "price", label: "Τιμή" },
  { key: "value", label: "Αντ. Αξία" },
  { key: "valueWithSyndicate", label: "Αντ. Αξία Με Συνιδιοκτησία" },
  { key: "status", label: "Κατάσταση" },
  { key: "owner", label: "Ιδιοκτήτης" },
  { key: "floorPlan", label: "Κάτοψη" },
  { key: "constructedBy", label: "Καταχωρήθηκε Από" },
  { key: "actions", label: "Ενέργειες" },
] as const;

export const DEFAULT_COLUMN_WIDTHS = [40,120,100,120,100,80,100,120,180,100,150,150,150,80];
