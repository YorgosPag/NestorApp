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
import type { ClientsLoad } from '@/components/mandate/BrokeredMandateFields';
import { CLIENT_NAME_KEYS } from '@/components/mandate/catalog/mandate-catalog-labels';
import { primaryEmailOf } from '@/lib/contacts/primary-email';
import { CLIENT_NAME_KNOWN, clientNameFrom } from '@/lib/mandate/mandate-client-name';
import {
  BROKERAGE_DENY_REASON_KEYS,
  BROKERAGE_SETTINGS,
} from '@/lib/auth/brokerage-authority';
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
import type { Contact } from '@/types/contacts';
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

/**
 * **Ο,ΤΙ ΔΙΑΒΑΣΑΜΕ** — ξεχωριστό από **ό,τι ζωγραφίζουμε** ({@link ClientsLoad}).
 *
 * 🔑 **Γιατί κρατάμε τις επαφές και όχι τις έτοιμες επιλογές**: η ετικέτα της ανώνυμης
 * επαφής είναι **μεταφρασμένο κείμενο**. Αν το `.map()` γινόταν μέσα στο effect (που
 * τρέχει **μία φορά**, στο άνοιγμα), η αλλαγή γλώσσας — που το κέλυφος προσφέρει σε
 * **κάθε** οθόνη (CHECK 3.72) — θα άφηνε τον επιλογέα στην παλιά γλώσσα ενώ όλη η
 * υπόλοιπη σελίδα γύριζε. Το κείμενο παράγεται στην **απόδοση**, όπου ζει το `t`.
 */
type ClientsSource =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly contacts: readonly Contact[] }
  | { readonly kind: 'failed' };

/**
 * **Η ΓΡΑΜΜΗ ΤΟΥ ΠΕΛΑΤΗ ΣΤΟΝ ΕΠΙΛΟΓΕΑ** — και γιατί δεν είναι ποτέ κενή.
 *
 * 🔴 Ήταν σκέτο `label: getContactDisplayName(contact)`. Για επαφή με
 * `firstName: ''` / `lastName: ''` αυτό δίνει **`' '`** ⇒ **κενή γραμμή** στο dropdown
 * (μετρημένη ζωντανά 2026-08-31: 1 στις 9). Και η κενή γραμμή δεν είναι μόνο άσχημη —
 * το κλικ πάνω της είχε ήδη **προσγειωθεί σε άλλη επαφή**.
 *
 * ✅ **Καμία νέα θεραπεία και κανένα νέο λεξιλόγιο**: το {@link clientNameFrom} και το
 * κλειδί `clientUnnamed` γράφτηκαν στο §6.5.δ **γι' αυτό ακριβώς** και ζωγραφίζουν ήδη
 * σωστά στον κατάλογο εντολών. Ο επιλογέας απλώς **δεν τα ρωτούσε** — ίδιο ελάττωμα,
 * **δεύτερη επιφάνεια**.
 *
 * 🔑 **ΤΟ ΔΕΥΤΕΡΕΥΟΝ ΚΕΙΜΕΝΟ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΣΗ — ΕΙΝΑΙ Ο ΔΙΑΧΩΡΙΣΤΗΣ.** Μόλις δύο
 * ανώνυμες επαφές πάρουν την **ίδια** ετικέτα, ο επιλογέας δεν μπορεί να τις ξεχωρίσει
 * από το κείμενο· και το `handleBlur` του λύνει την ταυτότητα **από την ετικέτα**.
 * Χωρίς διαχωριστή η θεραπεία του κενού θα γεννούσε τη **σύγκρουση**.
 *
 * ⚠️ **Και είναι το `primaryEmailOf`, ο ΙΔΙΟΣ κριτής που χρησιμοποιεί ο ειδοποιητής**
 * (`mandate-invitation.service.ts`). Άρα ο μεσίτης βλέπει **ακριβώς** τη διεύθυνση στην
 * οποία θα σταλεί η εντολή — και βλέπει την **απουσία** της **πριν** δεσμευτεί, αντί να
 * το μάθει από ένα `no-address` μετά. Δύο διαφορετικοί κριτές εδώ θα σήμαιναν οθόνη
 * που υπόσχεται παράδοση σε διεύθυνση που κανείς δεν θα χρησιμοποιούσε.
 */
