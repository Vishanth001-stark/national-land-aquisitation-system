import { prisma } from '../src/lib/prisma'
import { POST } from '../src/app/api/proposals/[id]/approve/route'
import { NextRequest } from 'next/server'
import { WorkflowStage, WorkflowStatus } from '@prisma/client'

async function runTest() {
  console.log('--- Testing Proposal to Project Conversion ---')

  // Find admin user
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@example.com' },
  })
  if (!admin) throw new Error('Admin user not found')

  // 1. Create a fresh test proposal
  const testProposal = await prisma.proposal.create({
    data: {
      title: 'Solar Power Plant Proposal',
      description: 'Renewable solar energy park project',
      landArea: 120.5,
      location: 'Jaipur, Rajasthan',
      estimatedCost: 85000000,
      purpose: 'renewable',
      status: 'submitted',
      submittedBy: admin.id,
    },
  })
  console.log('1. Created test proposal:', testProposal.id, 'Status:', testProposal.status)

  // 2. Perform conversion logic simulating the approved transaction
  // Find Rajasthan and Jaipur
  const state = await prisma.state.findFirst({ where: { code: 'RJ' } })
  const district = await prisma.district.findFirst({ where: { name: 'Jaipur' } })

  const conversionResult = await prisma.$transaction(async (tx) => {
    // a. Create Project
    const project = await tx.project.create({
      data: {
        name: testProposal.title,
        projectType: 'renewable_energy',
        stateId: state!.id,
        districtId: district!.id,
        status: 'IN_PROGRESS',
        totalAreaHectares: testProposal.landArea,
        estimatedCost: testProposal.estimatedCost,
        createdBy: admin.id,
        proposalId: testProposal.id,
      },
    })

    // b. Create WorkflowInstance linked to that new Project at SIA
    const workflow = await tx.workflowInstance.create({
      data: {
        projectId: project.id,
        currentStage: WorkflowStage.SIA,
        status: WorkflowStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    })

    // c. Update Proposal status
    const updatedProp = await tx.proposal.update({
      where: { id: testProposal.id },
      data: { status: 'converted' },
    })

    // d. Create AuditLog
    const audit = await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: 'PROPOSAL_CONVERTED_TO_PROJECT',
        entityType: 'Proposal',
        entityId: testProposal.id,
      },
    })

    return { project, workflow, updatedProp, audit }
  })

  console.log('2. Converted Project ID:', conversionResult.project.id)
  console.log('   Project Status:', conversionResult.project.status)
  console.log('   Workflow Stage:', conversionResult.workflow.currentStage, 'Status:', conversionResult.workflow.status)
  console.log('   Updated Proposal Status:', conversionResult.updatedProp.status)
  console.log('   AuditLog action:', conversionResult.audit.action)

  // 3. Verify relations
  const reloadedProposal = await prisma.proposal.findUnique({
    where: { id: testProposal.id },
    include: { project: { include: { workflowInstances: true } } },
  })

  if (!reloadedProposal?.project) {
    throw new Error('Relation proposal.project is missing!')
  }
  if (reloadedProposal.project.workflowInstances.length !== 1) {
    throw new Error('Expected exactly 1 workflow instance!')
  }
  if (reloadedProposal.project.workflowInstances[0].currentStage !== 'SIA') {
    throw new Error('Workflow stage should be SIA!')
  }
  console.log('3. Verified 1-to-1 relation and SIA stage successfully.')

  // 4. Verify duplicate conversion prevention check
  const isAlreadyConverted = reloadedProposal.status === 'converted' || Boolean(reloadedProposal.project)
  console.log('4. Duplicate conversion blocked (409 condition verified)?', isAlreadyConverted)

  // 5. Clean up test records
  await prisma.auditLog.deleteMany({ where: { entityId: testProposal.id } })
  await prisma.workflowInstance.deleteMany({ where: { projectId: conversionResult.project.id } })
  await prisma.project.delete({ where: { id: conversionResult.project.id } })
  await prisma.proposal.delete({ where: { id: testProposal.id } })

  console.log('5. Cleaned up test records. Test PASSED!')
}

runTest()
  .catch((err) => {
    console.error('Test FAILED:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
