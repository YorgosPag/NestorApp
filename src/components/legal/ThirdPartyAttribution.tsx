'use client';

/**
 * @fileoverview ⚖️ **Η ΑΠΟΔΟΣΗ ΤΩΝ ΑΔΕΙΩΝ ΠΟΥ ΒΛΕΠΕΙ Ο ΑΝΘΡΩΠΟΣ** (ADR-863 Φ3).
 * @related app/(app)/open-source/page.tsx · components/legal/ThirdPartyComponentTable.tsx ·
 *   scripts/generate-third-party-notices.js (τα τρία παραδοτέα)
 * @module components/legal/ThirdPartyAttribution
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΕΙΝΑΙ ΥΠΟΧΡΕΩΣΗ ΚΑΙ ΤΙ ΕΙΝΑΙ ΕΥΚΟΛΙΑ — Η ΓΡΑΜΜΗ ΕΙΝΑΙ ΦΕΡΟΥΣΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Οι άδειες NOTICE (MIT: *«in all copies or substantial portions»* · Apache-2.0 §4(α):
 * *«a copy of this License»*) απαιτούν το **κείμενο** να συνοδεύει το αντίγραφο. Το
 * κείμενο είναι το `/third-party/THIRD_PARTY_NOTICES.txt`, σερβιρισμένο από το **ίδιο
 * origin**, χωρίς λογαριασμό και **χωρίς JavaScript** — γι' αυτό ο σύνδεσμός του
 * αποδίδεται **εδώ, στο SSR**, πριν φορτώσει οτιδήποτε άλλο.
 *
 * Ο **κατάλογος** από κάτω είναι ευκολία ανάγνωσης: έρχεται τεμπέλικα, και αν δεν έρθει
 * ποτέ η συμμόρφωση **δεν κουνιέται**.
 *
 * 🏆 **ΤΟ ΣΚΑΛΙ ΠΑΝΩ ΑΠΟ ΤΟΥΣ ΜΕΤΡΗΜΕΝΟΥΣ**: Figma · Slack · Chromium · VS Code ·
 * Graphisoft δημοσιεύουν **μόνο** κείμενο για ανθρώπους. Εδώ το ίδιο γεγονός βγαίνει
 * **και** ως SBOM σε well-known διεύθυνση (RFC 9472), από την **ίδια** κρίση και με το
 * **ίδιο** αποτύπωμα — άρα τα δύο δεν μπορούν να αποκλίνουν.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ThirdPartyComponentTable } from '@/components/legal/ThirdPartyComponentTable';

/**
 * ⚠️ **ΚΥΡΙΟΛΕΚΤΙΚΟ NAMESPACE, ΟΧΙ ΣΤΑΘΕΡΑ** — δες τον γραμμένο λόγο στο
 * {@link module:components/legal/ThirdPartyComponentTable}: η `extractNamespaces`
 * αγνοεί σκέτο όνομα που δεν είναι δηλωμένο bundle, και η κληρονομιά κάνει **ένα**
 * άλμα μόνο. Αυτό το αρχείο είναι ο **ενδιάμεσος** κρίκος της αλυσίδας — αν έμενε
 * αδήλωτο, θα έκοβε την κληρονομιά για το παιδί του.
 */

/**
 * **Οι δύο σύνδεσμοι, και γιατί είναι ωμά `<a>`.**
 *
 * ⚠️ Δείχνουν σε **αρχεία** του `public/`, όχι σε διαδρομές της εφαρμογής: δεν υπάρχει
 * `page.tsx` πίσω τους, δεν παίρνουν ποτέ πρόθεμα χώρου, και μια πλοήγηση του Next θα
 * ήταν λάθος εργαλείο (δεν υπάρχει τίποτα να προφορτωθεί). Το σύνορο πλοήγησης
 * (CHECK 3.61) κρίνει **εισαγωγές** από `next/link` — εδώ δεν υπάρχει καμία.
 */
const ARTIFACTS = [
  { href: '/third-party/THIRD_PARTY_NOTICES.txt', label: 'openSource.fullText', hint: 'openSource.fullTextHint' },
  { href: '/.well-known/sbom', label: 'openSource.sbom', hint: 'openSource.sbomHint' },
] as const;

function ArtifactLinks(): React.JSX.Element {
  const { t } = useTranslation('legal');
  return (
    <ul>
      {ARTIFACTS.map((artifact) => (
        <li key={artifact.href}>
          <a
            href={artifact.href}
            className="text-foreground underline underline-offset-4"
            // ⚠️ Νέα καρτέλα: το κείμενο των αδειών είναι **έγγραφο αναφοράς** — ο
            //    αναγνώστης το ανοίγει δίπλα στη σελίδα, δεν την εγκαταλείπει.
            target="_blank"
            rel="noopener noreferrer"
          >
            {t(artifact.label)}
          </a>{' '}
          <span className="text-xs">{t(artifact.hint)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Η απόδοση: **πρώτα η υποχρέωση** (κείμενο + σύνδεσμοι, στο πρώτο καρέ), **μετά** ο
 * κατάλογος.
 *
 * ⚠️ Η σειρά **δεν** είναι αισθητική. Αν κάτι πάει στραβά με τον κατάλογο — αποτυχία
 * δικτύου, χαλασμένο αρχείο, κλειστό JavaScript — ό,τι απαιτεί η άδεια έχει **ήδη**
 * αποδοθεί από πάνω.
 */
export function ThirdPartyAttribution(): React.JSX.Element {
  const { t } = useTranslation('legal');
  return (
    <section>
      <p>{t('openSource.obligation')}</p>
      <ArtifactLinks />
      <ThirdPartyComponentTable />
    </section>
  );
}
