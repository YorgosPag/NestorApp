/**
 * ADR-233: Centralized entity card subtitle builder.
 * Pattern: "{typeLabel} · {code}" when code present, else just "{typeLabel}".
 * Used by StorageGridCard, StorageListCard, PropertyGridCard.
 */
export function buildCardSubtitle(typeLabel: string, code?: string | null): string {
  return code ? `${typeLabel} · ${code}` : typeLabel;
}
