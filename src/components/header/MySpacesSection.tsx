'use client';

/**
 * @fileoverview **ΟΙ ΧΩΡΟΙ ΜΟΥ** — η μία πόρτα ανάμεσα στον προσωπικό και τον εταιρικό κόσμο.
 * @related ADR-820 §5.1 · ADR-819 §8 (`/home`) · ADR-809 (CHECK 3.72) · ADR-787 άγκυρα Λ2
 * @module components/header/MySpacesSection
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΜΕΤΡΗΜΕΝΟ ΚΕΝΟ, ΚΑΙ ΗΤΑΝ **ΣΥΜΜΕΤΡΙΚΟ** (ADR-820 §2.3)
 * ────────────────────────────────────────────────────────────────────────────
 * Οι **8** καταναλωτές των `MY_OFFERS_ROUTE` / `MY_DEMANDS_ROUTE` ζούσαν **όλοι**
 * μέσα στον κόσμο του ιδιώτη *(`components/demand` · `owner-property` ·
 * `public-site` · `search`)*. **ΜΗΔΕΝ** σε `app-sidebar` · `app-header` ·
 * `smart-navigation-factory` · `ShellUtilities` · `user-menu`.
 *
 * Και το ανάποδο ήταν εξίσου κενό: ο `PublicSiteHeader` — η κεφαλίδα **και** του
 * `(me)` **και** του `(light)` — δεν είχε **καμία** πόρτα προς το γραφείο. Ο
 * υπάλληλος που περιηγιόταν στις δημόσιες αγγελίες γύριζε πίσω **με το χέρι στη
 * γραμμή διεύθυνσης**.
 *
 * ⇒ Το κενό δεν ήταν «λείπει σύνδεσμος στο sidebar»· ήταν ότι **οι δύο κόσμοι δεν
 * γνωρίζονταν, σε καμία κατεύθυνση**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΔΩ — ΤΡΕΙΣ ΑΝΕΞΑΡΤΗΤΟΙ ΛΟΓΟΙ (ADR-820 §5.1)
 * ────────────────────────────────────────────────────────────────────────────
 * 1. **Το `UserMenu` είναι το ΜΟΝΟ σημείο που αποδίδεται και στους πέντε κόσμους**
 *    — το ζωγραφίζει το `ShellUtilities` *(ADR-809 / CHECK 3.72)* σε `(app)` ·
 *    `(auth)` · `(light)` · `(me)` · `(bare)`. **Μία ένθεση, και οι δύο
 *    κατευθύνσεις.** Το sidebar ζει **μόνο** στο `(app)/layout.tsx` *(CHECK 3.52
 *    Κ3)*, άρα θα έλυνε τη μισή συμμετρία και θα ζητούσε **δεύτερη** ένθεση αλλού
 *    — δηλαδή δίδυμο.
 * 2. **Είναι η πρακτική των μεγάλων**: ο context switcher του GitHub ζει στο μενού
 *    της φωτογραφίας προφίλ. Και το ίδιο το `user-menu.tsx` το έχει ήδη γράψει για
 *    τον `DeclaredOccupationBadge`: *«η ταυτότητα ζει δίπλα στο avatar· στην
 *    κεφαλίδα θα ήταν ένατο στοιχείο σε σειρά που έχει ήδη οκτώ»*. **Ο χώρος είναι
 *    ταυτότητα, όχι εργαλείο.**
 * 3. **Το sidebar δεν το δέχεται καθαρά**: το δέντρο του περνά από φίλτρο
 *    δικαιωμάτων **εμβέλειας εταιρείας** — ακριβώς ο φρουρός που το
 *    `api/owner-properties/route.ts` απορρίπτει ρητά ως *«φρουρός που κανείς από το
 *    ακροατήριό του δεν μπορεί να ικανοποιήσει»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΣΥΜΜΕΤΡΙΑ ΤΩΝ ΔΥΟ ΔΙΕΥΘΥΝΣΕΩΝ ΕΙΝΑΙ **ΑΝΑΓΚΑΣΜΕΝΗ**
 * ────────────────────────────────────────────────────────────────────────────
 * Ο προσωπικός χώρος έχει **σταθερή** διεύθυνση *({@link PRIVATE_SPACE_HOME})*.
 * Ο εταιρικός περιέχει **ψευδώνυμο** — και το ψευδώνυμο **επιτρέπεται να το λύσει
 * μόνο ο διακομιστής**. Το απαγορεύει η **άγκυρα Λ2** *(ADR-787)*: *«ο πελάτης
 * μάντευε τον χώρο· ο διακομιστής τον επαληθεύει. Claim που ανακλήθηκε δίνει
 * σύνδεσμο προς γραφείο όπου δεν είσαι μέλος.»* Ο `workspaceSegmentFor` είναι
 * `server-only`, δηλαδή η μαντεψιά **δεν χτίζει καν**.
 *
 * 🔑 **Το `/home` ΔΕΝ είναι έμμεση διαδρομή — είναι ανάθεση στη ΜΙΑ αυθεντία, και
 * είναι fail-safe**: αν το claim έχει ανακληθεί, το `app/home/route.ts` ξαναδιαβάζει
 * την ταυτότητα από το **cookie** και στέλνει τον άνθρωπο στον **προσωπικό** του
 * χώρο. Ο πελάτης κρίνει **αν** θα δείξει την πόρτα· ο διακομιστής **πού βγάζει**.
 * Ποτέ σε ξένο γραφείο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ Η ΛΥΣΗ ΠΟΥ ΑΠΟΡΡΙΦΘΗΚΕ: `DropdownMenuRadioGroup`
 * ────────────────────────────────────────────────────────────────────────────
 * Το Radix προσφέρει `menuitemradio` — σημασιολογικά *«διάλεξε ενεργό context»*, με
 * έτοιμο ✓ και σωστό `aria-checked`. **Απορρίφθηκε**: το radio υπόσχεται
 * **αποθηκευμένη επιλογή**, και **δεν υπάρχει** — ο ενεργός χώρος καθορίζεται από τη
 * **διεύθυνση** *(ADR-787 §5.1α: η συλλογή `workspaces` **ΔΕΝ ΥΠΑΡΧΕΙ**, το
 * `listWorkspaces` επιστρέφει **πάντα** κενό)*. Είναι **πλοήγηση**, όχι κατάσταση.
 * Και ως σύνδεσμοι κερδίζουν το άνοιγμα σε **νέα καρτέλα** — εδώ πραγματική ανάγκη:
 * ο υπάλληλος θέλει τους δύο χώρους **δίπλα-δίπλα**.
 *
 * ⚠️ **Ο τρέχων ΠΑΡΑΜΕΝΕΙ σύνδεσμος.** Από το `/o/x/contacts/123` το πάτημα του
 * εταιρικού πάει στον πίνακα ελέγχου — **χρήσιμο**. Ανενεργός τρέχων θα ήταν το
 * *«Επιστροφή στη σύνδεση» σε ήδη συνδεδεμένο* *(ADR-819 §8)* σε νέα θέση.
 *
 * ⚠️ **`aria-current="true"` και ΟΧΙ `"page"`**: ο σύνδεσμος δείχνει στην **αρχική
 * του χώρου**, όχι στην τρέχουσα σελίδα. Το `"page"` θα ήταν ψευδής ισχυρισμός.
 *
 * 🔶 **Δηλωμένο όριο — καμία ονομασία γραφείου.** Ο μόνος πελατικός φορέας ονόματος
 * είναι το `WorkspaceContext.activeWorkspace?.displayName`, και το ADR-787 §5.1α
 * **μέτρησε** ότι η συλλογή του δεν υπάρχει ⇒ η τιμή είναι **πάντα** `undefined`.
 * Ετικέτα από εκεί θα ήταν **κενή ετικέτα που δείχνει γεμάτη** — το σχήμα «πράσινο
 * επειδή κανείς δεν κοίταξε» (N.12).
 */

