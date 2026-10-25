/**
 * Zod schemas μέσων καταλόγου (ADR-923 §5.10 Δ9) — **δομή** του σώματος αιτήματος.
 *
 * 🔑 Τα δικαιώματα ελέγχονται από το **υπάρχον** `MediaRightsSchema` (IPTC, ADR-884) — ο **ένας** ορισμός της
 * πλατφόρμας, όχι δεύτερος. Ζει σε `zod/v4` (συμβόλαιο εφαρμογής κινητού) ενώ ο κατάλογος σε `zod` (v3): γι' αυτό
 * μπαίνει ως `z.custom` που **ρωτά** το v4 schema — ο ορισμός μένει ένας, η γέφυρα είναι μία γραμμή.
 *
 * Το `fileId` **δεν** έρχεται από το σώμα: το γράφει μόνο η ροή ανεβάσματος (2γ), που ξέρει ότι το `FileRecord`
 * ανήκει σε αυτό το μέσο (ADR-709).
 * @module subapps/catalog/schema/zod/asset.schema
 */

import { z } from 'zod';
import { MediaRightsSchema } from '@/contracts/capture-api/capture-api-schemas';
import type { MediaRights } from '@/types/media-rights';
import type { CatalogAssetDefinition } from '../../types/asset';
import { CATALOG_ASSET_ROLES } from '../../vocabulary/asset-roles';
import { ASSET_KINDS } from '../../vocabulary/attribute-types';
import { catalogCodeSchema, descriptionSchema, expectedRevisionSchema, labelsSchema } from './common.schema';

const mediaRightsSchema = z.custom<MediaRights>((value) => MediaRightsSchema.safeParse(value).success);

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
