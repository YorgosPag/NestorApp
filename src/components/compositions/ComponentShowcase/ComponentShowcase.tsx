'use client';

import React, { useState } from 'react';
import { 
  TaskCard, 
  UserCard, 
  BuildingCard, 
  ProjectCard, 
  ContactCard, 
  NotificationCard, 
  StorageCard 
} from '@/components/compositions';
import type { CrmTask } from '@/types/crm';

// Mock data για demonstration
const mockTask: CrmTask = {
  id: '1',
  title: 'Follow-up κλήση με πελάτη',
  description: 'Επικοινωνία για ενημέρωση σχετικά με την πρόοδο του έργου',
  type: 'call',
  status: 'pending',
  priority: 'high',
  dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
  assignedTo: 'user123',
  contactId: 'contact456',
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockUser = {
  id: '1',
  name: 'Γιάννης Παπαδόπουλος',
  email: 'giannis@example.com',
  phone: '+30 210 1234567',
  role: 'agent' as const,
  department: 'Πωλήσεις',
  company: 'Pagonis Real Estate',
  location: 'Αθήνα, Ελλάδα',
  status: 'active' as const,
  lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  joinedDate: new Date(2023, 0, 15),
  bio: 'Έμπειρος real estate agent με εξειδίκευση στην αγορά της Αθήνας',
  specialties: ['Διαμερίσματα', 'Εμπορικά', 'Επενδύσεις'],
  tasksCompleted: 45,
  projectsAssigned: 8,
  achievements: 12
};

export function ComponentShowcase() {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  return (
    <div className="p-6 space-y-8 bg-background">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Component Composition Showcase</h1>
        <p className="text-muted-foreground">
          Demonstration των νέων composition components που χρησιμοποιούν το BaseCard system
        </p>
      </div>

      {/* TaskCard Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          📋 TaskCard
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <TaskCard 
            task={mockTask}
            isSelected={selectedCard === 'task1'}
            onSelectionChange={() => setSelectedCard(selectedCard === 'task1' ? null : 'task1')}
            onComplete={(id) => console.log('Complete task:', id)}
            onEdit={(id) => console.log('Edit task:', id)}
            onView={(id) => console.log('View task:', id)}
          />
          
          <TaskCard 
            task={{
              ...mockTask,
              id: '2',
              title: 'Προβολή ακινήτου',
              type: 'viewing',
              status: 'completed',
              priority: 'medium',
              completedAt: new Date(),
              viewingDetails: {
                location: 'Κολωνάκι, Αθήνα',
                units: ['Α1', 'Α2'],
                attendees: ['client1', 'agent1'],
                notes: 'Επιτυχημένη προβολή'
              }
            }}
            compact={true}
          />

          <TaskCard 
            task={{
              ...mockTask,
              id: '3',
              title: 'Επείγουσα κλήση',
              status: 'pending',
              priority: 'urgent',
              dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Overdue
            }}
            showAssignee={false}
          />
        </div>
      </section>

      {/* UserCard Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          👤 UserCard
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <UserCard 
            user={mockUser}
            isSelected={selectedCard === 'user1'}
            onSelectionChange={() => setSelectedCard(selectedCard === 'user1' ? null : 'user1')}
            onEdit={(id) => console.log('Edit user:', id)}
            onMessage={(id) => console.log('Message user:', id)}
            onView={(id) => console.log('View user:', id)}
          />
          
          <UserCard 
            user={{
              ...mockUser,
              id: '2',
              name: 'Μαρία Γεωργίου',
              role: 'manager',
              status: 'inactive',
              lastActive: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
              achievements: 25
            }}
            compact={true}
            showStats={false}
          />

          <UserCard 
            user={{
              ...mockUser,
              id: '3',
              name: 'Δημήτρης Admin',
              role: 'admin',
              status: 'active',
              email: 'admin@example.com',
              specialties: ['Διαχείριση', 'Analytics', 'Ασφάλεια']
            }}
            showActions={false}
          />
        </div>
      </section>

      {/* Integration Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          🔧 Integration Demo
        </h2>
        <div className="p-4 border rounded-lg bg-muted/20">
          <h3 className="font-medium mb-2">Χρήση στην εφαρμογή:</h3>
          <pre className="text-sm bg-background p-3 rounded border overflow-x-auto">
{`import { TaskCard, UserCard } from '@/components/compositions';

// TaskCard usage
<TaskCard 
  task={task}
  onComplete={handleComplete}
  onEdit={handleEdit}
  isSelected={selectedTask === task.id}
/>

// UserCard usage  
<UserCard
  user={user}
  onMessage={handleMessage}
  showStats={true}
  compact={false}
/>`}
          </pre>
        </div>
      </section>

      {/* Design System Benefits */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          🎨 Design System Benefits
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium text-green-600 mb-2">✅ Consistency</h3>
            <p className="text-sm text-muted-foreground">
              Όλα τα cards χρησιμοποιούν το ίδιο BaseCard system για unified look & feel
            </p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium text-blue-600 mb-2">🔧 Modularity</h3>
            <p className="text-sm text-muted-foreground">
              Composition pattern επιτρέπει εύκολη customization και reusability
            </p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium text-purple-600 mb-2">🎯 Type Safety</h3>
            <p className="text-sm text-muted-foreground">
              Full TypeScript support με validated props και design system integration
            </p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium text-orange-600 mb-2">🚀 Performance</h3>
            <p className="text-sm text-muted-foreground">
              Optimized rendering και semantic color system με zero runtime overhead
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}