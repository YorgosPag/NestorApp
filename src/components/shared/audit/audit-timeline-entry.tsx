/**
 * 📜 AuditTimelineEntry — Single audit entry renderer
 *
 * Extracted from `AuditTimelineView` per Google SRP (500 line limit).
 * Renders one row in the audit timeline: action icon + who + when + optional
 * entity link + field-level diffs with translated values.
 *
 * @module components/shared/audit/audit-timeline-entry
 * @enterprise ADR-195 — Entity Audit Trail
 */

"use client";

// 🔴 ΞΕΧΩΡΙΣΤΟ BUNDLE, ΟΧΙ ΤΟ ΚΟΙΝΟ (ADR-810): το `audit.fields` μετακόμισε σε δικό του
// namespace. Ήταν **27%** του `common.json`, που ταξιδεύει **ΟΛΟΚΛΗΡΟ** στο shell slice
// **κάθε** διαδρομής (ADR-744 `guaranteedNamespaces`), ενώ το ζητά **μόνο** αυτή η
// επιφάνεια. Η εμφώλευση των κλειδιών έμεινε ίδια — μηδέν αλλαγή στα τρία δυναμικά
// κλειδιά παρακάτω, άρα μηδέν ρίσκο ωμού κλειδιού.
import { AUDIT_TIMELINE_NAMESPACES } from '@/i18n/namespace-bundles';
import React, { useMemo } from "react";
import { Link } from '@/lib/workspace/navigation';
import { declaredHref } from '@/lib/workspace/route-worlds';
import { getEntityHref, type LinkableEntityType } from '@/lib/navigation/entity-href';
import { ENTITY_LINK_CLASS } from '@/lib/ui/link-style';
import { formatRelativeTime, formatDateTime } from "@/lib/intl-utils";
import type {
  AuditEntityType,
  AuditCollectionOp,
  AuditFieldChange,
  AuditSubChange,
  EntityAuditEntry,
} from "@/types/audit-trail";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { useFloorLabel } from "@/hooks/useFloorLabel";
import { cn } from "@/lib/utils";
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACTION_MAP } from "./activity-tab-config";
import { formatCollectionItemLabel, formatFieldAwareValue, formatStorageUrl, type AuditValueFormat } from "./activity-tab-helpers";
import { resolveAuditValue, resolveDeclaredAuditValue } from "./audit-value-resolver";
import { auditValueWords } from "./audit-value-words";
import { useAuditVocabulary } from "./useAuditVocabulary";
import type { AuditCatalogRef } from "@/config/audit-value-catalogs";
// 🏢 ADR-852 Φ2 — ο περιγραφέας του πεδίου: ζωντανή ετικέτα + τίμιο στιγμιότυπο.
// Καθαρές συναρτήσεις, εκτός React ⇒ η άγκυρα της Φ7 τις καρφώνει χωρίς render.
import { resolveTrackedFieldDef, resolveFieldLabel, resolveSubFieldLabel } from "./audit-field-descriptor";
import { resolveActorName, resolveCauseText } from "./audit-actor";

// ============================================================================
// ENTITY LINK MAPPING (for global view)
// ============================================================================

/**
 * Build the canonical detail route for each entity type.
 * Used when rendering in `showEntityLink` mode (global admin view).
 *
 * 🔑 **Δεν γράφει διευθύνσεις — τις ΖΗΤΑ** από το `getEntityHref` (ADR-242 Βήμα 5). Ήταν δεύτερο μητρώο με
 *   χειρόγραφα `/projects/${id}` · `/contacts/${id}` · `/buildings/${id}`: διευθύνσεις-redirect (ένα άλμα παραπάνω).
 *   Εδώ μένει **μόνο** η μετάφραση του λεξιλογίου του ιστορικού (`company` = επαφή) στον τύπο του resolver.
 */
const AUDIT_LINK_TYPE: Partial<Record<AuditEntityType, LinkableEntityType>> = {
  contact: "contact",
  company: "contact",
  project: "project",
  building: "building",
  property: "property",
  parking: "parking",
  storage: "storage",
  purchase_order: "purchase_order",
};

