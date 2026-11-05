/**
 * **Η επεξεργασία δεδομένων της εταιρείας από πάροχο AI, ανά σκοπό** (ADR-929 Δ15 #1).
 *
 * Το ερώτημα: *«Επιτρέπει αυτή η εταιρεία να φύγουν δεδομένα της προς τον πάροχο AI για ΑΥΤΟΝ τον σκοπό;»*
 *
 * 🔑 **Γιατί ΔΕΝ είναι `settings.features`**: εκείνο είναι ανοιχτός σάκος σημαιών χωρίς αυθεντία και χωρίς
 *    «ποιος το άλλαξε και πότε» (απορρίφθηκε ρητά στο ADR-824 §4.3). Εδώ κάθε απόφαση φέρει αποφασίζοντα και στιγμή.
 * 🔑 **Γιατί ΔΕΝ είναι `capabilities`** (ADR-824): εκείνες είναι ρυθμιζόμενες δραστηριότητες που **εγκρίνει η
 *    πλατφόρμα** (pending → active). Εδώ αποφασίζει **η ίδια η εταιρεία**, μέσω του διαχειριστή της.
 *
 * 🔑 **Προεπιλογή = ανοιχτό, όπως οι μεγάλοι** (Figma, Autodesk Advanced AI): η **απουσία** εγγραφής σημαίνει
 *    «δεν αποφασίστηκε ποτέ» ⇒ ισχύει η προεπιλογή της πλατφόρμας, και η οθόνη το λέει **ως τέτοιο**.
 * 🏆 **Ένα βήμα πέρα από αυτούς**: η αποστολή γίνεται **μόνο** όταν η πολιτική απορρήτου **σε ισχύ** περιέχει τον
 *    όρο του σκοπού ({@link AI_PROCESSING_LEGAL_CLAUSE}). Οι μεγάλοι το υπόσχονται σε κείμενο· εδώ ο διακόπτης δεν
 *    μπορεί να ανοίξει πριν δημοσιευτεί η γνωστοποίηση.
 *
 * @module types/company-ai-processing
 * @see ADR-929 Δ15
 */

/** **Κλειστό σύνολο.** Νέος σκοπός θέλει λόγο, όρο στην πολιτική απορρήτου και γραμμή στο ADR. */
export const AI_PROCESSING_PURPOSES = ['plan-reading'] as const;

export type AiProcessingPurpose = (typeof AI_PROCESSING_PURPOSES)[number];

export function isAiProcessingPurpose(value: unknown): value is AiProcessingPurpose {
  return (AI_PROCESSING_PURPOSES as readonly unknown[]).includes(value);
}

export const AI_PROCESSING_STATES = ['enabled', 'disabled'] as const;

export type AiProcessingState = (typeof AI_PROCESSING_STATES)[number];

export function isAiProcessingState(value: unknown): value is AiProcessingState {
  return (AI_PROCESSING_STATES as readonly unknown[]).includes(value);
}

/** Η **προεπιλογή της πλατφόρμας** για εταιρεία που δεν αποφάσισε ποτέ (μοτίβο Figma / Autodesk). */
export const AI_PROCESSING_PLATFORM_DEFAULT: Readonly<Record<AiProcessingPurpose, AiProcessingState>> = {
  'plan-reading': 'enabled',
};

/**
 * Ο όρος (clause id) που πρέπει να περιέχει η **σε ισχύ** πολιτική απορρήτου για να επιτρέπεται ο σκοπός.
 * Τα ids των όρων είναι κοινά σε κάθε γλώσσα (ελέγχεται στο πάγωμα, ADR-861).
 */
export const AI_PROCESSING_LEGAL_CLAUSE: Readonly<Record<AiProcessingPurpose, string>> = {
  'plan-reading': 'aiPlanReading',
};

/** Μία απόφαση της εταιρείας για έναν σκοπό. */
export interface AiProcessingDecision {
  readonly state: AiProcessingState;
  /** uid του διαχειριστή που αποφάσισε. */
  readonly decidedBy: string;
  /** ISO 8601. */
  readonly decidedAt: string;
}

/** `companies/{id}.settings.aiProcessing` — η απουσία σκοπού σημαίνει «ισχύει η προεπιλογή της πλατφόρμας». */
export type CompanyAiProcessingSettings = Readonly<Partial<Record<AiProcessingPurpose, AiProcessingDecision>>>;

/** Η νομική κατάσταση του σκοπού: έχει δημοσιευτεί ο όρος στην πολιτική απορρήτου σε ισχύ; */
export type AiProcessingLegalStatus = 'disclosed' | 'pending';

/** Η **ενεργή** κατάσταση ενός σκοπού, όπως την κρίνει ο διακομιστής. Είναι και το σχήμα του σύρματος. */
export interface AiPurposeStatus {
  readonly purpose: AiProcessingPurpose;
  /** Η επιλογή: της εταιρείας αν αποφάσισε, αλλιώς η προεπιλογή της πλατφόρμας. */
  readonly state: AiProcessingState;
  readonly source: 'platform-default' | 'company';
  readonly decision: AiProcessingDecision | null;
  readonly legal: AiProcessingLegalStatus;
  /** Φεύγουν δεδομένα; `state === 'enabled'` **και** `legal === 'disclosed'`. */
  readonly effective: boolean;
}

/** GET/PUT του `/api/settings/ai-processing`. */
export interface AiProcessingSettingsResponse {
  readonly purposes: readonly AiPurposeStatus[];
  /** Μπορεί ο καλών να αλλάξει τον διακόπτη; (το ίδιο ταβάνι με το PUT: `ADMINISTRATIVE_ROLES`). */
  readonly canEdit: boolean;
}
