/**
 * Το **σχήμα ρύθμισης** μιας καρτέλας του `UniversalTabsRenderer` — εξήχθη από τον renderer (N.7.1).
 *
 * @module components/generic/universal-tabs-config
 */

/**
 * **Καρτέλα-σύνδεσμος** (ADR-328 · ADR-330): η επιφάνεια ζει σε δική της διαδρομή, οπότε η
 * καρτέλα **πλοηγεί στο κλικ** — δεν στήνει component που ανακατευθύνει μόλις στηθεί. Με
 * `forceMount`, ένα τέτοιο component στήνεται και **κρυμμένο**, και πετά τον άνθρωπο αλλού
 * χωρίς να το ζητήσει (μετρημένο ζωντανά, 2026-10-04).
 *
 * @returns τη διεύθυνση για αυτή την οντότητα, ή `null` όταν δεν υπάρχει ακόμη προορισμός
 *   (π.χ. πρόχειρη οντότητα) ⇒ η καρτέλα φαίνεται **ανενεργή**.
 */
export type TabLinkResolver = (entityId: string) => string | null;

/**
 * Universal tab configuration interface
 * Compatible με όλους τους existing tab configs (Project, Building, Storage, Units, κτλ.)
 */
export interface UniversalTabConfig {
  /** Unique tab identifier */
  id: string;
  /** Tab value for routing/state */
  value: string;
  /** Display label */
  label: string;
  /** Icon name (από lucide-react) */
  icon?: string;
  /** Component name για το mapping — απών **μόνο** σε καρτέλα-σύνδεσμο (`href`). */
  component?: string;
  /** Αν το tab είναι ενεργό */
  enabled: boolean;
  /** Sort order */
  order?: number;
  /** Props να περάσουν στο component */
  componentProps?: Record<string, unknown>;
  /** Καρτέλα-σύνδεσμος — βλ. {@link TabLinkResolver}. */
  href?: TabLinkResolver;
}

/** Η ταυτότητα της οντότητας που δείχνουν οι καρτέλες — `''` όταν δεν έχει. */
export function entityIdOf(data: unknown): string {
  const id = (data as { id?: unknown } | null | undefined)?.id;
  return typeof id === 'string' ? id : '';
}

/**
 * Type guard για να ελέγξουμε αν το tabs config είναι compatible με Universal format
 */
export function isUniversalTabConfig(tab: unknown): tab is UniversalTabConfig {
  if (typeof tab !== 'object' || tab === null) {
    return false;
  }
  const tabObj = tab as Record<string, unknown>;
  return (
    typeof tabObj.id === 'string' &&
    typeof tabObj.value === 'string' &&
    typeof tabObj.label === 'string' &&
    (typeof tabObj.component === 'string' || typeof tabObj.href === 'function') &&
    typeof tabObj.enabled === 'boolean'
  );
}

/** Legacy tab config interface for backward compatibility */
interface LegacyTabConfig {
  id?: string;
  value: string;
  label: string;
  icon?: string;
  component?: string;
  enabled?: boolean;
  order?: number;
  componentProps?: Record<string, unknown>;
  href?: TabLinkResolver;
}

/**
 * Converter από legacy tab configs σε Universal format
 * Αυτό επιτρέπει backward compatibility με existing configs
 */
export function convertToUniversalConfig(legacyTab: LegacyTabConfig): UniversalTabConfig {
  return {
    id: legacyTab.id || legacyTab.value,
    value: legacyTab.value,
    label: legacyTab.label,
    icon: legacyTab.icon,
    component: legacyTab.component,
    enabled: legacyTab.enabled ?? true,
    order: legacyTab.order,
    componentProps: legacyTab.componentProps || {},
    ...(legacyTab.href ? { href: legacyTab.href } : {}),
  };
}
