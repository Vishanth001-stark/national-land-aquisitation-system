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

  // Create 3 realistic projects (parcels) with different stages (idempotent)
  let project1 = await prisma.project.findFirst({
    where: { name: 'National Highway Expansion - NH-48' },
  })
  if (!project1) {
    project1 = await prisma.project.create({
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
  }

  let project2 = await prisma.project.findFirst({
    where: { name: 'Industrial Corridor - Phase 2' },
  })
  if (!project2) {
    project2 = await prisma.project.create({
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
  }

  let project3 = await prisma.project.findFirst({
    where: { name: 'Railway Station Modernization' },
  })
  if (!project3) {
    project3 = await prisma.project.create({
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
  }

  // Create candidate cadastral parcels for map-based land selection workflow across major Indian cities/districts
  const candidateParcels = [
    // Jaipur, Rajasthan
    {
      ulpin: 'ULPIN-RJ-JPR-101',
      surveyNumber: 'KH-101/A',
      areaHectares: 12.5,
      landType: 'agricultural',
      ownerName: 'Ramesh Kumar',
      ownerId: citizen1.id,
      compensationAmount: 15000000,
      latitude: 26.9100,
      longitude: 75.7850,
      isCandidate: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [
          [
            [75.7830, 26.9080],
            [75.7870, 26.9080],
            [75.7870, 26.9120],
            [75.7830, 26.9120],
            [75.7830, 26.9080]
          ]
        ]
      }
    },
    {
      ulpin: 'ULPIN-RJ-JPR-102',
      surveyNumber: 'KH-102/B',
      areaHectares: 18.0,
      landType: 'agricultural',
      ownerName: 'Sunita Devi',
      ownerId: citizen2.id,
      compensationAmount: 21000000,
      latitude: 26.9100,
      longitude: 75.7900,
      isCandidate: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [
          [
            [75.7870, 26.9080],
            [75.7930, 26.9080],
            [75.7930, 26.9120],
            [75.7870, 26.9120],
            [75.7870, 26.9080]
          ]
        ]
      }
    },
    {
      ulpin: 'ULPIN-RJ-JPR-103',
      surveyNumber: 'KH-103/C',
      areaHectares: 8.4,
      landType: 'residential',
      ownerName: 'Mohan Lal',
      ownerId: citizen3.id,
      compensationAmount: 18000000,
      latitude: 26.9100,
      longitude: 75.7970,
      isCandidate: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [
          [
            [75.7930, 26.9080],
            [75.8010, 26.9080],
            [75.8010, 26.9120],
            [75.7930, 26.9120],
            [75.7930, 26.9080]
          ]
        ]
      }
    },
    {
      ulpin: 'ULPIN-RJ-JPR-104',
      surveyNumber: 'KH-104/D',
      areaHectares: 15.2,
      landType: 'commercial',
      ownerName: 'Rajesh Sharma',
      ownerId: null,
      compensationAmount: 32000000,
      latitude: 26.9160,
      longitude: 75.7850,
      isCandidate: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [
          [
            [75.7830, 26.9120],
            [75.7870, 26.9120],
            [75.7870, 26.9200],
            [75.7830, 26.9200],
            [75.7830, 26.9120]
          ]
        ]
      }
    },
    // Delhi NCR
    {
      ulpin: 'ULPIN-DL-DEL-201',
      surveyNumber: 'SY-DL-201',
      areaHectares: 14.5,
      landType: 'commercial',
      ownerName: 'Amitabh Sen',
      ownerId: null,
      compensationAmount: 45000000,
      latitude: 28.6100,
      longitude: 77.2050,
      isCandidate: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [
          [
            [77.2000, 28.6050],
            [77.2100, 28.6050],
            [77.2100, 28.6150],
            [77.2000, 28.6150],
            [77.2000, 28.6050]
          ]
        ]
      }
    },
    {
      ulpin: 'ULPIN-DL-DEL-202',
      surveyNumber: 'SY-DL-202',
      areaHectares: 21.0,
      landType: 'industrial',
      ownerName: 'Gurpreet Singh',
      ownerId: null,
      compensationAmount: 52000000,
      latitude: 28.6100,
      longitude: 77.2150,
      isCandidate: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [
          [
            [77.2100, 28.6050],
            [77.2200, 28.6050],
            [77.2200, 28.6150],
            [77.2100, 28.6150],
            [77.2100, 28.6050]
          ]
        ]
      }
    },
    // Mumbai, Maharashtra
    {
      ulpin: 'ULPIN-MH-MUM-301',
      surveyNumber: 'SY-MH-301',
      areaHectares: 11.2,
      landType: 'commercial',
      ownerName: 'Nitin Kulkarni',
      ownerId: null,
      compensationAmount: 68000000,
      latitude: 19.0750,
      longitude: 72.8750,
      isCandidate: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [
          [
            [72.8700, 19.0700],
            [72.8800, 19.0700],
            [72.8800, 19.0800],
            [72.8700, 19.0800],
            [72.8700, 19.0700]
          ]
        ]
      }
    },
    {
      ulpin: 'ULPIN-MH-MUM-302',
      surveyNumber: 'SY-MH-302',
      areaHectares: 16.8,
      landType: 'residential',
      ownerName: 'Ananya Mehta',
      ownerId: null,
      compensationAmount: 74000000,
      latitude: 19.0750,
      longitude: 72.8850,
      isCandidate: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [
          [
            [72.8800, 19.0700],
            [72.8900, 19.0700],
            [72.8900, 19.0800],
            [72.8800, 19.0800],
            [72.8800, 19.0700]
          ]
        ]
      }
    },
    // Bengaluru, Karnataka
    {
      ulpin: 'ULPIN-KA-BLR-401',
      surveyNumber: 'SY-KA-401',
      areaHectares: 19.4,
      landType: 'agricultural',
      ownerName: 'Kavitha Gowda',
      ownerId: null,
      compensationAmount: 38000000,
      latitude: 12.9700,
      longitude: 77.5900,
      isCandidate: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [
          [
            [77.5850, 12.9650],
            [77.5950, 12.9650],
            [77.5950, 12.9750],
            [77.5850, 12.9750],
            [77.5850, 12.9650]
          ]
        ]
      }
    },
    {
      ulpin: 'ULPIN-KA-BLR-402',
      surveyNumber: 'SY-KA-402',
      areaHectares: 24.5,
      landType: 'industrial',
      ownerName: 'Suresh Reddy',
      ownerId: null,
      compensationAmount: 49000000,
      latitude: 12.9700,
      longitude: 77.6000,
      isCandidate: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [
          [
            [77.5950, 12.9650],
            [77.6050, 12.9650],
            [77.6050, 12.9750],
            [77.5950, 12.9750],
            [77.5950, 12.9650]
          ]
        ]
      }
    },
    // Hyderabad, Telangana
    {
      ulpin: 'ULPIN-TS-HYD-501',
      surveyNumber: 'SY-TS-501',
      areaHectares: 17.3,
      landType: 'commercial',
      ownerName: 'Venkat Rao',
      ownerId: null,
      compensationAmount: 41000000,
      latitude: 17.3850,
      longitude: 78.4850,
      isCandidate: true,
      geometryJson: {
        type: 'Polygon',
        coordinates: [
          [
            [78.4800, 17.3800],
            [78.4900, 17.3800],
            [78.4900, 17.3900],
            [78.4800, 17.3900],
            [78.4800, 17.3800]
          ]
        ]
      }
    }
  ]

  for (const parcel of candidateParcels) {
    const existing = await prisma.landParcel.findFirst({
      where: { ulpin: parcel.ulpin }
    })

    if (!existing) {
      await prisma.landParcel.create({
        data: {
          ulpin: parcel.ulpin,
          surveyNumber: parcel.surveyNumber,
          areaHectares: parcel.areaHectares,
          landType: parcel.landType as any,
          ownerName: parcel.ownerName,
          ownerId: parcel.ownerId,
          compensationAmount: parcel.compensationAmount,
          possessionStatus: 'NOT_ACQUIRED',
          latitude: parcel.latitude,
          longitude: parcel.longitude,
          isCandidate: parcel.isCandidate,
          geometryJson: parcel.geometryJson,
        }
      })
    }
  }

  console.log('✅ Seeding completed!')
  console.log(`Created ${await prisma.user.count()} users`)
  console.log(`Created ${await prisma.project.count()} projects`)
  console.log(`Created ${await prisma.landParcel.count()} land parcels`)
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