import React from 'react';
import { Building2, Check, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// 🔴 **`@/auth` ΚΑΙ ΟΧΙ `@/auth/hooks/useAuth` — ΤΟ ΒΡΗΚΕ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ, ΟΧΙ Η ΚΡΙΣΗ.**
//    Η πρώτη γραφή εισήγαγε **βαθιά**, και **έσπασε υπάρχουσα άγκυρα**: το
//    `shell-utilities-identity.test.tsx` (ADR-809) υποκαθιστά τη **ρίζα** `@/auth` —
//    όπως ακριβώς την εισάγει ο μοναδικός καταναλωτής αυτού του αρχείου, το
//    `user-menu.tsx`. Δύο διαφορετικά μονοπάτια προς το ΙΔΙΟ hook είναι δύο
//    **διαφορετικά module** για τον Jest: η υποκατάσταση δεν έπιανε, το πραγματικό
//    `AuthContext` φορτωνόταν, και μαζί του το `firebase/auth` σε ESM που η σουίτα
//    δεν μεταγλωττίζει ⇒ **ολόκληρη η άγκυρα δεν φορτωνόταν καν**.
//    ⛔ **ΜΗΝ το ξαναβαθύνεις.** Η ένωση γίνεται από τη ρίζα, όπως ο γείτονας.
import { useAuth } from '@/auth';
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link, usePathname } from '@/lib/workspace/navigation';
import type { WorkspaceHref } from '@/lib/workspace/route-worlds';
import { hasOrganization, PRIVATE_SPACE_HOME } from '@/lib/routes/landing';
import { HOME_REDIRECT_ROUTE } from '@/lib/workspace/workspace-routes';
import { isInsideWorkspace } from '@/lib/workspace/workspace-scope';

