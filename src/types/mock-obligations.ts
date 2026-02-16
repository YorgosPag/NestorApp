import { ObligationSection, ObligationDocument } from './obligations';
import { GENERAL_CONSTRUCTION_TEMPLATE } from './obligations/default-template';

/**
 * DEFAULT TEMPLATE — Πλήρης Γενική Συγγραφή Υποχρεώσεων (28 Άρθρα σε 8 Ενότητες)
 * Πηγή: ΠΑΓΩΝΗΣ ΕΝΕΡΓΕΙΑΚΗ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ, Θέρμη 2026
 */
export const DEFAULT_TEMPLATE_SECTIONS: ObligationSection[] = GENERAL_CONSTRUCTION_TEMPLATE;

/** @deprecated Χρησιμοποίησε DEFAULT_TEMPLATE_SECTIONS αντί αυτού */
export const MOCK_SECTIONS: ObligationSection[] = GENERAL_CONSTRUCTION_TEMPLATE;

/** @deprecated Χρησιμοποίησε DEFAULT_TEMPLATE_SECTIONS αντί αυτού */
export const COMPLETE_SECTIONS: ObligationSection[] = GENERAL_CONSTRUCTION_TEMPLATE;

/** @deprecated Mock data — αντικαταστάθηκε από Firestore */
export const MOCK_OBLIGATIONS: ObligationDocument[] = [];
