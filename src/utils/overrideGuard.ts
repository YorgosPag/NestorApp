/**
 * Override Guard Utility
 * Φρουροί για διάγνωση προσβάσεων στις Γενικές Ρυθμίσεις όταν το Override είναι ενεργό
 */

// Helper function για έλεγχο αν το override είναι ενεργοποιημένο
export const isOverrideOn = (): boolean => {
  // Έλεγχος για προσωρινό global flag
  if ((window as any).__FORCE_OVERRIDE__ === true) {
    return true;
  }

  // TODO: Προσθήκη ελέγχου για draftSettingsStore όταν είναι διαθέσιμο
  // if (draftSettingsStore?.getState?.().overrideEnabled === true) {
  //   return true;
  // }

  return false;
};

// Φρουρός function που ρίχνει error όταν γίνεται προσπάθεια πρόσβασης στα γενικά settings
export function guardGlobalAccess(tag: string): void {
  if (isOverrideOn()) {
    const err = new Error(`🚨 GLOBAL_${tag}_DURING_OVERRIDE - Πρόσβαση στις γενικές ρυθμίσεις ενώ το override είναι ενεργό!`);

    // Προαιρετικά: εμφάνιση stack trace για debugging
    console.error(`🔍 [Override Guard] Εντοπισμός πρόσβασης στις γενικές ρυθμίσεις:`, err);
    console.trace(err);

    throw err;
  }
}

// Εναλλακτική: "Ορατό καναρίνι" - επιστροφή εξωφρενικών τιμών αντί για crash
export function guardWithCanary<T>(tag: string, normalValue: T, canaryValue: T): T {
  if (isOverrideOn()) {
    console.warn(`🐤 [Override Canary] Χρήση γενικών ρυθμίσεων για ${tag} ενώ override ενεργό - επιστρέφω canary value`);
    return canaryValue;
  }
  return normalValue;
}

// Helper για ενεργοποίηση του προσωρινού override flag (για testing)
export function enableForceOverride(): void {
  (window as any).__FORCE_OVERRIDE__ = true;
  console.log('🔧 [Override Guard] Force Override ενεργοποιήθηκε');
}

// Helper για απενεργοποίηση του προσωρινού override flag
export function disableForceOverride(): void {
  (window as any).__FORCE_OVERRIDE__ = false;
  console.log('🔧 [Override Guard] Force Override απενεργοποιήθηκε');
}