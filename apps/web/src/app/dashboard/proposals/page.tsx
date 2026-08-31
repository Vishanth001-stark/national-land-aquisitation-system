'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface ProjectProposal {
  id: string
  proposalCode: string
  title: string
  sponsoringMinistry: string
  category: string
  estimatedBudgetCr: number
  status: string
  createdAt: string
  alignments?: any[]
  clearances?: any[]
  financialSanction?: any
}

export default function ProposalsPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [infraProposals, setInfraProposals] = useState<ProjectProposal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInfraProposals = async () => {
    try {
      const res = await fetch('/api/proposals?type=infra')
      if (res.ok) {
        const data = await res.json()
        setInfraProposals(Array.isArray(data) ? data : data?.data || [])
      }
    } catch (err) {
      console.error('Error fetching infra proposals:', err)
    }
  }

  useEffect(() => {
    fetchInfraProposals().finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Infrastructure Pre-Sanction Portal
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Initiate and audit land acquisition schemes, feasibility layouts, and environmental clearance check dockets.
            </p>
          </div>
          <Link
            href="/dashboard/proposals/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-md transition"
          >
            + Create Proposal
          </Link>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
            Fetching proposal dockets...
          </div>
        ) : (
          /* INFRASTRUCTURE PRE-SANCTION TABLE */
          infraProposals.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 mb-4">No infrastructure pre-sanction schemes initialized yet.</p>
              <Link
                href="/dashboard/proposals/new"
                className="text-blue-600 hover:text-blue-700 font-semibold text-sm"
              >
                Initialize first scheme →
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Tracking Code</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Project Corridor</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Agency / Ministry</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">CapEx Budget</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right font-bold text-gray-500 uppercase tracking-wider">Vetting Portal</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {infraProposals.map((proposal) => {
                    const isSanctioned = proposal.status === 'AA_FS_SANCTIONED'
                    return (
                      <tr key={proposal.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-gray-900">{proposal.proposalCode}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">{proposal.title}</div>
                          <div className="text-xs text-gray-500">Category: {proposal.category}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{proposal.sponsoringMinistry}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-semibold text-blue-600">₹{proposal.estimatedBudgetCr} Cr</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 text-xs font-extrabold rounded-full border ${
                              isSanctioned
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : proposal.status === 'PROPOSAL_DRAFT'
                                ? 'bg-gray-50 text-gray-600 border-gray-200'
                                : 'bg-orange-50 text-orange-700 border-orange-200'
                            }`}
                          >
                            {proposal.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link
                            href={`/dashboard/proposals/${proposal.id}`}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-semibold shadow-sm transition"
                          >
                            Open Sanction Hub →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}