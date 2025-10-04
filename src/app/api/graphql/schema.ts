import { gql } from 'graphql-tag';

export const typeDefs = gql`
  type Query {
    # Buildings
    buildings(
      filters: BuildingFiltersInput
      pagination: PaginationInput
      sorting: SortingInput
    ): BuildingsResponse!
    
    building(id: ID!): Building
    
    # Projects
    projects(
      filters: ProjectFiltersInput
      pagination: PaginationInput
      sorting: SortingInput
    ): ProjectsResponse!
    
    project(id: ID!): Project
    
    # Contacts
    contacts(
      filters: ContactFiltersInput
      pagination: PaginationInput
      sorting: SortingInput
    ): ContactsResponse!
    
    contact(id: ID!): Contact
    
    # Storage
    storage(
      filters: StorageFiltersInput
      pagination: PaginationInput
      sorting: SortingInput
    ): StorageResponse!
    
    storageItem(id: ID!): StorageItem
    
    # CRM Data
    opportunities(
      filters: OpportunityFiltersInput
      pagination: PaginationInput
      sorting: SortingInput
    ): OpportunitiesResponse!
    
    opportunity(id: ID!): Opportunity
    
    # Communications
    communications(
      contactId: ID
      pagination: PaginationInput
    ): CommunicationsResponse!
    
    # Analytics
    dashboardStats: DashboardStats!
    buildingAnalytics(buildingId: ID!): BuildingAnalytics!
  }

  type Mutation {
    # Building mutations
    createBuilding(input: CreateBuildingInput!): Building!
    updateBuilding(id: ID!, input: UpdateBuildingInput!): Building!
    deleteBuilding(id: ID!): Boolean!
    
    # Project mutations
    createProject(input: CreateProjectInput!): Project!
    updateProject(id: ID!, input: UpdateProjectInput!): Project!
    deleteProject(id: ID!): Boolean!
    
    # Contact mutations
    createContact(input: CreateContactInput!): Contact!
    updateContact(id: ID!, input: UpdateContactInput!): Contact!
    deleteContact(id: ID!): Boolean!
    
    # Storage mutations
    createStorageItem(input: CreateStorageInput!): StorageItem!
    updateStorageItem(id: ID!, input: UpdateStorageInput!): StorageItem!
    deleteStorageItem(id: ID!): Boolean!
    
    # Communication mutations
    sendEmail(input: SendEmailInput!): Communication!
    sendSMS(input: SendSMSInput!): Communication!
    
    # Opportunity mutations
    createOpportunity(input: CreateOpportunityInput!): Opportunity!
    updateOpportunity(id: ID!, input: UpdateOpportunityInput!): Opportunity!
    deleteOpportunity(id: ID!): Boolean!
  }

  type Subscription {
    # Real-time notifications
    notificationAdded(userId: ID!): Notification!
    
    # Real-time updates
    buildingUpdated(buildingId: ID!): Building!
    projectUpdated(projectId: ID!): Project!
    
    # Communication events
    newCommunication(contactId: ID!): Communication!
    
    # Opportunity updates
    opportunityStatusChanged: Opportunity!
  }

  # Core Types
  type Building {
    id: ID!
    name: String!
    address: String
    description: String
    status: BuildingStatus!
    type: BuildingType!
    floors: Int
    totalUnits: Int
    availableUnits: Int
    constructionYear: Int
    images: [String!]!
    documents: [Document!]!
    storage: [StorageItem!]!
    projects: [Project!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Project {
    id: ID!
    name: String!
    description: String
    status: ProjectStatus!
    buildingId: ID
    building: Building
    startDate: DateTime
    endDate: DateTime
    budget: Float
    actualCost: Float
    progress: Float
    manager: Contact
    team: [Contact!]!
    documents: [Document!]!
    timeline: [TimelineEvent!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Contact {
    id: ID!
    firstName: String!
    lastName: String!
    email: String
    phone: String
    company: String
    position: String
    type: ContactType!
    status: ContactStatus!
    tags: [String!]!
    notes: String
    projects: [Project!]!
    communications: [Communication!]!
    opportunities: [Opportunity!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type StorageItem {
    id: ID!
    name: String!
    description: String
    buildingId: ID!
    building: Building!
    floor: Int
    area: Float
    price: Float
    status: StorageStatus!
    features: [String!]!
    images: [String!]!
    assignedTo: Contact
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Opportunity {
    id: ID!
    title: String!
    description: String
    value: Float
    probability: Float
    stage: OpportunityStage!
    status: OpportunityStatus!
    contactId: ID!
    contact: Contact!
    expectedCloseDate: DateTime
    actualCloseDate: DateTime
    notes: String
    activities: [Activity!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Communication {
    id: ID!
    type: CommunicationType!
    contactId: ID!
    contact: Contact!
    subject: String
    content: String!
    direction: CommunicationDirection!
    status: CommunicationStatus!
    timestamp: DateTime!
    metadata: JSON
  }

  type Notification {
    id: ID!
    userId: ID!
    type: NotificationType!
    title: String!
    message: String!
    data: JSON
    read: Boolean!
    createdAt: DateTime!
  }

  type Document {
    id: ID!
    name: String!
    type: String!
    url: String!
    size: Int!
    uploadedBy: ID!
    createdAt: DateTime!
  }

  type TimelineEvent {
    id: ID!
    title: String!
    description: String
    date: DateTime!
    type: TimelineEventType!
    createdBy: ID!
  }

  type Activity {
    id: ID!
    type: ActivityType!
    title: String!
    description: String
    date: DateTime!
    userId: ID!
    opportunityId: ID!
  }

  # Analytics Types
  type DashboardStats {
    totalBuildings: Int!
    totalProjects: Int!
    totalContacts: Int!
    totalStorage: Int!
    activeOpportunities: Int!
    monthlyRevenue: Float!
    completionRate: Float!
  }

  type BuildingAnalytics {
    occupancyRate: Float!
    averageRent: Float!
    maintenanceCosts: Float!
    totalRevenue: Float!
    trends: [AnalyticsTrend!]!
  }

  type AnalyticsTrend {
    period: String!
    value: Float!
    change: Float!
  }

  # Response Types
  type BuildingsResponse {
    data: [Building!]!
    pagination: PaginationInfo!
    totalCount: Int!
  }

  type ProjectsResponse {
    data: [Project!]!
    pagination: PaginationInfo!
    totalCount: Int!
  }

  type ContactsResponse {
    data: [Contact!]!
    pagination: PaginationInfo!
    totalCount: Int!
  }

  type StorageResponse {
    data: [StorageItem!]!
    pagination: PaginationInfo!
    totalCount: Int!
  }

  type OpportunitiesResponse {
    data: [Opportunity!]!
    pagination: PaginationInfo!
    totalCount: Int!
  }

  type CommunicationsResponse {
    data: [Communication!]!
    pagination: PaginationInfo!
    totalCount: Int!
  }

  type PaginationInfo {
    page: Int!
    limit: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  # Input Types
  input PaginationInput {
    page: Int = 1
    limit: Int = 10
  }

  input SortingInput {
    field: String!
    direction: SortDirection = ASC
  }

  input BuildingFiltersInput {
    name: String
    status: BuildingStatus
    type: BuildingType
    minFloors: Int
    maxFloors: Int
    minUnits: Int
    maxUnits: Int
  }

  input ProjectFiltersInput {
    name: String
    status: ProjectStatus
    buildingId: ID
    managerId: ID
    startDateFrom: DateTime
    startDateTo: DateTime
  }

  input ContactFiltersInput {
    name: String
    email: String
    company: String
    type: ContactType
    status: ContactStatus
    tags: [String!]
  }

  input StorageFiltersInput {
    name: String
    buildingId: ID
    status: StorageStatus
    minArea: Float
    maxArea: Float
    minPrice: Float
    maxPrice: Float
    floor: Int
  }

  input OpportunityFiltersInput {
    title: String
    stage: OpportunityStage
    status: OpportunityStatus
    contactId: ID
    minValue: Float
    maxValue: Float
  }

  # Create/Update Input Types
  input CreateBuildingInput {
    name: String!
    address: String
    description: String
    status: BuildingStatus!
    type: BuildingType!
    floors: Int
    totalUnits: Int
    constructionYear: Int
  }

  input UpdateBuildingInput {
    name: String
    address: String
    description: String
    status: BuildingStatus
    type: BuildingType
    floors: Int
    totalUnits: Int
    constructionYear: Int
  }

  input CreateProjectInput {
    name: String!
    description: String
    status: ProjectStatus!
    buildingId: ID
    startDate: DateTime
    endDate: DateTime
    budget: Float
    managerId: ID
  }

  input UpdateProjectInput {
    name: String
    description: String
    status: ProjectStatus
    buildingId: ID
    startDate: DateTime
    endDate: DateTime
    budget: Float
    actualCost: Float
    progress: Float
    managerId: ID
  }

  input CreateContactInput {
    firstName: String!
    lastName: String!
    email: String
    phone: String
    company: String
    position: String
    type: ContactType!
    status: ContactStatus!
  }

  input UpdateContactInput {
    firstName: String
    lastName: String
    email: String
    phone: String
    company: String
    position: String
    type: ContactType
    status: ContactStatus
    notes: String
  }

  input CreateStorageInput {
    name: String!
    description: String
    buildingId: ID!
    floor: Int
    area: Float
    price: Float
    status: StorageStatus!
    features: [String!]
  }

  input UpdateStorageInput {
    name: String
    description: String
    floor: Int
    area: Float
    price: Float
    status: StorageStatus
    features: [String!]
    assignedToId: ID
  }

  input CreateOpportunityInput {
    title: String!
    description: String
    value: Float
    probability: Float
    stage: OpportunityStage!
    status: OpportunityStatus!
    contactId: ID!
    expectedCloseDate: DateTime
  }

  input UpdateOpportunityInput {
    title: String
    description: String
    value: Float
    probability: Float
    stage: OpportunityStage
    status: OpportunityStatus
    expectedCloseDate: DateTime
    actualCloseDate: DateTime
    notes: String
  }

  input SendEmailInput {
    to: [String!]!
    subject: String!
    body: String!
    contactId: ID
    templateId: ID
  }

  input SendSMSInput {
    to: String!
    message: String!
    contactId: ID
  }

  # Enums
  enum SortDirection {
    ASC
    DESC
  }

  enum BuildingStatus {
    ACTIVE
    INACTIVE
    UNDER_CONSTRUCTION
    PLANNED
    SOLD
  }

  enum BuildingType {
    RESIDENTIAL
    COMMERCIAL
    MIXED_USE
    INDUSTRIAL
    OFFICE
  }

  enum ProjectStatus {
    PLANNING
    IN_PROGRESS
    ON_HOLD
    COMPLETED
    CANCELLED
  }

  enum ContactType {
    CLIENT
    PROSPECT
    VENDOR
    CONTRACTOR
    PARTNER
    EMPLOYEE
  }

  enum ContactStatus {
    ACTIVE
    INACTIVE
    POTENTIAL
    BLACKLISTED
  }

  enum StorageStatus {
    AVAILABLE
    RESERVED
    SOLD
    MAINTENANCE
  }

  enum OpportunityStage {
    LEAD
    QUALIFIED
    PROPOSAL
    NEGOTIATION
    CLOSED_WON
    CLOSED_LOST
  }

  enum OpportunityStatus {
    OPEN
    WON
    LOST
    CANCELLED
  }

  enum CommunicationType {
    EMAIL
    SMS
    PHONE
    MEETING
    NOTE
  }

  enum CommunicationDirection {
    INBOUND
    OUTBOUND
  }

  enum CommunicationStatus {
    SENT
    DELIVERED
    READ
    FAILED
  }

  enum NotificationType {
    INFO
    SUCCESS
    WARNING
    ERROR
  }

  enum TimelineEventType {
    CREATED
    UPDATED
    STATUS_CHANGED
    MILESTONE
    MEETING
    DOCUMENT_ADDED
  }

  enum ActivityType {
    CALL
    EMAIL
    MEETING
    TASK
    NOTE
  }

  # Scalar Types
  scalar DateTime
  scalar JSON
`;