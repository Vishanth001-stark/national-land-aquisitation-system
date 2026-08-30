'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import { ROLES } from '@/lib/roles'
import { useSession } from 'next-auth/react'

interface WorkflowInstance {
  id: string
  currentStage: string
  status: string
}

interface Project {
  id: string
  name: string
  projectType: string
  status: string
  state?: { name: string; code: string } | null
  district?: { name: string } | null
  workflowInstances: WorkflowInstance[]
}

interface LandParcel {
  id: string
  surveyNumber: string | null
  areaHectares: number | null
  landType: string | null
  ownerName: string | null
  compensationAmount: number | null
  possessionStatus: string
  latitude: number | null
  longitude: number | null
  project: Project
}

const STAGES = [
  { key: 'SIA', label: '1. SIA', desc: 'Social Impact Assessment' },
  { key: 'PRELIMINARY_NOTIFICATION', label: '2. Preliminary Notification', desc: 'Section 11 Notification' },
  { key: 'OBJECTIONS_CONSENT', label: '3. Objections & Consent', desc: 'Public Hearing & Consent' },
  { key: 'DECLARATION', label: '4. Declaration', desc: 'Section 19 Declaration' },
  { key: 'AWARD', label: '5. Award', desc: 'Land Valuation & Award' },
  { key: 'COMPENSATION', label: '6. Compensation', desc: 'Compensation Disbursement' },
  { key: 'POSSESSION', label: '7. Possession', desc: 'Handover & Transfer' },
]

