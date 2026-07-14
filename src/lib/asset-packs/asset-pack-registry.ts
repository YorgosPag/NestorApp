/**
 * ADR-655 — Asset Pack Registry: ο SSoT της **ΤΑΥΤΟΤΗΤΑΣ** ενός πακέτου περιεχομένου.
 *
 * Ένα «asset pack» είναι μια κλειστή, εκδοθείσα συλλογή binary assets (2D entourage sprites,
 * PBR textures, σύμβολα…) που διανέμεται στους πελάτες υπό όρους. Το μοντέλο είναι των μεγάλων
 * (Revit content libraries / Figma paid resources): το πακέτο είναι **πρώτης τάξεως οντότητα**
 * με σταθερό id, έκδοση, άδεια και πολιτική — όχι ένας φάκελος με αρχεία.
 *
 * ⚠️ ΚΡΙΣΙΜΟΣ ΔΙΑΧΩΡΙΣΜΟΣ — γιατί ΔΕΝ ζει εδώ η κατάσταση:
 *   • **ΤΑΥΤΟΤΗΤΑ** (εδώ, στον κώδικα): id, version, άδεια, ποια assets περιέχει. Σταθερή.
 *   • **ΚΑΤΑΣΤΑΣΗ** (Firestore `asset_pack_config/{packId}.status`): αν διανέμεται τώρα. Μεταβλητή.
 *
 * Αν η κατάσταση ζούσε ΕΔΩ, το «κόψε τη διανομή» θα απαιτούσε commit + build + deploy — δηλαδή
 * ΔΕΝ θα ήταν kill switch. Ο διακόπτης πρέπει να γυρίζει σε δευτερόλεπτα, άρα ζει σε δεδομένα.
 *
 * Το `defaultStatus` είναι ΜΟΝΟ το fallback όταν λείπει το Firestore doc (fail-closed για
 * `entitled` πακέτα — ποτέ fail-open).
 *
 * Types/data file (size-exempt): καθαρά lookups, μηδέν I/O, μηδέν React ⇒ import-able ΚΑΙ από
 * server routes ΚΑΙ από τον client.
 *
 * @see ./asset-pack-access.ts — η καθαρή απόφαση πρόσβασης (allow/deny)
 * @see docs/centralized-systems/reference/adrs/ADR-655-asset-packs.md
 */

import { listFurniturePlanDefs } from '@/subapps/dxf-viewer/data/furniture-plan-catalog';
import { listPeoplePlanDefs } from '@/subapps/dxf-viewer/data/people-plan-catalog';
import { listVehiclePlanDefs } from '@/subapps/dxf-viewer/data/vehicles-plan-catalog';
import { listPlantsPlanDefs } from '@/subapps/dxf-viewer/data/plants-plan-catalog';

// ─── Ταυτότητα ────────────────────────────────────────────────────────────────

/** Κάθε νέο πακέτο προσθέτει ΜΙΑ τιμή εδώ + ΜΙΑ εγγραφή στο {@link ASSET_PACKS}. */
export type AssetPackId =
  | 'furniture-plan-2d'
  | 'people-plan-2d'
  | 'vehicles-plan-2d'
  | 'plants-plan-2d';

/**
 * Πολιτική διανομής ενός πακέτου.
 *   • `public`   — κάθε αυθεντικοποιημένος χρήστης (δωρεάν περιεχόμενο).
 *   • `entitled` — ΜΟΝΟ εταιρείες που το έχουν αποκτήσει, ΚΑΙ χρήστες με `asset_packs:packs:use`.
 *   • `disabled` — κανείς (πλην super-admin). Ο διακόπτης πανικού.
 */
export type AssetPackStatus = 'public' | 'entitled' | 'disabled';

/** Ποια εκδοχή ενός asset: πλήρες sprite (καμβάς) ή thumbnail (παλέτα). */
export type AssetPackVariant = 'full' | 'thumb';

/**
 * Προέλευση + όροι. Δεν είναι διακόσμηση: καθορίζει αν το πακέτο ΕΠΙΤΡΕΠΕΤΑΙ να αναδιανεμηθεί
 * (π.χ. σε shared scope ή σε εξαγόμενο DXF που φεύγει από τον οργανισμό).
 */
export interface AssetPackLicense {
  /** Ποιος κατέχει τα πνευματικά δικαιώματα. */
  readonly holder: string;
  /** Ποιος παραχώρησε την άδεια (ο δημιουργός, ΟΧΙ μεταπωλητής). */
  readonly grantedBy: string;
  /** Πότε παραχωρήθηκε (ISO date). */
  readonly grantedAt: string;
  /** Αν επιτρέπεται αναδιανομή προς τρίτους. */
  readonly redistributable: boolean;
}

export interface AssetPackDefinition {
  readonly id: AssetPackId;
  /** Σταθερή έκδοση — μπαίνει στο storage path ⇒ immutable caching + rollback. */
  readonly version: string;
  /** i18n key του εμφανιζόμενου ονόματος (N.11 — ποτέ literal). */
  readonly titleKey: string;
  readonly license: AssetPackLicense;
  /** Fallback όταν λείπει το `asset_pack_config/{packId}` doc. Fail-closed. */
  readonly defaultStatus: AssetPackStatus;
  /**
   * Το **allowlist** των assets. Lazy (συνάρτηση) ώστε ο SSoT να παραμένει ο κατάλογος του
   * πακέτου — μηδέν αντιγραφή ids εδώ.
   */
  readonly listAssetIds: () => readonly string[];
}

