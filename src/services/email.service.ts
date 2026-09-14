// src/services/email.service.ts
/**
 * Enterprise Email Service — κοινοποίηση ακινήτων/φωτογραφιών.
 *
 * 🔴 **Η ΛΕΞΗ «FALLBACK» ΕΔΩ ΠΕΡΙΕΓΡΑΦΕ ΚΑΤΙ ΠΟΥ ΔΕΝ ΥΠΗΡΧΕ** (§8.26). Η κεφαλίδα
 * έλεγε «Resend + Mailgun **fallback**»· ο κώδικας διάλεγε **έναν** πάροχο μία
 * φορά — `resend ? 'resend' : mailgunAdapter ? 'mailgun' : null` — και σε αποτυχία
 * **πετούσε**. Ο δεύτερος δεν δοκιμαζόταν **ποτέ**, σε καμία διαδρομή.
 *
 * Η επιλογή, η εφεδρεία και το χρονικό όριο ζουν πλέον στο SSoT
 * `server/comms/email-provider-chain`: **μία** απάντηση για ολόκληρη την εφαρμογή,
 * κοινή με τον αγωγό ειδοποιήσεων (ADR-749 — όχι δύο μηχανές για ένα ερώτημα).
 *
 * @see ADR-777 §8.26
 */
import { getErrorMessage } from '@/lib/error-utils';
import { resolveSenderHeader, resolveSenderIdentity } from '@/services/company/sender-identity';
import { brandedSubject } from '@/server/comms/email-texts';
import { EmailTemplatesService } from './email-templates.service';
import { buildPhotoShareEmail } from './email-templates/photo-share';
import { describeChain, sendThroughChain } from '@/server/comms/email-provider-chain';
import { defaultEmailChain } from '@/server/comms/email-providers';
import type { EmailTemplateType, EmailTemplateData } from '@/types/email-templates';

const NODE_ENV = process.env.NODE_ENV || 'development';

/*
 * 🔴 ΕΔΩ ΖΟΥΣΑΝ ΤΑ `FROM_EMAIL` / `FROM_NAME` — Η ΔΕΥΤΕΡΗ ΑΠΟ ΤΙΣ ΤΡΕΙΣ ΑΝΑΓΝΩΣΕΙΣ.
 *
 * Ήταν **σταθερές module-scope**, δηλαδή διάβαζαν το περιβάλλον **μία φορά, τη στιγμή
 * της εισαγωγής**: μια μεταβλητή που έμπαινε αργότερα δεν είχε καμία επίδραση μέχρι
 * επανεκκίνηση — το ίδιο σχήμα «η ρύθμιση λέει ψέματα» που διόρθωσε το `defaultEmailChain()`.
 * Η ρίζα ({@link resolveSenderIdentity}) διαβάζει **σε κάθε κλήση**.
 *
 * @see ADR-857 §6 Φ9
 */

// New enterprise interface
export interface EmailRequest {
  recipients: string[];
  recipientName?: string;
  propertyTitle: string;
  propertyDescription?: string;
  propertyPrice?: number;
  propertyArea?: number;
  propertyLocation?: string;
  propertyUrl?: string;
  photoUrl?: string;
  photoUrls?: string[];
  isPhoto?: boolean;
  senderName?: string;
  personalMessage?: string;
  templateType?: EmailTemplateType;
}

export interface EmailResponse {
  success: boolean;
  message: string;
  recipients: number;
  templateUsed: string;
  emailId?: string;
  note?: string;
}


/*
 * ⚠️ Ο φρουρός χρόνου **μετακόμισε** στο `email-provider-chain`
 * (`PROVIDER_TIMEOUT_MS`). Γεννήθηκε από το συμβάν 2026-04-19 (*«Resend hung
 * silently → 408 in UI»*) και φρουρούσε **μόνο** αυτή τη διαδρομή: ο αγωγός cron
 * δεν τον είχε **καθόλου**, δηλαδή ο ίδιος κίνδυνος ήταν αφύλακτος στη μισή
 * εφαρμογή. Πλέον τον φοράει **κάθε** κρίκος **κάθε** αλυσίδας, αυτόματα.
 */

