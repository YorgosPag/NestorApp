export const mockContacts = [
  {
    id: '1',
    personal: { firstName: 'Γιάννης', lastName: 'Παπαδόπουλος' },
    job: { role: 'Πρόγραμμα Manager' }
  },
  {
    id: '2', 
    personal: { firstName: 'Μαρία', lastName: 'Κωνσταντίνου' },
    job: { role: 'Architect' }
  }
];

export const mockProjects = [
  {
    id: '1',
    title: 'Κτίριο Α',
    description: 'Πολυκατοικία 5 ορόφων',
    ownerContactId: '1',
    status: 'active',
    progress: 75,
    deadline: '2024-12-31',
    budget: 500000,
    interventions: []
  },
  {
    id: '2',
    title: 'Κτίριο Β', 
    description: 'Μονοκατοικία',
    ownerContactId: '2',
    status: 'planning',
    progress: 25,
    deadline: '2024-06-30',
    budget: 200000,
    interventions: []
  }
];