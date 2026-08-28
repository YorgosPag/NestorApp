'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΟΥ ΓΡΑΦΕΙΟΥ** — «νέα αγγελία για πελάτη».
 * @related ADR-777 §8.33 · components/owner-property/OwnerPropertyFormContent.tsx
 * @module components/mandate/BrokeredListingPageContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΚΑΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — ΚΑΙ ΤΙ **ΔΕΝ** ΞΑΝΑΓΡΑΦΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κρατά **μόνο** την κατάσταση της **εντολής** και τη λίστα επαφών. Τα πεδία του
 * ακινήτου, η επικύρωση, το κουμπί, η λίστα «τι λείπει» και η υποβολή είναι **το ίδιο
 * αρχείο** που εξυπηρετεί τον ιδιώτη — αλλάζει *ποιανού είναι*, όχι *τι είναι*.
 *
 * ⚠️ **Η λίστα επαφών ζητιέται μία φορά, στο άνοιγμα.** Ένα αντιδραστικό abonnement
 * εδώ θα ξαναποδίδαμε τη φόρμα κάθε φορά που κάποιος συνάδελφος αγγίζει επαφή — και η
 * φόρμα κρατά **μισοσυμπληρωμένη δουλειά** του μεσίτη.
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { useTranslation } from 'react-i18next';

import { BrokeredMandateFields } from '@/components/mandate/BrokeredMandateFields';
import { useMyOrganizationCapabilities } from '@/services/realtime/hooks/useOrganizationCapability';
import { isCapabilityActive } from '@/types/organization-capability';
import { OwnerPropertyFormContent } from '@/components/owner-property/OwnerPropertyFormContent';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import { nowISO } from '@/lib/date-local';
import { MANDATE_CATALOG_ROUTE } from '@/lib/mandate/mandate-routes';
import {
  emptyMandateForm,
  mandateFormBlockers,
  mandateRequestFrom,
  type MandateFormValues,
} from '@/lib/mandate/mandate-form-values';
import { getAllContacts } from '@/services/contacts-query.service';
import type { BrokeredNotifyOutcome } from '@/services/owner-property/owner-property.service';
import { getContactDisplayName } from '@/types/contacts';
import { createModuleLogger } from '@/lib/telemetry';

// 🧩 ADR-744 §15 (Φ4) — PER-ROUTE SLICE ΤΗΣ ΔΙΑΔΡΟΜΗΣ `/listings/mandates/new` (ADR-777 §8.36).
//
// Το dropdown είδους ακινήτου βάφεται από το `PROPERTY_TYPE_I18N_KEYS`, δηλαδή από το
// namespace `properties-enums` — που **δεν** ανήκει στο κέλυφος και φορτώνεται
// **ασύγχρονα**. Χωρίς αυτή την εγγραφή το πρώτο καρέ δείχνει **14 ωμά κλειδιά**
// (`types.studio` · `types.apartment` · …) εκεί ακριβώς όπου ο άνθρωπος διαλέγει.
//
// 🔴 **ΕΔΩ, ΚΑΙ ΟΧΙ ΣΤΟ `page.tsx`**: εκείνο είναι Server Component και τα Server/Client
// δέντρα έχουν **ΞΕΧΩΡΙΣΤΟΥΣ γράφους module** — εγγραφή από εκεί θα έγραφε σε **άλλο**
// στιγμιότυπο i18next, δηλαδή πράσινη κλήση που δεν κάνει τίποτα.
//
// ⚠️ **Στατική εισαγωγή, εμβέλεια MODULE**: με `import()` το κλειδί θα ήταν ωμό για ένα
// καρέ και **κρυμμένο** από το CHECK 3.51 — μετακίνηση του ελαττώματος, όχι διόρθωση.
// Το Next κόβει ήδη chunk ανά διαδρομή, άρα τα 577 bytes δεν ταξιδεύουν αλλού.
import routeSlice from '@/i18n/generated/routes/o__workspace__listings__mandates__new.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

