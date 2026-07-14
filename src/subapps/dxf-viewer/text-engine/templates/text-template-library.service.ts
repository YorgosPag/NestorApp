'use client';

/**
 * ADR-651 Φάση Θ (must-have #5) — **Βιβλιοθήκη προτύπων γραφείου**.
 *
 * Τα πρότυπα παύουν να είναι «ό,τι έφτιαξε αυτή η εταιρεία, όλα σε ένα σωρό» και αποκτούν
 * **εμβέλεια**: `company` (η βιβλιοθήκη του γραφείου — **ταξιδεύει σε ΚΑΘΕ έργο**),
 * `project` (παραλλαγή ενός έργου), `user` (τα δικά μου πρόχειρα). Τα built-in ζουν σε
 * TypeScript (`system`) και δεν περνούν ποτέ από εδώ.
 *
 * ## Read-scoped / write-server — και γιατί
 *
 * Ο `ScopedLibraryService` (ADR-652 M2) είναι **client** (Firebase SDK), ενώ ο
 * `text-template.service` είναι **server-only** (Admin SDK — γράφει `EntityAudit`, ADR-195).
 * Δεν κουμπώνουν αυτούσια. Η λύση **δεν** είναι δεύτερη μηχανή (N.18) αλλά διαχωρισμός:
 *
 *  - **ΑΝΑΓΝΩΣΕΙΣ** → ο **υπάρχων** `ScopedLibraryService` (5ος καταναλωτής, μετά από
 *    materials / blocks / family-types / stair-presets): multi-scope merge + cache TTL +
 *    equality-guarded `subscribe` + tenant isolation — **τίποτα δεν ξαναγράφεται**.
 *    Οι `firestore.rules` το επιτρέπουν ήδη: κάθε μέλος της εταιρείας διαβάζει τα
 *    `text_templates` της (ADR-344 Phase 7.E) ⇒ **καμία αλλαγή rules**.
 *  - **ΓΡΑΦΕΣ** → τα **υπάρχοντα** API routes (`text-template-api.ts`), ώστε να μη χαθεί
 *    ούτε το audit trail, ούτε ο Zod, ούτε τα enterprise ids (N.6).
 *
 * ## Κληρονομιά (must-have #1)
 *
 * Το «αλλάζω το master → αλλάζουν όλα» το δίνει **η ίδια η βιβλιοθήκη**: τα φύλλα δείχνουν
 * στο ΙΔΙΟ έγγραφο. Οι μέθοδοι {@link TextTemplateLibraryService.detach} /
 * {@link TextTemplateLibraryService.pullFromParent} καλύπτουν μόνο την **εξαίρεση** (ρητή
 * παραλλαγή έργου). Η λογική τους είναι καθαρή και ζει στο `template-inheritance.ts`.
 *
 * @see ../../bim/services/scoped-library-service.ts — ο κοινός πυρήνας βιβλιοθηκών
 * @see ./template-inheritance.ts — η καθαρή λογική master/απόσπασης/pull
 */

import type { Unsubscribe } from 'firebase/firestore';

import {
  ScopedLibraryService,
  companyScopeBucket,
  optionalProjectScopeBucket,
  userScopeBucket,
  type ScopedLibraryDoc,
} from '../../bim/services/scoped-library-service';
import type { DxfTextNode } from '../types/text-ast.types';
import {
  buildDetachPayload,
  buildPullPayload,
  canDetachFrom,
  type DetachOptions,
  type TemplateVariantOverrides,
} from './template-inheritance';
import type {
  TextTemplate,
  TextTemplateCategory,
  TextTemplateLocale,
  TextTemplateScope,
  TextTemplateTitleBlockMeta,
  WritableTextTemplateScope,
} from './template.types';
import {
  apiCreateTextTemplate,
  apiDeleteTextTemplate,
  apiUpdateTextTemplate,
} from './text-template-api';

/** Domain errors — typed strings, όπως κάθε άλλη βιβλιοθήκη (ποτέ sniffing σε `Error.message`). */
export const TEXT_TEMPLATE_LIBRARY_ERRORS = {
  NOT_FOUND: 'TEXT_TEMPLATE_LIBRARY_NOT_FOUND',
  BUILTIN_NOT_MUTABLE: 'TEXT_TEMPLATE_LIBRARY_BUILTIN_NOT_MUTABLE',
  SELF_PARENT: 'TEXT_TEMPLATE_LIBRARY_SELF_PARENT',
} as const;

