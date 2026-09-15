'use client';

/**
 * @fileoverview **Η ΠΟΡΤΑ ΠΡΟΣ ΤΑ «ΣΤΟΙΧΕΙΑ ΓΕΜΗ»** — και λέει **πού στέκεται** ο οργανισμός (ADR-841 §7 Α23.9 Φέτα Β).
 * @related components/mandate/ShowcaseRegistryContent.tsx · lib/agency/registry-standing.ts
 * @module components/mandate/ShowcaseRegistryDoor
 *
 * 🔑 **Γιατί υποσελίδα** — ίδιος λόγος με την κάρτα (`ShowcaseCardDoor`): Google Business Profile και Stripe κρατούν
 * κάθε ενότητα στοιχείων επιχείρησης σε δική της οθόνη, και η σφράγιση του route slice της βιτρίνας ορίζει γραπτά
 * ότι η επόμενη αύξηση λύνεται με δεύτερη διαδρομή (μετρημένο 2026-09-15: 17.162 / 18.170 bytes).
 *
 * 🏆 **Εξυπνότερα από απλή πόρτα**: η γραμμή κάτω από τον τίτλο είναι η **κατάσταση** — «κλειστή στο ΓΕΜΗ»
 * (μόνιμη, όπως η ετικέτα του GBP) · «επαληθεύτηκε <ημ/νία>» · «χρειάζεται ενέργεια». Ο διαχειριστής βλέπει το
 * πρόβλημα **χωρίς** να ανοίξει την υποσελίδα.
 *
 * ⚠️ **Πάντα ορατή, και με μη δημοσιευμένη βιτρίνα**: η επαλήθευση προηγείται της δημοσίευσης (το μήνυμα άρνησης
 * `agency-profile-title-not-in-registry` στέλνει τον άνθρωπο στο «Επαλήθευση από ΓΕΜΗ»).
 */

import React from 'react';
import { Landmark } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCompanyRegistryIdentity } from '@/hooks/company/useCompanyRegistryIdentity';
import { formatLongDate } from '@/lib/intl-formatting';
import { registryStandingOf, standingCheckedAt } from '@/lib/agency/registry-standing';
import { registryClosureOf } from '@/lib/agency/showcase-registry-closure';
import { AGENCY_SHOWCASE_REGISTRY_ROUTE } from '@/lib/mandate/mandate-routes';
import type { PublicShowcase } from '@/types/agency-profile';
import { SHOWCASE_NS } from '@/components/mandate/agency-showcase-labels';
import {
  SHOWCASE_REGISTRY_DOOR_KEYS,
  SHOWCASE_REGISTRY_KEYS,
} from '@/components/mandate/agency-showcase-registry-labels';
import { ShowcaseDoorLink } from '@/components/mandate/ShowcaseDoorLink';

export function ShowcaseRegistryDoor({ published }: { readonly published: PublicShowcase | null }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const { state } = useCompanyRegistryIdentity();
  const standing = registryStandingOf(
    published === null ? null : registryClosureOf(published),
    state.kind === 'ready' ? state.report : null,
  );
  const checkedAt = standingCheckedAt(standing);

  return (
    <ShowcaseDoorLink
      href={AGENCY_SHOWCASE_REGISTRY_ROUTE}
      icon={Landmark}
      title={t(SHOWCASE_REGISTRY_KEYS.door)}
      detail={t(SHOWCASE_REGISTRY_DOOR_KEYS[standing.kind], checkedAt === null ? undefined : { date: formatLongDate(checkedAt) })}
      tone={standing.kind === 'closed' || standing.kind === 'attention' ? 'alert' : 'neutral'}
      detailTestId="showcase-registry-door-status"
    />
  );
}
