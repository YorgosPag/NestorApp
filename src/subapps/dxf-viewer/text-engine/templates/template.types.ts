/**
 * ADR-344 Phase 7.A — Text template types.
 *
 * A TextTemplate is a reusable DxfTextNode (title block, stamp, revision
 * table, etc.) that the architect can drop into a drawing. The template's
 * `content` carries placeholder tokens of the form `{{namespace.key}}`
 * (e.g. `{{project.name}}`, `{{date.today}}`); the Phase 7.C resolver
 * substitutes real values at insertion time.
 *
 * Two storage tiers (Path C hybrid per Q5):
 *   1. Built-in defaults  — shipped as TypeScript constants in
 *      `defaults/`, immutable, `companyId: null`, `isDefault: true`.
 *   2. User templates     — stored in Firestore `text_templates`
 *      (companyId-scoped per ADR-326), full CRUD via Phase 7.B.
 *
 * The same `TextTemplate` shape covers both tiers so the management UI
 * (Phase 7.D) and the insertion command (later) treat them uniformly.
 */

import type { DxfTextNode } from '../types/text-ast.types';

/**
 * ADR-651 Φάση Θ — **πού ζει** ένα πρότυπο (μοντέλο Revit content library / ADR-652 M2):
 * ο χρήστης βλέπει το ΕΝΩΜΕΝΟ σύνολο των scopes που τον αφορούν.
 *
 *  - `system`  — τα built-in (ζουν σε TypeScript, ΟΧΙ στο Firestore· ποτέ γραπτά από client),
 *  - `company` — **η βιβλιοθήκη του γραφείου**: ταξιδεύει σε ΚΑΘΕ έργο (must-have #5),
 *  - `project` — παραλλαγή που αφορά ΜΟΝΟ ένα έργο (η «απόσπαση» του must-have #1),
 *  - `user`    — τα ιδιωτικά μου πρόχειρα.
 *
 * Ίδιο λεξιλόγιο με τα `block_library` / `bim_materials` ⇒ ο ΙΔΙΟΣ `ScopedLibraryService`
 * τα διαβάζει (N.18: καμία δεύτερη μηχανή βιβλιοθήκης).
 */
export type TextTemplateScope = 'system' | 'company' | 'project' | 'user';

/**
 * Τα scopes που επιτρέπεται να **γράψει** ο χρήστης. Το `system` λείπει σκόπιμα: θα έκανε
 * το πρότυπο ορατό σε ΟΛΟΥΣ τους πελάτες (ίδιο gate με το `block_library`, ADR-652 M3 —
 * self-promotion σε `system` απαγορεύεται· system content ΜΟΝΟ από seed).
 *
 * Ζει **εδώ** (client-safe types module) και όχι στο `text-template.types.ts`, γιατί εκείνο
 * τραβά `firebase-admin` ⇒ θα έσπαγε κάθε client importer.
 */
export const WRITABLE_TEXT_TEMPLATE_SCOPES = ['company', 'project', 'user'] as const;

export type WritableTextTemplateScope = (typeof WRITABLE_TEXT_TEMPLATE_SCOPES)[number];

/** Το scope ενός νέου προτύπου όταν ο καλών δεν το δηλώνει: **η βιβλιοθήκη του γραφείου**. */
export const DEFAULT_TEXT_TEMPLATE_SCOPE: WritableTextTemplateScope = 'company';

/**
 * ADR-651 Φάση Θ — τα λίγα **title-block-specific** που δεν εκφράζονται από το AST και
 * πρέπει να ταξιδέψουν μαζί με ένα αποθηκευμένο πρότυπο πινακίδας (αλλιώς το πρότυπο της
 * βιβλιοθήκης θα τυπωνόταν χωρίς το κελί σφραγίδας του). Ό,τι ακριβώς κρατά ένα preset
 * (`TitleBlockPreset.withStampBox` / `.stampLabel`) — ίδιο σχήμα, ώστε preset και
 * αποθηκευμένο πρότυπο να είναι εναλλάξιμα στο `active-title-block.ts`.
 */
export interface TextTemplateTitleBlockMeta {
  readonly withStampBox: boolean;
  /** Περιεχόμενο σχεδίου (τυπώνεται μέσα στην πινακίδα), όχι ετικέτα UI. */
  readonly stampLabel: string;
}

