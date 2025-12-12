'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Users, Phone, Target, ClipboardList, Filter, Users2, Bell, AppWindow, Mail, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { COMPLEX_HOVER_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';

const crmSections = [
    { title: 'Dashboard CRM', href: '/crm/dashboard', icon: BarChart, description: 'Συνολική εικόνα των πελατειακών σχέσεων.' },
    { title: 'Διαχείριση Πελατών', href: '/crm/customers', icon: Users, description: 'Διαχείριση όλων των πελατών.' },
    { title: 'Επικοινωνίες', href: '/crm/communications', icon: Phone, description: 'Καταγραφή όλων των αλληλεπιδράσεων.' },
    { title: 'Email Analytics', href: '/crm/email-analytics', icon: BarChart3, description: 'Αναλυτικά στοιχεία email marketing και κοινοποιήσεων.' },
    { title: 'Leads & Ευκαιρίες', href: '/crm/leads', icon: Target, description: 'Παρακολούθηση πιθανών πελατών.' },
    { title: 'Εργασίες & Ραντεβού', href: '/crm/tasks', icon: ClipboardList, description: 'Οργάνωση των καθηκόντων σας.' },
    { title: 'Πωλήσεις Pipeline', href: '/crm/pipeline', icon: Filter, description: 'Οπτικοποίηση της διαδικασίας πωλήσεων.' },
    { title: 'Ομάδες & Ρόλοι', href: '/crm/teams', icon: Users2, description: 'Διαχείριση δικαιωμάτων ομάδων.' },
    { title: 'Ειδοποιήσεις', href: '/crm/notifications', icon: Bell, description: 'Κεντρικές ειδοποιήσεις του CRM.' },
]

export default function CrmPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
                <AppWindow className="h-6 w-6 text-white" />
            </div>
            <div>
                <h1 className="text-3xl font-bold text-foreground">Customer Relationship Management (CRM)</h1>
                <p className="text-lg text-muted-foreground">
                    Κεντρική διαχείριση πελατών, πωλήσεων και επικοινωνιών.
                </p>
            </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {crmSections.map((section) => (
          <Link href={section.href} key={section.title} legacyBehavior>
            <a className="block h-full">
              <Card className={`h-full cursor-pointer group flex flex-col ${COMPLEX_HOVER_EFFECTS.FEATURE_CARD}`}>
                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <div className={`p-3 rounded-full bg-muted ${TRANSITION_PRESETS.STANDARD_COLORS}`}>
                      <section.icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardDescription>{section.description}</CardDescription>
                </CardContent>
              </Card>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}