export default function CitizenDashboard() {
  const { data: session } = useSession()
  const [parcels, setParcels] = useState<LandParcel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCitizenParcels = async () => {
    try {
      const res = await fetch('/api/citizen/parcels')
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to load your land records')
      } else {
        const data = await res.json()
        setParcels(data)
      }
    } catch (err) {
      console.error('Error fetching citizen parcels:', err)
      setError('Network error loading land records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCitizenParcels()
  }, [])

  return (
    <RoleGuard allowedRoles={[ROLES.CITIZEN, ROLES.SYSTEM_ADMIN]}>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header banner */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-xl shadow-lg p-6 sm:p-8 text-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/30 text-blue-100 border border-blue-400/30 mb-2">
                Citizen Portal • Land Acquisition Transparency
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold">
                Welcome, {session?.user?.name || 'Citizen'}
              </h1>
              <p className="text-blue-100 text-sm mt-1">
                Real-time statutory tracking for your notified land parcel(s). All information is read directly from official government records.
              </p>
            </div>
            <button
              onClick={() => {
                setLoading(true)
                setError(null)
                fetchCitizenParcels()
              }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-lg text-xs font-semibold transition border border-white/20 flex items-center gap-2"
            >
              🔄 Refresh Status
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl shadow p-12 text-center text-gray-500">
            <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
            <p>Loading your verified land records...</p>
          </div>
        ) : parcels.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              📋
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No Land Parcels Under Acquisition</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              There are currently no notified land parcels mapped to your account ({session?.user?.email}). If your land is part of an ongoing acquisition project, contact the District Collectorate.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {parcels.map((parcel) => {
              const project = parcel.project
              const workflowInst = project.workflowInstances[0]
              const currentStage = workflowInst?.currentStage || 'SIA'
              const currentStageIdx = STAGES.findIndex((s) => s.key === currentStage)
              const isWorkflowCompleted =
                workflowInst?.status === 'COMPLETED' ||
                project.status === 'completed' ||
                (currentStage === 'POSSESSION' && workflowInst?.status === 'COMPLETED')
              const isPossession = currentStage === 'POSSESSION'

              return (
                <div
                  key={parcel.id}
                  className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden"
                >
                  {/* Final Acquisition Completion Notice Banner */}
                  {isWorkflowCompleted && (
                    <div className="bg-emerald-50 border-b border-emerald-200 p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        ✓
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-900">
                          Land Acquisition Completed — Official Notice
                        </h4>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          All 7 statutory workflow stages have been successfully concluded by the Central Ministry. Final award and possession have been officially recorded.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Parcel & Project Header */}
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100">
                          {project.projectType.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500">
                          District: {project.district?.name || 'N/A'}, {project.state?.name || 'N/A'}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-gray-900">{project.name}</h2>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Survey No: <span className="font-mono font-medium text-gray-800">{parcel.surveyNumber || 'N/A'}</span> • Landowner: <span className="font-medium text-gray-800">{parcel.ownerName}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs text-gray-500 block">Current Status</span>
                        <span
                          className={`inline-block px-3 py-1 text-xs font-bold rounded-full border ${
                            isWorkflowCompleted
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : isPossession
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
                        >
                          {isWorkflowCompleted
                            ? '✓ Acquisition Completed'
                            : STAGES[currentStageIdx]?.label || currentStage}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Visual 7-Stage Workflow Stepper */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider text-xs">
                        Statutory Acquisition Progress (7 Stages)
                      </h3>
                      {isWorkflowCompleted && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                          ✓ All 7 Stages Completed
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                      {STAGES.map((stage, idx) => {
                        const isCompleted = isWorkflowCompleted
                          ? true
                          : idx < currentStageIdx
                        const isCurrent = !isWorkflowCompleted && idx === currentStageIdx
                        const isPending = !isWorkflowCompleted && idx > currentStageIdx

                        return (
                          <div
                            key={stage.key}
                            className={`p-3 rounded-lg border text-left transition ${
                              isCurrent
                                ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                                : isCompleted
                                ? 'bg-green-50/60 border-green-200'
                                : 'bg-gray-50/50 border-gray-200 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  isCompleted
                                    ? 'bg-green-600 text-white'
                                    : isCurrent
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {isCompleted ? '✓' : idx + 1}
                              </span>
                              <span
                                className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                  isCompleted
                                    ? 'bg-green-200 text-green-800'
                                    : isCurrent
                                    ? 'bg-blue-200 text-blue-800'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {isCompleted ? 'Completed' : isCurrent ? 'Active' : 'Pending'}
                              </span>
                            </div>
                            <h4
                              className={`text-xs font-bold leading-tight ${
                                isCompleted
                                  ? 'text-green-950'
                                  : isCurrent
                                  ? 'text-blue-900'
                                  : 'text-gray-700'
                              }`}
                            >
                              {stage.label.replace(/^\d+\.\s*/, '')}
                            </h4>
                            <p className="text-[11px] text-gray-500 mt-1 leading-snug">{stage.desc}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Parcel Details & Compensation Summary */}
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-gray-50/30">
                    <div>
                      <span className="text-xs text-gray-500 block">Notified Area</span>
                      <p className="text-base font-semibold text-gray-900 mt-0.5">
                        {parcel.areaHectares ? `${parcel.areaHectares} Ha` : 'N/A'}
                        {parcel.areaHectares && (
                          <span className="text-xs text-gray-500 font-normal ml-1">
                            ({(Number(parcel.areaHectares) * 2.47105).toFixed(2)} acres)
                          </span>
                        )}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs text-gray-500 block">Land Classification</span>
                      <p className="text-base font-semibold text-gray-900 mt-0.5 capitalize">
                        {parcel.landType || 'Unspecified'}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs text-gray-500 block">Estimated Compensation</span>
                      <p className="text-base font-bold text-emerald-700 mt-0.5">
                        {parcel.compensationAmount
                          ? `₹${(Number(parcel.compensationAmount) / 100000).toFixed(2)} Lakhs`
                          : 'Under Assessment'}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs text-gray-500 block">Possession Status</span>
                      <span
                        className={`inline-block mt-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                          parcel.possessionStatus === 'POSSESSED'
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : parcel.possessionStatus === 'ACQUIRED'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                        }`}
                      >
                        {parcel.possessionStatus.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </RoleGuard>
  )
}
