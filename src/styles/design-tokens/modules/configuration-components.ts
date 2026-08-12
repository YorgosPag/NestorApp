/**
 * Configuration Components Design Tokens
 * Extracted from design-tokens.ts — configurationComponents object
 * Config/data file (no line limit)
 */

import { colors, spacing, typography } from './foundations';
import { borderRadius } from './borders';

// ============================================================================
// ΚΟΙΝΑ ΘΡΑΥΣΜΑΤΑ — μία γραφή, πολλοί καταναλωτές
// ============================================================================
//
// 🔴 Εξήχθησαν επειδή το **CHECK 3.28 (jscpd)** τα ονόμασε: τρεις κλώνοι ≥50
// ψηφίων, όλοι **μέσα σε αυτό το αρχείο**. Ήταν προϋπάρχοντες — η μέτρηση με
// παρονομαστή (ίδιο αρχείο σε `HEAD` έναντι τώρα) το επιβεβαίωσε — αλλά ένα
// αρχείο που ακουμπιέται καθαρίζεται (N.0.2, Boy Scout).
//
// ⚠️ **ΔΕΝ εξήχθησαν και οι τέσσερις `header`**: οι δύο άλλες (`layout` ·
// `configurationCard`) είναι **πραγματικά διαφορετικές** — η μία είναι διαχωριστικό
// γραμμής, η άλλη διάταξη flex. Σύμπτυξη σε μία θα ήταν ισοπέδωση, όχι SSoT: το
// κριτήριο είναι «*είναι το ίδιο πράγμα;*», όχι «*μοιάζουν;*».

/**
 * Επικεφαλίδα ενότητας ρυθμίσεων — τίτλος με υπογράμμιση διαχωρισμού.
 * Κοινή σε `ruleEditor` και `notificationSettings`.
 */
const PANEL_HEADER = {
  fontSize: typography.fontSize.lg,
  fontWeight: typography.fontWeight.semibold,
  color: colors.text.primary,
  marginBottom: spacing.md,
  paddingBottom: spacing.sm,
  borderBottom: `1px solid ${colors.border.secondary}`
};

/**
 * Η βάση κάθε πεδίου εισόδου — `input`, `select` και (με επιπλέον ύψος) `textarea`.
 * Τα τρία **οφείλουν** να δείχνουν ίδια· γι' αυτό είναι μία δήλωση.
 */
const FIELD_BASE = {
  width: '100%',
  padding: spacing.sm,
  border: `1px solid ${colors.border.primary}`,
  borderRadius: borderRadius.sm,
  fontSize: typography.fontSize.sm,
  backgroundColor: colors.background.primary,
  color: colors.text.primary
};

