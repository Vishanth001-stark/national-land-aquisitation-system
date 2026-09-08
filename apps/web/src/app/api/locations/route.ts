import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const states = await prisma.state.findMany({
      orderBy: { name: 'asc' },
      include: {
        districts: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            stateId: true,
          },
        },
      },
    })

    return NextResponse.json(states)
  } catch (error) {
    console.error('Error fetching locations:', error)
    return NextResponse.json(
      { error: 'Internal server error loading states and districts' },
      { status: 500 }
    )
  }
}
