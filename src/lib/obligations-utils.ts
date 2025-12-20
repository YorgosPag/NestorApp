import type { 
  ObligationDocument, 
  ObligationSection, 
  ObligationArticle, 
  ObligationParagraph, 
  SectionCategory 
} from '@/types/obligations';

/* ============================================================================
 * Constants & Config (αντί για "μαγικούς" αριθμούς)
 * ==========================================================================*/
const MIN_CONTENT_LENGTH = 10;
const WORDS_PER_MINUTE = 200;

const FILE_NAME_MAX_LEN = 128;

/* ============================================================================
 * Type-safe Maps για status & category (compiler-enforced)
 * ==========================================================================*/
type ObligationStatus = ObligationDocument["status"];

const STATUS_LABELS: Record<ObligationStatus, string> = {
  draft: "Προσχέδιο",
  completed: "Ολοκληρωμένο",
  approved: "Εγκεκριμένο",
};

const STATUS_COLORS: Record<ObligationStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  approved: "bg-blue-100 text-blue-800 border-blue-200",
};

const STATUS_ICONS: Record<ObligationStatus, string> = {
  draft: "📝",
  completed: "✅",
  approved: "🔐",
};

const CATEGORY_LABELS: Record<SectionCategory, string> = {
  general: "Γενικά",
  construction: "Κατασκευή",
  materials: "Υλικά",
  systems: "Συστήματα",
  finishes: "Φινιρίσματα",
  installations: "Εγκαταστάσεις",
  safety: "Ασφάλεια",
  environment: "Περιβάλλον",
};

const CATEGORY_COLORS: Record<SectionCategory, string> = {
  general: "bg-blue-100 text-blue-800 border-blue-200",
  construction: "bg-green-100 text-green-800 border-green-200",
  materials: "bg-yellow-100 text-yellow-800 border-yellow-200",
  systems: "bg-purple-100 text-purple-800 border-purple-200",
  finishes: "bg-pink-100 text-pink-800 border-pink-200",
  installations: "bg-orange-100 text-orange-800 border-orange-200",
  safety: "bg-red-100 text-red-800 border-red-200",
  environment: "bg-teal-100 text-teal-800 border-teal-200",
};

const CATEGORY_ICONS: Record<SectionCategory, string> = {
  general: "📋",
  construction: "🏗️",
  materials: "🧱",
  systems: "⚙️",
  finishes: "🎨",
  installations: "🔌",
  safety: "🦺",
  environment: "🌱",
};

/* ============================================================================
 * Status utilities
 * ==========================================================================*/
export const getStatusLabel = (status: ObligationStatus): string =>
  STATUS_LABELS[status];

export const getStatusColor = (status: ObligationStatus): string =>
  STATUS_COLORS[status] || "bg-gray-100 text-gray-800";

export const getStatusIcon = (status: ObligationStatus): string =>
  STATUS_ICONS[status];

/* ============================================================================
 * Category utilities
 * ==========================================================================*/
export const getCategoryLabel = (category: SectionCategory): string =>
  CATEGORY_LABELS[category];

export const getCategoryColor = (category: SectionCategory): string =>
  CATEGORY_COLORS[category];

export const getCategoryIcon = (category: SectionCategory): string =>
  CATEGORY_ICONS[category];

/* ============================================================================
 * Validation helpers (DRY)
 * ==========================================================================*/
const requireField = (value: string | undefined, label: string) =>
  !value?.trim() ? `${label} είναι υποχρεωτικό` : null;

const hasMinContent = (value: string | undefined, min = MIN_CONTENT_LENGTH) =>
  value?.trim().length && value.trim().length >= min;

/* ============================================================================
 * Validation
 * ==========================================================================*/
