'use client';

/**
 * @fileoverview **Ο ΕΝΑΣ ΕΓΧΥΤΗΣ ΔΥΝΑΜΙΚΩΝ ΕΠΙΛΟΓΩΝ** των φίλτρων ακινήτου.
 * @related ADR-840 §5 (Α3) · ADR-051 (κεντρικό σύστημα φίλτρων)
 * @module components/core/AdvancedFilters/hooks/usePropertyFiltersConfig
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΑΛΛΑΞΕ ΚΑΙ ΓΙΑΤΙ (ADR-840 Σ1)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο hook ήταν **καρφωμένος** σε δύο σημεία: στο `propertyListFiltersConfig` ως μοναδική
 * είσοδο, και στη σειρά `'secondary-filters'` ως μοναδικό σημείο εγγραφής. Άρα ό,τι
 * άλλο ζητούσε δυναμικές επιλογές **δεν μπορούσε να τον ζητήσει** — και η οθόνη
 * `/properties` κατέληξε με πίνακα **χωρίς** «έργο» και «κτίριο», όχι από απόφαση αλλά
 * επειδή δεν υπήρχε δρόμος να τα πάρει (ADR-840 §4.1).
 *
 * 🔑 **Δεν γεννήθηκε δεύτερος εγχύτης — έγινε παραμετρικός ο υπάρχων.** Δύο αντίγραφα
 * αυτής της λογικής θα σήμαιναν δύο απαντήσεις στο *«ποια έργα υπάρχουν;»* που μπορούν
 * να διαφέρουν, και **και οι δύο να φαίνονται σωστές** (ίδιο σκεπτικό με το
 * `usePropertiesViewerState`).
 *
 * ⚠️ **Το πεδίο βρίσκεται με το ΟΝΟΜΑ του, σε ΟΠΟΙΑ σειρά κι αν ζει.** Η παλιά αναζήτηση
 * μέσα σε συγκεκριμένη σειρά έδενε τη διάταξη με τη συμπεριφορά: μετακίνηση πεδίου σε
 * άλλη σειρά θα το άφηνε **σιωπηλά** χωρίς επιλογές.
 *
 * ⚠️ **`type` ΚΑΙ `propertyType` δέχονται την ίδια έγχυση, επίτηδες.** Είναι το **ίδιο**
 * ερώτημα με δύο ονόματα σε δύο λεξιλόγια (ADR-840 §4). Η ενοποίηση των ονομάτων ανήκει
 * στη σύγκλιση των Πωλήσεων — δηλωμένο ανοιχτό θέμα, ADR-840 §8 #2 — και μέχρι τότε ο
 * εγχυτής **απαντά και στα δύο** αντί να σιωπά στο ένα.
 */

import { useMemo } from 'react';
import { propertyListFiltersConfig } from '../configs/propertyFiltersConfig';
import type { FilterOption, FilterPanelConfig } from '../types';
import type { Property } from '@/types/property-viewer';

/** Τα ονόματα πεδίων που δέχονται έγχυση, ανά ερώτημα που απαντούν. */
const PROJECT_FIELD = 'project';
const BUILDING_FIELD = 'building';
const FLOOR_FIELD = 'floor';
/** Το ίδιο ερώτημα, δύο ονόματα — δες την επικεφαλίδα του αρχείου. */
const TYPE_FIELDS = ['type', 'propertyType'] as const;

/**
 * Μοναδικές τιμές ενός πεδίου — η μία θέση που ξέρει «τι υπάρχει».
 *
 * 🔴 **ΚΑΜΙΑ αποβολή με `Boolean`, και ο λόγος είναι το ΙΣΟΓΕΙΟ.** Ο όροφος `0` είναι
 * ψευδής τιμή στη JavaScript: ένα `filter(Boolean)` θα εξαφάνιζε το ισόγειο από τον
 * κατάλογο ορόφων — τον **συχνότερο** όροφο σε ελληνική πολυκατοικία, και μάλιστα
 * σιωπηλά. Το κενό αποβάλλεται **ρητά, ανά τύπο**, από τους καλούντες.
 */
function distinct<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}

/** Μη κενά αλφαριθμητικά, ταξινομημένα — για τα πεδία που είναι ονόματα. */
function distinctNames(values: readonly string[]): string[] {
  return distinct(values.filter(v => v !== undefined && v !== null && v !== '')).sort();
}

/** `[όλα] + οι πραγματικές τιμές` — η σειρά που περιμένει κάθε select του πίνακα. */
function withAllOption(allLabel: string, options: readonly FilterOption[]): FilterOption[] {
  return [{ value: 'all', label: allLabel }, ...options];
}

/**
 * Οι επιλογές που προκύπτουν **από τα ίδια τα ακίνητα**, κλειδωμένες στο όνομα πεδίου.
 *
 * ⚠️ Ο όροφος ταξινομείται **αριθμητικά**: το λεξικογραφικό `sort()` βάζει τον 10ο πριν
 * τον 2ο, και ο άνθρωπος το διαβάζει ως σφάλμα δεδομένων.
 */
function buildOptionsByField(properties: readonly Property[]): Map<string, FilterOption[]> {
  const projects = distinctNames(properties.map(p => p.project));
  const buildings = distinctNames(properties.map(p => p.building));
  const types = distinctNames(properties.map(p => p.type));
  const floors = distinct(properties.map(p => p.floor))
    .filter(f => f !== null && f !== undefined)
    .sort((a, b) => a - b);

  const byField = new Map<string, FilterOption[]>([
    [PROJECT_FIELD, withAllOption('filters.allProjects', projects.map(p => ({ value: p, label: p })))],
    [BUILDING_FIELD, withAllOption('filters.allBuildings', buildings.map(b => ({ value: b, label: b })))],
    [FLOOR_FIELD, withAllOption('filters.allFloors', floors.map(f => ({ value: String(f), label: `${f}` })))],
  ]);

  const typeOptions = withAllOption(
    'filters.allTypes',
    types.map(t => ({ value: t, label: `properties.types.${t}` }))
  );
  for (const field of TYPE_FIELDS) byField.set(field, typeOptions);

  return byField;
}

/**
 * @param properties Τα ακίνητα από τα οποία **προκύπτουν** οι επιλογές.
 * @param baseConfig Ποιον πίνακα διακοσμούμε. Προεπιλογή: το `propertyListFiltersConfig`,
 *   ώστε ο υπάρχων καλών (`/spaces/properties`) να μη χρειαστεί αλλαγή.
 */
export function usePropertyFiltersConfig(
  properties: Property[],
  baseConfig: FilterPanelConfig = propertyListFiltersConfig
): FilterPanelConfig {
  return useMemo(() => {
    const optionsByField = buildOptionsByField(properties);

    // Βαθύ αντίγραφο: ο πίνακας είναι **δεδομένα**, και η έγχυση δεν επιτρέπεται να
    // μεταλλάξει τη σταθερά που μοιράζονται όλες οι οθόνες.
    const config = JSON.parse(JSON.stringify(baseConfig)) as FilterPanelConfig;

    for (const row of config.rows) {
      for (const field of row.fields) {
        const options = optionsByField.get(field.id);
        if (options) field.options = options;
      }
    }

    return config;
  }, [properties, baseConfig]);
}
