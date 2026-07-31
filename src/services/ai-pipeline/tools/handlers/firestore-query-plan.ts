/**
 * Το χτίσιμο ενός tenant-scoped Firestore query — μία φορά
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (N.0.2 Boy Scout· CHECK 3.28 το μετρούσε **ήδη στο HEAD**)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο `firestore-handler` έγραφε τον **ίδιο** βρόχο «filters → where → orderBy →
 * limit» σε **τέσσερα** σημεία, και την **ίδια** αλυσίδα ασφαλείας «επιτρεπτή
 * συλλογή → RBAC → tenant scope» σε **δύο**.
 *
 * Δεν είναι «λίγος κώδικας που μοιάζει» — είναι η αλυσίδα ασφαλείας κάθε
 * ανάγνωσης του πράκτορα. Αν ένα αντίγραφο ξεχάσει το `enforceCompanyScope` ή
 * το βάλει σε λάθος σειρά, **η διαφορά δεν φαίνεται πουθενά**: το εργαλείο
 * απαντά κανονικά, απλώς διαβάζει περισσότερα απ' όσα δικαιούται (ίδιο
 * σκεπτικό με ADR-742 §7.8).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΠΑΓΙΔΑ ΠΟΥ ΠΛΗΡΩΘΗΚΕ ΣΤΗΝ ΕΞΑΓΩΓΗ — ΜΗΝ ΤΗΝ «ΑΠΛΟΠΟΙΗΣΕΙΣ» ΠΙΣΩ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το τελευταίο καταφύγιο («companyId only») έγραφε **σκληρά** `where('companyId',
 * '==', …)` — αγνοώντας τον `operator` του φίλτρου. Αυτό **δεν** ήταν αμέλεια:
 *
 * το {@link enforceCompanyScope} όταν βρει **υπάρχον** φίλτρο `companyId`
 * αντικαθιστά **μόνο την τιμή** (`{ ...f, value: companyId }`) και **κρατά τον
 * operator που έστειλε το μοντέλο**. Το `mapOperator` δέχεται `!=` και `not-in`.
 *
 * ⇒ Αν το τελευταίο καταφύγιο περνούσε από τον γενικό βρόχο, ένα
 * `{field:'companyId', operator:'!=' }` θα γινόταν «όλες οι **άλλες** εταιρείες».
 * Το καταφύγιο **επιβάλλει** ισότητα: βλ. {@link tenantEqualityFilter}.
 *
 * @module services/ai-pipeline/tools/handlers/firestore-query-plan
 * @see ADR-742 §7.8 (γιατί οι αλυσίδες ασφαλείας γράφονται μία φορά)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  type AgenticContext,
  type QueryFilter,
  type ToolResult,
  enforceCompanyScope,
  enforceRoleAccess,
  isReadAllowed,
  mapOperator,
  coerceFilterValue,
} from '../executor-shared';

/** Ταξινόμηση αποτελεσμάτων — `null` σημαίνει «μη ζητηθείσα ή εγκαταλειμμένη». */
export interface QueryOrder {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

/**
 * Ο κοινός βρόχος. Φίλτρα με άγνωστο operator **αγνοούνται** (το `mapOperator`
 * επιστρέφει `null`) — συμπεριφορά που προϋπήρχε και διατηρείται αυτούσια.
 *
 * @param limit `null` για ερωτήματα που δεν φέρνουν έγγραφα (π.χ. `count()`)
 */
export function buildFilteredQuery(
  db: FirebaseFirestore.Firestore,
  collection: string,
  filters: readonly QueryFilter[],
  opts: { readonly orderBy?: QueryOrder | null; readonly limit?: number | null } = {},
): FirebaseFirestore.Query {
  let q: FirebaseFirestore.Query = db.collection(collection);

  for (const f of filters) {
    const op = mapOperator(f.operator);
    if (op) q = q.where(f.field, op, coerceFilterValue(f.value));
  }

  const order = opts.orderBy ?? null;
  if (order) q = q.orderBy(order.field, order.direction);

  const limit = opts.limit ?? null;
  return limit === null ? q : q.limit(limit);
}

/**
 * Το φίλτρο tenant του **τελευταίου καταφυγίου**: ισότητα, πάντα.
 *
 * 🔴 Ο `operator` **απορρίπτεται επίτηδες**. Το καταφύγιο τρέχει όταν όλα τα
 * προηγούμενα απέτυχαν· εκεί η μόνη αποδεκτή σημασιολογία είναι «η εταιρεία
 * μου», ποτέ «όχι η εταιρεία μου». Βλ. την παγίδα στην κεφαλίδα του module.
 */
export function tenantEqualityFilter(companyFilter: QueryFilter): QueryFilter {
  return { field: 'companyId', operator: '==', value: companyFilter.value };
}

/** Μία απόπειρα του fallback: **δεδομένα**, όχι closure. */
export interface QueryAttempt {
  readonly label: string;
  readonly filters: readonly QueryFilter[];
  readonly orderBy: QueryOrder | null;
}

/**
 * Η κλιμάκωση υποχώρησης όταν λείπει σύνθετο index, ως **λίστα δεδομένων**.
 *
 * Η σειρά είναι το συμβόλαιο: κάθε βήμα θυσιάζει **ένα** πράγμα (πρώτα την
 * ταξινόμηση, μετά τα ένθετα πεδία, τέλος όλα εκτός του tenant). Το πρώτο
 * επιτυχημένο κερδίζει — γι' αυτό το `full query` είναι πάντα πρώτο.
 */
export function buildFallbackAttempts(spec: {
  readonly filters: readonly QueryFilter[];
  readonly orderBy: string | null;
  readonly orderDirection: 'asc' | 'desc';
}): readonly QueryAttempt[] {
  const { filters, orderBy, orderDirection } = spec;
  const flatFilters = filters.filter((f) => !f.field.includes('.'));
  const companyFilter = filters.find((f) => f.field === 'companyId');

  return [
    {
      label: 'full query',
      filters,
      orderBy: orderBy === null ? null : { field: orderBy, direction: orderDirection },
    },
    { label: 'without orderBy', filters, orderBy: null },
    { label: 'flat filters only (no nested)', filters: flatFilters, orderBy: null },
    {
      label: 'companyId only',
      filters: companyFilter === undefined ? [] : [tenantEqualityFilter(companyFilter)],
      orderBy: null,
    },
  ];
}

/**
 * Το αποτέλεσμα της αλυσίδας ασφαλείας: **ή** το εγκεκριμένο σχέδιο, **ή** το
 * έτοιμο σφάλμα. Διακριτή ένωση ώστε ο καλών να μη μπορεί να προχωρήσει
 * αγνοώντας την άρνηση.
 */
export type ScopedReadPlan =
  | { readonly ok: true; readonly collection: string; readonly filters: QueryFilter[] }
  | { readonly ok: false; readonly result: ToolResult };

/**
 * Η αλυσίδα ασφαλείας κάθε ανάγνωσης, με **τη σειρά που έχει σημασία**:
 * επιτρεπτή συλλογή → RBAC ρόλου → tenant scope.
 *
 * Η σειρά δεν είναι στιλιστική: το `enforceRoleAccess` κρίνει τα φίλτρα **όπως
 * τα έστειλε το μοντέλο**, και το `enforceCompanyScope` επιβάλλει τον tenant
 * **μετά**, ώστε καμία απόφαση RBAC να μη βασιστεί σε φίλτρο που προσθέσαμε
 * εμείς.
 */
export function planScopedRead(
  args: Record<string, unknown>,
  ctx: AgenticContext,
): ScopedReadPlan {
  return planScopedReadImpl(args, ctx);
}

/** Ό,τι δικαιούται να διαβάσει ο καλών, αφού περάσει η αλυσίδα. */
export interface ApprovedRead {
  readonly collection: string;
  readonly filters: QueryFilter[];
}

/**
 * Ο **εκτελεστής ανάγνωσης**: αλυσίδα ασφαλείας → σύνδεση → η δουλειά.
 *
 * Υπάρχει για τον ίδιο λόγο με τον `_domain-route.ts` της Φάσης Β (ADR-742
 * §7.8): όταν κάθε read path γράφει μόνο του «έλεγξε → πάρε db → τρέξε», αρκεί
 * **ένα** να ξεχάσει τον έλεγχο ή να τον βάλει μετά, και **η διαφορά δεν
 * φαίνεται πουθενά** — το εργαλείο απαντά κανονικά, απλώς διαβάζει περισσότερα
 * απ' όσα δικαιούται.
 *
 * Με αυτόν, το «διάβασε χωρίς tenant scope» **δεν είναι εκφράσιμο**: δεν
 * υπάρχει μονοπάτι προς το `db` που να μην έχει περάσει από το
 * {@link planScopedRead}.
 */
export async function withScopedRead(
  args: Record<string, unknown>,
  ctx: AgenticContext,
  run: (approved: ApprovedRead, db: FirebaseFirestore.Firestore) => Promise<ToolResult>,
): Promise<ToolResult> {
  const plan = planScopedReadImpl(args, ctx);
  if (!plan.ok) return plan.result;

  return run({ collection: plan.collection, filters: plan.filters }, getAdminFirestore());
}

function planScopedReadImpl(
  args: Record<string, unknown>,
  ctx: AgenticContext,
): ScopedReadPlan {
  const collection = String(args.collection ?? '');

  if (!isReadAllowed(collection)) {
    return {
      ok: false,
      result: { success: false, error: `Collection "${collection}" is not accessible` },
    };
  }

  const rawFilters = Array.isArray(args.filters) ? (args.filters as QueryFilter[]) : [];

  const accessCheck = enforceRoleAccess(collection, rawFilters, ctx);
  if (!accessCheck.allowed) return { ok: false, result: accessCheck.result };

  return {
    ok: true,
    collection,
    filters: enforceCompanyScope(accessCheck.filters, ctx.companyId, collection),
  };
}