export const validateObligation = (
  obligation: Partial<ObligationDocument>
): string[] => {
  const errors: string[] = [];

  const e = [
    requireField(obligation.title, "Ο τίτλος"),
    requireField(obligation.projectName, "Το όνομα του έργου"),
    requireField(obligation.contractorCompany, "Η εργολάβος εταιρεία"),
  ].filter(Boolean) as string[];
  errors.push(...e);

  if (!obligation.owners || obligation.owners.length === 0) {
    errors.push("Πρέπει να υπάρχει τουλάχιστον ένας ιδιοκτήτης");
  }

  if (obligation.owners) {
    obligation.owners.forEach((owner, index) => {
      const msg = requireField(owner?.name, `Το όνομα του ιδιοκτήτη ${index + 1}`);
      if (msg) errors.push(msg);
    });

    const ownersWithShares = obligation.owners.filter(
      (owner) => owner.share !== undefined && owner.share > 0
    );
    if (ownersWithShares.length > 0) {
      const totalShares = ownersWithShares.reduce(
        (sum, owner) => sum + (owner.share || 0),
        0
      );
      if (Math.abs(totalShares - 100) > 0.01) {
        errors.push(
          `Τα μερίδια πρέπει να αθροίζουν στο 100% (τρέχον σύνολο: ${totalShares.toFixed(
            2
          )}%)`
        );
      }
    }
  }

  if (obligation.sections && obligation.sections.length > 0) {
    obligation.sections.forEach((section, sIndex) => {
      const sectionErrors = validateSection(section);
      sectionErrors.forEach((error) =>
        errors.push(`Ενότητα ${sIndex + 1}: ${error}`)
      );

      if (section.articles) {
        section.articles.forEach((article, aIndex) => {
          const articleErrors = validateArticle(article);
          articleErrors.forEach((error) =>
            errors.push(`Ενότητα ${sIndex + 1}, Άρθρο ${aIndex + 1}: ${error}`)
          );

          if (article.paragraphs) {
            article.paragraphs.forEach((paragraph, pIndex) => {
              const paragraphErrors = validateParagraph(paragraph);
              paragraphErrors.forEach((error) =>
                errors.push(
                  `Ενότητα ${sIndex + 1}, Άρθρο ${aIndex + 1}, Παράγραφος ${
                    pIndex + 1
                  }: ${error}`
                )
              );
            });
          }
        });
      }
    });
  }

  return errors;
};

export const validateSection = (
  section: Partial<ObligationSection>
): string[] => {
  const errors: string[] = [];
  const e = [
    requireField(section.title, "Ο τίτλος της ενότητας"),
    requireField(section.number, "Ο αριθμός άρθρου"),
    requireField(section.content, "Το περιεχόμενο της ενότητας"),
  ].filter(Boolean) as string[];
  errors.push(...e);
  return errors;
};

export const validateArticle = (
  article: Partial<ObligationArticle>
): string[] => {
  const errors: string[] = [];
  const e = [
    requireField(article.title, "Ο τίτλος του άρθρου"),
    requireField(article.number, "Ο αριθμός του άρθρου"),
  ].filter(Boolean) as string[];
  errors.push(...e);
  return errors;
};

export const validateParagraph = (
  paragraph: Partial<ObligationParagraph>
): string[] => {
  const errors: string[] = [];
  const e = [
    requireField(paragraph.content, "Το περιεχόμενο της παραγράφου"),
    requireField(paragraph.number, "Ο αριθμός της παραγράφου"),
  ].filter(Boolean) as string[];
  errors.push(...e);
  return errors;
};

/* ============================================================================
 * Text utils
 * ==========================================================================*/
export const generateObligationTitle = (
  projectName: string,
  location?: string
): string => {
  let title = `Συγγραφή Υποχρεώσεων - ${projectName}`;
  if (location) title += ` (${location})`;
  return title;
};

export const truncateText = (text: string, maxLength = 100): string =>
  text.length <= maxLength ? text : text.slice(0, maxLength).trim() + "...";

export const getWordCount = (text: string): number =>
  !text ? 0 : text.trim().split(/\s+/).filter(Boolean).length;

export const getCharacterCount = (text: string): number => text?.length || 0;

export const getReadingTime = (text: string): number =>
  Math.ceil(getWordCount(text) / WORDS_PER_MINUTE);

/* ============================================================================
 * Content metrics (sections/articles/paragraphs)
 * ==========================================================================*/
export const getTotalWordCount = (document: ObligationDocument): number => {
  let totalWords = 0;
  document.sections.forEach((section) => {
    totalWords += getWordCount(section.content || "");
    section.articles?.forEach((article) => {
      totalWords += getWordCount(article.content || "");
      article.paragraphs?.forEach((paragraph) => {
        totalWords += getWordCount(paragraph.content || "");
      });
    });
  });
  return totalWords;
};

export const getDocumentReadingTime = (document: ObligationDocument): number =>
  Math.ceil(getTotalWordCount(document) / WORDS_PER_MINUTE);

