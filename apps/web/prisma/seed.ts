import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Seed roles
  const roles = [
    { name: 'CENTRAL_MINISTRY', description: 'Central Ministry officials' },
    { name: 'STATE_NODAL', description: 'State Nodal Agency' },
    { name: 'DISTRICT_COLLECTOR', description: 'District Collector' },
    { name: 'LAND_ACQUIRING_BODY', description: 'Land Acquiring Body (NHAI, Railways, etc.)' },
    { name: 'LAND_REVENUE_OFFICER', description: 'Land Revenue Officer' },
    { name: 'TEHSILDAR', description: 'Tehsildar' },
    { name: 'RR_OFFICER', description: 'Rehabilitation & Resettlement Officer' },
    { name: 'FINANCE_OFFICER', description: 'Finance Officer' },
    { name: 'CITIZEN', description: 'Citizen / Landowner' },
    { name: 'SYSTEM_ADMIN', description: 'System Administrator' },
  ]

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    })
  }

  // Seed states
  const states = [
    { name: 'Karnataka', code: 'KA' },
    { name: 'Maharashtra', code: 'MH' },
    { name: 'Tamil Nadu', code: 'TN' },
    { name: 'Gujarat', code: 'GJ' },
    { name: 'Rajasthan', code: 'RJ' },
  ]

  for (const state of states) {
    await prisma.state.upsert({
      where: { code: state.code },
      update: {},
      create: state,
    })
  }

  console.log('✅ Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
  