import 'server-only';

/**
 * =============================================================================
 * ΕΞΑΓΩΓΗ ETIM xChange 2.0 — ο κατάλογος του χώρου για ΕΝΑ κοινό τιμών (ADR-923 §5.14 · κενό α)
 * =============================================================================
 *
 * Ένα συνεπές στιγμιότυπο σε συναλλαγή **μόνο ανάγνωσης** (καμία κλειδαριά πάνω σε ό,τι επεξεργάζεται ο χρήστης), και μετά ο
 * καθαρός προσαρμογέας `buildXChangeDocument`.
 *
 * 🔑 **Η μία μηχανή τιμής** (Ζ9): λίστα, εκδόσεις και συνθήκες διαβάζονται **μία** φορά (`readQuoteBasis`), οι γραμμές της
 *    έκδοσης μία φορά, και κάθε SKU κρίνεται με το `quoteOnBasis`, το ίδιο που απαντά στο «δες την τιμή σαν τον Χ».
 *    Ποτέ από το `PublicationPriceLookup`, που δίνει τυπωμένο κείμενο.
 * 🔒 **Το κοινό** (απόφαση Ε1): ο ανώνυμος θεατής, ή ο θεατής που χτίζεται από το **αποθηκευμένο** κοινό της λίστας πελάτη.
 *    Ο πελάτης στέλνει μόνο το id της λίστας· λίστα κόστους ή χωρίς κοινό αρνείται.
 * 🔒 **Ορατότητα** (απόφαση Ε2): η ίδια ετυμηγορία `judgeVisibility` για το ίδιο κοινό, στην ίδια στιγμή. Κρυφό ⇒ εκτός αρχείου.
 * 🔒 **Ποτέ κενό αρχείο** (απόφαση Ε3): το σχήμα 2.0 ζητά `Product` με `minItems: 1`. Χωρίς κανένα προϊόν η εξαγωγή αρνείται με
 *    την **αιτία** (`xchangeEmptyCause`), και ο προέλεγχος (`previewXChangeExport`) το λέει **πριν** τη λήψη, από την **ίδια**
 *    κρίση (`judgeAudience`): οι δύο δεν μπορούν να διαφωνήσουν.
 * 🔑 Η άδεια ODC-BY του μοντέλου ETIM ζητά αναφορά όπου εμφανίζονται **ονόματα** ETIM. Εδώ γράφονται μόνο κωδικοί.
 * @module server/catalog/xchange-export.server
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { AuthContext } from '@/lib/auth';
import { localDateOf, normalizeToMillisOrNull } from '@/lib/date-local';
import { fnv1a64Hex } from '@/lib/hash/fnv1a';
import { MONEY_CURRENCY } from '@/lib/money/money';
import { isValidGreekVat, normalizeVat } from '@/lib/validation/greek-vat-number';
import { readCompanyTaxDeclaration } from '@/services/company/company-legal-identity';
import { buildXChangeDocument } from '@/subapps/catalog/interop/etim/catalog-to-xchange';
import {
  assembleXChangeProducts,
  xchangeEmptyCause,
  xchangeNothingToExportIssue,
  type XChangeAssembly,
} from '@/subapps/catalog/interop/etim/xchange-export-assembly';
import { xchangeSkuPricing } from '@/subapps/catalog/interop/etim/xchange-pricing';
import { priceLineSubjectKey } from '@/subapps/catalog/pricing/price-line-subject';
import { judgeVisibility } from '@/subapps/catalog/pricing/visibility';
import type { StoredProduct } from '@/subapps/catalog/publishing/publication-chapters';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { PriceListDefinition, PricingViewer } from '@/subapps/catalog/types/price-list';
import type {
  XChangeExportAudience,
  XChangeExportCounts,
  XChangeExportPreview,
  XChangeExportPriceSource,
  XChangeExportWire,
} from '@/subapps/catalog/types/xchange-export';
import type { XChangeEmptyCause } from '@/subapps/catalog/vocabulary/etim';
import { readCatalogDataSet } from './catalog-dataset-reads.server';
import { readOwned, runCatalogReadOnly, type CatalogTx } from './catalog-store.server';
import { CatalogWriteError, assertNoIssues } from './catalog-write-error';
import { basisVersion, quoteOnBasis, readQuoteBasis, type QuoteBasis, type QuoteLine } from './price-quote.server';
import { readVersionLines } from './price-version-reads.server';
import { viewerOf } from './pricing-viewer.server';
import { ancestryOfChain, readVisibilityRules } from './visibility-reads.server';

export interface XChangeExportRequest {
  readonly audience: XChangeExportAudience;
  readonly language: HumanLanguage;
}

/** Μήκος `SupplierName` / `ManufacturerName` στο σχήμα 2.0. */
const SUPPLIER_NAME_MAX = 80;

