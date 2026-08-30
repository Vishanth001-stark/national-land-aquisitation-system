// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Get or create the Central Ministry role
  const centralMinistryRole = await prisma.role.upsert({
    where: { name: 'CENTRAL_MINISTRY' },
    update: {},
    create: {
      name: 'CENTRAL_MINISTRY',
      description: 'Central Ministry of Mines',
    },
  })

  const collectorRole = await prisma.role.upsert({
    where: { name: 'DISTRICT_COLLECTOR' },
    update: {},
    create: {
      name: 'DISTRICT_COLLECTOR',
      description: 'District Collector',
    },
  })

  const citizenRole = await prisma.role.upsert({
    where: { name: 'CITIZEN' },
    update: {},
    create: {
      name: 'CITIZEN',
      description: 'Citizen / Land Owner',
    },
  })

  // Get or create Rajasthan state
  const rajasthan = await prisma.state.upsert({
    where: { code: 'RJ' },
    update: {},
    create: {
      name: 'Rajasthan',
      code: 'RJ',
    },
  })

  // Get or create Jaipur district
  // Find Jaipur district if it already exists; otherwise create it.
let jaipur = await prisma.district.findFirst({
  where: {
    name: 'Jaipur',
    stateId: rajasthan.id,
  },
})

if (!jaipur) {
  jaipur = await prisma.district.create({
    data: {
      name: 'Jaipur',
      stateId: rajasthan.id,
    },
  })
}

  // Create users
  const adminPassword = await bcrypt.hash('admin123', 10)
  const collectorPassword = await bcrypt.hash('collector123', 10)
  const citizenPassword = await bcrypt.hash('citizen123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Central Ministry Admin',
      email: 'admin@example.com',
      passwordHash: adminPassword,
      roleId: centralMinistryRole.id,
      stateId: rajasthan.id,
    },
  })

  const collector = await prisma.user.upsert({
    where: { email: 'collector@example.com' },
    update: {},
    create: {
      name: 'District Collector - Jaipur',
      email: 'collector@example.com',
      passwordHash: collectorPassword,
      roleId: collectorRole.id,
      stateId: rajasthan.id,
      districtId: jaipur.id,
    },
  })

  const citizen1 = await prisma.user.upsert({
    where: { email: 'citizen1@example.com' },
    update: {},
    create: {
      name: 'Ramesh Kumar',
      email: 'citizen1@example.com',
      passwordHash: citizenPassword,
      roleId: citizenRole.id,
      districtId: jaipur.id,
    },
  })

  const citizen2 = await prisma.user.upsert({
    where: { email: 'citizen2@example.com' },
    update: {},
    create: {
      name: 'Sunita Devi',
      email: 'citizen2@example.com',
      passwordHash: citizenPassword,
      roleId: citizenRole.id,
      districtId: jaipur.id,
    },
  })

  const citizen3 = await prisma.user.upsert({
    where: { email: 'citizen3@example.com' },
    update: {},
    create: {
      name: 'Mohan Lal',
      email: 'citizen3@example.com',
      passwordHash: citizenPassword,
      roleId: citizenRole.id,
      districtId: jaipur.id,
    },
  })

  // Create 3 realistic projects (parcels) with different stages
  const project1 = await prisma.project.create({
    data: {
      name: 'National Highway Expansion - NH-48',
      acquiringBodyId: null,
      projectType: 'highway',
      stateId: rajasthan.id,
      districtId: jaipur.id,
      status: 'IN_PROGRESS',
      totalAreaHectares: 18.5,
      estimatedCost: 15000000,
      createdBy: admin.id,
      workflowInstances: {
        create: {
          currentStage: 'PRELIMINARY_NOTIFICATION',
          status: 'IN_PROGRESS',
        },
      },
      landParcels: {
        create: {
          surveyNumber: 'KH-45/2, KH-45/3',
          areaHectares: 18.5,
          landType: 'agricultural',
          ownerName: 'Ramesh Kumar',
          ownerId: citizen1.id,
          compensationAmount: 12500000,
          possessionStatus: 'NOT_ACQUIRED',
          latitude: 26.9124,
          longitude: 75.7873,
        },
      },
    },
  })

  const project2 = await prisma.project.create({
    data: {
      name: 'Industrial Corridor - Phase 2',
      acquiringBodyId: null,
      projectType: 'industrial_corridor',
      stateId: rajasthan.id,
      districtId: jaipur.id,
      status: 'IN_PROGRESS',
      totalAreaHectares: 48.0,
      estimatedCost: 42000000,
      createdBy: admin.id,
      workflowInstances: {
        create: {
          currentStage: 'DECLARATION',
          status: 'IN_PROGRESS',
        },
      },
      landParcels: {
        create: {
          surveyNumber: 'KH-78/1, KH-78/2, KH-79/1',
          areaHectares: 48.0,
          landType: 'wasteland',
          ownerName: 'Sunita Devi',
          ownerId: citizen2.id,
          compensationAmount: 35000000,
          possessionStatus: 'NOT_ACQUIRED',
          latitude: 26.8467,
          longitude: 75.8023,
        },
      },
    },
  })

  const project3 = await prisma.project.create({
    data: {
      name: 'Railway Station Modernization',
      acquiringBodyId: null,
      projectType: 'railway',
      stateId: rajasthan.id,
      districtId: jaipur.id,
      status: 'IN_PROGRESS',
      totalAreaHectares: 31.3,
      estimatedCost: 28000000,
      createdBy: admin.id,
      workflowInstances: {
        create: {
          currentStage: 'AWARD',
          status: 'IN_PROGRESS',
        },
      },
      landParcels: {
        create: {
          surveyNumber: 'KH-92/1, KH-92/2',
          areaHectares: 31.3,
          landType: 'residential',
          ownerName: 'Mohan Lal',
          ownerId: citizen3.id,
          compensationAmount: 22000000,
          possessionStatus: 'ACQUIRED',
          latitude: 26.9239,
          longitude: 75.8235,
        },
      },
    },
  })

  // Create audit logs for each project
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: project1.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'STAGE_ADVANCED:SIA->PRELIMINARY_NOTIFICATION',
      entityType: 'Project',
      entityId: project1.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: project2.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'STAGE_ADVANCED:SIA->PRELIMINARY_NOTIFICATION',
      entityType: 'Project',
      entityId: project2.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'STAGE_ADVANCED:PRELIMINARY_NOTIFICATION->DECLARATION',
      entityType: 'Project',
      entityId: project2.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: project3.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'STAGE_ADVANCED:SIA->PRELIMINARY_NOTIFICATION',
      entityType: 'Project',
      entityId: project3.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'STAGE_ADVANCED:PRELIMINARY_NOTIFICATION->DECLARATION',
      entityType: 'Project',
      entityId: project3.id,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'STAGE_ADVANCED:DECLARATION->AWARD',
      entityType: 'Project',
      entityId: project3.id,
    },
  })

  console.log('✅ Seeding completed!')
  console.log(`Created ${await prisma.user.count()} users`)
  console.log(`Created ${await prisma.project.count()} projects`)
  console.log(`Created ${await prisma.auditLog.count()} audit logs`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })