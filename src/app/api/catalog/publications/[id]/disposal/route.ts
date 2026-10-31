/**
 * POST /api/catalog/publications/[id]/disposal — σβήνει τα PDF μιας έκδοσης που δεν κατέβηκε ποτέ (ADR-923 §5.6.1).
 * Η εγγραφή, το sha256 και το ιστορικό μένουν. Auth: `catalog:pricing:manage` · Rate: sensitive, γιατί σβήνει bytes.
 */

import 'server-only';

import { deletePublicationPdf } from '@/server/catalog/publishing/publication-retention.server';
import { publicationDisposalBodySchema } from '@/subapps/catalog/schema/zod/publication.schema';
import { catalogEntityRoute } from '../../../_shared/catalog-route';

export const POST = catalogEntityRoute({ category: 'SENSITIVE', authority: 'pricing' }, publicationDisposalBodySchema, (auth, id) => deletePublicationPdf(auth, id));