function clientOptionFrom(contact: Contact, unnamedLabel: string): ComboboxOption {
  const named = clientNameFrom(getContactDisplayName(contact));
  return {
    value: contact.id,
    label: named.kind === CLIENT_NAME_KNOWN ? named.name : unnamedLabel,
    secondaryLabel: primaryEmailOf(contact.emails) ?? undefined,
  };
}

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
  const [clientsSource, setClientsSource] = React.useState<ClientsSource>({ kind: 'loading' });
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
        setClientsSource({ kind: 'ready', contacts });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        // ⚠️ **Η αποτυχία λέγεται, δεν σιωπά — ΚΑΙ ΣΤΟΝ ΑΝΘΡΩΠΟ.** Μέχρι σήμερα
        // γραφόταν **μόνο** εδώ, στα logs: ο μεσίτης έβλεπε άδειο πεδίο και συμπέραινε
        // ότι δεν έχει τις επαφές του. Το `kind: 'failed'` είναι αυτό που το φέρνει
        // στην οθόνη (`ClientsLoad`) — ένα `logger.error` δεν είναι μήνυμα προς χρήστη.
        logger.error('Οι επαφές δεν φορτώθηκαν για τον επιλογέα πελάτη', {
          error: error instanceof Error ? error.message : String(error),
        });
        setClientsSource({ kind: 'failed' });
      });
    return () => {
      alive = false;
    };
  }, []);

  // **Ο,τι διαβάσαμε → ό,τι ζωγραφίζουμε.** Το κείμενο παράγεται εδώ, στην απόδοση,
  // ώστε η αλλαγή γλώσσας να το ξαναγράφει — δες {@link ClientsSource}.
  const clients: ClientsLoad = React.useMemo(() => {
    if (clientsSource.kind !== 'ready') return clientsSource;
    const unnamedLabel = t(CLIENT_NAME_KEYS.unnamed);
    return {
      kind: 'ready',
      options: clientsSource.contacts.map((contact) => clientOptionFrom(contact, unnamedLabel)),
    };
  }, [clientsSource, t]);

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
        {/* 🔴 **ΕΥΡΕΤΗΡΙΑΣΗ ΣΕ ΣΤΑΘΕΡΑ MODULE, ΟΧΙ ΠΑΡΕΜΒΟΛΗ** (ADR-824 §12.14). Ως τις
            2026-08-30 εδώ ζούσε ένα ``t(`auth:brokerage.denyReason.${brokerage}`)``:
            δυναμικό κλειδί, δηλαδή **αόρατο στη CHECK 3.8** *(που διαβάζει κυριολεκτικά
            ορίσματα)* — μια μετονομασία στα locales θα ζωγράφιζε **ωμό κλειδί** και η
            πύλη θα έμενε πράσινη. Ο πίνακας υπήρχε ήδη, μία εισαγωγή μακριά.
            🔑 Το `isCapabilityActive` από πάνω **έχει ήδη στενέψει** τον τύπο σε ό,τι
            αρνείται, άρα η ευρετηρίαση είναι ολική — χωρίς fallback, χωρίς `??`. */}
        <p className="text-sm text-muted-foreground">
          {t(BROKERAGE_DENY_REASON_KEYS[brokerage])}
        </p>
        <nav className="flex flex-wrap gap-4">
          {/* 🔴 **Η ΥΠΟΣΧΕΣΗ ΟΔΗΓΕΙ ΚΑΠΟΥ** (ADR-824 §12.14): το `denyReason.revoked`
              λέει *«δες τον λόγο στις ρυθμίσεις του οργανισμού»*, και η οθόνη τον
              **έδειχνε χωρίς δρόμο**. Μετρήθηκε ζωντανά 2026-08-30. */}
          <Link href={BROKERAGE_SETTINGS.route} className="text-sm underline">
            {t(BROKERAGE_SETTINGS.linkKey)}
          </Link>
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
          // ⚠️ Το ρολόι περνιέται **ρητά**: η νομιμότητα της διάρκειας μετριέται από
          //    τώρα, και ο κριτής δεν διαβάζει ρολόι μόνος του (δοκιμασιμότητα).
          blockers: mandateFormBlockers(mandate, nowISO()),
          request: mandateRequestFrom(mandate),
          onNotify: (outcome) => setNotify(outcome ?? { kind: 'failed' }),
        }}
      />
    </section>
  );
}