// ─── Το μητρώο ────────────────────────────────────────────────────────────────

export const ASSET_PACKS: Readonly<Record<AssetPackId, AssetPackDefinition>> = {
  'furniture-plan-2d': {
    id: 'furniture-plan-2d',
    version: 'v1',
    titleKey: 'assetPacks.furniturePlan2d.title',
    license: {
      holder: 'Nestor Pagonis',
      grantedBy: 'creator',
      grantedAt: '2007-01-01',
      redistributable: false,
    },
    defaultStatus: 'entitled',
    listAssetIds: () => listFurniturePlanDefs().map((def) => def.id),
  },
  'people-plan-2d': {
    id: 'people-plan-2d',
    version: 'v1',
    titleKey: 'assetPacks.peoplePlan2d.title',
    license: {
      holder: 'Nestor Pagonis',
      grantedBy: 'creator',
      grantedAt: '2007-01-01',
      redistributable: false,
    },
    defaultStatus: 'entitled',
    listAssetIds: () => listPeoplePlanDefs().map((def) => def.id),
  },
  'vehicles-plan-2d': {
    id: 'vehicles-plan-2d',
    version: 'v1',
    titleKey: 'assetPacks.vehiclePlan2d.title',
    license: {
      holder: 'Nestor Pagonis',
      grantedBy: 'creator',
      grantedAt: '2007-01-01',
      redistributable: false,
    },
    defaultStatus: 'entitled',
    listAssetIds: () => listVehiclePlanDefs().map((def) => def.id),
  },
  'plants-plan-2d': {
    id: 'plants-plan-2d',
    version: 'v1',
    titleKey: 'assetPacks.plantsPlan2d.title',
    license: {
      holder: 'Nestor Pagonis',
      grantedBy: 'creator',
      grantedAt: '2007-01-01',
      redistributable: false,
    },
    defaultStatus: 'entitled',
    listAssetIds: () => listPlantsPlanDefs().map((def) => def.id),
  },
};

/** `null` για άγνωστο id ⇒ ο καλών κάνει hard deny (ποτέ σιωπηλό allow). */
export function getAssetPack(packId: string): AssetPackDefinition | null {
  return (ASSET_PACKS as Record<string, AssetPackDefinition>)[packId] ?? null;
}

export function listAssetPacks(): readonly AssetPackDefinition[] {
  return Object.values(ASSET_PACKS);
}

// ─── Διαδρομές ────────────────────────────────────────────────────────────────

/** Root στο Firebase Storage. Client read = DENY (βλ. storage.rules) — μόνο ο proxy διαβάζει. */
export const ASSET_PACK_STORAGE_ROOT = 'asset-packs';

/** Root του same-origin proxy. Το `<img src>` στέλνει αυτόματα το `__session` cookie. */
export const ASSET_PACK_API_ROOT = '/api/asset-packs';

/** Το όνομα αρχείου ενός asset. Μοναδική σύμβαση — ΜΗΝ την ξαναγράψεις αλλού. */
export function assetPackFileName(assetId: string, variant: AssetPackVariant): string {
  return variant === 'thumb' ? `${assetId}.thumb.webp` : `${assetId}.webp`;
}

/**
 * Αντίστροφο του {@link assetPackFileName}: `fileName → {assetId, variant}`.
 * `null` όταν το όνομα δεν ταιριάζει στη σύμβαση ⇒ ο proxy απορρίπτει ΠΡΙΝ αγγίξει το Storage.
 */
export function parseAssetPackFileName(
  fileName: string,
): { readonly assetId: string; readonly variant: AssetPackVariant } | null {
  if (fileName.endsWith('.thumb.webp')) {
    return { assetId: fileName.slice(0, -'.thumb.webp'.length), variant: 'thumb' };
  }
  if (fileName.endsWith('.webp')) {
    return { assetId: fileName.slice(0, -'.webp'.length), variant: 'full' };
  }
  return null;
}

/** Object path στο Storage: `asset-packs/{packId}/{version}/{fileName}`. */
export function assetPackStoragePath(
  pack: AssetPackDefinition,
  fileName: string,
): string {
  return `${ASSET_PACK_STORAGE_ROOT}/${pack.id}/${pack.version}/${fileName}`;
}

/**
 * Το URL που μπαίνει στο `ImageEntity.url` και στο `<img src>`. **Σταθερό και same-origin** —
 * γι' αυτό ένα αποθηκευμένο σχέδιο δουλεύει για πάντα (σε αντίθεση με signed URL που λήγει).
 */
export function assetPackAssetUrl(
  pack: AssetPackDefinition,
  assetId: string,
  variant: AssetPackVariant = 'full',
): string {
  return `${ASSET_PACK_API_ROOT}/${pack.id}/${pack.version}/${assetPackFileName(assetId, variant)}`;
}
