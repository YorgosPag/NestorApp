/**
 * =============================================================================
 * ΠΡΟΓΡΑΜΜΑ ΕΡΓΑΣΙΩΝ — SSoT (ADR-740)
 * =============================================================================
 *
 * **Η μία και μοναδική απάντηση στο «τι τρέχει πότε».**
 *
 * ## Γιατί υπάρχει αυτό το αρχείο
 *
 * Μέχρι 2026-07-31 η απάντηση ζούσε στο `vercel.json`. Το `vercel.json` το διαβάζει
 * **μόνο** το Vercel, και το Vercel είναι παγωμένο από **2026-05-09**. Η παραγωγή τρέχει
 * σε Netcup/Coolify. Αποτέλεσμα: επί **τρεις μήνες** δεν έτρεξε **καμία** εργασία — ούτε
 * αντίγραφο ασφαλείας, ούτε εκκαθάριση κάδου, ούτε οριστική διαγραφή. Κανένας έλεγχος
 * δεν παραπονέθηκε, επειδή το αρχείο *φαινόταν* έγκυρο και κανείς δεν το διάβαζε.
 *
 * Άρα ο κανόνας: **το πρόγραμμα ζει στο git, δίπλα στον κώδικα που εκτελεί.** Είναι το
 * μοτίβο της Laravel (`* * * * * php artisan schedule:run`), του Sidekiq-cron και του
 * Quartz — και του ίδιου του Coolify, που είναι Laravel.
 *
 * ## Μία δήλωση, τρεις καταναλωτές
 *
 * 1. **Ο dispatcher** (`lib/cron/cron-dispatcher.ts`) αποφασίζει τι οφείλεται.
 * 2. **Το Sentry monitor** ρυθμίζεται από τα *ίδια* πεδία (`schedule`, `timezone`,
 *    `checkinMarginMinutes`, `maxRuntimeMinutes`). Άρα πρόγραμμα και συναγερμός
 *    **δεν μπορούν** να αποκλίνουν — η απόκλιση θα ήταν ακριβώς τόσο αόρατη όσο ήταν
 *    και η τρίμηνη σιωπή.
 * 3. **Τα tests** (`lib/cron/__tests__/cron-route-contract.test.ts`) επιβάλλουν ότι
 *    κάθε `src/app/api/cron/*` είναι δηλωμένο εδώ και έχει guard.
 *
 * ## Πώς προσθέτεις εργασία
 *
 * Γράφεις τη συνάρτηση στο `lib/cron/jobs/<slug>.job.ts`, προσθέτεις εγγραφή εδώ,
 * κάνεις deploy. **Δεν υπάρχει βήμα σε UI.** Αν ξεχάσεις την εγγραφή, το test
 * εξαντλητικότητας κοκκινίζει — δεν μαθαίνεις για το κενό σε τρεις μήνες.
 *
 * ## Ζώνη ώρας
 *
 * Όλα δηλώνονται **ρητά** σε `Europe/Athens`. Οι παλιές ώρες του `vercel.json` ήταν UTC,
 * δηλαδή μετακινούνταν 03:00↔04:00 τοπική ώρα δύο φορές τον χρόνο. Οι νέες είναι η
 * θερινή τους αντιστοιχία, παγωμένη: το `0 4 * * *` είναι 04:00 Ελλάδας **πάντα**.
 *
 * @module config/cron-schedule
 * @see ADR-740
 */

import { runAiLearning } from '@/lib/cron/jobs/ai-learning.job';
import { runBackup } from '@/lib/cron/jobs/backup.job';
import { runEmailIngestion } from '@/lib/cron/jobs/email-ingestion.job';
import { runFilePurge } from '@/lib/cron/jobs/file-purge.job';
import { runOAuthCleanup } from '@/lib/cron/jobs/oauth-cleanup.job';
import { runOnboardingReminder } from '@/lib/cron/jobs/onboarding-reminder.job';
import { runOverdueAlerts } from '@/lib/cron/jobs/overdue-alerts.job';
import { runPurgeDeletedEntities } from '@/lib/cron/jobs/purge-deleted-entities.job';
import type { CronJobDefinition } from '@/types/cron-schedule';