export function buildEntityHref(
  type: AuditEntityType,
  id: string,
): string | null {
  const linkType = AUDIT_LINK_TYPE[type];
  return linkType ? getEntityHref(linkType, id) : null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Firestore runtime guard: typed fields (entityName, change.field, itemLabel)
 * may be stored as objects in legacy records. Coerce safely to string.
 * Uses `as unknown` to bypass TS narrowing without `any`.
 */
function safeStr(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('name' in obj) return String(obj.name);
    return JSON.stringify(obj);
  }
  return String(value);
}

function safeEntityName(value: string | null): string | null {
  if (value === null || value === undefined) return null;
  const s = safeStr(value as unknown);
  return s === '' ? null : s;
}

// ============================================================================
// ENTRY SANITIZER — coerce ALL Firestore string fields to actual strings
// CDC deep-diff can write object values ({name, number}) where the schema
// expects primitives. Sanitize once at the component boundary so every
// downstream render expression receives guaranteed-safe types.
// ============================================================================

function sanitizeSubChange(raw: AuditSubChange): AuditSubChange {
  return {
    ...raw,
    subField: safeStr(raw.subField as unknown),
    label: raw.label != null ? safeStr(raw.label as unknown) : undefined,
  };
}

function sanitizeChange(raw: AuditFieldChange): AuditFieldChange {
  return {
    ...raw,
    field: safeStr(raw.field as unknown),
    label: raw.label != null ? safeStr(raw.label as unknown) : undefined,
    // ADR-195 FK id + display label: prefer these over raw value when present.
    newValueLabel: raw.newValueLabel != null ? safeStr(raw.newValueLabel as unknown) : undefined,
    oldValueLabel: raw.oldValueLabel != null ? safeStr(raw.oldValueLabel as unknown) : undefined,
    itemKey: raw.itemKey != null ? safeStr(raw.itemKey as unknown) : undefined,
    itemLabel: raw.itemLabel != null ? safeStr(raw.itemLabel as unknown) : undefined,
    kind: raw.kind != null ? (safeStr(raw.kind as unknown) as AuditFieldChange['kind']) : undefined,
    op: raw.op != null ? (safeStr(raw.op as unknown) as AuditCollectionOp) : undefined,
    subChanges: raw.subChanges ? raw.subChanges.map(sanitizeSubChange) : undefined,
  };
}

