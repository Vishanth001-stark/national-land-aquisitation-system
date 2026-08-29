'use client'

import RoleGuard from '@/components/RoleGuard'
import { ROLES } from '@/lib/roles'
import Link from 'next/link'

export default function CentralDashboard() {
  return (
    <RoleGuard allowedRoles={[ROLES.CENTRAL_MINISTRY, ROLES.SYSTEM_ADMIN]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">
            National Dashboard
          </h1>
          <Link
            href="/dashboard/proposals/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + New Proposal
          </Link>
        </div>

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

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/dashboard/proposals"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 block"
            >
              <h3 className="font-semibold text-gray-900 mb-2">View Proposals</h3>
              <p className="text-sm text-gray-600">See all your submitted proposals</p>
            </Link>
            <Link
              href="/dashboard/proposals/new"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 block"
            >
              <h3 className="font-semibold text-gray-900 mb-2">Submit Proposal</h3>
              <p className="text-sm text-gray-600">Create a new land acquisition proposal</p>
            </Link>
            <Link
              href="/dashboard/projects"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 block"
            >
              <h3 className="font-semibold text-gray-900 mb-2">View Projects</h3>
              <p className="text-sm text-gray-600">Manage ongoing projects</p>
            </Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Navigation</h2>
          <div className="flex gap-4">
            <Link
              href="/dashboard/map"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              View Map
            </Link>
            <Link
              href="/dashboard/reports"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              View Reports
            </Link>
          </div>
        </div>
      </div>
    </RoleGuard>
  )
} 