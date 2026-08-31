import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './auth'
import { prisma } from './prisma'
import { Role } from './roles'

/**
 * Resolves authenticated session and user ID.
 * Returns { session, userId } or a NextResponse error.
 */
export async function getAuthContext(): Promise<
  | { session: NonNullable<Awaited<ReturnType<typeof getServerSession>>>; userId: string; error?: never }
  | { error: NextResponse; session?: never; userId?: never }
> {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  let userId = session.user.id

  // Fallback: resolve via email if ID is missing from JWT token
  if (!userId && session.user.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (dbUser) userId = dbUser.id
  }

  if (!userId) {
    return { error: NextResponse.json({ error: 'User ID could not be resolved' }, { status: 401 }) }
  }

  return { session, userId }
}

/**
 * Guards a route to require one of the specified roles.
 * Returns a 403 NextResponse if not authorized.
 */
export function requireRole(
  role: string,
  allowedRoles: Role[]
): NextResponse | null {
  if (!allowedRoles.includes(role as Role)) {
    return NextResponse.json(
      { error: `Forbidden: Required role(s): ${allowedRoles.join(', ')}` },
      { status: 403 }
    )
  }
  return null
}