/**
 * Το έγγραφο όπως έρχεται από τον **client** SDK: ίδια πεδία με το `UserTextTemplateDoc`,
 * αλλά με client `Timestamp` (ο server τύπος κουβαλά `firebase-admin` ⇒ άχρηστος εδώ).
 */
export interface TextTemplateLibraryDoc extends ScopedLibraryDoc {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly category: TextTemplateCategory;
  readonly content: DxfTextNode;
  readonly placeholders: readonly string[];
  /** ADR-651 Φάση Κ — η γλώσσα του περιεχομένου· `null`/απόν σε πρότυπα πριν τη Φάση Κ. */
  readonly locale?: TextTemplateLocale | null;
  readonly scope: TextTemplateScope;
  readonly projectId: string | null;
  readonly parentId: string | null;
  readonly parentSyncedAt: number | null;
  readonly titleBlock?: TextTemplateTitleBlockMeta;
  readonly createdAt?: { toMillis?: () => number } | null;
  readonly updatedAt?: { toMillis?: () => number } | null;
}

/** Firestore `Timestamp` → `Date` (ή `null` όταν λείπει — π.χ. pending server write). */
function toDate(stamp: { toMillis?: () => number } | null | undefined): Date | null {
  const millis = stamp?.toMillis?.();
  return typeof millis === 'number' ? new Date(millis) : null;
}

/**
 * Έγγραφο βιβλιοθήκης → κανονικό {@link TextTemplate}: **ένα** σχήμα για built-ins και για
 * αποθηκευμένα, ώστε ο resolver / ο picker / ο manager να μη ξέρουν καν τη διαφορά.
 */
export function toTextTemplate(doc: TextTemplateLibraryDoc): TextTemplate {
  return {
    id: doc.id,
    companyId: doc.companyId,
    name: doc.name,
    category: doc.category,
    content: doc.content,
    placeholders: doc.placeholders ?? [],
    isDefault: false,
    ...(doc.locale ? { locale: doc.locale } : {}),
    scope: doc.scope,
    projectId: doc.projectId,
    parentId: doc.parentId,
    parentSyncedAt: doc.parentSyncedAt,
    ...(doc.titleBlock ? { titleBlock: doc.titleBlock } : {}),
    createdAt: toDate(doc.createdAt),
    updatedAt: toDate(doc.updatedAt),
  };
}

export interface TextTemplateLibraryConfig {
  readonly companyId: string;
  readonly userId: string;
  readonly projectId?: string;
}

export interface SaveTextTemplateInput {
  readonly name: string;
  readonly category: TextTemplateCategory;
  readonly content: DxfTextNode;
  readonly scope: WritableTextTemplateScope;
  readonly titleBlock?: TextTemplateTitleBlockMeta;
}

export class TextTemplateLibraryService {
  private readonly library: ScopedLibraryService<TextTemplateLibraryDoc>;

  constructor(private readonly config: TextTemplateLibraryConfig) {
    this.library = new ScopedLibraryService<TextTemplateLibraryDoc>({
      collectionKey: 'TEXT_TEMPLATES',
      companyId: config.companyId,
      userId: config.userId,
      // ΟΧΙ `system` bucket: τα built-in πρότυπα ζουν σε TypeScript (ADR-344 two-tier), δεν
      // είναι έγγραφα. Σειρά = προτεραιότητα εμφάνισης: γραφείο → έργο → δικά μου.
      buckets: [
        companyScopeBucket(),
        ...optionalProjectScopeBucket(config.projectId),
        userScopeBucket(config.userId),
      ],
      errors: {
        notFound: TEXT_TEMPLATE_LIBRARY_ERRORS.NOT_FOUND,
        builtinNotMutable: TEXT_TEMPLATE_LIBRARY_ERRORS.BUILTIN_NOT_MUTABLE,
      },
    });
  }

  /** Το ΕΝΩΜΕΝΟ σύνολο που βλέπει ο χρήστης: γραφείου + έργου + δικά του. */
  async list(): Promise<readonly TextTemplate[]> {
    const docs = await this.library.list();
    return docs.map(toTextTemplate);
  }

  /**
   * Live merge — **αυτό** είναι το «αλλάζω το master → ενημερώνονται όλα τα φύλλα»: μια αλλαγή
   * στο πρότυπο του γραφείου φτάνει στον listener κάθε ανοιχτού έργου, χωρίς refresh.
   */
  subscribe(
    cb: (templates: readonly TextTemplate[]) => void,
    onError: (error: Error) => void = () => {},
  ): Unsubscribe {
    return this.library.subscribe((docs) => cb(docs.map(toTextTemplate)), onError);
  }