export const getContentSummary = (document: ObligationDocument) => {
  const sectionsCount = document.sections.length;
  const articlesCount = document.sections.reduce(
    (sum, s) => sum + (s.articles?.length || 0),
    0
  );
  const paragraphsCount = document.sections.reduce(
    (sum, s) =>
      sum +
      (s.articles?.reduce(
        (aSum, a) => aSum + (a.paragraphs?.length || 0),
        0
      ) || 0),
    0
  );
  const totalWords = getTotalWordCount(document);
  const readingTime = getDocumentReadingTime(document);

  const characters = document.sections.reduce((sum, s) => {
    let sectionChars = getCharacterCount(s.content || "");
    s.articles?.forEach((a) => {
      sectionChars += getCharacterCount(a.content || "");
      a.paragraphs?.forEach((p) => {
        sectionChars += getCharacterCount(p.content || "");
      });
    });
    return sum + sectionChars;
  }, 0);

  return {
    sections: sectionsCount,
    articles: articlesCount,
    paragraphs: paragraphsCount,
    words: totalWords,
    readingTime,
    characters,
  };
};

/* ============================================================================
 * Dates
 * ==========================================================================*/
// ⚠️ DEPRECATED: Use formatDateLong from intl-utils.ts for enterprise date formatting
// 🔄 BACKWARD COMPATIBILITY: This function is maintained for legacy support
// 📍 MIGRATION: import { formatDateLong } from '@/lib/intl-utils'
export const formatDate = (date: Date): string => {
  // Re-export centralized function for backward compatibility
  const { formatDateLong } = require('./intl-utils');
  return formatDateLong(date);
};

