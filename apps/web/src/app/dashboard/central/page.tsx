'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import { ROLES } from '@/lib/roles'
import Link from 'next/link'

interface DashboardStats {
  totalProposals: number
  totalLandArea: number
  totalEstimatedCost: number
  proposalsByStatus: Array<{
    status: string
    _count: {
      status: number
    }
  }>
  recentProposals: Array<{
    id: string
    title: string
    status: string
    landArea: number
    estimatedCost: number
    createdAt: string
  }>
}

export default function CentralDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error:', err)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

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
            <h3 className="text-lg font-semibold text-gray-700">Total Proposals</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">{stats?.totalProposals || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Total Land Area</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">{(stats?.totalLandArea || 0).toFixed(2)} acres</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Total Estimated Cost</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">₹{((stats?.totalEstimatedCost || 0) / 10000000).toFixed(2)} Cr</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Active Proposals</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {stats?.proposalsByStatus?.find(p => p.status === 'draft')?._count.status || 0}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/dashboard/proposals"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 block"
              >
                <h3 className="font-semibold text-gray-900 mb-2">View Proposals</h3>
                <p className="text-sm text-gray-600">See all submitted proposals</p>
              </Link>
              <Link
                href="/dashboard/proposals/new"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 block"
              >
                <h3 className="font-semibold text-gray-900 mb-2">Submit Proposal</h3>
                <p className="text-sm text-gray-600">Create new proposal</p>
              </Link>
              <Link
                href="/dashboard/projects"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 block"
              >
                <h3 className="font-semibold text-gray-900 mb-2">View Projects</h3>
                <p className="text-sm text-gray-600">Manage ongoing projects</p>
              </Link>
              <Link
                href="/dashboard/map"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 block"
              >
                <h3 className="font-semibold text-gray-900 mb-2">View Map</h3>
                <p className="text-sm text-gray-600">GIS map of land parcels</p>
              </Link>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Proposals</h2>
            {stats?.recentProposals && stats.recentProposals.length > 0 ? (
              <div className="space-y-3">
                {stats.recentProposals.map((proposal) => (
                  <div key={proposal.id} className="p-3 border border-gray-200 rounded-lg">
                    <h3 className="font-semibold text-gray-900 text-sm">{proposal.title}</h3>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-500">
                        {proposal.landArea} acres
                      </span>
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                        {proposal.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-sm">No recent proposals</p>
            )}
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}
