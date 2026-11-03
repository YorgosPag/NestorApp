/**
 * **Ποια δημόσια προβολή αγγίζει μια γραφή** (ADR-923 §5.13 Δ3): καθαρή, δίπλα στο πρότυπο `pricingViewsOfWrite`.
 *
 * Το SKU οδηγεί στη ρίζα του, γιατί το δημόσιο έγγραφο ζει ανά μοντέλο. Ό,τι αλλάζει το σχήμα ή ορίζει ολόκληρο τον κατάλογο
 * δίνει `catalog`: δεν ξέρουμε φθηνά ποια μοντέλα αγγίζει, και η εκτέλεση είναι τμηματική.
 * ⚠️ Είδος εκτός λίστας δίνει κενό: εισαγωγή και τιμολόγηση δεν μεγαλώνουν τη συναλλαγή.
 *
 * @module subapps/catalog/public/public-scopes-of-write
 */

export type PublicScope = { readonly kind: 'model'; readonly modelId: string } | { readonly kind: 'catalog' } | { readonly kind: 'profile' };

const CATALOG: PublicScope = { kind: 'catalog' };
export const PUBLIC_PROFILE_SCOPE: PublicScope = { kind: 'profile' };
export const PUBLIC_PROFILE_SCOPE_KEY = 'profile';
const CATALOG_WIDE_KINDS: ReadonlySet<string> = new Set(['attribute', 'attributeGroup', 'measurementFamily', 'category', 'family', 'asset', 'settings']);

export function publicScopeKey(scope: PublicScope): string {
  switch (scope.kind) {
    case 'catalog':
      return 'catalog';
    case 'profile':
      return PUBLIC_PROFILE_SCOPE_KEY;
    case 'model':
      return `model:${scope.modelId}`;
  }
}

const textOf = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

const modelScope = (modelId: unknown): readonly PublicScope[] => {
  const id = textOf(modelId);
  return id === null ? [] : [{ kind: 'model', modelId: id }];
};

function rootModelIdOf(record: Readonly<Record<string, unknown>>): unknown {
  const derived = record.derived;
  return derived !== null && typeof derived === 'object' ? (derived as { readonly rootModelId?: unknown }).rootModelId : undefined;
}

function scopesOfVisibilityRule(record: Readonly<Record<string, unknown>>): readonly PublicScope[] {
  const subject = record.subject as { readonly kind?: unknown; readonly modelId?: unknown } | undefined;
  return subject?.kind === 'productModel' ? modelScope(subject.modelId) : [CATALOG];
}

/** Οι δημόσιες προβολές που αλλάζει μια γραφή εγγραφής του είδους `kind`. Απλό προϊόν ⇒ το δικό του id. */
export function publicScopesOfWrite(kind: string, record: Readonly<Record<string, unknown>>): readonly PublicScope[] {
  if (CATALOG_WIDE_KINDS.has(kind)) return [CATALOG];
  switch (kind) {
    case 'productModel':
      return modelScope(rootModelIdOf(record) ?? record.id);
    case 'product':
      return modelScope(rootModelIdOf(record) ?? record.modelId ?? record.id);
    case 'visibilityRule':
      return scopesOfVisibilityRule(record);
    case 'supplierProfile':
      return [PUBLIC_PROFILE_SCOPE];
    default:
      return [];
  }
}

/** Χωρίς διπλότυπα: μία αύξηση ανά προβολή ανά συναλλαγή, όσες γραφές κι αν την άγγιξαν. */
export function distinctPublicScopes(scopes: Iterable<PublicScope>): readonly PublicScope[] {
  const byKey = new Map<string, PublicScope>();
  for (const scope of scopes) byKey.set(publicScopeKey(scope), scope);
  return [...byKey.values()];
}