  /** Αποθήκευση νέου προτύπου στη βιβλιοθήκη (γράφει μέσω route ⇒ audit + Zod + enterprise id). */
  async save(input: SaveTextTemplateInput): Promise<TextTemplate> {
    const created = await apiCreateTextTemplate({
      name: input.name,
      category: input.category,
      content: input.content,
      scope: input.scope,
      ...(input.scope === 'project' && this.config.projectId
        ? { projectId: this.config.projectId }
        : {}),
      ...(input.titleBlock ? { titleBlock: input.titleBlock } : {}),
    });
    this.library.invalidateCache();
    return created;
  }

  /**
   * «Δημοσίευση» σε άλλη εμβέλεια (π.χ. δικό μου → **γραφείου**) — ΙΔΙΟ έγγραφο, ίδιο id
   * (ADR-652 M3 semantics): όποιο φύλλο το δείχνει, συνεχίζει να το δείχνει.
   */
  async publish(templateId: string, scope: WritableTextTemplateScope): Promise<TextTemplate> {
    const updated = await apiUpdateTextTemplate(templateId, {
      scope,
      ...(scope === 'project' && this.config.projectId
        ? { projectId: this.config.projectId }
        : {}),
    });
    this.library.invalidateCache();
    return updated;
  }

  /**
   * **Απόσπαση** παραλλαγής από ένα master (must-have #1, εξαίρεση): νέο έγγραφο με ΟΛΟ το
   * περιεχόμενο του γονιού + την προέλευσή του. Από κει και πέρα καμία σιωπηλή αλλαγή.
   */
  async detach(parent: TextTemplate, options: DetachOptions): Promise<TextTemplate> {
    if (!canDetachFrom(parent)) {
      throw new Error(TEXT_TEMPLATE_LIBRARY_ERRORS.SELF_PARENT);
    }
    const created = await apiCreateTextTemplate(buildDetachPayload(parent, options));
    this.library.invalidateCache();
    return created;
  }

  /**
   * Ρητό **«Ενημέρωση από τον γονιό»**: το παιδί τραβά το περιεχόμενο του master και
   * ξανασφραγίζει τη στιγμή συγχρονισμού. Idempotent — δεύτερη κλήση γράφει τα ΙΔΙΑ.
   *
   * ADR-651 Φάση Κ — σε **γλωσσική** παραλλαγή ο καλών περνά το ξανα-μεταφρασμένο περιεχόμενο
   * στα `overrides`: το παιδί παίρνει τις αλλαγές του γονιού **στη δική του γλώσσα**, αντί να
   * δεχτεί ελληνικά πάνω στην αγγλική του πινακίδα.
   */
  async pullFromParent(
    child: TextTemplate,
    parent: TextTemplate,
    overrides: TemplateVariantOverrides = {},
  ): Promise<TextTemplate> {
    if (child.parentId !== parent.id) {
      throw new Error(TEXT_TEMPLATE_LIBRARY_ERRORS.NOT_FOUND);
    }
    const updated = await apiUpdateTextTemplate(child.id, buildPullPayload(parent, overrides));
    this.library.invalidateCache();
    return updated;
  }

  /**
   * ADR-651 Φάση Κ — δηλώνει (μία φορά) τη γλώσσα ενός προτύπου γραμμένου **πριν** υπάρξει το
   * πεδίο. Χωρίς αυτό, ο δρόμος της επιστροφής χάνεται: η αγγλική παραλλαγή ξέρει ότι είναι
   * αγγλική, αλλά ο ελληνικός της γονιός δεν ξέρει ότι είναι ελληνικός ⇒ η εναλλαγή προς τα
   * ελληνικά δεν θα τον έβρισκε ποτέ.
   */
  async setLocale(templateId: string, locale: TextTemplateLocale): Promise<TextTemplate> {
    const updated = await apiUpdateTextTemplate(templateId, { locale });
    this.library.invalidateCache();
    return updated;
  }

  async remove(templateId: string): Promise<void> {
    await apiDeleteTextTemplate(templateId);
    this.library.invalidateCache();
  }

  invalidateCache(): void {
    this.library.invalidateCache();
  }
}

export function createTextTemplateLibraryService(
  config: TextTemplateLibraryConfig,
): TextTemplateLibraryService {
  return new TextTemplateLibraryService(config);
}
