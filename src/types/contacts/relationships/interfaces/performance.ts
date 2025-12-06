// ============================================================================
// PERFORMANCE & HR INFORMATION INTERFACES - ENTERPRISE MODULE
// ============================================================================
//
// 📊 Professional performance and HR-related data structures
// Enterprise-grade employee relationship tracking
// Part of modular Enterprise relationship types architecture
//
// ============================================================================

/**
 * 📊 Performance & HR Information
 *
 * Professional performance and HR-related data
 * Enterprise-grade employee relationship tracking
 */
export interface PerformanceInfo {
  /** ⭐ Performance rating */
  performanceRating?: 'excellent' | 'good' | 'satisfactory' | 'needs_improvement' | 'unsatisfactory';

  /** 📅 Last performance review date */
  lastReviewDate?: string;

  /** 📅 Next review due date */
  nextReviewDate?: string;

  /** 🎯 Goals/objectives */
  currentGoals?: string[];

  /** 🏆 Achievements/awards */
  achievements?: string[];

  /** 📚 Training/certifications */
  trainings?: string[];

  /** 📈 Career development plan */
  careerPlan?: string;

  /** 🚨 Disciplinary actions */
  disciplinaryActions?: string[];

  /** 💯 Skills assessment */
  skillsAssessment?: Record<string, number>; // skill -> rating (1-5)

  /** 📝 Manager notes */
  managerNotes?: string;
}