/**
 * Experimental Features Configuration
 * Controls optional/experimental features in DXF Viewer
 */

/**
 * ⚠️ **ΜΙΑ ΣΗΜΑΙΑ ΦΕΥΓΕΙ ΜΑΖΙ ΜΕ ΤΟΝ ΚΩΔΙΚΑ ΤΗΣ** (ADR-806 §7 #3). Το
 * `COLLABORATION_OVERLAY: false` αφαιρέθηκε **στην ίδια πράξη** με τα τέσσερα αρχεία
 * του collaboration: μια σημαία που δεν ενεργοποιεί τίποτα δεν είναι ρύθμιση, είναι
 * **υπόσχεση που λέει ψέματα** — ο επόμενος τη γυρίζει σε `true` και δεν συμβαίνει
 * τίποτα. Είναι το *flag debt* που ονομάζει ρητά ο Fowler (release toggle που
 * επιβίωσε του σκοπού του) και η κανονική θεραπεία είναι **αφαίρεση με τον κώδικα**.
 *
 * 🔶 **ΜΕΤΡΗΜΕΝΟ ΧΡΕΟΣ, ΔΗΛΩΜΕΝΟ ΚΑΙ ΟΧΙ ΔΙΚΟ ΜΟΥ**: άλλες **τρεις** εγγραφές εδώ
 * έχουν επίσης **μηδέν αναγνώστες** — `DXF_CANVAS_OVERLAY_INTEGRATION` ·
 * `ADVANCED_SNAPPING` · `MULTI_LAYER_GRIPS`. Οι δύο τελευταίες είναι `true`, δηλαδή
 * **δηλώνουν ενεργό χαρακτηριστικό που κανείς δεν ρωτά**. Δεν αφαιρέθηκαν επειδή
 * προϋπήρχαν και η αφαίρεσή τους είναι **δήλωση προϊόντος** — απόφαση Giorgio.
 */
export const EXPERIMENTAL_FEATURES = {
  // Legacy overlay integration system (deprecated)
  DXF_CANVAS_OVERLAY_INTEGRATION: false,

  // Future features can be added here
  ADVANCED_SNAPPING: true,
  MULTI_LAYER_GRIPS: true,

  // 🆕 PHASE 4: Enterprise Settings System - Shadow Mode ENABLED
  // Enterprise provider validates data while old provider renders UI
  ENTERPRISE_SETTINGS_SHADOW_MODE: true,

  // 🆕 PHASE 6: Production Mode (Future - After Conference)
  // Enterprise provider as primary - requires full migration
  ENTERPRISE_SETTINGS_PRODUCTION_MODE: false,

  // 🆕 PORTS & ADAPTERS: Store Sync with Dependency Injection
  // Enables decoupled store synchronization via ports
  ENABLE_SETTINGS_SYNC: true,

  // Layout Debug System
  LAYOUT_DEBUG_SYSTEM: false,

  // 🏢 ENTERPRISE (2027-01-27): Unified Drawing Engine
  // Enables unified drawing engine for overlay creation
  USE_UNIFIED_DRAWING_ENGINE: true,
} as const;

export function isFeatureEnabled(feature: keyof typeof EXPERIMENTAL_FEATURES): boolean {
  return EXPERIMENTAL_FEATURES[feature] === true;
}