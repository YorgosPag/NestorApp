/**
 * @fileoverview **ΤΟ ΣΧΗΜΑ ΤΩΝ ΔΙΚΑΙΩΜΑΤΩΝ ΜΕΣΟΥ, ΑΝΑ ΠΛΑΙΣΙΟ** — ο ΕΝΑΣ ορισμός zod του IPTC `MediaRights` (ADR-884 Φ0.14 ·
 *   ADR-923 §5.10.3).
 * @module lib/media-rights/media-rights-schema
 *
 * 🔑 **Ένα σχήμα, πολλά πλαίσια**: το πλαίσιο (`MEDIA_LICENSE_CONTEXTS`) διαλέγει **ποιοι σκοποί** και **ποιες διάρκειες**
 *   γίνονται δεκτοί — το σχήμα του δημιουργού, των δικαιούχων και της δήλωσης πνευματικών δικαιωμάτων μένει **ένα**.
 *   - `listing` = το **συμβόλαιο της εφαρμογής κινητού** (`contracts/capture-api`, CHECK 3.98): αλλαγή εδώ αλλάζει το
 *     OpenAPI· γι' αυτό το πλαίσιο `listing` κρατά **ακριβώς** τους τρεις σκοπούς και τις τρεις διάρκειες που είχε.
 *   - `catalog` = τα μέσα καταλόγου (ADR-923).
 * 🔑 Οι διάρκειες είναι **ονομασμένα** σχήματα (`MediaLicenseTerm*Schema`) ώστε το OpenAPI να τις δηλώνει ως `oneOf` με
 *   `discriminator` και ο γεννήτορας Kotlin να βγάζει `sealed` ιεραρχία.
 *
 * **Layering**: leaf — μόνο zod και καθαρά λεξιλόγια· **κανένα** `server-only` (ο γεννήτορας του συμβολαίου τρέχει σε σκέτο node).
 */

import { z } from 'zod/v4';

import { MAX_MEDIA_LICENSORS, MEDIA_LICENSE_CONTEXTS, type MediaLicenseContext } from '@/constants/media-rights-vocabulary';

/** Κείμενο με τουλάχιστον έναν μη-κενό χαρακτήρα — ο αναγνώστης του διακομιστή κάνει `trim` και απορρίπτει το κενό. */
export const NonBlankText = z.string().regex(/\S/);

/** Στιγμή ISO-8601 σε UTC (`…Z`) — όπως τη γράφει ο διακομιστής (`toISOString`). */
export const IsoInstant = z.iso.datetime();

export const MediaPartySchema = z.object({
  name: NonBlankText,
  /** Ο λογαριασμός — `null` για πρόσωπο εκτός πλατφόρμας. Αν δοθεί για τον δημιουργό, **πρέπει** να είναι ο δράστης. */
  userId: NonBlankText.nullable(),
  url: NonBlankText.nullable(),
});

export const MediaLicenseTermPerpetualSchema = z.object({ kind: z.literal('perpetual') });
export const MediaLicenseTermMandateSchema = z.object({ kind: z.literal('mandate'), mandateId: NonBlankText });
export const MediaLicenseTermDateSchema = z.object({ kind: z.literal('date'), until: IsoInstant });

const DISCRIMINATOR = { discriminator: { propertyName: 'kind' } } as const;

/**
 * Οι διάρκειες **κάθε** πλαισίου, ως διακριτή ένωση. 🔑 **Ρητές, όχι παραγόμενες** από τον πίνακα του πλαισίου: η σειρά
 * των μελών είναι η σειρά του `oneOf` στο OpenAPI — μια αναδιάταξη θα άλλαζε το συμβόλαιο της εφαρμογής κινητού χωρίς
 * καμία αλλαγή νοήματος. Ότι κάθε ένωση έχει **ακριβώς** τις διάρκειες του πλαισίου της το αποδεικνύει το
 * `media-rights-schema.test.ts` (Ν2).
 */
const TERM_UNION_OF = {
  listing: z.discriminatedUnion('kind', [MediaLicenseTermPerpetualSchema, MediaLicenseTermMandateSchema, MediaLicenseTermDateSchema]).meta(DISCRIMINATOR),
  catalog: z.discriminatedUnion('kind', [MediaLicenseTermPerpetualSchema, MediaLicenseTermDateSchema]).meta(DISCRIMINATOR),
} as const satisfies Record<MediaLicenseContext, z.ZodType>;

/** Οι διάρκειες του πλαισίου (ονομασμένη ένωση). */
export function mediaLicenseTermSchemaFor<C extends MediaLicenseContext>(context: C): (typeof TERM_UNION_OF)[C] {
  return TERM_UNION_OF[context];
}

function licenseSchema<C extends MediaLicenseContext>(context: C) {
  return z.object({ purpose: z.enum(MEDIA_LICENSE_CONTEXTS[context].purposes), term: TERM_UNION_OF[context] });
}

function rightsSchema<C extends MediaLicenseContext>(license: ReturnType<typeof licenseSchema<C>>) {
  return z.object({
    creator: MediaPartySchema,
    licensors: z.array(MediaPartySchema).max(MAX_MEDIA_LICENSORS),
    copyrightNotice: NonBlankText,
    webStatementOfRights: NonBlankText.nullable(),
    license,
  });
}

/**
 * 🔑 **Ένα στιγμιότυπο ανά πλαίσιο**, όχι νέο σε κάθε κλήση: ο γεννήτορας του OpenAPI αναγνωρίζει ονομασμένο σχήμα
 * από την **ταυτότητα** του αντικειμένου — το `license` μέσα στο `MediaRights` πρέπει να **είναι** το `MediaLicense`.
 */
const LICENSE_OF = { listing: licenseSchema('listing'), catalog: licenseSchema('catalog') } as const;
const RIGHTS_OF = { listing: rightsSchema(LICENSE_OF.listing), catalog: rightsSchema(LICENSE_OF.catalog) } as const;

/** Η άδεια του πλαισίου: σκοπός από τους σκοπούς **του πλαισίου** + διάρκεια του πλαισίου. */
export function mediaLicenseSchemaFor<C extends MediaLicenseContext>(context: C): (typeof LICENSE_OF)[C] {
  return LICENSE_OF[context];
}

/** Τα δικαιώματα ενός μέσου **σε αυτό το πλαίσιο** (IPTC `Creator` · `Licensor` 0–3 · `Copyright Notice` · άδεια). */
export function mediaRightsSchemaFor<C extends MediaLicenseContext>(context: C): (typeof RIGHTS_OF)[C] {
  return RIGHTS_OF[context];
}
