'use client';

/**
 * **ΟΙ ΧΩΡΟΙ ΜΟΥ ΣΤΗΝ ΑΡΧΙΚΗ** — η λωρίδα πάνω από τον ήρωα, μόνο για συνδεδεμένους.
 *
 * @related ADR-820 §5.4 · ADR-777 (οθόνη 1) · ADR-867 §4.5 (σήμα αδιάβαστων)
 * @module components/search/LandingMySpaces
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 * Η `/` είναι η δημόσια βιτρίνα — σωστά. Όμως ο επαγγελματίας που μπαίνει κάθε πρωί για
 * να **δουλέψει** έβρισκε τον χώρο του γραφείου του **μόνο** μέσα στο μενού του avatar.
 * Δηλαδή το πιο συχνό ταξίδι του ήταν κρυμμένο πίσω από ένα αναδυόμενο μενού.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Η ΠΡΑΚΤΙΚΗ — ΚΑΙ ΠΟΥ ΤΗΝ ΞΕΠΕΡΝΑΜΕ
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ **ΟΧΙ πύλη επιλογής («πού θέλεις να πας;»)** με δύο ισότιμα μπάνερ: το splash
 * page προσθέτει ένα κλικ σε **όλους**, κάθε φορά, και σπάει SEO + κοινοποιημένους
 * συνδέσμους. Κανείς από τους μεγάλους δεν το κάνει.
 * ✅ **Airbnb**: η αρχική μένει του επισκέπτη, και ο οικοδεσπότης έχει **ένα** κλικ προς
 * τον χώρο του. **Figma / Notion**: ο συνδεδεμένος βλέπει πρώτα τη δουλειά του.
 * 🏆 **Εδώ**: ο επισκέπτης δεν βλέπει **τίποτα** από αυτή τη λωρίδα (η `/` μένει
 * βιτρίνα)· ο συνδεδεμένος βλέπει τους χώρους του **με ζωντανό σήμα**, όχι στατικό
 * κουμπί — και όποιος δεν έχει γραφείο βλέπει την πόρτα για να **ανοίξει** ένα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΔΗΛΩΜΕΝΑ ΟΡΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 * - **Μόνο ΕΝΑ ζωντανό σήμα: τα αδιάβαστα μηνύματα** (`network-unread`, η ΙΔΙΑ πηγή με
 *   τη στήλη και το μενού avatar). Για «ζητήσεις που ταιριάζουν» / «αγγελίες σε αναμονή»
 *   **δεν υπάρχει** πηγή στον πελάτη — αριθμός χωρίς πηγή θα ήταν ψέμα (ADR-820 §8).
 * - **Καμία ονομασία γραφείου** — ο μόνος πελατικός φορέας ονόματος είναι πάντα κενός
 *   (ADR-820 §8 #1).
 * - Κατά τη φόρτωση της ταυτότητας δεν αποδίδεται **τίποτα**: λωρίδα που αναβοσβήνει
 *   «χωρίς γραφείο» σε άνθρωπο **με** γραφείο θα ήταν ψευδής ισχυρισμός.
 */

import React from 'react';
import { Building2, MessagesSquare } from 'lucide-react';

import { useAuthOptional } from '@/auth';
import { MenuCountBadge } from '@/components/sidebar/menu-count-badge';
import { spacesFor, type SpaceId } from '@/config/my-spaces';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { MY_MESSAGES_ROUTE } from '@/lib/network-messaging/network-messaging-routes';
import { CREATE_WORKSPACE_ROUTE } from '@/lib/workspace/workspace-routes';
import { DoorCard } from './LandingDoors';

const HEADING_ID = 'landing-my-spaces-heading';

/**
 * ⚠️ **ΚΥΡΙΟΛΕΚΤΙΚΑ κλειδιά, ΟΧΙ `${id}`** — ο γεννήτορας του i18n slice (CHECK 3.34)
 * **αρνείται** ανεπίλυτη δυναμική `t()`. Και τα κλειδιά ζουν στο `common-account`,
 * **ΟΧΙ** στο `search-results`: εκείνο ταξιδεύει ΟΛΟΚΛΗΡΟ σε κάθε σελίδα με ταβάνι
 * σε bytes· εδώ τα πληρώνει μόνο το route slice της `/`.
 */
const SPACE_TEXT: Readonly<Record<SpaceId, { readonly label: string; readonly hint: string }>> = {
  personal: {
    label: 'common-account:userMenu.spaces.personal',
    hint: 'common-account:userMenu.spaces.hint.personal',
  },
  organization: {
    label: 'common-account:userMenu.spaces.organization',
    hint: 'common-account:userMenu.spaces.hint.organization',
  },
};

export function LandingMySpaces(): React.ReactElement | null {
  const { t } = useTranslation(['common-account', 'navigation']);
  // ⚠️ `useAuthOptional`: η `/` είναι ΔΗΜΟΣΙΑ επιφάνεια — χωρίς πάροχο ταυτότητας
  // (π.χ. απομονωμένη απόδοση) η απάντηση είναι «κανείς συνδεδεμένος», όχι σφάλμα.
  const auth = useAuthOptional();
  const user = auth?.user ?? null;

  if (auth?.loading || !user) return null;

  const spaces = spacesFor(user.companyId);
  const hasOffice = spaces.some((space) => space.id === 'organization');

  return (
    <nav
      aria-labelledby={HEADING_ID}
      // Όλο το πλάτος, στοιχισμένο με τον ήρωα από κάτω (ADR-820 §5.4 · ADR-777 §8.79):
      // στο μέτρο της πρόζας οι κάρτες έσπαγαν τον υπότιτλο σε 3-4 γραμμές.
      data-shell-span="full"
      className="flex flex-col gap-2"
    >
      <h2 id={HEADING_ID} className="text-sm font-medium text-muted-foreground">
        {t('common-account:userMenu.spaces.label')}
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-3">
        {spaces.map(({ id, href, Icon }) => (
          <DoorCard
            key={id}
            href={href}
            icon={Icon}
            label={t(SPACE_TEXT[id].label)}
            hint={t(SPACE_TEXT[id].hint)}
            density="compact"
          />
        ))}
        {!hasOffice && (
          <DoorCard
            href={CREATE_WORKSPACE_ROUTE}
            icon={Building2}
            label={t('navigation:personal.items.createWorkspace')}
            hint={t('common-account:userMenu.spaces.hint.createWorkspace')}
            density="compact"
          />
        )}
        <DoorCard
          href={MY_MESSAGES_ROUTE}
          icon={MessagesSquare}
          label={t('navigation:personal.items.myMessages')}
          hint={t('common-account:userMenu.spaces.hint.messages')}
          density="compact"
          signal={<MenuCountBadge source="network-unread" placement="inline-end" />}
        />
      </ul>
    </nav>
  );
}
