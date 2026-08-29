import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ROLES } from '@/lib/roles'

export default async function DashboardHome() {
  const session = await auth()

  if (!session) {
    redirect('/auth/login')
  }

  const role = session.user?.role

  if (role === ROLES.CENTRAL_MINISTRY || role === ROLES.SYSTEM_ADMIN) {
    redirect('/dashboard/central')
  } else if (role === ROLES.DISTRICT_COLLECTOR) {
    redirect('/dashboard/dc')
  } else if (role === ROLES.CITIZEN) {
    redirect('/dashboard/citizen')
  }

  redirect('/dashboard/central')
}