/**
 * ADR-651 Φάση Θ (N.18) — τα πεδία ενός **αποθηκευμένου** προτύπου, μία φορά.
 *
 * Το ίδιο έγγραφο εμφανίζεται σε δύο κόσμους που διαφέρουν **μόνο** στον τύπο του χρόνου:
 * στο Firestore ως admin-SDK `Timestamp` ({@link UserTextTemplateDoc}) και στο σύρμα ως ISO
 * `string` (`SerializedUserTextTemplate`). Παραμετροποιούμε τον χρόνο αντί να γράψουμε δύο
 * πανομοιότυπες λίστες πεδίων που θα ξέφευγαν σιωπηλά η μία από την άλλη σε κάθε νέο πεδίο.
 */
export interface UserTextTemplateFields<TTime> {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly category: TextTemplateCategory;
  readonly content: DxfTextNode;
  readonly placeholders: readonly string[];
  /** Πάντα `false`: τα built-in ζουν σε TypeScript, δεν κάνουν round-trip από το Firestore. */
  readonly isDefault: false;

  /** Πού ζει (γραφείο / έργο / δικά μου). Ποτέ `system` από client write. */
  readonly scope: TextTemplateScope;
  /** Το έργο-ιδιοκτήτης όταν `scope === 'project'`· αλλιώς `null` (Firestore: ποτέ undefined). */
  readonly projectId: string | null;
  /** Η **προέλευση** μιας αποσπασμένης παραλλαγής (must-have #1) — αλλιώς `null`. */
  readonly parentId: string | null;
  /** Το `updatedAt` του γονιού στον τελευταίο συγχρονισμό (ms) — αλλιώς `null`. */
  readonly parentSyncedAt: number | null;
  /** Κελί σφραγίδας — μόνο για πρότυπα πινακίδας (`category: 'title-block'`). */
  readonly titleBlock?: TextTemplateTitleBlockMeta;

  readonly createdAt: TTime;
  readonly updatedAt: TTime;
  readonly createdBy: string;
  readonly createdByName: string | null;
  readonly updatedBy: string;
  readonly updatedByName: string | null;
}

/**
 * Η **wire** όψη του ίδιου εγγράφου: ο χρόνος ταξιδεύει ως ISO `string` (admin-SDK
 * `Timestamp` δεν περνά JSON). Δηλώνεται εδώ — σε **ουδέτερο** module — ώστε να τη διαβάζουν
 * ΚΑΙ το API route (server) ΚΑΙ ο api client (`'use client'`), χωρίς να τραβήξει το ένα το
 * bundle του άλλου. Ο serializer του route και ο deserializer του client δεν μπορούν πλέον να
 * ξεφύγουν ο ένας από τον άλλο (N.18: μία λίστα πεδίων).
 */
export type SerializedUserTextTemplate = UserTextTemplateFields<string>;

/** Functional grouping for the management UI grid. */
export type TextTemplateCategory =
  | 'title-block'
  | 'stamp'
  | 'revision'
  | 'notes'
  | 'scale-bar'
  | 'custom';

/**
 * Locale tag for built-in templates. User templates leave this undefined.
 * The UI uses it to show flag chips and to auto-select on first insertion.
 */
export type TextTemplateLocale = 'el' | 'en' | 'multi';

/**
 * Canonical template document — same shape for built-ins and Firestore docs.
 *
 * Built-ins: `companyId` is null, `isDefault` is true, timestamps are null,
 * `id` follows the `builtin/<slug>` convention (never an enterprise ID).
 *
 * User: `companyId` is the tenant, `isDefault` is false, timestamps populated
 * by Firestore, `id` from `generateTextTemplateId()` (prefix `tpl_text`).
 */