interface SupplierParty {
  readonly name: string;
  readonly vatNumber: string | null;
}

interface SupplierRead {
  readonly party: SupplierParty;
  /** Ό,τι κάνει την εξαγωγή να αρνηθεί. Ο προέλεγχος το **δείχνει**, η εξαγωγή το **ρίχνει**. */
  readonly issues: readonly CatalogIssue[];
}

const SUPPLIER_NAME_MISSING: readonly CatalogIssue[] = [{ code: 'xchangeSupplierNameMissing', path: 'supplier' }];

/** Η επωνυμία και ο ΑΦΜ από το SSoT της νομικής ταυτότητας (ADR-439). Ο ΑΦΜ γράφεται με το πρόθεμα ΦΠΑ της ΕΕ, μόνο αν είναι έγκυρος. */
async function readSupplier(companyId: string): Promise<SupplierRead> {
  const read = await readCompanyTaxDeclaration(companyId);
  if (read.kind === 'unavailable') throw new Error('company-legal-identity-unavailable');
  const name = read.kind === 'present' ? read.declaration.businessName?.trim() ?? '' : '';
  const taxId = read.kind === 'present' ? read.taxId : null;
  const party = { name: name.slice(0, SUPPLIER_NAME_MAX), vatNumber: taxId !== null && isValidGreekVat(taxId) ? `EL${normalizeVat(taxId)}` : null };
  return { party, issues: name === '' ? SUPPLIER_NAME_MISSING : [] };
}

const NOT_OFFERED: readonly CatalogIssue[] = [{ code: 'xchangePriceListNotOffered', path: 'priceListId' }];

interface AudienceTerms {
  readonly viewer: PricingViewer;
  readonly priceListId: string | null;
}

/** Ο θεατής του αρχείου, από αποθηκευμένες εγγραφές. Λίστα πελάτη ⇒ ο θεατής **του κοινού της**, και μόνο λίστα πώλησης. */
async function audienceTermsOf(scope: CatalogTx, audience: XChangeExportAudience): Promise<AudienceTerms> {
  if (audience.kind === 'public') return { viewer: { kind: 'anonymous' }, priceListId: null };
  const list = await readOwned<PriceListDefinition>(scope, 'priceList', audience.priceListId);
  // Ο θεατής χτίζεται από το κοινό της ίδιας της λίστας, άρα το καλύπτει εξ ορισμού: μένει μόνο «πώληση, με κοινό».
  if (list.kind !== 'sales' || list.audience === null) throw new CatalogWriteError('invalid', NOT_OFFERED);
  return { viewer: await viewerOf(scope, list.audience), priceListId: list.id };
}

const byId = <T extends { readonly id: string }>(records: readonly T[]) => new Map(records.map((record) => [record.id, record]));

/** Ο κατάλογος του χώρου από τον έναν αναγνώστη (`readCatalogDataSet`, ίδιος με τον εκδότη), σε χάρτες για τον προσαρμογέα. */
async function readExportData(scope: CatalogTx) {
  const { families, attributes, models, products, categories, registry } = await readCatalogDataSet(scope);
  return { families: byId(families), attributes: byId(attributes), models: byId(models), products, categories: byId(categories), registry };
}

/** Οι γραμμές της έκδοσης που ισχύει, μία φορά, ανά υποκείμενο. Δημοσιευμένη έκδοση = αμετάβλητη, άρα η ανάγνωση είναι συνεπής. */
async function readBasisLines(scope: CatalogTx, basis: QuoteBasis): Promise<ReadonlyMap<string, QuoteLine>> {
  const version = basisVersion(basis);
  if (version === null) return new Map();
  const lines = await readVersionLines(scope.db, scope.ctx.companyId, version.id);
  return new Map(lines.map((line) => [priceLineSubjectKey(line.subject), line]));
}

function priceSourceOf(basis: QuoteBasis): XChangeExportPriceSource | null {
  if (basis.selected.kind !== 'list') return null;
  const { list } = basis.selected;
  const version = basisVersion(basis);
  return {
    priceListId: list.id,
    code: list.code,
    labels: list.labels,
    version: version === null || version.validFrom === null ? null : { id: version.id, number: version.number, validFrom: version.validFrom },
  };
}

type ExportData = Awaited<ReturnType<typeof readExportData>>;

interface Judgement {
  readonly basis: QuoteBasis;
  readonly lines: ReadonlyMap<string, QuoteLine>;
  readonly rules: Awaited<ReturnType<typeof readVisibilityRules>>;
  readonly categories: ExportData['categories'];
}

