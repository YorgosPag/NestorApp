/**
 * Zod schemas μέσων καταλόγου (ADR-923 §5.10 Δ9) — **δομή** του σώματος αιτήματος.
 *
 * 🔑 Τα δικαιώματα ελέγχονται από τον **έναν** ορισμό της πλατφόρμας (`mediaRightsSchemaFor`, IPTC — ADR-884) με το
 * πλαίσιο **`catalog`** (ADR-923 §5.10.3): σκοποί `catalog-publication` · `reseller-reuse` · `unrestricted`, διάρκεια
 * `date`/`perpetual` — **όχι** «μάρκετινγκ αγγελίας» ούτε «όσο ισχύει η εντολή». Ο ορισμός ζει σε `zod/v4` ενώ ο
 * κατάλογος σε `zod` (v3): γι' αυτό μπαίνει ως `z.custom` που **ρωτά** το v4 schema — η γέφυρα είναι μία γραμμή.
 *
 * Το `fileId` **δεν** έρχεται από το σώμα του ορισμού: το γράφει μόνο η πράξη σύνδεσης (2γ, `POST …/assets/[id]/file`),
 * που κρίνει ότι το `FileRecord` ανήκει σε αυτό το μέσο (ADR-709 · ADR-923 §5.10.3).
 * @module subapps/catalog/schema/zod/asset.schema
 */

import { z } from 'zod';
import { mediaRightsSchemaFor } from '@/lib/media-rights/media-rights-schema';
import type { MediaRights } from '@/types/media-rights';
import type { CatalogAssetDefinition } from '../../types/asset';
import { CATALOG_ASSET_ROLES } from '../../vocabulary/asset-roles';
import { ASSET_KINDS } from '../../vocabulary/attribute-types';
import { catalogCodeSchema, descriptionSchema, entityIdSchema, expectedRevisionSchema, labelsSchema } from './common.schema';

const CATALOG_RIGHTS = mediaRightsSchemaFor('catalog');
const mediaRightsSchema = z.custom<MediaRights>((value) => CATALOG_RIGHTS.safeParse(value).success);

/** Ό,τι στέλνει ο άνθρωπος — ο ορισμός **χωρίς** `fileId`. */
export type CatalogAssetInput = Omit<CatalogAssetDefinition, 'fileId'>;

export const assetDefinitionSchema: z.ZodType<CatalogAssetInput, z.ZodTypeDef, unknown> = z.object({
  code: catalogCodeSchema,
  role: z.enum(CATALOG_ASSET_ROLES),
  kind: z.enum(ASSET_KINDS),
  labels: labelsSchema,
  description: descriptionSchema,
  rights: mediaRightsSchema,
});

export const createAssetBodySchema = z.object({ definition: assetDefinitionSchema });
export const updateAssetBodySchema = z.object({ expectedRevision: expectedRevisionSchema, definition: assetDefinitionSchema });

/** `POST /api/catalog/assets/[id]/file` — σύνδεση αρχείου (ή νέας έκδοσής του) με CAS. */
export const attachAssetFileBodySchema = z.object({ expectedRevision: expectedRevisionSchema, fileId: entityIdSchema });
export type AttachAssetFileBody = z.infer<typeof attachAssetFileBodySchema>;
