import { PrismaClient, RoleName } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Seed roles
  const roles: { name: RoleName; description: string }[] = [
    { name: RoleName.CENTRAL_MINISTRY, description: 'Central Ministry officials' },
    { name: RoleName.STATE_NODAL, description: 'State Nodal Agency' },
    { name: RoleName.DISTRICT_COLLECTOR, description: 'District Collector' },
    { name: RoleName.LAND_ACQUIRING_BODY, description: 'Land Acquiring Body (NHAI, Railways, etc.)' },
    { name: RoleName.LAND_REVENUE_OFFICER, description: 'Land Revenue Officer' },
    { name: RoleName.TEHSILDAR, description: 'Tehsildar' },
    { name: RoleName.RR_OFFICER, description: 'Rehabilitation & Resettlement Officer' },
    { name: RoleName.FINANCE_OFFICER, description: 'Finance Officer' },
    { name: RoleName.CITIZEN, description: 'Citizen / Landowner' },
    { name: RoleName.SYSTEM_ADMIN, description: 'System Administrator' },
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
  