/** Η κρίση ενός SKU: ορατότητα με την αλυσίδα του, τιμή με την ποσότητα της γραμμής, η ίδια μηχανή με τη μεμονωμένη τιμή. */
function pricingJudge({ basis, lines, rules, categories }: Judgement) {
  const priceType = basis.selected.kind === 'list' ? basis.selected.list.priceType : null;
  const priceTypeOf = () => {
    if (priceType === null) throw new Error('priced quote outside the selected price list');
    return priceType;
  };
  return (product: StoredProduct, chain: Parameters<typeof ancestryOfChain>[1]) => {
    const visibility = judgeVisibility(rules, ancestryOfChain(product.id, chain, categories), basis.viewer, basis.atMs);
    const subject = { kind: 'variant' as const, variantId: product.id };
    const line = lines.get(priceLineSubjectKey(subject)) ?? null;
    return xchangeSkuPricing(quoteOnBasis(basis, { subject, quantity: line?.priceQuantity ?? 1 }, line, visibility), priceTypeOf);
  };
}

const dateOf = (iso: string): string => localDateOf(new Date(normalizeToMillisOrNull(iso) ?? Date.now()));

interface AudienceJudgement {
  readonly basis: QuoteBasis;
  readonly data: ExportData;
  readonly assembly: XChangeAssembly;
  readonly emptyCause: XChangeEmptyCause | null;
}

/** Η **μία** κρίση του κοινού πάνω στον κατάλογο: ό,τι μετρά ο προέλεγχος είναι ό,τι γράφει η εξαγωγή (Ε3). */
async function judgeAudience(scope: CatalogTx, audience: XChangeExportAudience): Promise<AudienceJudgement> {
  const terms = await audienceTermsOf(scope, audience);
  const basis = await readQuoteBasis(scope, { priceListId: terms.priceListId, at: scope.now }, terms.viewer);
  const [data, rules, lines] = await Promise.all([readExportData(scope), readVisibilityRules(scope), readBasisLines(scope, basis)]);
  const assembly = assembleXChangeProducts({ ...data, pricingOf: pricingJudge({ basis, lines, rules, categories: data.categories }) });
  const emptyCause = xchangeEmptyCause(assembly, { productCount: data.products.length, visibilityRuleCount: rules.length });
  return { basis, data, assembly, emptyCause };
}

function countsOf(audience: XChangeExportAudience, { basis, assembly }: AudienceJudgement): XChangeExportCounts {
  const { hidden, unfitIdentifier, onRequest } = assembly;
  const at = new Date(basis.atMs).toISOString();
  return { audience, priceSource: priceSourceOf(basis), at, exported: assembly.sources.length, hidden, unfitIdentifier, onRequest };
}

/** Κενό αρχείο είναι άκυρο έγγραφο (`Product` `minItems: 1`): άρνηση με την αιτία, ποτέ λήψη. */
function assertExportable(cause: XChangeEmptyCause | null): void {
  assertNoIssues(cause === null ? [] : [xchangeNothingToExportIssue(cause)]);
}

/** `GET /api/catalog/xchange-export/preview`: τι θα έβγαινε για το κοινό, χωρίς έγγραφο. Πετά μόνο για ακατάλληλη λίστα. */
export async function previewXChangeExport(ctx: AuthContext, audience: XChangeExportAudience): Promise<XChangeExportPreview> {
  const supplier = await readSupplier(ctx.companyId);
  return runCatalogReadOnly(ctx, async (scope) => {
    const judged = await judgeAudience(scope, audience);
    return { ...countsOf(audience, judged), emptyCause: judged.emptyCause, blockers: supplier.issues };
  });
}

/** `GET /api/catalog/xchange-export`. Πετά `CatalogWriteError` (άγνωστη/ακατάλληλη λίστα, χωρίς επωνυμία, κανένα προϊόν). */
export async function exportXChangeCatalog(ctx: AuthContext, request: XChangeExportRequest): Promise<XChangeExportWire> {
  const supplier = await readSupplier(ctx.companyId);
  assertNoIssues(supplier.issues);
  return runCatalogReadOnly(ctx, async (scope) => {
    const judged = await judgeAudience(scope, request.audience);
    assertExportable(judged.emptyCause);
    const counts = countsOf(request.audience, judged);
    const generatedOn = dateOf(scope.now);
    const priceValidityDate = counts.priceSource?.version ? dateOf(counts.priceSource.version.validFrom) : null;
    const audienceKey = request.audience.kind === 'public' ? 'public' : `priceList:${request.audience.priceListId}`;
    const catalogueId = `NC${fnv1a64Hex(`${ctx.companyId}|${audienceKey}`)}`;
    const { data } = judged;
    const { document, report } = buildXChangeDocument({
      catalogueId, language: request.language, validFrom: priceValidityDate ?? generatedOn, generatedOn, priceValidityDate,
      currency: MONEY_CURRENCY, supplier: supplier.party, families: data.families, attributes: data.attributes, registry: data.registry,
      products: judged.assembly.sources,
    });
    return { document, summary: { ...counts, fileName: `xchange-${catalogueId}-${generatedOn}.json`, content: report } };
  });
}
