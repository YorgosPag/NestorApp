import { COLOR_BRIDGE } from "@/design-system/color-bridge";

export const overlayBase =
  "fixed inset-0 z-[var(--z-index-transient-stack)] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

// 🔄 BACKWARD COMPATIBILITY: Static export για legacy code
// `grid-cols-[minmax(0,1fr)]`: χωρίς δηλωμένη στήλη, το `grid` φτιάχνει στήλη `auto` που μεγαλώνει ως το μακρύτερο
// ΑΔΙΑΣΠΑΣΤΟ κείμενο του περιεχομένου, ανεξάρτητα από το `max-w-*` — μετρημένο live 2026-11-18 (ADR-777 §8.102):
// διάλογος 672px, στήλη 913px ⇒ τα πλαίσια βγαίνανε δεξιά έξω. Το `minmax(0,…)` δένει τη στήλη στο πλάτος του κουτιού.
export const contentBase = `fixed left-[50%] top-[50%] z-[var(--z-index-transient-stack)] grid grid-cols-[minmax(0,1fr)] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border rounded-lg ${COLOR_BRIDGE.bg.primary} p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]`;

export const headerBase = "flex flex-col space-y-2 text-center sm:text-left";
// sm:flex-wrap + sm:gap-2 (αντί για sm:space-x-2): με 3+ ενέργειες ή μακριές
// ετικέτες τα κουμπιά τυλίγονται σε δεύτερη σειρά αντί να ξεχειλίζουν δεξιά
// έξω από το AlertDialogContent (max-w-lg).
export const footerBase =
  "flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2";
export const titleBase = "text-lg font-semibold";
// `break-words`: μακρύ αδιάσπαστο κείμενο (αναγνωριστικό, όνομα αρχείου, URL) τυλίγεται μέσα στο κουτί αντί να ξεχειλίζει.
export const descriptionBase = "text-sm text-muted-foreground break-words";
export const cancelExtra = "mt-2 sm:mt-0";
