import RoleGuard from '@/components/RoleGuard'
import { ROLES } from '@/lib/roles'

export default function CitizenDashboard() {
  return (
    <RoleGuard allowedRoles={[ROLES.CITIZEN, ROLES.SYSTEM_ADMIN]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">
          My Land Status
        </h1>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600">Track your land acquisition status, compensation, and R&R benefits.</p>
        </div>
      </div>
    </RoleGuard>
  )
}
