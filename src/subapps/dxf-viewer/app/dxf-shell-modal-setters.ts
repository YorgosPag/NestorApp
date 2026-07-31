/**
 * SSoT για τα setters των modals του DXF shell (ADR-547 Stage 4).
 *
 * Τα ίδια 7 `setX` props ταξίδευαν αυτούσια από το `DxfViewerContent` → στο
 * `useDxfViewerCallbacks` → στο `dispatchDxfSpecialAction`. Δηλωμένα δύο φορές =
 * δομικό δίδυμο (CHECK 3.28 / ADR-584): προσθήκη modal σήμαινε δύο επεξεργασίες,
 * και μια ξεχασμένη έσπαγε μόνο στο call site. Ένα interface, δύο `extends`.
 *
 * ΔΕΝ περιέχει `fullscreen` / `floatingRef`: αυτά τα δύο δεν είναι modal setters
 * και δεν τα θέλουν και οι δύο πλευρές με το ίδιο σχήμα.
 */

import type React from 'react';

/** Τα state setters των modals που ανοίγει ο special-action dispatcher. */
export interface DxfShellModalSetters {
  setTestsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCreditsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPdfPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAiChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowEnhancedImport: React.Dispatch<React.SetStateAction<boolean>>;
  setShowImportWizard: React.Dispatch<React.SetStateAction<boolean>>;
  setShowLegacyImport: React.Dispatch<React.SetStateAction<boolean>>;
}
