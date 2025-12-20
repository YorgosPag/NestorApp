import { ObligationDocument, ObligationSection, ObligationArticle } from '@/types/obligations';
import { WORD_COUNT_THRESHOLDS } from '@/core/configuration/business-rules';
import { formatDate } from '@/lib/intl-utils';

export function convertToMarkdown(document: ObligationDocument): string {
  let markdown = '';

  markdown += `# ${document.title}\n\n`;

  markdown += `**Έργο:** ${document.projectName}\n`;
  markdown += `**Ανάδοχος:** ${document.contractorCompany}\n`;

  if (document.owners && document.owners.length > 0) {
    markdown += `**Ιδιοκτήτες:** ${document.owners.map(o => o.name).join(', ')}\n`;
  }

  markdown += `**Ημερομηνία:** ${formatDate(document.createdAt)}\n\n`;

  if (document.projectDetails) {
    markdown += '## Στοιχεία Έργου\n\n';
    const details = document.projectDetails;

    if (details.location) markdown += `**Περιοχή:** ${details.location}\n`;
    if (details.address) markdown += `**Διεύθυνση:** ${details.address}\n`;
    if (details.plotNumber) markdown += `**Αριθμός Οικοπέδου:** ${details.plotNumber}\n`;
    if (details.buildingPermitNumber) markdown += `**Αριθμός Οικοδομικής Άδειας:** ${details.buildingPermitNumber}\n`;
    if (details.contractDate) markdown += `**Ημερομηνία Σύμβασης:** ${formatDate(details.contractDate)}\n`;
    if (details.deliveryDate) markdown += `**Ημερομηνία Παράδοσης:** ${formatDate(details.deliveryDate)}\n`;
    if (details.notaryName) markdown += `**Συμβολαιογράφος:** ${details.notaryName}\n`;

    markdown += '\n';
  }

  if (document.tableOfContents && document.tableOfContents.length > 0) {
    markdown += '## Πίνακας Περιεχομένων\n\n';
    document.tableOfContents.forEach(item => {
      const indent = '  '.repeat(item.level - 1);
      const pageInfo = item.page ? ` (σελ. ${item.page})` : '';
      markdown += `${indent}- ${item.number} ${item.title}${pageInfo}\n`;
    });
    markdown += '\n';
  }

  if (document.sections && document.sections.length > 0) {
    document.sections.forEach(section => {
      markdown += convertSectionToMarkdown(section);
    });
  }

  return markdown;
}

function convertSectionToMarkdown(section: ObligationSection): string {
  let markdown = '';

  markdown += `## ${section.number} ${section.title}\n\n`;

  if (section.content) {
    const plainContent = section.content
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    markdown += `${plainContent}\n\n`;
  }

  if (section.articles && section.articles.length > 0) {
    section.articles.forEach(article => {
      markdown += convertArticleToMarkdown(article);
    });
  }

  return markdown;
}

function convertArticleToMarkdown(article: ObligationArticle): string {
  let markdown = '';

  markdown += `### ${article.number} ${article.title}\n\n`;

  if (article.content) {
    const plainContent = article.content
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    markdown += `${plainContent}\n\n`;
  }

  if (article.paragraphs && article.paragraphs.length > 0) {
    article.paragraphs.forEach(paragraph => {
      markdown += `**${paragraph.number}** ${paragraph.content}\n\n`;
    });
  }

  return markdown;
}

export function generateTemplateContent(category: string): string {
  const templates: Record<string, string> = {
    general: `
      <p>Η παρούσα ενότητα περιλαμβάνει τους γενικούς όρους και προϋποθέσεις που διέπουν την εκτέλεση του έργου.</p>
      <p>Όλες οι εργασίες θα εκτελούνται σύμφωνα με τους ισχύοντες κανονισμούς και προδιαγραφές.</p>
    `,
    construction: `
      <p>Οι κατασκευαστικές εργασίες θα εκτελούνται με τη μεγαλύτερη δυνατή ακρίβεια και ποιότητα.</p>
      <p>Όλα τα υλικά θα είναι πρώτης ποιότητας και θα φέρουν τις απαραίτητες πιστοποιήσεις.</p>
    `,
    materials: `
      <p>Τα υλικά που θα χρησιμοποιηθούν θα είναι καινούργια και σύμφωνα με τις ευρωπαϊκές προδιαγραφές.</p>
      <p>Κάθε υλικό θα συνοδεύεται από πιστοποιητικό ποιότητας και εγγύηση κατασκευαστή.</p>
    `,
    systems: `
      <p>Τα συστήματα του κτιρίου θα σχεδιαστούν και εγκατασταθούν από ειδικευμένο προσωπικό.</p>
      <p>Όλες οι εγκαταστάσεις θα είναι σύμφωνες με τους ισχύοντες κανονισμούς ασφαλείας.</p>
    `,
    finishes: `
      <p>Τα φινιρίσματα θα εκτελούνται με ιδιαίτερη προσοχή στη λεπτομέρεια και την αισθητική.</p>
      <p>Όλες οι επιφάνειες θα είναι λείες, ομοιόμορφες και χωρίς ελαττώματα.</p>
    `,
    installations: `
      <p>Οι εγκαταστάσεις θα εκτελούνται από ειδικευμένα συνεργεία με την κατάλληλη άδεια.</p>
      <p>Μετά την ολοκλήρωση θα γίνουν οι απαραίτητες δοκιμές λειτουργίας.</p>
    `,
    safety: `
      <p>Η ασφάλεια των εργαζομένων και του κοινού είναι η ανώτατη προτεραιότητα.</p>
      <p>Θα εφαρμόζονται αυστηρά όλα τα μέτρα ασφαλείας και προστασίας.</p>
    `,
    environment: `
      <p>Όλες οι εργασίες θα εκτελούνται με σεβασμό στο περιβάλλον.</p>
      <p>Θα εφαρμόζονται πρακτικές βιώσιμης ανάπτυξης και ανακύκλωσης.</p>
    `
  };

  return templates[category] || templates.general;
}

export function generateSectionNumber(existingSections: ObligationSection[]): string {
  const maxNumber = existingSections.reduce((max, section) => {
    const num = parseInt(section.number, 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  return (maxNumber + 1).toString();
}

export function generateArticleNumber(existingArticles: ObligationArticle[]): string {
  const maxNumber = existingArticles.reduce((max, article) => {
    const parts = article.number.split('.');
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  return (maxNumber + 1).toString();
}

export function validateMarkdownContent(content: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!content.trim()) {
    errors.push('Το περιεχόμενο δεν μπορεί να είναι κενό');
  }

  if (content.length < WORD_COUNT_THRESHOLDS.minimum) {
    errors.push(`Το περιεχόμενο είναι πολύ σύντομο (ελάχιστο ${WORD_COUNT_THRESHOLDS.minimum} χαρακτήρες)`);
  }

  const htmlTagsPattern = /<script|<iframe|<object|<embed/i;
  if (htmlTagsPattern.test(content)) {
    errors.push('Το περιεχόμενο περιέχει μη επιτρεπτά HTML tags');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}