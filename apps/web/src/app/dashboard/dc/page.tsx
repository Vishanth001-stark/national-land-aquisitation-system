import RoleGuard from '@/components/RoleGuard'
import { ROLES } from '@/lib/roles'

export default function DCDashboard() {
  return (
    <RoleGuard allowedRoles={[ROLES.DISTRICT_COLLECTOR, ROLES.SYSTEM_ADMIN]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">
          District Dashboard
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Pending Awards</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">0</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Compensation Pending</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">₹0 crore</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Possession Pending</h3>
            <p className="text-3xl font-bold text-yellow-600 mt-2">0 projects</p>
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}