// ⚠️ Εμβέλεια MODULE, όχι render και όχι effect: τρέχει **πριν** αποδοθεί οτιδήποτε.
registerRouteSlice(routeSlice);


const NS = 'property-market';
const K = `${NS}:mandate.office`;

const logger = createModuleLogger('BrokeredListingPageContent');

/**
 * Πόσες επαφές κατεβαίνουν στον επιλογέα.
 *
 * ⚠️ **Δηλώνεται ρητά αντί να κληρονομηθεί η προεπιλογή** (`BATCH_SIZE`, **100**): ο
 * επιλογέας είναι **αναζήτηση σε τοπική λίστα**, οπότε ό,τι δεν κατέβηκε **δεν
 * βρίσκεται** — και ένα γραφείο με 150 επαφές θα έψαχνε τον 120ό πελάτη του χωρίς
 * ποτέ να μάθει γιατί δεν εμφανίζεται.
 *
 * 🔶 **Δηλωμένο όριο**: πάνω από αυτό ο επιλογέας θέλει **αναζήτηση στον διακομιστή**
 * (το `searchContacts` υπάρχει ήδη), όχι μεγαλύτερο νούμερο εδώ.
 */
const CLIENT_PICKER_LIMIT = 500;

export function BrokeredListingPageContent(): React.ReactElement {
  const { t } = useTranslation([NS, 'auth', 'common-status']);

  /**
   * 🔴 **Η ΟΘΟΝΗ ΔΕΝ ΠΡΟΣΦΕΡΕΙ ΠΟΡΤΑ ΠΟΥ ΘΑ ΑΠΑΝΤΗΣΕΙ 403** (ADR-824 §8 Κ5).
   *
   * ⛔ **ΔΕΝ είναι ο φρουρός** — εκείνος είναι ο τύπος `BrokerageAuthority` στον
   * διακομιστή, και μια διαδρομή που τον ξεχνά **δεν μεταγλωττίζεται**. Αυτό εδώ
   * είναι **ειλικρίνεια της οθόνης**: μέχρι τις 2026-08-27 η φόρμα εμφανιζόταν σε
   * **κάθε** γραφείο, και το tooltip του επιλογέα «δουλειάς» το ομολογούσε —
   * *«Δεν αλλάζει δικαιώματα — **μόνο τι εμφανίζεται**»*.
   */
  const { view: capabilities, settled } = useMyOrganizationCapabilities();

  // 🔑 **Αρχικοποιητής συνάρτησης**: το ρολόι διαβάζεται σε **μία** απόδοση. Ένα
  // `useState(emptyMandateForm(nowISO()))` θα υπολόγιζε νέα προεπιλεγμένη λήξη σε
  // κάθε απόδοση (πετώντας το αποτέλεσμα) — δουλειά χωρίς καταναλωτή.
  const [mandate, setMandate] = React.useState<MandateFormValues>(() =>
    emptyMandateForm(nowISO()),
  );
  const [clients, setClients] = React.useState<readonly ComboboxOption[]>([]);
  const [notify, setNotify] = React.useState<BrokeredNotifyOutcome | null>(null);

  React.useEffect(() => {
    let alive = true;
    // 🔴 **ΤΟ `getAllContacts` ΔΕΝ ΕΠΙΣΤΡΕΦΕΙ ΠΙΝΑΚΑ** — επιστρέφει σελίδα:
    // `{ contacts, lastDoc, nextCursor }`. Η πρώτη γραφή έκανε `.map()` πάνω στο
    // αντικείμενο και έσκαγε με «contacts.map is not a function».
    //
    // ⚠️ **Το βρήκε η ΟΘΟΝΗ, όχι πύλη και όχι άγκυρα** (μάθημα Μ-Η) — και έγινε ορατό
    // **μόνο** επειδή το `.catch()` παρακάτω **λέει** την αποτυχία. Μια σιωπηλή
    // αποτυχία εδώ θα έδινε **κενή λίστα επαφών**, που φαίνεται ταυτόσημη με «δεν
    // έχεις επαφές»: ο μεσίτης θα έψαχνε τον πελάτη του σε λίστα που δεν φορτώθηκε
    // ποτέ, και θα κατηγορούσε τα δεδομένα του.
    void getAllContacts({ limitCount: CLIENT_PICKER_LIMIT })
      .then(({ contacts }) => {
        if (!alive) return;
        setClients(
          contacts.map((contact) => ({
            value: contact.id,
            label: getContactDisplayName(contact),
          })),
        );
      })
      .catch((error: unknown) => {
        // ⚠️ **Η αποτυχία λέγεται, δεν σιωπά.** Μια κενή λίστα επαφών φαίνεται
        // ταυτόσημη με «δεν έχεις επαφές», και ο μεσίτης θα έψαχνε τον πελάτη του σε
        // λίστα που δεν φορτώθηκε ποτέ.
        logger.error('Οι επαφές δεν φορτώθηκαν για τον επιλογέα πελάτη', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      alive = false;
    };
  }, []);

  // 🔴 **ΟΛΟΚΛΗΡΗ η φόρμα λείπει, όχι απενεργοποιημένο κουμπί.** Μια φόρμα που ο
  //    άνθρωπος συμπληρώνει και **δεν μπορεί** να υποβάλει είναι χειρότερη από
  //    απουσία: του ζητά δουλειά που θα πεταχτεί. Το μήνυμα λέει **σε ποια
  //    κατάσταση** βρίσκεται και άρα **τι μπορεί να κάνει**.
  // 🔴 **ΟΣΟ ΔΕΝ ΞΕΡΩ, ΔΕΝ ΜΙΛΑΩ — ΚΑΙ ΔΕΝ ΕΙΝΑΙ «ΕΝΑ ΚΑΡΕ».**
  //
  // Μετρημένο ζωντανά σε **εγκεκριμένο** γραφείο (2026-08-28, ανιχνευτής σε 7 αποδόσεις):
  //
  //   1-3  authLoading=true  hasUser=false companyId=null      status=unrequested  ⇒ ΑΡΝΗΣΗ
  //   4-5  authLoading=true  hasUser=true  companyId=comp_…    status=unrequested  ⇒ ΑΡΝΗΣΗ
  //   6    authLoading=true  hasUser=true  companyId=comp_…    status=active       ⇒ φόρμα
  //   7    authLoading=false hasUser=true  companyId=comp_…    status=active       ⇒ φόρμα
  //
  // **5 στις 7** αποδόσεις έλεγαν σε νόμιμο μεσιτικό γραφείο *«δεν έχεις δηλώσει μεσιτική
  // δραστηριότητα»* — αρκετά ώστε το κείμενο να διαβάζεται στην οθόνη, όχι να τρεμοπαίζει.
  // Αιτία: το `companyId` της **αναμονής** είναι `null`, και το `null` διαβαζόταν ως
  // *«δεν έχει οργανισμό»* αντί για *«δεν ρώτησα ακόμη»*.
  //
  // 🔑 **Το `settled` είναι το ΜΟΝΟ ασφαλές σήμα**: μετρημένο ότι το `authLoading` κλείνει
  // **τελευταίο** — μετά το `user` **και** μετά το `companyId`. Ένα `user !== null` θα
  // άνοιγε το στόμα της οθόνης στην απόδοση **4**, δηλαδή θα ξανάφτιαχνε το ίδιο ψέμα σε
  // μικρότερο παράθυρο. Ίδιο ιδίωμα με το `MandateCatalogContent` (άγκυρα Ο1).
  if (!settled) {
    // ⚠️ **Γενικό κλειδί, όχι δανεικό.** Το `offer.mandates.loading` λέει *«Φορτώνουμε τις
    //    ΕΝΤΟΛΕΣ σας»* — αληθές στον **κατάλογο**, ψευδές σε φόρμα **νέας** καταχώρησης
    //    *(μετρήθηκε στην οθόνη)*. Το `common-status` ζει **στο κέλυφος**, άρα το κλειδί
    //    είναι διαθέσιμο σε **κάθε** διαδρομή χωρίς κανένα byte στο slice της.
    return <p className="text-sm text-muted-foreground">{t('common-status:status.loading')}</p>;
  }

  // ⚠️ **Το κεντρικό κριτήριο, όχι σύγκριση συμβολοσειράς**: το `isCapabilityActive` είναι
  //    ο SSoT ορισμός του *«επιτρέπεται η πράξη;»* — και ένα `status is 'active'` type guard.
  //    Ένα `!== 'active'` εδώ ήταν το δεύτερο αντίγραφο του ίδιου κανόνα (N.0.2).
  const brokerage = capabilities.brokerage_listings;
  if (!isCapabilityActive(brokerage)) {
    return (
      <section className="flex flex-col gap-4">
        {/* ⚠️ **Τα ΥΠΑΡΧΟΝΤΑ κλειδιά, κανένα νέο.** Ο τίτλος και ο σύνδεσμος επιστροφής
            είναι οι ίδιοι με την κανονική οθόνη — αλλάζει **μόνο** το μήνυμα, που
            έχει ήδη τρεις γραμμένες αποδόσεις (μία ανά κατάσταση). */}
        <h1 className="text-xl font-semibold text-foreground">{t(`${K}.newTitle`)}</h1>
        <p className="text-sm text-muted-foreground">
          {t(`auth:brokerage.denyReason.${brokerage}`)}
        </p>
        <nav>
          <Link href={MANDATE_CATALOG_ROUTE} className="text-sm text-muted-foreground">
            {t('property-market:offer.mandates.backToCatalog')}
          </Link>
        </nav>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {/*
        🔴 **Ο ΔΙΑΔΡΟΜΟΣ ΠΑΕΙ ΚΑΙ ΠΡΟΣ ΤΑ ΠΙΣΩ** (ADR-777 §8.34). Μέχρι τις 2026-08-21
        αυτή η σελίδα ήταν **ορφανή**: κανένα μενού δεν οδηγούσε σε αυτήν και, αφού ο
        μεσίτης καταχωρούσε, **δεν υπήρχε πουθενά να πάει** — έμενε σε φόρμα που μόλις
        υπέβαλε. Ο κατάλογος είναι η οθόνη όπου θα δει τι απέγινε η εντολή που μόλις
        έστειλε, οπότε ο σύνδεσμος **είναι** η συνέχεια της πράξης, όχι διακόσμηση.
      */}
      <nav>
        <Link href={MANDATE_CATALOG_ROUTE} className="text-sm text-muted-foreground">
          {t('property-market:offer.mandates.backToCatalog')}
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">{t(`${K}.newTitle`)}</h1>
        <p className="text-sm text-muted-foreground">{t(`${K}.newSubtitle`)}</p>
      </header>

      {notify !== null && (
        <p
          role="status"
          className={
            notify.kind === 'sent'
              ? 'text-sm text-muted-foreground'
              : 'text-sm font-medium text-destructive'
          }
        >
          {notify.kind === 'sent'
            ? t(`${K}.notify.sent`, { to: notify.to })
            : t(`${K}.notify.${notify.kind}`)}
        </p>
      )}

      <OwnerPropertyFormContent
        mandate={{
          section: (
            <BrokeredMandateFields
              values={mandate}
              clients={clients}
              onChange={setMandate}
            />
          ),
          blockers: mandateFormBlockers(mandate),
          request: mandateRequestFrom(mandate),
          onNotify: (outcome) => setNotify(outcome ?? { kind: 'failed' }),
        }}
      />
    </section>
  );
}
