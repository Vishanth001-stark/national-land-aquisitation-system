import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        workflowInstances: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        landParcels: true,
        state: {
          select: {
            name: true,
            code: true,
          },
        },
        district: {
          select: {
            name: true,
          },
        },
      },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}
