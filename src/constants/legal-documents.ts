/**
 * =============================================================================
 * ΤΑ ΝΟΜΙΚΑ ΕΓΓΡΑΦΑ — ποια υπάρχουν και **ποια είναι η δομή τους** (ADR-861 Φ3)
 * =============================================================================
 *
 * **Μηδέν εισαγωγές.** Το διαβάζουν η εφαρμογή **και** ο γεννήτορας/η πύλη εκδόσεων
 * (`scripts/lib/legal-documents/*`, μέσω `ts-module-loader`) — πρότυπο `platform-operator.ts`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ ΠΕΡΙΓΡΑΜΜΑ ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ JSX
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως τη Φ2 κάθε σελίδα έγραφε με το χέρι «αυτό το κλειδί είναι επικεφαλίδα, εκείνα λίστα».
 * Μια **παγωμένη έκδοση** πρέπει να είναι **αυτό που διάβασε ο άνθρωπος** — άρα η δομή δεν
 * μπορεί να ζει σε δύο σημεία (σελίδα + γεννήτορας). Ζει **εδώ**· ο γεννήτορας την επιλύει
 * πάνω στο `legal.json` σε κείμενο, και **ένας** renderer αποδίδει την παγωμένη έκδοση
 * και στην τρέχουσα σελίδα και στο αρχείο εκδόσεων.
 *
 * ⚠️ Το `legal.json` είναι η **πηγή σύνταξης**, όχι αυτό που αποδίδεται. Αλλαγή κειμένου χωρίς
 * νέα έκδοση ⇒ **μπλοκ** (CHECK 3.85 Κ2).
 *
 * @module constants/legal-documents
 * @see ADR-861 §7 — εκδόσεις νομικών κειμένων
 */

/** 🔑 Το κλειστό λεξιλόγιο των εγγράφων με εκδόσεις (ρίζα CHECK 3.73). */
export const LEGAL_DOCUMENT_IDS = ['privacy-policy', 'terms-of-service', 'data-deletion'] as const;

export type LegalDocumentId = (typeof LEGAL_DOCUMENT_IDS)[number];

/** Ποιο γραμματοκιβώτιο του φορέα αποδίδεται **δίπλα** σε ένα στοιχείο λίστας. */
export type OperatorMailboxRole = 'contact' | 'privacy';

/** Στοιχείο λίστας: κλειδί κειμένου, με προαιρετική διεύθυνση του φορέα μετά. */
export interface LegalListItemOutline {
  readonly key: string;
  readonly mailbox?: OperatorMailboxRole;
}

/**
 * Ένα μπλοκ ενότητας. Διακριτή ένωση — ό,τι **δεν** είναι κείμενο (η ταμπέλα του φορέα) είναι
 * ρητό είδος, όχι «κλειδί που τυχαίνει να λείπει».
 */
export type LegalBlockOutline =
  | { readonly kind: 'paragraph'; readonly key: string }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: readonly LegalListItemOutline[] }
  | { readonly kind: 'operator-identity' };

export interface LegalSectionOutline {
  /** **Σταθερό** id — το «τι άλλαξε» συγκρίνει εκδόσεις **κατά id**, ποτέ κατά θέση. */
  readonly id: string;
  readonly headingKey: string;
  readonly blocks: readonly LegalBlockOutline[];
}

export interface LegalDocumentOutline {
  /** Υποδέντρο του namespace `legal` που κρατά το κείμενο. */
  readonly source: string;
  readonly titleKey: string;
  readonly sections: readonly LegalSectionOutline[];
}

const paragraph = (key: string): LegalBlockOutline => ({ kind: 'paragraph', key });
const list = (ordered: boolean, ...items: readonly LegalListItemOutline[]): LegalBlockOutline => ({
  kind: 'list',
  ordered,
  items,
});
const items = (prefix: string, count: number): readonly LegalListItemOutline[] =>
  Array.from({ length: count }, (_, i) => ({ key: `${prefix}.item${i + 1}` }));
const OPERATOR: LegalBlockOutline = { kind: 'operator-identity' };

/** Ενότητα με τίτλο `<id>.title` — η σύμβαση του `legal.json`. */
const section = (id: string, ...blocks: readonly LegalBlockOutline[]): LegalSectionOutline => ({
  id,
  headingKey: `${id}.title`,
  blocks,
});

/**
 * 🔑 **Τα περιγράμματα.** Η σειρά των ενοτήτων είναι η σειρά ανάγνωσης.
 *
 * ⚠️ Αλλαγή εδώ αλλάζει το παγωμένο κείμενο ⇒ χρειάζεται νέα έκδοση (CHECK 3.85 Κ2),
 * ακριβώς όπως αλλαγή στο `legal.json`.
 */
export const LEGAL_DOCUMENT_OUTLINES: { readonly [Id in LegalDocumentId]: LegalDocumentOutline } = {
  'privacy-policy': {
    source: 'privacyPolicy',
    titleKey: 'title',
    sections: [
      section('introduction', paragraph('introduction.content')),
      section('dataWeCollect', list(false, ...items('dataWeCollect', 3))),
      section('howWeUse', list(false, ...items('howWeUse', 3))),
      section('dataSharing', paragraph('dataSharing.content')),
      section('dataRetention', paragraph('dataRetention.content')),
      section('yourRights', paragraph('yourRights.content')),
      section('contact', paragraph('contact.intro'), OPERATOR),
    ],
  },
  'terms-of-service': {
    source: 'termsOfService',
    titleKey: 'title',
    sections: [
      section('acceptance', paragraph('acceptance.content')),
      section('services', paragraph('services.content')),
      section('userResponsibilities', list(false, ...items('userResponsibilities', 3))),
      section('limitation', paragraph('limitation.content')),
      section('changes', paragraph('changes.content')),
      section('contact', paragraph('contact.intro'), OPERATOR),
    ],
  },
  'data-deletion': {
    source: 'dataDeletion',
    titleKey: 'title',
    sections: [
      section(
        'howToRequest',
        paragraph('howToRequest.intro'),
        list(
          true,
          { key: 'howToRequest.step1', mailbox: 'privacy' },
          { key: 'howToRequest.step2' },
          { key: 'howToRequest.step3' },
        ),
      ),
      section('whatWeDelete', list(false, ...items('whatWeDelete', 3))),
      section('contact', paragraph('contact.intro'), OPERATOR),
    ],
  },
};

/** Οι γλώσσες που **παγώνουν** μαζί σε κάθε έκδοση — ποτέ έκδοση μόνο για τη μία. */
export const LEGAL_DOCUMENT_LOCALES = ['el', 'en'] as const;

export type LegalDocumentLocale = (typeof LEGAL_DOCUMENT_LOCALES)[number];
