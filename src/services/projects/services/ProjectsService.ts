
import type { IProjectsService, IProjectsRepository, ProjectStructure } from '../contracts';
import type { Project, ProjectCustomer, ProjectStats } from '@/types/project';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName, getPrimaryPhone } from '@/types/contacts';
import { db } from '@/lib/firebase-admin';

const getFirebaseAdmin = async () => {
  const admin = await import('firebase-admin/firestore');
  return admin;
};

export class ProjectsService implements IProjectsService {
  private firestoreRepo: IProjectsRepository;
  private mockRepo: Pick<IProjectsRepository, 'getProjectsByCompanyId'>;

  constructor(
    firestoreRepo: IProjectsRepository,
    mockRepo: Pick<IProjectsRepository, 'getProjectsByCompanyId'>
  ) {
    this.firestoreRepo = firestoreRepo;
    this.mockRepo = mockRepo;
  }
  
  async getProjectsByCompanyId(companyId: string): Promise<Project[]> {
    console.log(`🏗️ ProjectsService: getProjectsByCompanyId called with: "${companyId}"`);
    console.log(`🏗️ ProjectsService: Using FirestoreProjectsRepository`);
    const result = await this.firestoreRepo.getProjectsByCompanyId(companyId);
    console.log(`🏗️ ProjectsService: FirestoreRepo returned:`, result);
    return result;
  }

  async getProjectStructure(projectId: number): Promise<ProjectStructure | null> {
    console.log('🔍 Fetching project structure for project ID:', projectId);
    
    const project = await this.firestoreRepo.getProjectById(projectId);
    if (!project) {
        console.warn(`❌ Project with ID ${projectId} not found.`);
        return null;
    }
    console.log('✅ Project found:', project.name);

    const buildingsData = await this.firestoreRepo.getBuildingsByProjectId(projectId);
    console.log('🏢 Buildings found:', buildingsData.length, buildingsData.map(b => b.id));

    const structureBuildings = [];
    const allUnitOwnerIds = new Set<string>();

    for (const building of buildingsData) {
        const units = await this.firestoreRepo.getUnitsByBuildingId(`building-${building.id}`);
        console.log(`🏠 Units in building ${building.id}:`, units.length);
        
        units.forEach(u => {
            if (u.soldTo) allUnitOwnerIds.add(u.soldTo);
        });

        structureBuildings.push({ ...building, units });
    }
    
    console.log('👥 All unique customer IDs to fetch:', Array.from(allUnitOwnerIds));
    
    const contactsMap = new Map<string, string>();
    if (allUnitOwnerIds.size > 0) {
        console.log('🔍 Fetching contacts...');
        const contacts = await this.firestoreRepo.getContactsByIds(Array.from(allUnitOwnerIds));
        console.log('📞 Contacts found:', contacts.length);
        contacts.forEach(contact => {
            contactsMap.set(contact.id!, getContactDisplayName(contact));
        });
    }
    
    for (const building of structureBuildings) {
        for (const unit of building.units) {
            if (unit.soldTo) {
                unit.customerName = contactsMap.get(unit.soldTo);
            }
        }
    }

    return { project, buildings: structureBuildings };
  }

  async getProjectCustomers(projectId: number): Promise<ProjectCustomer[]> {
    const buildings = await this.firestoreRepo.getBuildingsByProjectId(projectId);
    if (buildings.length === 0) return [];
    
    const buildingIds = buildings.map(b => `building-${b.id}`);
    
    const allUnits = (await Promise.all(
        buildingIds.map(id => this.firestoreRepo.getUnitsByBuildingId(id))
    )).flat();

    const soldUnits = allUnits.filter(u => u.status === 'sold' && u.soldTo);

    const customerUnitCount: { [contactId: string]: number } = {};
    soldUnits.forEach(unit => {
        customerUnitCount[unit.soldTo!] = (customerUnitCount[unit.soldTo!] || 0) + 1;
    });

    const customerIds = Object.keys(customerUnitCount);
    if (customerIds.length === 0) return [];
    
    const contacts = await this.firestoreRepo.getContactsByIds(customerIds);

    return contacts.map(contact => ({
      contactId: contact.id!,
      name: getContactDisplayName(contact),
      phone: getPrimaryPhone(contact) || null,
      unitsCount: customerUnitCount[contact.id!] || 0,
    }));
  }

  async getProjectStats(projectId: number): Promise<ProjectStats> {
    try {
        console.log('🔍 Getting stats for project:', projectId);
        const buildings = await this.firestoreRepo.getBuildingsByProjectId(projectId);
        console.log('🏢 Buildings found:', buildings.length);
        
        if (buildings.length === 0) {
            console.log('❌ No buildings found for project', projectId);
            return { totalUnits: 0, soldUnits: 0, totalSoldArea: 0 };
        }
        
        let totalUnits = 0;
        let soldUnits = 0;
        let totalSoldArea = 0;

        for (const building of buildings) {
            const units = await this.firestoreRepo.getUnitsByBuildingId(`building-${building.id}`);
            console.log(`🏠 Units in building ${building.id}:`, units.length);

            units.forEach(unit => {
                totalUnits++;
                const isSold = unit.status === 'sold' || (unit.soldTo && unit.soldTo.trim() !== '');
                if (isSold) {
                    soldUnits++;
                    totalSoldArea += parseFloat(String(unit.area)) || 0;
                }
            });
        }

        const stats = { totalUnits, soldUnits, totalSoldArea };
        console.log('📊 Final stats:', stats);
        return stats;

    } catch (error) {
        console.error(`❌ Error fetching stats for project ${projectId}:`, error);
        return { totalUnits: 0, soldUnits: 0, totalSoldArea: 0 };
    }
  }

  async debugProjectData(projectId: number): Promise<void> {
    if (!db) {
        console.error("Firestore not initialized for debug");
        return;
    }
    try {
        console.log('🔍 DEBUG: Full data check for project', projectId);
        
        const admin = await getFirebaseAdmin();
        
        const projectDoc = await admin.getDoc(admin.doc(db, 'projects', String(projectId)));
        console.log('📋 Project exists:', projectDoc.exists());
        if (projectDoc.exists()) {
            console.log('📋 Project data:', projectDoc.data());
        }
        
        const buildingsQuery = admin.query(admin.collection(db, 'buildings'), admin.where('projectId', '==', projectId));
        const buildings = await admin.getDocs(buildingsQuery);
        console.log('🏢 Buildings count:', buildings.docs.length);
        buildings.docs.forEach(doc => {
            console.log(`   Building ${doc.id}:`, doc.data());
        });
        
        for (const building of buildings.docs) {
            const unitsQuery = admin.query(admin.collection(db, 'units'), admin.where('buildingId', '==', `building-${building.id}`));
            const units = await admin.getDocs(unitsQuery);
            console.log(`🏠 Units in building ${building.id}:`, units.docs.length);
            units.docs.forEach(doc => {
                const data = doc.data();
                console.log(`     Unit ${doc.id}:`, { name: data.name, status: data.status, soldTo: data.soldTo, area: data.area, price: data.price });
            });
        }
        
        try {
            const directUnitsQuery = admin.query(admin.collection(db, 'units'), admin.where('projectId', '==', projectId));
            const directUnits = await admin.getDocs(directUnitsQuery);
            if (!directUnits.empty) {
                console.log('⚠️ Found units with direct projectId (incorrect structure):', directUnits.docs.length);
            }
        } catch (e) {
            console.log('No direct projectId units found (this is correct)');
        }
    } catch (error) {
        console.error('❌ Debug error:', error);
    }
  }
}
