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
  stateId?: string | null
  districtId?: string | null
  state?: { id: string; name: string; code: string } | null
  district?: { id: string; name: string } | null
  projectId?: string | null
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

  const totalSchemes = infraProposals.length
  const sanctionedCount = infraProposals.filter((p) => p.status === 'AA_FS_SANCTIONED').length
  const totalBudget = infraProposals.reduce((sum, p) => sum + Number(p.estimatedBudgetCr || 0), 0)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              Infrastructure Pre-Sanction & Feasibility Portal
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              PM GatiShakti multi-criteria corridor vetting, statutory clearance gates, and AA&FS Land Acquisition conversion.
            </p>
          </div>
          <Link
            href="/dashboard/proposals/new"
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold shadow-sm transition flex items-center gap-2"
          >
            <span>+</span> Initialize Pre-Sanction Scheme
          </Link>
        </div>

        {/* Overview Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Total Corridor Schemes</span>
            <span className="text-2xl font-black text-gray-900 mt-1 block">{totalSchemes}</span>
            <span className="text-xs text-gray-500 mt-0.5 block">Under Pre-Construction Vetting</span>
          </div>
          <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-xs">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">Sanctioned to Projects (AA&FS)</span>
            <span className="text-2xl font-black text-emerald-700 mt-1 block">{sanctionedCount}</span>
            <span className="text-xs text-emerald-600/80 mt-0.5 block">Converted to Active Land Acquisition</span>
          </div>
          <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-xs">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block">Total Pipeline CapEx</span>
            <span className="text-2xl font-black text-blue-700 mt-1 block">₹ {totalBudget.toLocaleString('en-IN')} Cr</span>
            <span className="text-xs text-blue-600/80 mt-0.5 block">Proposed Infrastructure Capital</span>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-12 text-center text-gray-400 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Fetching infrastructure proposal dockets...
          </div>
        ) : infraProposals.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-12 text-center">
            <span className="text-4xl block mb-2">📋</span>
            <p className="text-gray-700 font-bold mb-1">No infrastructure pre-sanction schemes initialized yet.</p>
            <p className="text-gray-500 text-xs mb-4">Start by initiating your first corridor proposal for spatial vetting and clearances.</p>
            <Link
              href="/dashboard/proposals/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold shadow-sm transition"
            >
              Initialize first scheme →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50/70 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5 text-left">Tracking Code</th>
                  <th className="px-6 py-3.5 text-left">Project Corridor</th>
                  <th className="px-6 py-3.5 text-left">Agency / Ministry</th>
                  <th className="px-6 py-3.5 text-left">CapEx Budget</th>
                  <th className="px-6 py-3.5 text-left">Statutory Status</th>
                  <th className="px-6 py-3.5 text-right">Vetting Portal</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {infraProposals.map((proposal) => {
                  const isSanctioned = proposal.status === 'AA_FS_SANCTIONED'
                  return (
                    <tr key={proposal.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-gray-900">
                        {proposal.proposalCode}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{proposal.title}</div>
                        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-1">
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-700">
                            {proposal.category}
                          </span>
                          {proposal.district?.name && (
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5">
                              <span>📍</span> {proposal.district.name}{proposal.state?.name ? `, ${proposal.state.name}` : ''}
                            </span>
                          )}
                          {isSanctioned && (
                            <span className="text-emerald-700 text-[11px] font-bold flex items-center gap-1">
                              <span>🏛️</span> Active Project (SIA)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">
                        {proposal.sponsoringMinistry}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-blue-700">
                        ₹ {proposal.estimatedBudgetCr} Cr
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 text-xs font-bold rounded-full border ${
                            isSanctioned
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : proposal.status === 'PROPOSAL_DRAFT'
                              ? 'bg-gray-100 text-gray-700 border-gray-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {proposal.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/dashboard/proposals/${proposal.id}`}
                          className="inline-flex items-center px-3.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold shadow-xs transition"
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
        )}
    </div>
  )
}