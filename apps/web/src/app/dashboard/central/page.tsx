import RoleGuard from '@/components/RoleGuard'
import { ROLES } from '@/lib/roles'

export default function CentralDashboard() {
  return (
    <RoleGuard allowedRoles={[ROLES.CENTRAL_MINISTRY, ROLES.SYSTEM_ADMIN]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">
          National Dashboard
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Total Projects</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">0</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Land Acquired</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">0 hectares</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Compensation Paid</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">₹0 crore</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">R&R Progress</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">0%</p>
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}