export const configurationComponents = {
  layout: {
    container: {
      padding: spacing.lg,
      backgroundColor: colors.background.primary
    },
    header: {
      marginBottom: spacing.lg,
      paddingBottom: spacing.md,
      borderBottom: `1px solid ${colors.border.primary}`
    },
    title: {
      fontSize: typography.fontSize['2xl'],
      fontWeight: typography.fontWeight.bold,
      color: colors.text.primary,
      marginBottom: spacing.sm
    },
    subtitle: {
      fontSize: typography.fontSize.base,
      color: colors.text.secondary,
      lineHeight: typography.lineHeight.relaxed
    },
    contentGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 2fr',
      gap: spacing.xl,
      marginTop: spacing.lg
    },
    sidebar: {
      padding: spacing.lg,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md
    }
  },
  configurationCard: {
    base: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      cursor: 'pointer',
      transition: 'all 200ms ease'
    },
    selected: {
      backgroundColor: colors.background.hover,
      borderColor: colors.primary[500],
      transform: 'translateY(-1px)'
    },
    statusDot: {
      width: spacing.xs,
      height: spacing.xs,
      borderRadius: borderRadius.full,
      display: 'inline-block',
      marginRight: spacing.sm
    },
    // ✅ ENTERPRISE: Missing properties for AlertConfigurationInterface.styles.ts
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm
    },
    icon: {
      fontSize: typography.fontSize.xl,
      color: colors.text.secondary
    },
    titleContainer: {
      flex: 1,
      marginLeft: spacing.sm
    },
    title: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: spacing.xs
    },
    statusContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.xs
    },
    statusText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary
    },
    description: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      lineHeight: typography.lineHeight.relaxed,
      marginTop: spacing.sm
    }
  },
  buttons: {
    primary: {
      backgroundColor: colors.primary[500],
      color: colors.text.inverse,
      padding: `${spacing.sm} ${spacing.md}`,
      borderRadius: borderRadius.md,
      border: 'none',
      cursor: 'pointer',
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium
    },
    secondary: {
      backgroundColor: colors.background.secondary,
      color: colors.text.primary,
      padding: `${spacing.sm} ${spacing.md}`,
      borderRadius: borderRadius.md,
      border: `1px solid ${colors.border.primary}`,
      cursor: 'pointer',
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium
    },
    small: {
      padding: `${spacing.xs} ${spacing.sm}`,
      fontSize: typography.fontSize.xs
    }
  },
  ruleEditor: {
    container: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.md,
      padding: spacing.lg
    },
    header: PANEL_HEADER,
    section: {
      marginBottom: spacing.lg,
      paddingBottom: spacing.md,
      borderBottom: `1px solid ${colors.border.tertiary}`
    },
    label: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
      marginBottom: spacing.xs,
      display: 'block'
    },
    input: FIELD_BASE,
    textarea: {
      ...FIELD_BASE,
      minHeight: '100px',
      resize: 'vertical' as const // ✅ ENTERPRISE: Proper type literal
    },
    select: FIELD_BASE,
    gridTwoColumns: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: spacing.md
    },
    checkboxContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs
    },
    checkboxLabel: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      cursor: 'pointer'
    },
    mockSection: {
      backgroundColor: colors.background.secondary,
      border: `1px solid ${colors.border.secondary}`,
      borderRadius: borderRadius.sm,
      padding: spacing.md,
      marginTop: spacing.md
    },
    mockText: {
      fontSize: typography.fontSize.xs,
      color: colors.text.tertiary,
      fontStyle: 'italic'
    },
    mockButtonContainer: {
      display: 'flex',
      gap: spacing.sm,
      marginTop: spacing.sm
    },
    actionButtons: {
      display: 'flex',
      gap: spacing.sm,
      justifyContent: 'flex-end',
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTop: `1px solid ${colors.border.secondary}`
    }
  },
  notificationSettings: {
    container: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      marginTop: spacing.md
    },
    header: PANEL_HEADER,
    sectionTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
      marginBottom: spacing.sm,
      marginTop: spacing.md
    },
    channelsGrid: {
      display: 'grid',
      // Φρουρός `min(100%, …)` — αλλιώς υπερχείλιση σε δοχείο < 300 px (ADR-777 §8.21.6).
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
      gap: spacing.md,
      marginBottom: spacing.lg
    },
    channelItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      border: `1px solid ${colors.border.secondary}`,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.background.secondary
    },
    channelLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm
    },
    channelCheckbox: {
      width: '16px',
      height: '16px',
      cursor: 'pointer'
    },
    channelName: {
      fontSize: typography.fontSize.sm,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary
    },
    channelRight: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.xs
    },
    priorityLabel: {
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary,
      whiteSpace: 'nowrap' as const
    },
    priorityInput: {
      width: '60px',
      padding: spacing.xs,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.sm,
      fontSize: typography.fontSize.xs,
      backgroundColor: colors.background.primary,
      color: colors.text.primary,
      textAlign: 'center' as const
    },
    advancedGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: spacing.md,
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.sm,
      border: `1px solid ${colors.border.secondary}`
    },
    saveButtonContainer: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTop: `1px solid ${colors.border.secondary}`
    }
  },
  rulesSection: {
    headerContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
      paddingBottom: spacing.sm,
      borderBottom: `1px solid ${colors.border.secondary}`
    },
    title: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary
    },
    rulesGrid: {
      display: 'grid',
      // Φρουρός `min(100%, …)` — αλλιώς υπερχείλιση σε δοχείο < 350 px (ADR-777 §8.21.6).
      gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))',
      gap: spacing.md,
      marginTop: spacing.md
    },
    ruleCard: {
      backgroundColor: colors.background.primary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      cursor: 'pointer',
      transition: 'all 200ms ease',
      ':hover': {
        borderColor: colors.primary[500],
        boxShadow: `0 2px 8px rgba(0,0,0,0.1)`
      }
    },
    ruleHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.sm
    },
    ruleTitle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.semibold,
      color: colors.text.primary,
      marginBottom: spacing.xs
    },
    ruleMetadata: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
      fontSize: typography.fontSize.xs,
      color: colors.text.secondary
    },
    priorityText: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      padding: `${spacing.xs} ${spacing.sm}`,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.background.secondary,
      color: colors.text.secondary
    },
    ruleDescription: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      lineHeight: typography.lineHeight.relaxed,
      marginTop: spacing.sm
    }
  },
  loadingState: {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      border: `1px solid ${colors.border.secondary}`
    },
    content: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: spacing.md
    },
    spinner: {
      width: '32px',
      height: '32px',
      border: `3px solid ${colors.border.secondary}`,
      borderTop: `3px solid ${colors.primary[500]}`,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    text: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      textAlign: 'center' as const
    }
  },
  placeholderSection: {
    container: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.md,
      border: `1px dashed ${colors.border.secondary}`,
      marginTop: spacing.lg
    },
    title: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      color: colors.text.primary,
      marginBottom: spacing.sm
    },
    text: {
      fontSize: typography.fontSize.sm,
      color: colors.text.secondary,
      textAlign: 'center' as const,
      lineHeight: typography.lineHeight.relaxed
    }
  }
};