/**
 * Η ζώνη ώρας του έργου.
 *
 * Δηλώνεται **σε κάθε** εγγραφή και όχι ως σιωπηρή προεπιλογή: μια προεπιλογή σημαίνει
 * ότι το «τι ώρα τρέχει;» εξαρτάται από ρύθμιση του container, δηλαδή δεν είναι στο git.
 */
export const CRON_TIMEZONE = 'Europe/Athens';

/**
 * Το slug του heartbeat monitor για το **ίδιο το ρολόι**.
 *
 * Κάθε job έχει δικό του monitor, αλλά αν πεθάνει η Coolify Scheduled Task **κανένα**
 * job δεν στέλνει check-in — και όλα τα ημερήσια monitors θα χτυπήσουν με καθυστέρηση
 * έως 24 ωρών. Ο heartbeat χτυπά ωριαία και κόβει τον χρόνο ανίχνευσης σε ~1 ώρα.
 *
 * Ωριαίος και όχι λεπτού: το Sentry περιορίζει τα check-ins σε 6/λεπτό ανά monitor, και
 * 1.440 check-ins/ημέρα είναι θόρυβος χωρίς αντίκρισμα.
 */
export const CRON_HEARTBEAT_SLUG = 'cron-dispatcher-heartbeat';

/** Το cron του heartbeat — πρέπει να ταιριάζει με τη συχνότητα check-in του dispatcher. */
export const CRON_HEARTBEAT_SCHEDULE = '0 * * * *';

/**
 * Το πρόγραμμα.
 *
 * ⚠️ Η σειρά δεν έχει σημασία για την εκτέλεση (ο dispatcher αξιολογεί όλες τις εγγραφές
 * σε κάθε tick), αλλά κρατιέται χρονολογική για ανθρώπινη ανάγνωση.
 */