const K = 'common-account:userMenu.spaces';

/**
 * Μία εγγραφή του κλειστού συνόλου.
 *
 * ⚠️ **Πίνακας και όχι δύο γραμμένα `DropdownMenuItem`**: οι δύο σειρές διαφέρουν σε
 * **τρία** πράγματα *(εικονίδιο · κλειδί · διεύθυνση)* και συμφωνούν σε όλα τα
 * υπόλοιπα. Γραμμένες δύο φορές θα ήταν **δίδυμο** — ακριβώς ό,τι πιάνει το
 * `jscpd:diff` **μέσα στο ίδιο diff** (N.18 / CHECK 3.28).
 */
interface SpaceEntry {
  readonly id: 'personal' | 'organization';
  readonly href: WorkspaceHref;
  readonly Icon: LucideIcon;
}

/**
 * **Οι χώροι αυτού του ανθρώπου** — μία εγγραφή ή δύο, ποτέ τρεις.
 *
 * 🔑 **Ο κριτής είναι το {@link hasOrganization}, ΠΟΤΕ ωμό `user?.companyId`.** Το
 * ερώτημα *«ανήκω σε οργανισμό;»* το κατέχει το `lib/routes/landing.ts` (παγωμένο)
 * και χειρίζεται **ρητά την κενή συμβολοσειρά** — μια δεύτερη γραφή εδώ θα ήταν
 * ADR-749, και θα απέκλινε ακριβώς εκεί όπου η απάντηση δεν είναι προφανής.
 *
 * ⚠️ **Ο προσωπικός είναι ΠΑΝΤΑ πρώτος και ΠΑΝΤΑ παρών** — δεν είναι σειρά
 * εμφάνισης, είναι το μοντέλο: *«ο άνθρωπος έχει πάντα προσωπικό χώρο και ίσως
 * εταιρικό»* (ADR-820 §4). Το ίδιο λέει το `workspace-membership.ts` με την
 * ετυμηγορία `self`: *«υπάρχει ΠΑΝΤΑ, ΔΕΝ αποθηκεύεται»*.
 */