export interface TextTemplate {
  /** Stable identifier — `builtin/<slug>` for defaults, enterprise ID for user docs. */
  readonly id: string;
  /** Tenant scope. Null = built-in default available to all tenants. */
  readonly companyId: string | null;
  /** Display name shown in the management UI. i18n key for built-ins. */
  readonly name: string;
  /** i18n key for the localised display name (built-ins). User templates leave empty. */
  readonly nameI18nKey?: string;
  readonly category: TextTemplateCategory;
  /** The DxfTextNode that gets inserted. May contain `{{...}}` placeholder runs. */
  readonly content: DxfTextNode;
  /** Placeholder paths extracted from `content` at build time. Sorted, unique. */
  readonly placeholders: readonly string[];
  /** True for built-in defaults. UI marks these as read-only. */
  readonly isDefault: boolean;
  /** Built-in locale tag. Absent for user templates. */
  readonly locale?: TextTemplateLocale;
  /**
   * ADR-651 Φάση Θ — πού ζει το πρότυπο. Απόν στα built-ins (TS constants) ⇒ διάβασέ το
   * ΠΑΝΤΑ μέσω {@link textTemplateScope}, ποτέ κατευθείαν.
   */
  readonly scope?: TextTemplateScope;
  /** Το έργο που το κατέχει — μόνο όταν `scope === 'project'`. */
  readonly projectId?: string | null;
  /**
   * ADR-651 Φάση Θ (must-have #1, μοντέλο ArchiCAD Master Layout) — ο **γονιός** από τον
   * οποίο **αποσπάστηκε** αυτό το πρότυπο.
   *
   * ⚠️ Η κληρονομιά ΔΕΝ είναι «ζωντανή σύνθεση» (Figma component overrides): τα φύλλα
   * **δείχνουν** στο master (ίδιο doc, μηδέν αντίγραφο) ⇒ αλλαγή στο master φτάνει παντού
   * **αυτόματα**, χωρίς parentId. Το `parentId` μπαίνει ΜΟΝΟ όταν ο χρήστης **αποσπάσει**
   * ρητά μια παραλλαγή· τότε κρατά την **προέλευση**, ώστε να μπορεί αργότερα να τραβήξει
   * ρητά τις αλλαγές του γονιού («Ενημέρωση από τον γονιό» — pull, ποτέ σιωπηλό push).
   * Έτσι δουλεύουν ArchiCAD/Revit: αναφορά ή απόσπαση — ποτέ μερική κληρονομιά AST, που
   * θα προσγείωνε ένα override σε λάθος γραμμή μόλις ο γονιός αναδιαταχθεί.
   */
  readonly parentId?: string | null;
  /**
   * Το `updatedAt` **του γονιού** τη στιγμή του τελευταίου συγχρονισμού (απόσπαση ή ρητό
   * «Ενημέρωση από τον γονιό»), σε ms. Χωρίς αυτό το πεδίο, το κουμπί «ο γονιός άλλαξε» θα
   * έλεγε **ψέματα**: σύγκριση `parent.updatedAt > child.updatedAt` σβήνει την ειδοποίηση
   * μόλις ο χρήστης πειράξει οτιδήποτε στο παιδί — και η αλλαγή του γραφείου χάνεται σιωπηλά.
   * Εδώ η ερώτηση είναι η σωστή: **άλλαξε ο γονιός μετά τον τελευταίο μου συγχρονισμό;**
   */
  readonly parentSyncedAt?: number | null;
  /** Title-block metadata (κελί σφραγίδας) — μόνο για `category: 'title-block'`. */
  readonly titleBlock?: TextTemplateTitleBlockMeta;
  readonly createdAt: Date | null;
  readonly updatedAt: Date | null;
}

/**
 * Το scope ενός προτύπου, **ανεξάρτητα** από το αν ήρθε από TypeScript ή από Firestore:
 * τα built-ins δεν φέρουν πεδίο `scope` (είναι σταθερές, όχι έγγραφα) αλλά είναι εξ ορισμού
 * `system` περιεχόμενο. SSoT — κάθε καταναλωτής ρωτάει ΑΥΤΗ τη συνάρτηση.
 */
export function textTemplateScope(template: TextTemplate): TextTemplateScope {
  return template.scope ?? (template.isDefault ? 'system' : 'company');
}

/**
 * Built-in template variant — narrower view used by the defaults registry.
 * Carries no Firestore-specific fields and never has timestamps.
 */
export interface BuiltInTextTemplate extends TextTemplate {
  readonly companyId: null;
  readonly isDefault: true;
  readonly createdAt: null;
  readonly updatedAt: null;
  readonly nameI18nKey: string;
  readonly locale: TextTemplateLocale;
}

/**
 * Build-time validation: assert that every placeholder in `content`
 * appears in `placeholders` and vice versa. Thrown via the unit tests
 * in `__tests__/defaults.test.ts`, never at runtime in production.
 */
export class TextTemplatePlaceholderMismatchError extends Error {
  constructor(templateId: string, scanned: readonly string[], declared: readonly string[]) {
    super(
      `Template "${templateId}": placeholder mismatch — scanned [${scanned.join(', ')}] vs declared [${declared.join(', ')}]`,
    );
    this.name = 'TextTemplatePlaceholderMismatchError';
  }
}