export const formatShortDate = (date: Date): string => {
  if (!date || isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("el-GR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

export const formatDateTime = (date: Date): string => {
  if (!date || isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("el-GR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const getRelativeTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Σήμερα";
  if (days === 1) return "Χθες";
  if (days < 7) return `${days} ημέρες πριν`;
  if (days < 30) return `${Math.floor(days / 7)} εβδομάδες πριν`;
  if (days < 365) return `${Math.floor(days / 30)} μήνες πριν`;
  return `${Math.floor(days / 365)} χρόνια πριν`;
};

/* ============================================================================
 * File name generation (με καλύτερο normalization)
 * ==========================================================================*/
const normalizeGreek = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-zA-Zα-ωΑ-Ω0-9\s-]/g, "")
    .trim();

export const generateFileName = (
  obligation: ObligationDocument,
  extension = "pdf"
): string => {
  const raw = obligation.title || "document";
  const sanitizedTitle = normalizeGreek(raw).replace(/\s+/g, "_").toLowerCase();
  const date = formatShortDate(new Date()).replace(/\//g, "-");
  const base = `${sanitizedTitle}_${date}`.slice(0, FILE_NAME_MAX_LEN);
  return `${base}.${extension}`;
};

/* ============================================================================
 * Search (με preview context)
 * ==========================================================================*/
export const highlightSearchTerm = (text: string, searchTerm: string): string => {
  if (!searchTerm.trim()) return text;
  const safe = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${safe})`, "gi");
  return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
};

export const searchInText = (text: string, searchTerm: string): boolean =>
  text.toLowerCase().includes(searchTerm.toLowerCase());

const buildPreview = (text = "", term = "", context = 40) => {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return { preview: "", index: -1 };
  const start = Math.max(0, idx - context);
  const end = Math.min(text.length, idx + term.length + context);
  const preview =
    (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
  return { preview, index: idx };
};

export const searchInDocument = (
  document: ObligationDocument,
  searchTerm: string
): {
  sections: Array<ObligationSection & { matchPreview?: string }>;
  articles: Array<ObligationArticle & { sectionId: string; matchPreview?: string }>;
  paragraphs: Array<
    ObligationParagraph & { sectionId: string; articleId: string; matchPreview?: string }
  >;
} => {
  const results = {
    sections: [] as Array<ObligationSection & { matchPreview?: string }>,
    articles: [] as Array<
      ObligationArticle & { sectionId: string; matchPreview?: string }
    >,
    paragraphs: [] as Array<
      ObligationParagraph & { sectionId: string; articleId: string; matchPreview?: string }
    >,
  };

  if (!searchTerm.trim()) return results;

  document.sections.forEach((section) => {
    const textToSearch = `${section.title}\n${section.content || ""}`;
    if (searchInText(textToSearch, searchTerm)) {
      const { preview } = buildPreview(textToSearch, searchTerm);
      results.sections.push({ ...section, matchPreview: preview });
    }

    section.articles?.forEach((article) => {
      const at = `${article.title}\n${article.content || ""}`;
      if (searchInText(at, searchTerm)) {
        const { preview } = buildPreview(at, searchTerm);
        results.articles.push({ ...article, sectionId: section.id, matchPreview: preview });
      }

      article.paragraphs?.forEach((paragraph) => {
        const pt = paragraph.content || "";
        if (searchInText(pt, searchTerm)) {
          const { preview } = buildPreview(pt, searchTerm);
          results.paragraphs.push({
            ...paragraph,
            sectionId: section.id,
            articleId: article.id,
            matchPreview: preview,
          });
        }
      });
    });
  });

  return results;
};

/* ============================================================================
 * Sorting (date-safe, null-safe)
 * ==========================================================================*/
const isISODate = (v: unknown) =>
  typeof v === "string" && !Number.isNaN(Date.parse(v));

export const sortObligations = (
  obligations: ObligationDocument[],
  sortBy: "title" | "projectName" | "createdAt" | "updatedAt" | "status",
  sortOrder: "asc" | "desc" = "desc"
): ObligationDocument[] => {
  return [...obligations].sort((a, b) => {
    let aValue: any = (a as any)[sortBy];
    let bValue: any = (b as any)[sortBy];

    if (aValue == null && bValue != null) return sortOrder === "asc" ? -1 : 1;
    if (aValue != null && bValue == null) return sortOrder === "asc" ? 1 : -1;
    if (aValue == null && bValue == null) return 0;

    if (aValue instanceof Date && bValue instanceof Date) {
      aValue = aValue.getTime();
      bValue = bValue.getTime();
    } else if (isISODate(aValue) && isISODate(bValue)) {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    } else if (typeof aValue === "string" && typeof bValue === "string") {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    let comparison = 0;
    if (aValue > bValue) comparison = 1;
    if (aValue < bValue) comparison = -1;

    return sortOrder === "desc" ? -comparison : comparison;
  });
};

/* ============================================================================
 * Statistics / Progress
 * ==========================================================================*/
export const calculateProgress = (sections: ObligationSection[]): number => {
  if (sections.length === 0) return 0;
  const completed = sections.filter((s) => hasMinContent(s.content)).length;
  return Math.round((completed / sections.length) * 100);
};

export const calculateCompletionPercentage = (
  sections: ObligationSection[]
): number => {
  if (sections.length === 0) return 0;

  let total = 0;
  let done = 0;

  sections.forEach((section) => {
    total++;
    if (hasMinContent(section.content)) done++;
    section.articles?.forEach((article) => {
      total++;
      if (hasMinContent(article.content)) done++;
      article.paragraphs?.forEach((p) => {
        total++;
        if (hasMinContent(p.content)) done++;
      });
    });
  });

  return total > 0 ? Math.round((done / total) * 100) : 0;
};

export const getObligationStats = (obligations: ObligationDocument[]) => {
  const total = obligations.length;
  const draft = obligations.filter((o) => o.status === "draft").length;
  const completed = obligations.filter((o) => o.status === "completed").length;
  const approved = obligations.filter((o) => o.status === "approved").length;

  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthCount = obligations.filter(
    (o) => (o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt)) >= thisMonth
  ).length;

  const avgSections =
    total > 0
      ? Math.round(
          obligations.reduce((sum, o) => sum + (o.sections?.length || 0), 0) / total
        )
      : 0;

  const avgCompletion =
    total > 0
      ? Math.round(
          obligations.reduce(
            (sum, o) => sum + calculateCompletionPercentage(o.sections || []),
            0
          ) / total
        )
      : 0;

  return {
    total,
    draft,
    completed,
    approved,
    thisMonth: thisMonthCount,
    avgSections,
    avgCompletion,
    completionRate: total > 0 ? Math.round(((completed + approved) / total) * 100) : 0,
  };
};

/* ============================================================================
 * Templates / Apply
 * ==========================================================================*/
export const applyTemplate = (
  obligation: Partial<ObligationDocument>,
  templateSections: ObligationSection[]
): Partial<ObligationDocument> => {
  return {
    ...obligation,
    sections: templateSections.map((section, index) => ({
      ...section,
      id: `${section.id}-${Date.now()}-${index}`,
      order: index,
    })),
  };
};

/* ============================================================================
 * Content helpers
 * ==========================================================================*/
export const stripHtmlTags = (html: string): string =>
  html.replace(/<[^>]*>/g, "");

export const convertMarkdownToHtml = (markdown: string): string => {
  if (!markdown) return "";

  let html = markdown;

  // 1. Handle bold text
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // 2. Handle italic text
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // 3. Handle underline text
  html = html.replace(/<u>(.*?)<\/u>/g, "<u>$1</u>");

  // 4. Handle blockquotes
  html = html.replace(/^> (.*$)/gm, "<blockquote>$1</blockquote>");

  // 5. Handle bullet lists (multi-line support)
  const bulletLines = html.split('\n');
  let inBulletList = false;
  const processedLines: string[] = [];

  bulletLines.forEach((line) => {
    const isBulletLine = /^\* (.*)$/.test(line);

    if (isBulletLine && !inBulletList) {
      // Start new bullet list
      processedLines.push('<ul>');
      processedLines.push(`<li>${line.replace(/^\* /, '')}</li>`);
      inBulletList = true;
    } else if (isBulletLine && inBulletList) {
      // Continue bullet list
      processedLines.push(`<li>${line.replace(/^\* /, '')}</li>`);
    } else if (!isBulletLine && inBulletList) {
      // End bullet list
      processedLines.push('</ul>');
      processedLines.push(line);
      inBulletList = false;
    } else {
      processedLines.push(line);
    }
  });

  // Close any open bullet list
  if (inBulletList) {
    processedLines.push('</ul>');
  }

  html = processedLines.join('\n');

  // 6. Handle numbered lists (similar logic)
  const numberedLines = html.split('\n');
  let inNumberedList = false;
  const processedNumberedLines: string[] = [];

  numberedLines.forEach((line) => {
    const isNumberedLine = /^\d+\. (.*)$/.test(line);

    if (isNumberedLine && !inNumberedList) {
      // Start new numbered list
      processedNumberedLines.push('<ol>');
      processedNumberedLines.push(`<li>${line.replace(/^\d+\. /, '')}</li>`);
      inNumberedList = true;
    } else if (isNumberedLine && inNumberedList) {
      // Continue numbered list
      processedNumberedLines.push(`<li>${line.replace(/^\d+\. /, '')}</li>`);
    } else if (!isNumberedLine && inNumberedList) {
      // End numbered list
      processedNumberedLines.push('</ol>');
      processedNumberedLines.push(line);
      inNumberedList = false;
    } else {
      processedNumberedLines.push(line);
    }
  });

  // Close any open numbered list
  if (inNumberedList) {
    processedNumberedLines.push('</ol>');
  }

  html = processedNumberedLines.join('\n');

  // 7. Handle paragraphs (convert double line breaks to paragraph breaks)
  html = html.replace(/\n\n/g, '</p><p>');

  // 8. Handle single line breaks (convert to <br>)
  html = html.replace(/\n/g, '<br>');

  // 9. Wrap in paragraph tags if not already wrapped
  if (!html.startsWith('<p>') && !html.startsWith('<ul>') && !html.startsWith('<ol>') && !html.startsWith('<blockquote>')) {
    html = `<p>${html}</p>`;
  }

  // 10. Fix paragraph closing/opening tags
  html = html.replace(/<\/p><p>/g, '</p>\n<p>');

  return html;
};

/* ============================================================================
 * IDs
 * ==========================================================================*/
export const generateSectionId = (): string =>
  `section-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

/* ============================================================================
 * Exporters (future-proofing)
 * ==========================================================================*/
export interface DocumentExporter {
  export(document: ObligationDocument): Promise<void>;
}

class PDFExporter implements DocumentExporter {
  async export(document: ObligationDocument): Promise<void> {
    // εδώ θα μπει jsPDF/Print API κ.λπ.
    console.log("PDF Export functionality to be implemented", {
      title: document.title,
      sections: document.sections?.length ?? 0,
    });
  }
}

/**
 * Συμβατό με το υπάρχον API — τώρα χρησιμοποιεί το interface.
 */
export const exportToPDF = async (
  document: ObligationDocument
): Promise<void> => {
  const exporter = new PDFExporter();
  return exporter.export(document);
};
