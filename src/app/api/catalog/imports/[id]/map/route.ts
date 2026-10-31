/**
 * POST /api/catalog/imports/[id]/map — το αρχείο περνά από το προφίλ και γίνεται προτάσεις (ADR-923 §5.5). Καμία εγγραφή δεδομένων.
 * Auth: `catalog:products:manage` · Rate: sensitive (διαβάζει ολόκληρο αρχείο) · ιδεμποτία μέσω `withAuth`.
 */

import 'server-only';

import { z } from 'zod';

import { buildTableProposals } from '@/server/catalog/import-readers.server';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'SENSITIVE', authority: 'products' }, z.object({}), (auth, id) => buildTableProposals(auth, id));
