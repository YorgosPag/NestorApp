/**
 * Κοινά zod δομικά στοιχεία των σωμάτων αιτήματος του καταλόγου (ADR-923 §5.2).
 * Τα όρια διαβάζονται **μόνο** από το `CATALOG_LIMITS` — κανένας δεύτερος αριθμός εδώ.
 * @module subapps/catalog/schema/zod/common.schema
 */

import { z } from 'zod';
import { normalizeLocalizedText, type LocalizedText } from '@/i18n/localized-text';
import { isValidOrderKey } from '@/lib/ordering/fractional-index';
import { CATALOG_LIMITS, CATALOG_CODE_PATTERN, MEASUREMENT_UNIT_CODE_PATTERN } from '../../vocabulary/catalog-limits';

export const catalogCodeSchema = z.string().regex(CATALOG_CODE_PATTERN);

export const measurementUnitCodeSchema = z.string().regex(MEASUREMENT_UNIT_CODE_PATTERN);

export const orderKeySchema = z.string().refine(isValidOrderKey);

export const entityIdSchema = z.string().min(1).max(128);

/** Αναθεώρηση που διάβασε ο πελάτης — για compare-and-swap στον γραφέα. */
export const expectedRevisionSchema = z.number().int().min(1);

/** Πολυγλωσσικό κείμενο: δέχεται χάρτη γλώσσα → κείμενο, κρατά μόνο ανθρώπινες γλώσσες. */
export function localizedTextSchema(maxLength: number): z.ZodType<LocalizedText, z.ZodTypeDef, unknown> {
  return z
    .record(z.string(), z.string().max(maxLength))
    .transform((value) => normalizeLocalizedText(value));
}

export const labelsSchema = localizedTextSchema(CATALOG_LIMITS.maxLabelLength);

export const descriptionSchema = localizedTextSchema(CATALOG_LIMITS.maxDescriptionLength).default({});

export const nullableNumberSchema = z.number().finite().nullable();