function spacesFor(companyId: string | null | undefined): readonly SpaceEntry[] {
  const personal: SpaceEntry = {
    id: 'personal',
    href: PRIVATE_SPACE_HOME,
    Icon: UserRound,
  };

  if (!hasOrganization({ companyId })) return [personal];

  return [
    personal,
    {
      id: 'organization',
      // 🔴 ΟΧΙ κατασκευασμένο `/o/<ψευδώνυμο>/…` — άγκυρα Λ2. Ο διακομιστής λύνει.
      href: HOME_REDIRECT_ROUTE,
      Icon: Building2,
    },
  ];
}

/**
 * **Ποιος χώρος είναι ο τρέχων.**
 *
 * 🔑 **Καμία νέα κρίση**: το `usePathname` του συνόρου **αφαιρεί ήδη** το πρόθεμα
 * *(`navigation.tsx`)*, και το `isInsideWorkspace` είναι ο **υπάρχων** κριτής χρόνου
 * εκτέλεσης πάνω στο **υπάρχον** κλειστό σύνολο *(`workspace-scope.ts`)*.
 *
 * ⚠️ **Εκτός χώρου ⇒ «προσωπικός», και ΠΕΡΙΛΑΜΒΑΝΕΙ τις δημόσιες οθόνες** — και
 * είναι σωστό, όχι παράλειψη: ο `PrivateSpaceShell` το έχει ήδη γράψει, *«ο ιδιώτης
 * που πέρασε από την αρχική στη ζήτησή του **δεν άλλαξε ιστότοπο**»*. Ο δημόσιος
 * κόσμος φοράει την **ίδια** κεφαλίδα με τον προσωπικό.
 */
function currentSpaceId(pathname: string): SpaceEntry['id'] {
  return isInsideWorkspace(pathname) ? 'organization' : 'personal';
}

export function MySpacesSection(): React.ReactElement {
  const { t } = useTranslation(['common-account']);
  const { user } = useAuth();
  const pathname = usePathname();
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();

  const spaces = spacesFor(user?.companyId);
  const current = currentSpaceId(pathname);

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {t(`${K}.label`)}
      </DropdownMenuLabel>

      {spaces.map(({ id, href, Icon }) => {
        const isCurrent = id === current;

        return (
          <DropdownMenuItem key={id} asChild className={layout.cursorPointer}>
            {/*
              🔑 **`asChild` + ο `Link` ΤΟΥ ΣΥΝΟΡΟΥ**, ποτέ `onClick={router.push}`:
              μόνο ένα πραγματικό `<a>` δίνει μεσαίο κλικ και «άνοιγμα σε νέα
              καρτέλα» — και **εδώ** αυτό είναι το ζητούμενο, όχι καλλωπισμός: ο
              υπάλληλος θέλει τον προσωπικό του χώρο **δίπλα** στου γραφείου.

              ⚠️ Ο `Link` του συνόρου και όχι του Next: κρίνει ο **ίδιος** αν η
              διεύθυνση παίρνει πρόθεμα. Και τα δύο `href` εδώ είναι δηλωμένα
              **εκτός** εμβέλειας χώρου (`workspace-scope.ts`), άρα **δεν** παίρνουν
              — αλλά η απόφαση ανήκει στο σύνορο, όχι σε αυτό το αρχείο.
            */}
            <Link href={href} aria-current={isCurrent ? 'true' : undefined}>
              <Icon className={`${layout.buttonIconSpacing} ${iconSizes.sm}`} />
              <span className="flex-1">{t(`${K}.${id}`)}</span>
              {isCurrent && (
                <>
                  <Check className={iconSizes.sm} aria-hidden="true" />
                  <span className="sr-only">{t(`${K}.current`)}</span>
                </>
              )}
            </Link>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuGroup>
  );
}