/**
 * Enterprise Email Service
 * Handles email sending with Resend integration
 */
export class EmailService {

  /**
   * Send property share emails (NEW ENTERPRISE METHOD)
   */
  static async sendPropertyShareEmail(emailRequest: EmailRequest): Promise<EmailResponse> {
    console.debug('🔍 DEBUG: EmailService.sendPropertyShareEmail called');
    console.debug('🔍 DEBUG: NODE_ENV:', NODE_ENV);

    const {
      recipients,
      propertyTitle,
      propertyDescription,
      propertyPrice,
      propertyArea,
      propertyLocation,
      propertyUrl,
      photoUrl,
      senderName = resolveSenderIdentity().name,
      personalMessage,
      templateType = 'residential',
      isPhoto,
    } = emailRequest;

    // Validate inputs
    if (!recipients || recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    if (!propertyTitle) {
      throw new Error('Property title is required');
    }

    // 🔑 **Αλυσίδα, όχι επιλογή.** Resend → Mailgun, με πραγματική μετάπτωση σε
    // αποτυχία **ή σιωπή** του πρώτου. Η σειρά ζει στο `defaultEmailChain()`.
    const chain = defaultEmailChain();
    const status = describeChain(chain);

    if (status.configured.length === 0) {
      console.debug('🧪 EMAIL SERVICE: No provider configured (need RESEND_API_KEY or MAILGUN_API_KEY)');
      return {
        success: true,
        message: '🧪 DEVELOPMENT: Email simulated successfully',
        recipients: recipients.length,
        templateUsed: templateType,
        note: 'No email provider configured. Set RESEND_API_KEY or MAILGUN_API_KEY.'
      };
    }

    try {
      let htmlContent: string;
      let subject: string;

      const allPhotoUrls = emailRequest.photoUrls;
      if (isPhoto && (photoUrl || allPhotoUrls?.length)) {
        // Photo share → branded Pagonis Energo template with inline photo(s)
        htmlContent = buildPhotoShareEmail({
          photoUrl: photoUrl || allPhotoUrls![0],
          photoUrls: allPhotoUrls,
          title: propertyTitle,
          personalMessage,
          senderName: senderName || resolveSenderIdentity().name,
          recipientEmail: recipients[0],
        });
        subject = brandedSubject(propertyTitle);
      } else {
        // Property share → existing templates (residential/commercial/premium)
        const template = EmailTemplatesService.getTemplate(templateType);
        if (!template) {
          throw new Error(`Email template '${templateType}' not found`);
        }
        // Normalize undefined → '' so template interpolation doesn't emit
        // the literal string "undefined" in href attributes.
        const emailData: EmailTemplateData = {
          propertyTitle, propertyDescription, propertyPrice, propertyArea,
          propertyLocation, propertyUrl: propertyUrl ?? '', photoUrl,
          recipientEmail: recipients[0],
          personalMessage, senderName: senderName || resolveSenderIdentity().name
        };
        htmlContent = EmailTemplatesService.generateEmailHtml(templateType, emailData);
        // Generic shares (contacts, projects) pass no propertyUrl. The legacy
        // property templates always emit a CTA <a>. Strip those CTA wrappers
        // post-render so recipients don't see a broken "href=""" button.
        if (!propertyUrl) {
          htmlContent = htmlContent.replace(
            /<div style="text-align: center[^"]*">\s*<a href=""[^>]*class="cta-[^"]+"[\s\S]*?<\/a>\s*<\/div>/g,
            '',
          );
        }
        subject = this.generateSubject(templateType, propertyTitle);
      }

      // ⚠️ **ΕΝΑ email ανά παραλήπτη** — και αυτό διορθώνει υπαρκτό ελάττωμα
      // απορρήτου: η παλιά διαδρομή Resend περνούσε ολόκληρο τον πίνακα ως `to`,
      // δηλαδή **κάθε παραλήπτης έβλεπε τις διευθύνσεις όλων των άλλων**. Η διαδρομή
      // Mailgun έστελνε ήδη χωριστά· οι δύο συμπεριφορές ενοποιούνται στη σωστή.
      // 🔴 ADR-857 Φ9 — **ΤΟ `senderName` ΕΡΧΕΤΑΙ ΑΠΟ ΦΟΡΜΑ ΧΡΗΣΤΗ ΚΑΙ ΕΜΠΑΙΝΕ ΩΜΟ.**
      //    Ο φρουρός έγχυσης CRLF (`safeHeaderEntries`) φυλάει **μόνο** τις custom
      //    κεφαλίδες· το `from` δεν περνούσε από πουθενά, άρα ένα `\r\n` μέσα στο όνομα
      //    έγραφε **νέα κεφαλίδα** (π.χ. `Bcc:`). Η ρίζα καθαρίζει και εισαγωγικοποιεί
      //    κατά RFC 5322 — και η **διεύθυνση** δεν επιλέγεται ποτέ από χρήστη.
      const fromHeader = resolveSenderHeader(senderName);
      const outcomes = await Promise.all(
        recipients.map((to) =>
          sendThroughChain(chain, {
            to,
            subject,
            text: propertyUrl ? `${propertyTitle} — ${propertyUrl}` : propertyTitle,
            html: htmlContent,
            from: fromHeader,
          }),
        ),
      );

      const delivered = outcomes.filter((outcome) => outcome.kind === 'delivered');
      if (delivered.length === 0) {
        // Οι λόγοι **ονομαστικά, ανά πάροχο**: ένα σκέτο «all sends failed» δεν
        // ξεχωρίζει το πεσμένο δίκτυο από το ληγμένο κλειδί.
        //
        // ⚠️ **Αγγλικά, όπως τα τέσσερα αδέλφια του αρχείου** — δεν φτάνει ποτέ σε
        // οθόνη: ταξιδεύει σε logs και Sentry. Ελληνικό κείμενο εδώ θα ήταν και
        // ασυνέπεια και παραβίαση του N.11 (CHECK: UI hardcoded strings).
        throw new Error(`Email delivery failed for every recipient: ${summarizeFailures(outcomes)}`);
      }

      const failedOver = delivered.some((outcome) => outcome.failedOver);
      const providers = [...new Set(delivered.map((outcome) => outcome.provider))].join(', ');
      console.debug('✅ EMAIL SENT:', {
        providers, failedOver, delivered: delivered.length, recipients: recipients.length,
      });

      return {
        success: true,
        message: `Email sent to ${delivered.length}/${recipients.length} recipients via ${providers}`,
        recipients: delivered.length,
        templateUsed: isPhoto ? 'photo-share' : templateType,
        emailId: delivered.find((outcome) => outcome.messageId)?.messageId,
        // 🔑 Η μετάπτωση **φτάνει στον καλούντα**: το email έφυγε, αλλά ένας πάροχος
        // είναι πεσμένος και αυτό δεν επιτρέπεται να είναι σιωπηλή επιτυχία.
        ...(failedOver ? { note: `Εφεδρικός πάροχος: ${providers}` } : {}),
      };

    } catch (error) {
      console.error('❌ ENTERPRISE EMAIL ERROR:', error);
      throw new Error(getErrorMessage(error, 'Failed to send email'));
    }
  }

  /**
   * Generate email subject based on template type
   */
  /**
   * 🔴 **ΥΠΕΓΡΑΦΕ ΜΟΝΟ ΤΟΥ, ΜΕ ΑΛΛΟ ΟΝΟΜΑ** (ADR-857 Φ7). Και οι τέσσερις κλάδοι
   * κολλούσαν **χειρόγραφα** `- Nestor Construct`, ενώ η εφαρμογή έχει **έναν** SSoT
   * υπογραφέα (`brandedSubject`) με πέντε νόμιμους καλούντες. Ήταν η **έκτη**, κρυφή
   * διαδρομή — και **ζωντανή**: φτάνει σε εισερχόμενα μέσω του property-share API.
   *
   * Το `brandedSubject` φέρνει μαζί και τον **φρουρό διπλής υπογραφής**: ένα θέμα που
   * υπογράφει ήδη (με το σημερινό **ή οποιοδήποτε παλιό** όνομα) δεν ξαναϋπογράφεται.
   *
   * 🔶 Η **ελληνική πρόζα** εδώ παραμένει σκληρή — **προϋπάρχον** χρέος i18n, δηλωμένο
   * στο ADR-857 §7· δεν επεκτείνεται σε αυτή την αλλαγή ταυτότητας.
   */
  private static generateSubject(templateType: EmailTemplateType, propertyTitle: string): string {
    switch (templateType) {
      case 'residential':
        return brandedSubject(`🏠 Το Σπίτι των Ονείρων σας: ${propertyTitle}`);
      case 'commercial':
        return brandedSubject(`🏢 Επαγγελματική Ευκαιρία: ${propertyTitle}`);
      case 'premium':
        return brandedSubject(`⭐ Premium Collection: ${propertyTitle}`);
      default:
        return brandedSubject(`🏠 Κοινοποίηση Ακινήτου: ${propertyTitle}`);
    }
  }

  /**
   * Get service status
   *
   * ⚠️ Ανέφερε **έναν** «ενεργό πάροχο» — έννοια που δεν υπάρχει πια, και δεν
   * υπήρχε ποτέ σωστά: ήταν απλώς ο πρώτος με κλειδί. Πλέον αναφέρει **ποιοι**
   * είναι ρυθμισμένοι, **ποιοι λείπουν** και **αν υπάρχει καθόλου εφεδρεία** — η
   * μόνη διατύπωση που ξεχωρίζει το «δεν λειτούργησε» από το «δεν υπήρχε».
   */
  static getStatus() {
    const status = describeChain(defaultEmailChain());
    return {
      configured: status.configured.length > 0,
      providers: status.configured,
      missingProviders: status.missing,
      hasFailover: status.hasFailover,
      environment: NODE_ENV,
      // 🔑 ADR-857 Φ9 — **η διάγνωση λέει ό,τι ΣΤΕΛΝΕΤΑΙ, όχι ό,τι διαβάστηκε κάποτε.**
      //    Πριν, ανέφερε τις module-scope σταθερές· αν η γραμμή `From:` άλλαζε από
      //    αλλού, το `getStatus()` θα έδειχνε τιμές που **δεν φεύγουν** — διαγνωστική
      //    που καθησυχάζει. Τώρα ρωτά την **ίδια** ρίζα με τον αποστολέα, και λέει
      //    **από ποιο σκαλί** ήρθε (`tenant` · `environment` · `platform`).
      ...(() => {
        const sender = resolveSenderIdentity();
        return { fromEmail: sender.address, fromName: sender.name, senderSource: sender.source };
      })(),
    };
  }
}

/** Οι αποτυχίες κάθε παραλήπτη, **ονομαστικά ανά πάροχο**. */
function summarizeFailures(
  outcomes: readonly Awaited<ReturnType<typeof sendThroughChain>>[],
): string {
  const reasons = outcomes.flatMap((outcome) => {
    if (outcome.kind === 'no-provider') return ['κανένας πάροχος ρυθμισμένος'];
    if (outcome.kind === 'all-failed') {
      return outcome.attempts.map((attempt) => `${attempt.provider}: ${attempt.error}`);
    }
    return [];
  });
  return [...new Set(reasons)].join(' | ') || 'άγνωστος λόγος';
}

