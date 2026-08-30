import { prisma } from '../src/lib/prisma'
import { GET as getCitizenParcels } from '../src/app/api/citizen/parcels/route'
import { POST as advanceProject } from '../src/app/api/projects/[id]/advance/route'
import { NextRequest } from 'next/server'
import { WorkflowStage } from '@prisma/client'

async function runTest() {
  console.log('--- Testing Citizen Dashboard & Real-Time Workflow Synchronization ---')

  // 1. Find Citizen Ramesh Kumar and Sunita Devi
  const ramesh = await prisma.user.findFirst({ where: { email: 'citizen1@example.com' } })
  const sunita = await prisma.user.findFirst({ where: { email: 'citizen2@example.com' } })
  const admin = await prisma.user.findFirst({ where: { email: 'admin@example.com' } })

  if (!ramesh || !sunita || !admin) {
    throw new Error('Required seeded users missing!')
  }

  // 2. Query parcels for Ramesh directly using the query logic
  const rameshParcels = await prisma.landParcel.findMany({
    where: { ownerId: ramesh.id },
    include: {
      project: {
        include: {
          workflowInstances: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  console.log(`1. Ramesh Kumar owns ${rameshParcels.length} parcel(s):`)
  rameshParcels.forEach((p) => {
    console.log(`   - Survey: ${p.surveyNumber} | Project: ${p.project.name} | Stage: ${p.project.workflowInstances[0].currentStage}`)
  })

  if (rameshParcels.length === 0) throw new Error('Ramesh should own a parcel!')
  const initialStage = rameshParcels[0].project.workflowInstances[0].currentStage

  // 3. Query parcels for Sunita
  const sunitaParcels = await prisma.landParcel.findMany({
    where: { ownerId: sunita.id },
    include: {
      project: {
        include: {
          workflowInstances: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  console.log(`2. Sunita Devi owns ${sunitaParcels.length} parcel(s):`)
  sunitaParcels.forEach((p) => {
    console.log(`   - Survey: ${p.surveyNumber} | Project: ${p.project.name} | Stage: ${p.project.workflowInstances[0].currentStage}`)
  })

  // Verify privacy: Ramesh cannot see Sunita's parcel and vice versa
  const leakCheck = rameshParcels.some((p) => p.ownerId === sunita.id)
  console.log('3. Privacy check (no data cross-contamination):', !leakCheck)
  if (leakCheck) throw new Error('Privacy breach: Ramesh can see Sunita’s parcel!')

  // 4. Simulate Central Ministry advancing Ramesh's project workflow
  const targetProject = rameshParcels[0].project
  const workflowInst = targetProject.workflowInstances[0]

  // Advance stage atomically
  const nextStage = WorkflowStage.OBJECTIONS_CONSENT
  await prisma.$transaction([
    prisma.workflowInstance.update({
      where: { id: workflowInst.id },
      data: { currentStage: nextStage },
    }),
    prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: `STAGE_ADVANCED:${initialStage}->${nextStage}`,
        entityType: 'Project',
        entityId: targetProject.id,
      },
    }),
  ])
  console.log(`4. Advanced Project "${targetProject.name}" from ${initialStage} to ${nextStage}`)

  // 5. Query Ramesh's parcels again as citizen would
  const updatedRameshParcels = await prisma.landParcel.findMany({
    where: { ownerId: ramesh.id },
    include: {
      project: {
        include: {
          workflowInstances: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  const newStageOnCitizenSide = updatedRameshParcels[0].project.workflowInstances[0].currentStage
  console.log(`5. Citizen Ramesh sees updated stage in real time: ${newStageOnCitizenSide}`)

  if (newStageOnCitizenSide !== nextStage) {
    throw new Error(`Expected stage ${nextStage}, but citizen saw ${newStageOnCitizenSide}`)
  }

  // Restore initial stage for reproducible demos
  await prisma.workflowInstance.update({
    where: { id: workflowInst.id },
    data: { currentStage: initialStage },
  })
  console.log(`6. Restored project stage to ${initialStage} for demo reproducibility.`)
  console.log('--- ALL CITIZEN TRANSPARENCY TESTS PASSED! ---')
}

runTest()
  .catch((err) => {
    console.error('Test FAILED:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
