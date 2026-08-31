import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding PostGIS constraint layers...')

  // Truncate existing spatial layers
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE forest_zones, water_bodies, utility_crossings CASCADE;`)

  // 1. Seed Forest Zones (MultiPolygon, 4326)
  const forestZones = [
    {
      name: 'Bannerghatta Reserve Forest (Eco-Sensitive Zone)',
      wkt: 'MULTIPOLYGON(((77.50 12.70, 77.70 12.70, 77.70 12.90, 77.50 12.90, 77.50 12.70)))',
    },
    {
      name: 'Western Ghats Protected Biosphere',
      wkt: 'MULTIPOLYGON(((74.00 13.00, 75.00 13.00, 75.00 15.00, 74.00 15.00, 74.00 13.00)))',
    },
  ]

  for (const forest of forestZones) {
    const id = crypto.randomUUID()
    await prisma.$executeRawUnsafe(`
      INSERT INTO forest_zones (id, name, geom)
      VALUES ('${id}', '${forest.name}', ST_GeomFromText('${forest.wkt}', 4326));
    `)
  }

  // 2. Seed Water Bodies (MultiPolygon, 4326)
  const waterBodies = [
    {
      name: 'Kaveri River Basin & Wetland Corridor',
      wkt: 'MULTIPOLYGON(((76.00 12.40, 78.00 12.40, 78.00 12.50, 76.00 12.50, 76.00 12.40)))',
    },
    {
      name: 'Kabini Reservoir Eco-Zone',
      wkt: 'MULTIPOLYGON(((76.20 11.90, 76.40 11.90, 76.40 12.10, 76.20 12.10, 76.20 11.90)))',
    },
  ]

  for (const water of waterBodies) {
    const id = crypto.randomUUID()
    await prisma.$executeRawUnsafe(`
      INSERT INTO water_bodies (id, name, geom)
      VALUES ('${id}', '${water.name}', ST_GeomFromText('${water.wkt}', 4326));
    `)
  }

  // 3. Seed Utility Crossings (MultiLineString, 4326)
  const utilityCrossings = [
    {
      name: '765kV High-Tension Transmission Grid (PGCIL)',
      wkt: 'MULTILINESTRING((74.00 13.00, 79.00 13.00))',
    },
    {
      name: 'GAIL Natural Gas Pipeline Corridor',
      wkt: 'MULTILINESTRING((77.00 11.00, 77.00 16.00))',
    },
  ]

  for (const util of utilityCrossings) {
    const id = crypto.randomUUID()
    await prisma.$executeRawUnsafe(`
      INSERT INTO utility_crossings (id, name, geom)
      VALUES ('${id}', '${util.name}', ST_GeomFromText('${util.wkt}', 4326));
    `)
  }

  console.log('✅ PostGIS constraint layers seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
