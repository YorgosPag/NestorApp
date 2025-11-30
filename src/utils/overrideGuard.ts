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

    // Stack trace για debugging (console removed for production)

    throw err;
  }
}

// Εναλλακτική: "Ορατό καναρίνι" - επιστροφή εξωφρενικών τιμών αντί για crash
export function guardWithCanary<T>(tag: string, normalValue: T, canaryValue: T): T {
  if (isOverrideOn()) {
    // Using canary value during override (console logging removed)
    return canaryValue;
  }
  return normalValue;
}

// Helper για ενεργοποίηση του προσωρινού override flag (για testing)
export function enableForceOverride(): void {
  (window as any).__FORCE_OVERRIDE__ = true;
  // Force Override enabled
}

// Helper για απενεργοποίηση του προσωρινού override flag
export function disableForceOverride(): void {
  (window as any).__FORCE_OVERRIDE__ = false;
  // Force Override disabled
}