export const CRON_SCHEDULE: readonly CronJobDefinition[] = [
  {
    slug: 'email-ingestion',
    path: '/api/cron/email-ingestion',
    description: 'Επεξεργασία παρτίδας από την ουρά εισερχομένων email (ADR-071)',
    enabled: true,
    schedule: '0 3 * * *',
    timezone: CRON_TIMEZONE,
    checkinMarginMinutes: 15,
    maxRuntimeMinutes: 10,
    leaseMinutes: 15,
    run: runEmailIngestion,
  },
  {
    slug: 'ai-learning',
    path: '/api/cron/ai-learning',
    description: 'Εξαγωγή μοτίβων από ανατροφοδότηση + εκκαθάριση (ADR-173)',
    enabled: true,
    schedule: '0 3 * * *',
    timezone: CRON_TIMEZONE,
    checkinMarginMinutes: 15,
    maxRuntimeMinutes: 10,
    leaseMinutes: 15,
    run: runAiLearning,
  },
  {
    slug: 'overdue-alerts',
    path: '/api/cron/overdue-alerts',
    description: 'Σάρωση ληξιπρόθεσμων δόσεων και ειδοποιήσεις (ADR-234)',
    enabled: true,
    schedule: '0 3 * * *',
    timezone: CRON_TIMEZONE,
    checkinMarginMinutes: 15,
    maxRuntimeMinutes: 10,
    leaseMinutes: 15,
    run: runOverdueAlerts,
  },
  {
    slug: 'backup',
    path: '/api/cron/backup',
    description: 'Πλήρες αντίγραφο ασφαλείας Firestore + Storage → GCS (ADR-313)',
    enabled: true,
    schedule: '0 4 * * *',
    timezone: CRON_TIMEZONE,
    // Το πιο κρίσιμο job του συστήματος και το πιο αργό: γενναιόδωρα όρια ώστε μια
    // αργή μεταφορά προς GCS να μη σημαίνει ψευδή συναγερμό, αλλά όχι τόσο μεγάλα
    // ώστε ένα πραγματικά κολλημένο backup να περνά απαρατήρητο μια ολόκληρη μέρα.
    checkinMarginMinutes: 30,
    maxRuntimeMinutes: 45,
    leaseMinutes: 60,
    run: runBackup,
  },
  {
    slug: 'file-purge',
    path: '/api/cron/file-purge',
    description: 'Εκκαθάριση κάδου αρχείων + ορφανών PENDING/FAILED (ADR-191)',
    enabled: true,
    schedule: '0 5 * * *',
    timezone: CRON_TIMEZONE,
    checkinMarginMinutes: 15,
    maxRuntimeMinutes: 15,
    leaseMinutes: 20,
    run: runFilePurge,
  },
  {
    slug: 'oauth-cleanup',
    path: '/api/cron/oauth-cleanup',
    description: 'Εκκαθάριση ληγμένων εγγράφων OAuth (ADR-738 §10)',
    enabled: true,
    // Δεν ήταν ποτέ δηλωμένο στο `vercel.json` — προστέθηκε εδώ (ADR-740). Ώρα χωρίς
    // γείτονα, ώστε να μην ανταγωνίζεται τα βαριά purge jobs.
    schedule: '0 6 * * *',
    timezone: CRON_TIMEZONE,
    checkinMarginMinutes: 15,
    maxRuntimeMinutes: 10,
    leaseMinutes: 15,
    run: runOAuthCleanup,
  },
  {
    slug: 'purge-deleted-entities',
    path: '/api/cron/purge-deleted-entities',
    description: 'Οριστική διαγραφή soft-deleted οντοτήτων μετά 30 ημέρες (ADR-281)',
    enabled: true,
    schedule: '0 7 * * *',
    timezone: CRON_TIMEZONE,
    checkinMarginMinutes: 15,
    maxRuntimeMinutes: 20,
    leaseMinutes: 25,
    run: runPurgeDeletedEntities,
  },
  {
    slug: 'onboarding-reminder',
    path: '/api/cron/onboarding-reminder',
    description: 'Υπενθύμιση σε εταιρείες με ημιτελές onboarding (ADR-326)',
    enabled: true,
    // 08:00 τοπικά: υπενθύμιση προς άνθρωπο πρέπει να φτάνει πρωί, όχι νύχτα.
    schedule: '0 8 * * *',
    timezone: CRON_TIMEZONE,
    checkinMarginMinutes: 20,
    maxRuntimeMinutes: 15,
    leaseMinutes: 20,
    run: runOnboardingReminder,
  },

  // ─── Δηλωμένα αλλά ανενεργά ────────────────────────────────────────────────
  // Εμφανίζονται εδώ **σκόπιμα**. Ένα job εκτός λίστας είναι αόρατο· ένα job στη
  // λίστα με `enabled: false` και αιτία είναι απόφαση. Η διάκριση αυτή είναι το
  // μάθημα ολόκληρου του ADR-740.

  {
    slug: 'purge-deleted-contacts',
    path: '/api/cron/purge-deleted-contacts',
    description: 'Οριστική διαγραφή επαφών — υποσύνολο του purge-deleted-entities',
    enabled: false,
    disabledReason: 'superseded',
    supersededBy: 'purge-deleted-entities',
    reactivateWhen:
      'Ποτέ. Αντ\' αυτού: αφαίρεσε route + job αφού το purge-deleted-entities δείξει ' +
      'επιτυχημένα check-ins σε παραγωγή (δεν έχει τρέξει ποτέ — κανένα cron δεν έτρεξε ' +
      'από 2026-05-09).',
  },
  {
    slug: 'ai-pipeline',
    path: '/api/cron/ai-pipeline',
    description: 'Επεξεργασία παρτίδας ουράς AI pipeline (ADR-080)',
    enabled: false,
    disabledReason: 'never-scheduled',
    reactivateWhen:
      'Αφού ο Γιώργος επιβεβαιώσει τη συμπεριφορά με χειροκίνητη κλήση του route σε ' +
      'παραγωγή. Δεν μπήκε ποτέ στο vercel.json, άρα δεν έτρεξε ούτε επί Vercel — η ' +
      'συμπεριφορά του υπό πραγματικό φόρτο είναι άγνωστη.',
  },
];

/** Εύρεση εγγραφής με το slug της. */
export function findCronJob(slug: string): CronJobDefinition | undefined {
  return CRON_SCHEDULE.find((job) => job.slug === slug);
}
