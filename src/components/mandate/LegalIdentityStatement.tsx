'use client';

/**
 * @fileoverview ⚖️ **«ΝΟΜΙΚΑ ΣΤΟΙΧΕΙΑ»** στη δημόσια βιτρίνα — επωνυμία · μορφή · ΓΕΜΗ · έδρα · βεβαίωση (ADR-841 §7 Α23 Φ4 Α2).
 * @related lib/agency/showcase-legal-presentation.ts · components/mandate/CredibilityStatement.tsx · AgencyFact
 * @module components/mandate/LegalIdentityStatement
 *
 * 🏆 ν. 4919/2022 άρθ. 22 §4 (αριθμός ΓΕΜΗ, νομική μορφή, επωνυμία, τόπος έδρας) · Π.Δ. 131/2003 άρθ. 4 — το «Impressum» των
 * μεγάλων (ImmoScout24). **Εξυπνότερα**: κάθε ένδειξη λέει **ποιος** το βεβαίωσε και **πότε** — «επαληθεύτηκαν από το ΓΕΜΗ ·
 * έλεγχος <ημ/νία>» ή «Δήλωση του ίδιου. Δεν την έχουμε ελέγξει.» — ποτέ σκέτα στοιχεία που φορούν στολή απόδειξης (Α9.1).
 *
 * 🔑 **Καμία δεύτερη πρόταση**: αριθμός (`CREDIBILITY_KEYS.claimNational`), «δηλωμένο» (`claimDeclared`) και «επαληθευμένο»
 * (η πρόταση της υποσελίδας του κατόχου) είναι υπάρχοντα κλειδιά. ⚠️ Εικονίδιο **και** κείμενο (CHECK 3.41), κανένα `text-primary` (3.38).
 */

import React from 'react';
import { BadgeCheck, IdCard } from 'lucide-react';

import { REGISTRY_AUTHORITY_PRESENTATION } from '@/constants/professional-registries';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { seatLineOf } from '@/lib/agency/showcase-legal-presentation';
import { formatLongDate } from '@/lib/intl-formatting';
import type { ShowcaseLegalIdentity } from '@/types/showcase-legal-identity';

import { AGENCY_PUBLIC_NS, CREDIBILITY_KEYS, LEGAL_FORM_KEYS, PROFILE_KEYS } from './agency-directory-labels';
import { Fact } from './AgencyFact';

function AttestationLine({ identity }: { readonly identity: ShowcaseLegalIdentity }): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const { attestation } = identity;
  if (attestation.state === 'verified') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-success))]">
        <BadgeCheck className="size-3.5 shrink-0" aria-hidden="true" />
        {t(PROFILE_KEYS.legalVerifiedOn, { date: formatLongDate(attestation.checkedAt) })}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <IdCard className="size-3.5 shrink-0" aria-hidden="true" />
      {t(CREDIBILITY_KEYS.claimDeclared)}
    </span>
  );
}

/** **Ποιος είναι στον νόμο** — μία γραμμή `Fact`, ώστε να διαβάζεται μαζί με «Έδρα» και «Επικοινωνία». */
export function LegalIdentityStatement({ identity }: { readonly identity: ShowcaseLegalIdentity }): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  return (
    <Fact label={t(PROFILE_KEYS.legalTitle)}>
      <span className="text-foreground">{identity.legalName}</span>
      {identity.legalForm === null ? null : <span>{t(LEGAL_FORM_KEYS[identity.legalForm])}</span>}
      {identity.gemiNumber === null ? null : (
        <span>
          {t(CREDIBILITY_KEYS.claimNational, {
            authority: t(REGISTRY_AUTHORITY_PRESENTATION.gemi.nameKey),
            number: identity.gemiNumber,
          })}
        </span>
      )}
      <span>{t(PROFILE_KEYS.legalSeat, { seat: seatLineOf(identity.seat) })}</span>
      <AttestationLine identity={identity} />
    </Fact>
  );
}
