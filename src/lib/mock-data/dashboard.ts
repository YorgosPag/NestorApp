import {
  Plus,
  Activity,
  Star,
  Upload,
} from "lucide-react";
import type { QuickStats, Activity as ActivityType, Meeting } from "@/types/dashboard";

export const quickStats: QuickStats = {
  totalContacts: 1247,
  newThisMonth: 89,
  favorites: 34,
  activeToday: 156,
};

export const recentActivities: ActivityType[] = [
  {
    id: 1,
    type: "contact_added",
    title: "Νέα επαφή προστέθηκε",
    description: "Γιώργος Παπαδόπουλος",
    time: "πριν 2 λεπτά",
    icon: Plus,
    color: "text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-400",
  },
  {
    id: 2,
    type: "contact_updated",
    title: "Ενημέρωση επαφής",
    description: "TechCorp Α.Ε. - Νέο τηλέφωνο",
    time: "πριν 15 λεπτά",
    icon: Activity,
    color: "text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-400",
  },
  {
    id: 3,
    type: "favorite_added",
    title: "Προστέθηκε στα αγαπημένα",
    description: "ΔΟΥ Α' Θεσσαλονίκης",
    time: "πριν 1 ώρα",
    icon: Star,
    color:
      "text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-400",
  },
  {
    id: 4,
    type: "import_completed",
    title: "Εισαγωγή ολοκληρώθηκε",
    description: "45 νέες επαφές",
    time: "πριν 3 ώρες",
    icon: Upload,
    color:
      "text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-400",
  },
];

export const upcomingMeetings: Meeting[] = [
  {
    id: 1,
    title: "Συνάντηση με Γιώργο Παπαδόπουλο",
    time: "10:00 - 11:00",
    date: "Σήμερα",
    type: "individual",
    location: "Γραφείο",
  },
  {
    id: 2,
    title: "Τηλεδιάσκεψη με TechCorp Α.Ε.",
    time: "14:30 - 15:30",
    date: "Σήμερα",
    type: "company",
    location: "Online",
  },
  {
    id: 3,
    title: "Ραντεβού στη ΔΟΥ",
    time: "09:00 - 10:00",
    date: "Αύριο",
    type: "service",
    location: "ΔΟΥ Α' Θεσσαλονίκης",
  },
];
