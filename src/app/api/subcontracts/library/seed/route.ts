/**
 * POST /api/subcontracts/library/seed — σπορά της **προεπιλεγμένης βιβλιοθήκης** στον χώρο (ADR-928 Φ1 απόφαση 5).
 * Ιδεμποτική: ρήτρες που λείπουν γράφονται ως προτάσεις προς έγκριση· πρότυπα όσα περνούν τον έλεγχο της βιβλιοθήκης,
 * τα υπόλοιπα επιστρέφονται ως εκκρεμή. Auth: `subcontracts:clauses:manage` **και** `subcontracts:templates:manage` ·
 * Rate: sensitive (γράφει δεκάδες έγγραφα) · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { z } from 'zod';

import { seedDefaultSubcontractLibrary } from '@/server/subcontracts/default-library-seed.server';
import { subcontractWriteRoute } from '../../_shared/subcontract-route';

const seedBodySchema = z.object({}).strict();

export const POST = subcontractWriteRoute({ category: 'SENSITIVE', authority: 'seed' }, seedBodySchema, (auth) => seedDefaultSubcontractLibrary(auth));
