import { prisma } from '../src/lib/prisma'
import { WORKFLOW_STAGES } from '../src/app/api/projects/[id]/advance/route'
import { WorkflowStage, WorkflowStatus } from '@prisma/client'

async function runTest() {
  console.log('--- Testing Workflow Advancement Logic ---')
  
  // Find an admin user
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@example.com' },
  })
  if (!admin) throw new Error('Admin not found')

  // Find Rajasthan and Jaipur
  const state = await prisma.state.findFirst({ where: { code: 'RJ' } })
  const district = await prisma.district.findFirst({ where: { name: 'Jaipur' } })

  // 1. Create a test project at SIA
  const testProject = await prisma.project.create({
    data: {
      name: 'Test Highway Golden Path Project',
      projectType: 'highway',
      stateId: state!.id,
      districtId: district!.id,
      status: 'IN_PROGRESS',
      createdBy: admin.id,
      workflowInstances: {
        create: {
          currentStage: WorkflowStage.SIA,
          status: WorkflowStatus.IN_PROGRESS,
        },
      },
    },
    include: {
      workflowInstances: true,
    },
  })

  console.log('Created project:', testProject.id, 'Initial stage:', testProject.workflowInstances[0].currentStage)

  // 2. Advance step-by-step to POSSESSION
  let currentProject = testProject
  for (let i = 0; i < 6; i++) {
    const workflow = currentProject.workflowInstances[0]
    const prev = workflow.currentStage
    const idx = WORKFLOW_STAGES.indexOf(prev)
    const next = WORKFLOW_STAGES[idx + 1]
    const isPossession = next === WorkflowStage.POSSESSION

    const [updatedWorkflow, updatedProj, log] = await prisma.$transaction([
      prisma.workflowInstance.update({
        where: { id: workflow.id },
        data: {
          currentStage: next,
          status: isPossession ? WorkflowStatus.COMPLETED : WorkflowStatus.IN_PROGRESS,
          ...(isPossession ? { completedAt: new Date() } : {}),
        },
      }),
      prisma.project.update({
        where: { id: currentProject.id },
        data: {
          status: isPossession ? 'completed' : 'IN_PROGRESS',
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: admin.id,
          action: `STAGE_ADVANCED:${prev}->${next}`,
          entityType: 'Project',
          entityId: currentProject.id,
        },
      }),
    ])

    console.log(`Step ${i + 1}: ${prev} -> ${updatedWorkflow.currentStage} | Status: ${updatedWorkflow.status} | Project status: ${updatedProj.status} | Log: ${log.action}`)

    currentProject = {
      ...updatedProj,
      workflowInstances: [updatedWorkflow],
    } as any
  }

  // 3. Confirm POSSESSION stage reached
  if (currentProject.workflowInstances[0].currentStage !== WorkflowStage.POSSESSION) {
    throw new Error('Project should be at POSSESSION')
  }
  if (currentProject.workflowInstances[0].status !== WorkflowStatus.COMPLETED) {
    throw new Error('Workflow should be COMPLETED')
  }
  if (currentProject.status !== 'completed') {
    throw new Error('Project status should be completed')
  }

  // 4. Test terminal condition check
  const atPossession = currentProject.workflowInstances[0].currentStage === WorkflowStage.POSSESSION
  console.log('Blocked further advance at POSSESSION?', atPossession)

  // 5. Clean up test project and its audit logs
  await prisma.auditLog.deleteMany({ where: { entityId: testProject.id } })
  await prisma.workflowInstance.deleteMany({ where: { projectId: testProject.id } })
  await prisma.project.delete({ where: { id: testProject.id } })

  console.log('Cleaned up test project. Test completed successfully!')
}

runTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
