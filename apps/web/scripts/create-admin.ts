import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Creating admin user...')

  // Get or create CENTRAL_MINISTRY role
  const role = await prisma.role.upsert({
    where: { name: 'CENTRAL_MINISTRY' },
    update: {},
    create: {
      name: 'CENTRAL_MINISTRY',
      description: 'Central Ministry officials',
    },
  })

  // Get or create Karnataka state
  const state = await prisma.state.upsert({
    where: { code: 'KA' },
    update: {},
    create: {
      name: 'Karnataka',
      code: 'KA',
    },
  })

  // Hash password
  const passwordHash = await bcrypt.hash('admin123', 10)

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@example.com',
      passwordHash,
      roleId: role.id,
      stateId: state.id,
    },
  })

  console.log('✅ Admin user created:', admin.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
  