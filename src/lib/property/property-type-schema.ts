/**
 * @fileoverview **ΤΟ ΕΙΔΟΣ ΑΚΙΝΗΤΟΥ ΣΤΟ ΣΥΝΟΡΟ ΤΟΥ ΔΙΚΤΥΟΥ** — ένα σχήμα zod, όσοι το δέχονται από αίτημα.
 * @related ADR-866 §2.8 (N.0.2) · constants/property-types.ts · ADR-777 §8.32
 * @module lib/property/property-type-schema
 *
 * 🔑 Ο τύπος `PropertyTypeCanonical` φυλάει τη **μεταγλώττιση**· αυτό φυλάει το **δίκτυο**, που δεν
 * μεταγλωττίζεται. Ήταν γραμμένο μέσα στο σχήμα της αγγελίας· ο φάκελος (ADR-866 Φ1.1) θα ήταν το
 * δεύτερο αντίγραφο — γι' αυτό ζει εδώ, πάνω στη **μία** λίστα `PROPERTY_TYPES`.
 *
 * ⚠️ Το `as unknown as [T, ...T[]]` δεν είναι παράκαμψη: το `z.enum` ζητά **μη κενή** πλειάδα, ενώ το
 * `as const` δίνει `readonly` πίνακα — η λίστα είναι μη κενή εκ κατασκευής.
 *
 * **Layering**: leaf — zod + σταθερές, καμία εξάρτηση από Firestore ή React.
 */

import { z } from 'zod';

import { PROPERTY_TYPES, type PropertyTypeCanonical } from '@/constants/property-types';

/** Το κλειστό σύνολο των **κανονικών** ειδών — ό,τι άλλο στέλνει ο πελάτης απορρίπτεται. */
export const propertyTypeSchema = z.enum(
  PROPERTY_TYPES as unknown as [PropertyTypeCanonical, ...PropertyTypeCanonical[]],
);
