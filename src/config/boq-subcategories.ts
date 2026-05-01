/**
 * BOQ Sub-Categories (Level 2) — ADR-337
 *
 * 98 curated sub-categories per 16 ΑΤΟΕ groups.
 * Static catalog — used directly by BOQItemEditor (synchronous, no loading).
 * Parallel Firestore catalog in `boq_system_subcategories` (seeded via
 * `npm run seed:boq-subcategories`, managed via Admin UI).
 *
 * @module config/boq-subcategories
 * @see ADR-337 §4.2
 */

// ============================================================================
// TYPE
// ============================================================================

export interface BOQSubCategory {
  code: string;
  parentCode: string;
  nameEL: string;
  nameEN: string;
  sortOrder: number;
}

// ============================================================================
// 98 SUB-CATEGORIES — 16 GROUPS
// ============================================================================

export const BOQ_SUBCATEGORIES: readonly BOQSubCategory[] = [
  // OIK-1 Χωματουργικά
  { code: 'OIK-1.1', parentCode: 'OIK-1', nameEL: 'Εκσκαφές θεμελίων', nameEN: 'Foundation excavations', sortOrder: 1 },
  { code: 'OIK-1.2', parentCode: 'OIK-1', nameEL: 'Εκσκαφές γενικές', nameEN: 'General excavations', sortOrder: 2 },
  { code: 'OIK-1.3', parentCode: 'OIK-1', nameEL: 'Εκβραχισμοί', nameEN: 'Rock excavation', sortOrder: 3 },
  { code: 'OIK-1.4', parentCode: 'OIK-1', nameEL: 'Επιχώσεις — Συμπυκνώσεις', nameEN: 'Backfills & compaction', sortOrder: 4 },
  { code: 'OIK-1.5', parentCode: 'OIK-1', nameEL: 'Κατεδαφίσεις', nameEN: 'Demolitions', sortOrder: 5 },
  { code: 'OIK-1.6', parentCode: 'OIK-1', nameEL: 'Καθαιρέσεις — Αποξηλώσεις', nameEN: 'Removals & dismantling', sortOrder: 6 },
  { code: 'OIK-1.7', parentCode: 'OIK-1', nameEL: 'Μεταφορές γαιών', nameEN: 'Soil transport', sortOrder: 7 },

  // OIK-2 Σκυροδέματα
  { code: 'OIK-2.1', parentCode: 'OIK-2', nameEL: 'Θεμελιώσεις', nameEN: 'Foundations', sortOrder: 1 },
  { code: 'OIK-2.2', parentCode: 'OIK-2', nameEL: 'Πλάκες δαπέδου', nameEN: 'Floor slabs', sortOrder: 2 },
  { code: 'OIK-2.3', parentCode: 'OIK-2', nameEL: 'Δοκοί', nameEN: 'Beams', sortOrder: 3 },
  { code: 'OIK-2.4', parentCode: 'OIK-2', nameEL: 'Υποστυλώματα', nameEN: 'Columns', sortOrder: 4 },
  { code: 'OIK-2.5', parentCode: 'OIK-2', nameEL: 'Τοιχώματα', nameEN: 'Concrete walls (shear walls)', sortOrder: 5 },
  { code: 'OIK-2.6', parentCode: 'OIK-2', nameEL: 'Σκάλες σκυροδέματος', nameEN: 'Concrete stairs', sortOrder: 6 },
  { code: 'OIK-2.7', parentCode: 'OIK-2', nameEL: 'Σιδηρός οπλισμός', nameEN: 'Reinforcement steel', sortOrder: 7 },

  // OIK-3 Τοιχοποιίες
  { code: 'OIK-3.1', parentCode: 'OIK-3', nameEL: 'Οπτοπλινθοδομές μπατικές', nameEN: 'Brick masonry (full thickness)', sortOrder: 1 },
  { code: 'OIK-3.2', parentCode: 'OIK-3', nameEL: 'Οπτοπλινθοδομές δρομικές', nameEN: 'Brick masonry (half thickness)', sortOrder: 2 },
  { code: 'OIK-3.3', parentCode: 'OIK-3', nameEL: 'Λιθοδομές', nameEN: 'Stone masonry', sortOrder: 3 },
  { code: 'OIK-3.4', parentCode: 'OIK-3', nameEL: 'Τοιχοποιίες γυψοσανίδας', nameEN: 'Drywall partitions', sortOrder: 4 },
  { code: 'OIK-3.5', parentCode: 'OIK-3', nameEL: 'Τσιμεντόλιθοι', nameEN: 'Cement-block masonry', sortOrder: 5 },
  { code: 'OIK-3.6', parentCode: 'OIK-3', nameEL: 'Πορομπετόν / Ytong', nameEN: 'Aerated concrete blocks', sortOrder: 6 },

  // OIK-4 Επιχρίσματα
  { code: 'OIK-4.1', parentCode: 'OIK-4', nameEL: 'Ασβεστοκονίαμα', nameEN: 'Lime plaster', sortOrder: 1 },
  { code: 'OIK-4.2', parentCode: 'OIK-4', nameEL: 'Τσιμεντοκονίαμα', nameEN: 'Cement plaster', sortOrder: 2 },
  { code: 'OIK-4.3', parentCode: 'OIK-4', nameEL: 'Ασβεστοτσιμεντοκονίαμα', nameEN: 'Lime-cement plaster', sortOrder: 3 },
  { code: 'OIK-4.4', parentCode: 'OIK-4', nameEL: 'Γυψοκονίαμα', nameEN: 'Gypsum plaster', sortOrder: 4 },
  { code: 'OIK-4.5', parentCode: 'OIK-4', nameEL: 'Μαρμαροκονίαμα', nameEN: 'Marble dust finish', sortOrder: 5 },
  { code: 'OIK-4.6', parentCode: 'OIK-4', nameEL: 'Έτοιμα επιχρίσματα', nameEN: 'Ready-mix plasters', sortOrder: 6 },

  // OIK-5 Πατώματα / Δάπεδα
  { code: 'OIK-5.1', parentCode: 'OIK-5', nameEL: 'Μάρμαρα', nameEN: 'Marble', sortOrder: 1 },
  { code: 'OIK-5.2', parentCode: 'OIK-5', nameEL: 'Γρανίτες', nameEN: 'Granite', sortOrder: 2 },
  { code: 'OIK-5.3', parentCode: 'OIK-5', nameEL: 'Κεραμικά πλακάκια', nameEN: 'Ceramic tiles', sortOrder: 3 },
  { code: 'OIK-5.4', parentCode: 'OIK-5', nameEL: 'Πορσελανάτα (Gres)', nameEN: 'Porcelain stoneware', sortOrder: 4 },
  { code: 'OIK-5.5', parentCode: 'OIK-5', nameEL: 'Ξύλινα δάπεδα (παρκέ)', nameEN: 'Wooden parquet', sortOrder: 5 },
  { code: 'OIK-5.6', parentCode: 'OIK-5', nameEL: 'Laminate / Πολυστρωματικά', nameEN: 'Laminate flooring', sortOrder: 6 },
  { code: 'OIK-5.7', parentCode: 'OIK-5', nameEL: 'Βιομηχανικά δάπεδα', nameEN: 'Industrial floors (epoxy/concrete)', sortOrder: 7 },

  // OIK-6 Κουφώματα
  { code: 'OIK-6.1', parentCode: 'OIK-6', nameEL: 'Αλουμινίου', nameEN: 'Aluminum frames', sortOrder: 1 },
  { code: 'OIK-6.2', parentCode: 'OIK-6', nameEL: 'Συνθετικά (PVC)', nameEN: 'PVC synthetic frames', sortOrder: 2 },
  { code: 'OIK-6.3', parentCode: 'OIK-6', nameEL: 'Ξύλινα', nameEN: 'Wooden frames', sortOrder: 3 },
  { code: 'OIK-6.4', parentCode: 'OIK-6', nameEL: 'Μεταλλικά / Πυρασφαλείας', nameEN: 'Metal / fire-rated', sortOrder: 4 },
  { code: 'OIK-6.5', parentCode: 'OIK-6', nameEL: 'Υαλοπίνακες ενεργειακοί', nameEN: 'Thermal glazing', sortOrder: 5 },
  { code: 'OIK-6.6', parentCode: 'OIK-6', nameEL: 'Ρολά / Παντζούρια', nameEN: 'Roller shutters / shutters', sortOrder: 6 },

  // OIK-7 Χρωματισμοί
  { code: 'OIK-7.1', parentCode: 'OIK-7', nameEL: 'Σπατουλαρίσματα / Στοκαρίσματα', nameEN: 'Spackling / surface prep', sortOrder: 1 },
  { code: 'OIK-7.2', parentCode: 'OIK-7', nameEL: 'Αστάρια', nameEN: 'Primers', sortOrder: 2 },
  { code: 'OIK-7.3', parentCode: 'OIK-7', nameEL: 'Πλαστικά χρώματα (εσωτερικά)', nameEN: 'Plastic paints (interior)', sortOrder: 3 },
  { code: 'OIK-7.4', parentCode: 'OIK-7', nameEL: 'Ακρυλικά χρώματα (εξωτερικά)', nameEN: 'Acrylic paints (exterior)', sortOrder: 4 },
  { code: 'OIK-7.5', parentCode: 'OIK-7', nameEL: 'Ριπολίνες / Ντουκοχρώματα', nameEN: 'Enamel / lacquer', sortOrder: 5 },
  { code: 'OIK-7.6', parentCode: 'OIK-7', nameEL: 'Βερνίκια', nameEN: 'Varnishes', sortOrder: 6 },

  // OIK-8 Υδραυλικά
  { code: 'OIK-8.1', parentCode: 'OIK-8', nameEL: 'Ύδρευση', nameEN: 'Water supply', sortOrder: 1 },
  { code: 'OIK-8.2', parentCode: 'OIK-8', nameEL: 'Αποχέτευση', nameEN: 'Drainage / sewerage', sortOrder: 2 },
  { code: 'OIK-8.3', parentCode: 'OIK-8', nameEL: 'Είδη υγιεινής', nameEN: 'Sanitary fixtures', sortOrder: 3 },
  { code: 'OIK-8.4', parentCode: 'OIK-8', nameEL: 'Θέρμανση', nameEN: 'Heating (radiators / underfloor)', sortOrder: 4 },
  { code: 'OIK-8.5', parentCode: 'OIK-8', nameEL: 'Κλιματισμός', nameEN: 'Air conditioning', sortOrder: 5 },
  { code: 'OIK-8.6', parentCode: 'OIK-8', nameEL: 'Πυρόσβεση', nameEN: 'Fire suppression', sortOrder: 6 },

  // OIK-9 Ηλεκτρολογικά
  { code: 'OIK-9.1', parentCode: 'OIK-9', nameEL: 'Ισχυρά ρεύματα', nameEN: 'Power circuits (outlets / switches)', sortOrder: 1 },
  { code: 'OIK-9.2', parentCode: 'OIK-9', nameEL: 'Φωτισμός', nameEN: 'Lighting', sortOrder: 2 },
  { code: 'OIK-9.3', parentCode: 'OIK-9', nameEL: 'Πίνακες διανομής', nameEN: 'Distribution panels', sortOrder: 3 },
  { code: 'OIK-9.4', parentCode: 'OIK-9', nameEL: 'Ασθενή ρεύματα — Δεδομένα, TV, Θυροτηλεοράσεις, WiFi', nameEN: 'Low-voltage — Data, TV, Intercoms, WiFi', sortOrder: 4 },
  { code: 'OIK-9.5', parentCode: 'OIK-9', nameEL: 'Γείωση & αντικεραυνική προστασία', nameEN: 'Grounding & lightning protection', sortOrder: 5 },
  { code: 'OIK-9.6', parentCode: 'OIK-9', nameEL: 'Συστήματα ασφαλείας / πυρανίχνευσης', nameEN: 'Security / fire-detection systems', sortOrder: 6 },
  { code: 'OIK-9.7', parentCode: 'OIK-9', nameEL: 'Αυτοματισμοί Smart Home (KNX / BUS)', nameEN: 'Smart home automation (KNX / BUS)', sortOrder: 7 },

  // OIK-10 Μονώσεις
  { code: 'OIK-10.1', parentCode: 'OIK-10', nameEL: 'Θερμομόνωση τοίχων', nameEN: 'Wall thermal insulation', sortOrder: 1 },
  { code: 'OIK-10.2', parentCode: 'OIK-10', nameEL: 'Θερμομόνωση οροφής', nameEN: 'Roof thermal insulation', sortOrder: 2 },
  { code: 'OIK-10.3', parentCode: 'OIK-10', nameEL: 'Στεγανοποίηση δωμάτων', nameEN: 'Roof waterproofing', sortOrder: 3 },
  { code: 'OIK-10.4', parentCode: 'OIK-10', nameEL: 'Στεγανοποίηση υπογείων', nameEN: 'Basement waterproofing', sortOrder: 4 },
  { code: 'OIK-10.5', parentCode: 'OIK-10', nameEL: 'Ηχομόνωση', nameEN: 'Acoustic insulation', sortOrder: 5 },
  { code: 'OIK-10.6', parentCode: 'OIK-10', nameEL: 'Πυροπροστασία', nameEN: 'Fire protection', sortOrder: 6 },

  // OIK-11 Σοβατεπί / Ποδιές
  { code: 'OIK-11.1', parentCode: 'OIK-11', nameEL: 'Μαρμάρινες ποδιές', nameEN: 'Marble window sills', sortOrder: 1 },
  { code: 'OIK-11.2', parentCode: 'OIK-11', nameEL: 'Μαρμάρινα σοβατεπί', nameEN: 'Marble baseboards', sortOrder: 2 },
  { code: 'OIK-11.3', parentCode: 'OIK-11', nameEL: 'Ξύλινα σοβατεπί', nameEN: 'Wooden baseboards', sortOrder: 3 },
  { code: 'OIK-11.4', parentCode: 'OIK-11', nameEL: 'PVC / Συνθετικά σοβατεπί', nameEN: 'PVC baseboards', sortOrder: 4 },
  { code: 'OIK-11.5', parentCode: 'OIK-11', nameEL: 'Πατήματα σκάλας', nameEN: 'Stair treads', sortOrder: 5 },
  { code: 'OIK-11.6', parentCode: 'OIK-11', nameEL: 'Κορνίζες', nameEN: 'Cornices', sortOrder: 6 },

  // OIK-12 Μεταλλικά
  { code: 'OIK-12.1', parentCode: 'OIK-12', nameEL: 'Κάγκελα μπαλκονιού', nameEN: 'Balcony railings', sortOrder: 1 },
  { code: 'OIK-12.2', parentCode: 'OIK-12', nameEL: 'Κάγκελα σκάλας', nameEN: 'Stair railings', sortOrder: 2 },
  { code: 'OIK-12.3', parentCode: 'OIK-12', nameEL: 'Σιδερένιες κατασκευές', nameEN: 'Iron structures', sortOrder: 3 },
  { code: 'OIK-12.4', parentCode: 'OIK-12', nameEL: 'Μεταλλικές σκάλες', nameEN: 'Metal staircases', sortOrder: 4 },
  { code: 'OIK-12.5', parentCode: 'OIK-12', nameEL: 'Πέργκολες & στέγαστρα', nameEN: 'Pergolas & canopies', sortOrder: 5 },
  { code: 'OIK-12.6', parentCode: 'OIK-12', nameEL: 'Γκαραζόπορτες & ρολά', nameEN: 'Garage doors & shutters', sortOrder: 6 },
  { code: 'OIK-12.7', parentCode: 'OIK-12', nameEL: 'Εξώπορτες ασφαλείας', nameEN: 'Security doors', sortOrder: 7 },

  // OIK-13 Ανελκυστήρες
  { code: 'OIK-13.1', parentCode: 'OIK-13', nameEL: 'Υδραυλικοί ανελκυστήρες', nameEN: 'Hydraulic elevators', sortOrder: 1 },
  { code: 'OIK-13.2', parentCode: 'OIK-13', nameEL: 'Ηλεκτροκίνητοι ανελκυστήρες (με μηχανοστάσιο)', nameEN: 'Electric traction elevators (with machine room)', sortOrder: 2 },
  { code: 'OIK-13.3', parentCode: 'OIK-13', nameEL: 'Ανελκυστήρες χωρίς μηχανοστάσιο (MRL)', nameEN: 'Machine-room-less (MRL) elevators', sortOrder: 3 },
  { code: 'OIK-13.4', parentCode: 'OIK-13', nameEL: 'Ανυψωτικές πλατφόρμες ΑΜΕΑ', nameEN: 'Accessibility platform lifts', sortOrder: 4 },
  { code: 'OIK-13.5', parentCode: 'OIK-13', nameEL: 'Συντήρηση & πιστοποίηση', nameEN: 'Maintenance & certification', sortOrder: 5 },

  // OIK-14 Πισίνες
  { code: 'OIK-14.1', parentCode: 'OIK-14', nameEL: 'Κατασκευή λεκάνης', nameEN: 'Pool basin construction', sortOrder: 1 },
  { code: 'OIK-14.2', parentCode: 'OIK-14', nameEL: 'Επένδυση & αδιαβροχοποίηση', nameEN: 'Lining & waterproofing', sortOrder: 2 },
  { code: 'OIK-14.3', parentCode: 'OIK-14', nameEL: 'Υδραυλικές εγκαταστάσεις', nameEN: 'Pool plumbing & filtration', sortOrder: 3 },
  { code: 'OIK-14.4', parentCode: 'OIK-14', nameEL: 'Φωτισμός πισίνας', nameEN: 'Pool lighting', sortOrder: 4 },
  { code: 'OIK-14.5', parentCode: 'OIK-14', nameEL: 'Εξοπλισμός (αντλίες, φίλτρα)', nameEN: 'Equipment (pumps, filters)', sortOrder: 5 },
  { code: 'OIK-14.6', parentCode: 'OIK-14', nameEL: 'Περίφραξη & κάλυμμα', nameEN: 'Fencing & cover', sortOrder: 6 },

  // OIK-15 Φωτοβολταϊκά
  { code: 'OIK-15.1', parentCode: 'OIK-15', nameEL: 'Φωτοβολταϊκά πάνελ', nameEN: 'PV panels', sortOrder: 1 },
  { code: 'OIK-15.2', parentCode: 'OIK-15', nameEL: 'Inverter & ηλεκτρολογικά', nameEN: 'Inverter & electrical', sortOrder: 2 },
  { code: 'OIK-15.3', parentCode: 'OIK-15', nameEL: 'Σύστημα στήριξης', nameEN: 'Mounting structure', sortOrder: 3 },
  { code: 'OIK-15.4', parentCode: 'OIK-15', nameEL: 'Αποθήκευση ενέργειας (μπαταρίες)', nameEN: 'Battery storage', sortOrder: 4 },
  { code: 'OIK-15.5', parentCode: 'OIK-15', nameEL: 'Σύνδεση δικτύου & net metering', nameEN: 'Grid connection & net metering', sortOrder: 5 },

  // OIK-16 Ξυλουργικά / Κουζίνες (ΑΤΟΕ chapter — absent from original 15)
  { code: 'OIK-16.1', parentCode: 'OIK-16', nameEL: 'Κουζίνες (πλήρης εγκατάσταση)', nameEN: 'Fitted kitchens (full installation)', sortOrder: 1 },
  { code: 'OIK-16.2', parentCode: 'OIK-16', nameEL: 'Ντουλάπες — Εντοιχισμένα έπιπλα', nameEN: 'Built-in wardrobes & furniture', sortOrder: 2 },
  { code: 'OIK-16.3', parentCode: 'OIK-16', nameEL: 'Πόρτες εσωτερικές — Ξύλινες', nameEN: 'Interior wooden doors', sortOrder: 3 },
  { code: 'OIK-16.4', parentCode: 'OIK-16', nameEL: 'Κλιμακοστάσιο — Ξύλινα σκαλοπάτια', nameEN: 'Wooden staircase elements', sortOrder: 4 },
  { code: 'OIK-16.5', parentCode: 'OIK-16', nameEL: 'Ξύλινες επενδύσεις (wainscoting)', nameEN: 'Wood panelling & wainscoting', sortOrder: 5 },
] as const;

// ============================================================================
// HELPERS
// ============================================================================

export function subCategoriesFor(categoryCode: string): readonly BOQSubCategory[] {
  return BOQ_SUBCATEGORIES.filter((sc) => sc.parentCode === categoryCode);
}

export function findSubCategory(code: string): BOQSubCategory | undefined {
  return BOQ_SUBCATEGORIES.find((sc) => sc.code === code) as BOQSubCategory | undefined;
}
