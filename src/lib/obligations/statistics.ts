import { ObligationDocument, ObligationSection } from '@/types/obligations';
import { calculateWordCount, estimateReadingTime } from './text-utils';
import { PROGRESS_THRESHOLDS, QUALITY_THRESHOLD } from '@/core/configuration/business-rules';
import { formatDate } from '@/lib/intl-utils';

export interface DocumentStatistics {
  totalSections: number;
  completedSections: number;
  requiredSections: number;
  optionalSections: number;
  totalWordCount: number;
  estimatedReadingTime: number;
  completionPercentage: number;
  qualityScore: number;
  categoryDistribution: Record<string, number>;
  lastModified: Date;
}

export interface ProgressMetrics {
  percentage: number;
  status: 'excellent' | 'good' | 'moderate' | 'poor';
  label: string;
  color: string;
  backgroundColor: string;
}

export interface ContentMetrics {
  totalWords: number;
  averageWordsPerSection: number;
  shortSections: number;
  readingTime: string;
  lastActivity: string;
}

export function calculateDocumentStatistics(document: ObligationDocument): DocumentStatistics {
  const sections = document.sections || [];
  const requiredSections = sections.filter(s => s.isRequired);
  const optionalSections = sections.filter(s => !s.isRequired);

  const completedSections = sections.filter(section => {
    const hasContent = section.content && section.content.trim().length > 0;
    const hasTitle = section.title && section.title.trim().length > 0;
    const meetsQuality = calculateWordCount(section.content) >= QUALITY_THRESHOLD;
    return hasContent && hasTitle && meetsQuality;
  });

  const totalWordCount = calculateDocumentWordCount(document);
  const estimatedReadingTime = estimateReadingTime(
    sections.map(s => s.content).join(' ')
  );

  const completionPercentage = sections.length > 0
    ? Math.round((completedSections.length / sections.length) * 100)
    : 0;

  const qualityScore = calculateQualityScore(document);
  const categoryDistribution = calculateCategoryDistribution(sections);

  return {
    totalSections: sections.length,
    completedSections: completedSections.length,
    requiredSections: requiredSections.length,
    optionalSections: optionalSections.length,
    totalWordCount,
    estimatedReadingTime,
    completionPercentage,
    qualityScore,
    categoryDistribution,
    lastModified: document.updatedAt
  };
}

export function calculateProgressMetrics(document: ObligationDocument): ProgressMetrics {
  const stats = calculateDocumentStatistics(document);
  const percentage = stats.completionPercentage;

  let status: ProgressMetrics['status'];
  let label: string;
  let color: string;
  let backgroundColor: string;

  if (percentage >= PROGRESS_THRESHOLDS.excellent) {
    status = 'excellent';
    label = 'Άριστη Πρόοδος';
    color = '#10B981';
    backgroundColor = '#ECFDF5';
  } else if (percentage >= PROGRESS_THRESHOLDS.good) {
    status = 'good';
    label = 'Καλή Πρόοδος';
    color = '#3B82F6';
    backgroundColor = '#EFF6FF';
  } else if (percentage >= PROGRESS_THRESHOLDS.moderate) {
    status = 'moderate';
    label = 'Μέτρια Πρόοδος';
    color = '#F59E0B';
    backgroundColor = '#FFFBEB';
  } else {
    status = 'poor';
    label = 'Χρειάζεται Προσοχή';
    color = '#EF4444';
    backgroundColor = '#FEF2F2';
  }

  return {
    percentage,
    status,
    label,
    color,
    backgroundColor
  };
}

export function calculateContentMetrics(document: ObligationDocument): ContentMetrics {
  const stats = calculateDocumentStatistics(document);
  const sections = document.sections || [];

  const averageWordsPerSection = sections.length > 0
    ? Math.round(stats.totalWordCount / sections.length)
    : 0;

  const shortSections = sections.filter(section =>
    calculateWordCount(section.content) < QUALITY_THRESHOLD
  ).length;

  const readingTime = stats.estimatedReadingTime < 1
    ? 'Λιγότερο από 1 λεπτό'
    : stats.estimatedReadingTime === 1
      ? '1 λεπτό'
      : `${stats.estimatedReadingTime} λεπτά`;

  const lastActivity = formatLastActivity(document.updatedAt);

  return {
    totalWords: stats.totalWordCount,
    averageWordsPerSection,
    shortSections,
    readingTime,
    lastActivity
  };
}

function calculateDocumentWordCount(document: ObligationDocument): number {
  let totalWords = 0;

  document.sections?.forEach(section => {
    totalWords += calculateWordCount(section.content);

    section.articles?.forEach(article => {
      totalWords += calculateWordCount(article.content);

      article.paragraphs?.forEach(paragraph => {
        totalWords += calculateWordCount(paragraph.content);
      });
    });
  });

  return totalWords;
}

function calculateQualityScore(document: ObligationDocument): number {
  const sections = document.sections || [];
  if (sections.length === 0) return 0;

  let totalScore = 0;
  const maxScore = sections.length * 100;

  sections.forEach(section => {
    let sectionScore = 0;

    if (section.title && section.title.trim().length > 0) {
      sectionScore += 20;
    }

    if (section.content && section.content.trim().length > 0) {
      sectionScore += 30;
    }

    const wordCount = calculateWordCount(section.content);
    if (wordCount >= QUALITY_THRESHOLD) {
      sectionScore += 30;
    }

    if (section.articles && section.articles.length > 0) {
      sectionScore += 20;
    }

    totalScore += sectionScore;
  });

  return Math.round((totalScore / maxScore) * 100);
}

function calculateCategoryDistribution(sections: ObligationSection[]): Record<string, number> {
  const distribution: Record<string, number> = {};

  sections.forEach(section => {
    const category = section.category;
    distribution[category] = (distribution[category] || 0) + 1;
  });

  return distribution;
}

function formatLastActivity(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffHours < 1) {
    return 'Τώρα';
  } else if (diffHours < 24) {
    const hours = Math.floor(diffHours);
    return `${hours} ώρα${hours > 1 ? 'ες' : ''} πριν`;
  } else if (diffDays < 7) {
    const days = Math.floor(diffDays);
    return `${days} μέρα${days > 1 ? 'ες' : ''} πριν`;
  } else {
    return formatDate(date);
  }
}