function sanitizeEntry(raw: EntityAuditEntry): EntityAuditEntry {
  const name = raw.entityName != null ? safeStr(raw.entityName as unknown) : null;
  return {
    ...raw,
    entityType: safeStr(raw.entityType as unknown) as AuditEntityType,
    entityId: safeStr(raw.entityId as unknown),
    entityName: name === '' ? null : name,
    action: safeStr(raw.action as unknown) as EntityAuditEntry['action'],
    timestamp: safeStr(raw.timestamp as unknown),
    performedBy: safeStr(raw.performedBy as unknown),
    performedByName: raw.performedByName != null ? (safeStr(raw.performedByName as unknown) || null) : null,
    changes: (raw.changes ?? []).map(sanitizeChange),
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

interface AuditTimelineEntryProps {
  entry: EntityAuditEntry;
  showEntityLink: boolean;
  /** Ό,τι ακολουθεί τις αλλαγές μέσα στην ίδια γραμμή — π.χ. οι αποθηκεύσεις μιας συνεδρίας. */
  children?: React.ReactNode;
}

export function AuditTimelineEntry({
  entry: rawEntry,
  showEntityLink,
  children,
}: AuditTimelineEntryProps) {
  const entry = sanitizeEntry(rawEntry);
  const { t } = useTranslation(AUDIT_TIMELINE_NAMESPACES);
  // ADR-195 (ζ) — τα λεξιλόγια τιμών ΑΥΤΗΣ της οντότητας, παραγόμενα από τις δηλώσεις της (ποτέ «όποιος τα φόρτωσε»).
  const vocabT = useAuditVocabulary(entry.entityType);
  const words = useMemo(() => auditValueWords(vocabT), [vocabT]);
  const floorLabel = useFloorLabel();
  const colors = useSemanticColors();
  const config = ACTION_MAP[entry.action] ?? ACTION_MAP.updated;
  const Icon = config.icon;

  // Η μηχανή λύνεται από την ΤΑΥΤΟΤΗΤΑ της στη γλώσσα του θεατή· ο άνθρωπος έχει το όνομά του.
  const actorName = resolveActorName({
    performedBy: entry.performedBy,
    performedByName: entry.performedByName,
    translate: t,
  });
  // Παράγωγη εγγραφή (αλυσίδα): ο εκτελεστής είναι η μηχανή, ο εμπνευστής λέγεται χωριστά.
  const causeText = resolveCauseText(entry, t);

  const timestamp = entry.timestamp ? new Date(entry.timestamp) : null;
  const relativeTime = timestamp ? formatRelativeTime(timestamp) : "";
  const absoluteTime = timestamp ? formatDateTime(timestamp) : "";

  const entityHref = showEntityLink
    ? declaredHref(
        'buildEntityHref διαλέγει βάση από τον τύπο οντότητας σε χρόνο εκτέλεσης.',
        buildEntityHref(entry.entityType, entry.entityId),
      )
    : null;

  /** Firebase UID detector — alphanumeric 20–36 chars, no separators. */
  const FIREBASE_UID_RE = /^[A-Za-z0-9]{20,36}$/;

  /** Country-code labels (kept local — not a tracked enum field). */
  const COUNTRY_KEYS: Readonly<Record<string, string>> = {
    GR: "countries.greece",
    CY: "countries.cyprus",
    US: "countries.usa",
    DE: "countries.germany",
    FR: "countries.france",
    IT: "countries.italy",
    ES: "countries.spain",
    UK: "countries.uk",
    AU: "countries.australia",
    CA: "countries.canada",
    OTHER: "countries.other",
  };

  /**
   * Build a field-aware translator: resolver handles catalog + audit.values +
   * ISO-date fallbacks; the country-code map is layered on top for non-enum
   * fields (e.g. `birthCountry`).
   */
  const withValueFallbacks = (resolve: (v: string) => string | undefined) =>
    (v: string): string | undefined => {
      const resolved = resolve(v);
      if (resolved) return resolved;

      if (FIREBASE_UID_RE.test(v)) return t('audit.userRef');

      const countryKey = COUNTRY_KEYS[v];
      if (countryKey) {
        const countryResult = t(countryKey);
        if (countryResult !== countryKey) return countryResult;
      }
      return undefined;
    };
  const makeFieldTranslator = (field: string, catalog: AuditCatalogRef | undefined) =>
    withValueFallbacks((v) => resolveAuditValue(field, v, vocabT, catalog));
  // Υπο-πεδίο: ΜΟΝΟ ο κατάλογος που δηλώνει η συλλογή (`itemCatalogs`) — ποτέ ο κατάλογος του ονόματος.
  const makeSubFieldTranslator = (catalog: AuditCatalogRef | undefined) =>
    withValueFallbacks((v) => resolveDeclaredAuditValue(catalog, v, vocabT));

  return (
    <li className="relative pb-5 pl-8 last:pb-0">
      <div
        className={`absolute -left-[9px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-muted bg-background ${config.color}`}
      >
        <Icon className="h-2.5 w-2.5" />
      </div>

      <article className="space-y-1">
        {showEntityLink && (
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                "rounded bg-muted px-1.5 py-0.5 font-mono uppercase",
                colors.text.muted,
              )}
            >
              {t(`audit.entityTypes.${entry.entityType}`)}
            </span>
            {entityHref ? (
              <Link
                href={entityHref}
                className={cn("font-medium", ENTITY_LINK_CLASS)}
              >
                {safeEntityName(entry.entityName) ?? t('audit.unknownEntityName')}
              </Link>
            ) : (
              <span className="font-medium">
                {safeEntityName(entry.entityName) ?? t('audit.unknownEntityName')}
              </span>
            )}
          </div>
        )}

        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-sm font-medium ${config.color}`}>
            {t(config.labelKey)}
          </span>
          {actorName && (
            <span className={cn("text-xs", colors.text.muted)}>
              {t("audit.byUser", { name: actorName })}
            </span>
          )}
          {causeText && (
            <span className={cn("text-xs", colors.text.muted)}>{causeText}</span>
          )}
          {timestamp && (
            <Tooltip>
              <TooltipTrigger asChild>
                <time
                  dateTime={entry.timestamp}
                  className={cn("ml-auto text-xs", colors.text.muted)}
                >
                  {relativeTime}
                </time>
              </TooltipTrigger>
              <TooltipContent>{absoluteTime}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {entry.changes.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {entry.changes.map((change, idx) => {
              // 🏢 ADR-852 Φ2 — ΔΙΠΛΟ ΚΑΝΑΛΙ. Η σειρά επίλυσης (labelKey → ειδική →
              // γενική → στιγμιότυπο → ωμό) ζει στο `resolveFieldLabel`, ώστε να
              // δοκιμάζεται χωρίς render. Τα δύο μεσαία βήματα είναι ΑΚΡΙΒΩΣ ό,τι
              // έκανε αυτό το μπλοκ πριν ⇒ μηδέν παλινδρόμηση εκ κατασκευής.
              const def = resolveTrackedFieldDef(entry.entityType, change.field);
              // Ο κατάλογος τιμών του περιγραφέα κερδίζει τον κατάλογο ανά όνομα πεδίου: το `kind`
              // της στάθμης και το `kind` του τοίχου είναι δύο λεξιλόγια κάτω από ένα όνομα.
              const translateFieldValue = makeFieldTranslator(change.field, def?.enumCatalog);
              const label = resolveFieldLabel({
                entityType: entry.entityType,
                field: change.field,
                def,
                storedLabel: change.label != null ? safeStr(change.label as unknown) : undefined,
                translate: t,
              });
              const fieldLabel: string = label.text;

              // 🏢 ADR-852 Φ3 — Η ΠΟΣΟΤΗΤΑ ΜΕ ΤΗΝ **ΙΔΙΑ** ΠΡΟΤΕΡΑΙΟΤΗΤΑ ΜΕ ΤΗΝ ΕΤΙΚΕΤΑ:
              // ζωντανό μητρώο πρώτα, αποθηκευμένο στιγμιότυπο ως **πτώση**. Όσο το πεδίο
              // ζει στο μητρώο, μια μελλοντική διόρθωση της δήλωσης **θεραπεύει αναδρομικά**
              // και το ήδη γραμμένο ιστορικό (§4.1). Όταν το πεδίο **αποσυρθεί**, το
              // αποθηκευμένο `quantity` είναι ό,τι κρατά τον αριθμό αναγνώσιμο — αλλιώς μια
              // εγγραφή αποσυρμένου πεδίου ξαναγίνεται `749.9999999999927`, δηλαδή
              // ανέλεγκτη από άνθρωπο, σε αρχείο που υπάρχει για να ελέγχεται.
              //
              // ⚠️ Δεν περνά από τον `sanitizeChange`, **σκοπίμως**: ο sanitizer υπάρχει για
              // τιμές που **φτάνουν στην οθόνη**. Το `quantity` δεν αποδίδεται ποτέ — μόνο
              // συγκρίνεται (`formatQuantityValue`: `if (quantity !== 'model-length') return
              // undefined`), άρα οτιδήποτε αλλοιωμένο από legacy Firestore είναι **αδρανές
              // εκ κατασκευής**, χωρίς φρουρό.
              const quantity = def?.quantity ?? change.quantity;
              const valueFormat: AuditValueFormat = {
                ...words,
                translateValue: translateFieldValue,
                quantity,
                floorLabel,
                itemCatalogs: def?.itemCatalogs,
                nestedKeyCatalog: def?.nestedKeyCatalog,
              };

              // ── Collection-aware rendering (ADR-195 Phase 11) ──
              if (change.kind === 'collection' && change.op) {
                // safeStr: itemLabel/itemKey may be objects in legacy Firestore records
                const rawLabel = safeStr(change.itemLabel ?? change.itemKey ?? '');
                // Πρώτα τα δηλωμένα λεξιλόγια των στοιχείων (ο τύπος ζει στην ΟΥΡΑ: «2310428900 — mobile»), μετά ο κατάλογος.
                const healedLabel = formatCollectionItemLabel(rawLabel, valueFormat);
                const itemLabel: string = rawLabel === ''
                  ? safeStr(t('audit.collection.emptyItem') as unknown)
                  : healedLabel !== rawLabel
                    ? healedLabel
                    : (resolveAuditValue(change.field, rawLabel, vocabT, def?.enumCatalog)
                        ?? (rawLabel.includes('firebasestorage.googleapis.com') ? formatStorageUrl(rawLabel, words.word('photo')) : rawLabel));
                const rawMessage = t(`audit.collection.${change.op}`, {
                  field: fieldLabel,
                  item: itemLabel,
                });
                const message = safeStr(rawMessage as unknown);
                return (
                  <li
                    key={`${change.field}-${change.op}-${change.itemKey ?? idx}`}
                    className="rounded bg-muted/50 px-2.5 py-1 text-xs"
                  >
                    <span className="font-medium">{message}</span>
                    {change.subChanges &&
                      change.subChanges.length > 0 && (
                        <ul className="mt-1 ml-3 space-y-0.5">
                          {change.subChanges.map((sub, si) => {
                            // Ζωντανά πρώτα, όπως η ετικέτα του πεδίου: θεραπεύει και τις παλιές
                            // εγγραφές που κουβαλούν `label: 'street'` (ADR-195, 2026-10-05).
                            const subLabel: string = resolveSubFieldLabel({
                              subField: sub.subField,
                              def,
                              storedLabel: sub.label,
                              translate: t,
                            }).text;
                            const subFormat: AuditValueFormat = {
                              ...words,
                              translateValue: makeSubFieldTranslator(def?.itemCatalogs?.[sub.subField]),
                              floorLabel,
                            };
                            return (
                              <li key={`${sub.subField}-${si}`}>
                                <span className={colors.text.muted}>
                                  {subLabel}
                                  {": "}
                                </span>
                                <span
                                  className={cn(
                                    colors.text.muted,
                                    "line-through",
                                  )}
                                >
                                  {formatFieldAwareValue(sub.subField, sub.oldValue, subFormat)}
                                </span>
                                {" → "}
                                <span className="font-medium text-foreground">
                                  {formatFieldAwareValue(sub.subField, sub.newValue, subFormat)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                  </li>
                );
              }

              // ── Scalar rendering (legacy) ──
              return (
                <li
                  key={`${change.field}-${idx}`}
                  className="rounded bg-muted/50 px-2.5 py-1 text-xs"
                >
                  {/* ADR-852 §3.1 — ένα ΣΤΙΓΜΙΟΤΥΠΟ δεν παρουσιάζεται ποτέ ως τρέχουσα
                      αλήθεια: το μητρώο δεν ξέρει πια αυτό το πεδίο, και ο άνθρωπος
                      πρέπει να μπορεί να το μάθει. Διακεκομμένη υπογράμμιση + tooltip
                      (ποτέ native `title=` — CHECK 3.23). */}
                  {label.isSnapshot ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-medium underline decoration-dotted underline-offset-2">
                          {fieldLabel}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {safeStr(t("audit.retiredFieldNotice") as unknown)}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="font-medium">{fieldLabel}</span>
                  )}
                  {": "}
                  <span
                    className={cn(
                      colors.text.muted,
                      "line-through",
                    )}
                  >
                    {change.oldValueLabel
                      ? safeStr(change.oldValueLabel as unknown)
                      : formatFieldAwareValue(change.field, change.oldValue, valueFormat)}
                  </span>
                  {" → "}
                  <span className="font-medium text-foreground">
                    {change.newValueLabel
                      ? safeStr(change.newValueLabel as unknown)
                      : formatFieldAwareValue(change.field, change.newValue, valueFormat)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {children}
      </article>
    </li>
  );
}
