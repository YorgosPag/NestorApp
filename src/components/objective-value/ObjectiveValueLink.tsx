'use client';

/**
 * **Ο σύνδεσμος προς τον δημόσιο υπολογιστή αντικειμενικής αξίας** (ADR-898 Φ2) — ΕΝΑ component για τις τρεις
 * πόρτες: τη ζώνη της αγγελίας, τη σελίδα περιοχής και το υποσέλιδο του δημόσιου κελύφους.
 *
 * 🔑 **Το κείμενο ζει στο `navigation`** (namespace του κελύφους), όχι στο `objective-value`: έτσι οι τρεις πόρτες
 * δεν κατεβάζουν το namespace του υπολογιστή, και το υποσέλιδο δεν βάφει ωμό κλειδί στο SSR (CHECK 3.51).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { objectiveValueHref } from '@/lib/listings/listing-routes';
import { VISIBLE_LINK_CLASS } from '@/lib/ui/link-style';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';

interface ObjectiveValueLinkProps {
  readonly className?: string;
  /** Προσυμπλήρωση από αγγελία (ADR-898 Φ3) — ο υπολογιστής ανοίγει με ό,τι ξέρει η αγγελία. */
  readonly prefillQuery?: string;
  /** Κείμενο του καλούντος· χωρίς αυτό, το γενικό «υπολογιστής αντικειμενικής αξίας» του κελύφους. */
  readonly children?: React.ReactNode;
}

export function ObjectiveValueLink({ className, prefillQuery, children }: ObjectiveValueLinkProps): React.ReactElement {
  const { t } = useTranslation('navigation');
  return (
    <Link href={objectiveValueHref(prefillQuery)} className={cn(VISIBLE_LINK_CLASS, className)}>
      {children ?? t('tools.objectiveValue')}
    </Link>
  );
}
