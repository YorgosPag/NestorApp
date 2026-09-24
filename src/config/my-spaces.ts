/**
 * **ΟΙ ΧΩΡΟΙ ΤΟΥ ΑΝΘΡΩΠΟΥ** — ποιοι είναι, μία φορά.
 *
 * @related ADR-820 §5.1 (η πόρτα) · §5.4 (η λωρίδα της αρχικής) · ADR-819 §8 (`/home`)
 * @module config/my-spaces
 *
 * 🔑 **Δύο καταναλωτές, ΜΙΑ απάντηση.** Το μενού του avatar (`MySpacesSection`) και η
 * λωρίδα «Οι χώροι μου» της αρχικής (`LandingMySpaces`) ρωτούν το ίδιο ερώτημα —
 * *«ποιους χώρους έχει αυτός ο άνθρωπος;»*. Γραμμένο δύο φορές θα απέκλινε ακριβώς
 * εκεί όπου η απάντηση δεν είναι προφανής (κενή συμβολοσειρά `companyId`) — ADR-749.
 *
 * ⚠️ **Ο κριτής είναι το {@link hasOrganization}, ΠΟΤΕ ωμό `user?.companyId`.**
 *
 * ⚠️ **Ο προσωπικός είναι ΠΑΝΤΑ πρώτος και ΠΑΝΤΑ παρών** — είναι το μοντέλο, όχι σειρά
 * εμφάνισης: *«ο άνθρωπος έχει πάντα προσωπικό χώρο και ίσως εταιρικό»* (ADR-820 §4).
 *
 * 🔴 **Ο εταιρικός δείχνει στο `/home`, ΠΟΤΕ σε κατασκευασμένο `/o/<ψευδώνυμο>/…`** —
 * άγκυρα Λ2 (ADR-787): το ψευδώνυμο το λύνει **μόνο ο διακομιστής**, και αν το claim
 * έχει ανακληθεί στέλνει τον άνθρωπο στον **προσωπικό** του χώρο. Ποτέ σε ξένο γραφείο.
 */

import type { LucideIcon } from 'lucide-react';
import { Building2, UserRound } from 'lucide-react';

import { hasOrganization, PRIVATE_SPACE_HOME } from '@/lib/routes/landing';
import type { WorkspaceHref } from '@/lib/workspace/route-worlds';
import { HOME_REDIRECT_ROUTE } from '@/lib/workspace/workspace-routes';

export type SpaceId = 'personal' | 'organization';

/** Μία εγγραφή του κλειστού συνόλου — μία ή δύο, ποτέ τρεις. */
export interface SpaceEntry {
  readonly id: SpaceId;
  readonly href: WorkspaceHref;
  readonly Icon: LucideIcon;
}

const PERSONAL_SPACE: SpaceEntry = {
  id: 'personal',
  href: PRIVATE_SPACE_HOME,
  Icon: UserRound,
};

const ORGANIZATION_SPACE: SpaceEntry = {
  id: 'organization',
  href: HOME_REDIRECT_ROUTE,
  Icon: Building2,
};

/** **Οι χώροι αυτού του ανθρώπου**, με τη σειρά του μοντέλου. */
export function spacesFor(companyId: string | null | undefined): readonly SpaceEntry[] {
  return hasOrganization({ companyId }) ? [PERSONAL_SPACE, ORGANIZATION_SPACE] : [PERSONAL_SPACE];
}
