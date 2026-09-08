'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

interface Alignment {
  id: string
  alignmentName: string
  isPreferred: boolean
  bufferWidthMeters: number
  totalLengthKm: number
  forestOverlapHa: number
  waterbodyOverlapHa: number
  clearanceRiskScore: string
  centerlineGeojson?: any
  corridorGeojson?: any
  utilityIntersectsCount?: number
}

interface Clearance {
  id: string
  clearanceType: string
  status: 'NOT_APPLIED' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'
  referenceNo?: string
  submittedDate?: string
  approvalDate?: string
  remarks?: string
}

interface FinancialSanction {
  id: string
  sanctionOrderNo: string
  sanctionedAmountCr: number
  landAcquisitionBudgetCr: number
  civilWorksBudgetCr: number
  sanctioningAuthority: string
  sanctionDate: string
  documentHash?: string | null
}

interface ProjectWorkflow {
  id: string
  currentStage: string
  status: string
  slaDeadline?: string | null
  startedAt: string
}

interface LinkedProject {
  id: string
  name: string
  projectType: string
  status: string
  totalAreaHectares?: number | null
  estimatedCost?: number | null
  workflowInstances?: ProjectWorkflow[]
  state?: { name: string; code: string } | null
  district?: { name: string } | null
}

interface Proposal {
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
  alignments?: Alignment[]
  clearances?: Clearance[]
  financialSanction?: FinancialSanction | null
  project?: LinkedProject | null
}

const CLEARANCE_NAMES: Record<string, string> = {
  FOREST_STAGE_1: 'Forest Clearance (Stage-1 In-Principle)',
  FOREST_STAGE_2: 'Forest Clearance (Stage-2 Final Handover)',
  EIA_TOR: 'Environmental Impact (ToR & Scoping)',
  EIA_PUBLIC_HEARING: 'EIA Public Hearing Consultation',
  EIA_FINAL: 'Final Environmental Clearance (EC)',
  RAILWAY_NOC: 'Railway Zone Crossing NOC',
  UTILITY_PWD: 'State PWD / High-Tension Utility NOC',
}

const STAGE_LABELS: Record<string, string> = {
  SIA: '1. SIA (Social Impact Assessment - Sec 4 RFCTLARR)',
  PRELIMINARY_NOTIFICATION: '2. Preliminary Notification (Sec 11)',
  OBJECTIONS_CONSENT: '3. Objections & Hearing (Sec 15)',
  DECLARATION: '4. Declaration of Acquisition (Sec 19)',
  AWARD: '5. Land Valuation & Award Inquiry (Sec 23)',
  COMPENSATION: '6. Direct Benefit Compensation Disbursal',
  POSSESSION: '7. Final Statutory Possession Handover',
}

export default function ProposalSanctionHub({ params }: { params: any }) {
  const resolvedParams = React.use<any>(params)
  const proposalId = resolvedParams?.id

  const router = useRouter()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [alignments, setAlignments] = useState<Alignment[]>([])
  const [clearances, setClearances] = useState<Clearance[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Clearance Update modal state
  const [editingClearance, setEditingClearance] = useState<Clearance | null>(null)
  const [clearanceStatus, setClearanceStatus] = useState<any>('APPROVED')
  const [clearanceRefNo, setClearanceRefNo] = useState('')
  const [clearanceRemarks, setClearanceRemarks] = useState('')

  // Sanction Modal states
  const [showSanctionModal, setShowSanctionModal] = useState(false)
  const [sanctionForm, setSanctionForm] = useState({
    sanctionOrderNo: '',
    sanctionedAmountCr: 0,
    landAcquisitionBudgetCr: 0,
    civilWorksBudgetCr: 0,
    sanctioningAuthority: 'Cabinet Committee on Economic Affairs (CCEA)',
    sanctionDate: new Date().toISOString().split('T')[0],
    stateId: '',
    districtId: '',
  })

  // Load single proposal data with all relations
  const loadData = async () => {
    try {
      const res = await fetch(`/api/proposals/${proposalId}`)
      if (res.ok) {
        const data: Proposal = await res.json()
        setProposal(data)
        setAlignments(data.alignments || [])
        setClearances(data.clearances || [])

        // Pre-fill sanction form based on budget
        if (data && !data.financialSanction) {
          const budget = Number(data.estimatedBudgetCr) || 1200
          setSanctionForm((prev) => ({
            ...prev,
            sanctionOrderNo: `AA-FS-${data.proposalCode}-${new Date().getFullYear()}`,
            sanctionedAmountCr: budget,
            landAcquisitionBudgetCr: Math.round(budget * 0.35), // 35% standard LA allocation
            civilWorksBudgetCr: Math.round(budget * 0.65),
            stateId: data.stateId || '',
            districtId: data.districtId || '',
          }))
        }
      } else {
        setErrorMsg('Failed to load proposal docket from server.')
      }
    } catch (err) {
      console.error('Error loading proposal data:', err)
      setErrorMsg('Network error connecting to sanction hub server.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (proposalId) {
      loadData()
    }
  }, [proposalId])

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [77.1000, 12.6500],
      zoom: 8.5,
    })

    map.current.on('load', () => {
      setMapLoaded(true)
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Draw Alignments on Map
  useEffect(() => {
    if (!map.current || !mapLoaded || alignments.length === 0) return

    const m = map.current

    // Clean up existing layers and sources
    alignments.forEach((align) => {
      const lineLayer = `line-${align.id}`
      const fillLayer = `fill-${align.id}`

      if (m.getLayer(lineLayer)) m.removeLayer(lineLayer)
      if (m.getLayer(fillLayer)) m.removeLayer(fillLayer)
      if (m.getSource(align.id)) m.removeSource(align.id)
    })

    // Add each alignment
    alignments.forEach((align) => {
      if (!align.centerlineGeojson || !align.corridorGeojson) return

      const color = align.isPreferred ? '#eab308' : '#06b6d4' // Yellow = Preferred, Cyan = Alternative

      m.addSource(align.id, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: align.corridorGeojson,
              properties: { type: 'corridor' },
            },
            {
              type: 'Feature',
              geometry: align.centerlineGeojson,
              properties: { type: 'centerline' },
            },
          ],
        },
      })

      // Corridor Polygon Fill
      m.addLayer({
        id: `fill-${align.id}`,
        type: 'fill',
        source: align.id,
        filter: ['==', ['get', 'type'], 'corridor'],
        paint: {
          'fill-color': color,
          'fill-opacity': align.isPreferred ? 0.25 : 0.12,
          'fill-outline-color': color,
        },
      })

      // Centerline Line
      m.addLayer({
        id: `line-${align.id}`,
        type: 'line',
        source: align.id,
        filter: ['==', ['get', 'type'], 'centerline'],
        paint: {
          'line-color': color,
          'line-width': align.isPreferred ? 4.5 : 2.5,
          'line-dasharray': align.isPreferred ? [] : [2, 2],
        },
      })
    })

    // Fit map bounds to preferred alignment if coordinates exist
    const pref = alignments.find((a) => a.isPreferred) || alignments[0]
    if (pref?.centerlineGeojson?.coordinates?.length) {
      const coords = pref.centerlineGeojson.coordinates
      const bounds = coords.reduce(
        (b: mapboxgl.LngLatBounds, coord: [number, number]) => b.extend(coord),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      )
      m.fitBounds(bounds, { padding: 50, duration: 1200 })
    }
  }, [alignments, mapLoaded])

  // Lock Preferred Alignment
  const handleLockAlignment = async (alignmentId: string) => {
    setActionLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/select-alignment/${alignmentId}`, {
        method: 'PUT',
      })
      if (res.ok) {
        setSuccessBanner('Preferred corridor locked successfully for statutory clearance vetting.')
        await loadData()
      } else {
        const data = await res.json()
        setErrorMsg(data.error || 'Failed to select preferred alignment.')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Error updating preferred alignment.')
    } finally {
      setActionLoading(false)
    }
  }

  // Auto-generate realistic alignments using PostGIS spatial engine
  const handleAutoGenerateAlignments = async () => {
    setActionLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/alignments/auto-generate`, {
        method: 'POST',
      })
      if (res.ok) {
        setSuccessBanner('Corridor alignment schemes provisioned and vetted with PostGIS spatial layers.')
        await loadData()
      } else {
        const data = await res.json()
        setErrorMsg(data.error || 'Failed to generate alignments.')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Error triggering alignment generation.')
    } finally {
      setActionLoading(false)
    }
  }

  // Fast-track in-principle clearances
  const handleFastTrackClearances = async () => {
    setActionLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/clearances/fast-track`, {
        method: 'POST',
      })
      if (res.ok) {
        setSuccessBanner('In-Principle Clearances successfully granted (MoEFCC Stage-1 & EIA ToR). Scheme ready for AA&FS Sanction.')
        await loadData()
      } else {
        const data = await res.json()
        setErrorMsg(data.error || 'Failed to fast-track clearances.')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Network error fast-tracking statutory clearances.')
    } finally {
      setActionLoading(false)
    }
  }

  // Update single clearance milestone
  const handleUpdateClearance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClearance) return
    setActionLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/proposals/${proposalId}/clearances/${editingClearance.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: clearanceStatus,
          referenceNo: clearanceRefNo || null,
          submittedDate: new Date().toISOString(),
          approvalDate: clearanceStatus === 'APPROVED' ? new Date().toISOString() : null,
          remarks: clearanceRemarks || null,
        }),
      })

      if (res.ok) {
        await loadData()
        setEditingClearance(null)
        setClearanceRefNo('')
        setClearanceRemarks('')
        setSuccessBanner(`Milestone updated for ${editingClearance.clearanceType}`)
      } else {
        const data = await res.json()
        setErrorMsg(data.error || 'Failed to update clearance milestone.')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Error saving clearance status.')
    } finally {
      setActionLoading(false)
    }
  }

  // Submit Financial Sanction AA&FS
  const handleConfirmSanction = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/proposals/${proposalId}/sanction-aafs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sanctionForm,
          sanctionedAmountCr: Number(sanctionForm.sanctionedAmountCr),
          landAcquisitionBudgetCr: Number(sanctionForm.landAcquisitionBudgetCr),
          civilWorksBudgetCr: Number(sanctionForm.civilWorksBudgetCr),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to record financial sanction.')
      } else {
        setShowSanctionModal(false)
        setSuccessBanner('🎉 Administrative Approval & Financial Sanction (AA&FS) issued! Downstream Land Acquisition Project successfully initialized at Stage 1 (SIA) under RFCTLARR Act 2013.')
        await loadData()
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Error establishing connection to financial sanction engine.')
    } finally {
      setActionLoading(false)
    }
  }

  const exportEnvelope = () => {
    window.open(`/api/proposals/${proposalId}/export-sanctioned-envelope`, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 font-semibold flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Loading Pre-Construction Sanction Hub...
        </div>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-red-500 font-bold text-lg mb-2">Proposal Docket Not Found</div>
        <p className="text-gray-500 text-sm mb-6">The requested infrastructure proposal could not be retrieved.</p>
        <Link
          href="/dashboard/proposals"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          ← Return to Proposals
        </Link>
      </div>
    )
  }

  // Statutory lifecycle stages
  const steps = [
    { label: '1. Concept (Draft)', key: 'PROPOSAL_DRAFT' },
    { label: '2. Pre-Feasibility', key: 'PRE_FEASIBILITY_APPROVED' },
    { label: '3. DPR Preparation', key: 'DPR_UNDER_PREPARATION' },
    { label: '4. Clearance Gate', key: 'CLEARANCE_PENDING' },
    { label: '5. PIB Review', key: 'PIB_SANCTION_REVIEW' },
    { label: '6. Sanctioned (AA&FS)', key: 'AA_FS_SANCTIONED' },
  ]

  const currentStepIndex = steps.findIndex((s) => s.key === proposal.status)
  const isSanctioned = proposal.status === 'AA_FS_SANCTIONED'
  const preferredAlignment = alignments.find((a) => a.isPreferred)
  const approvedClearancesCount = clearances.filter((c) => c.status === 'APPROVED').length
  const hasInPrincipleClearances = approvedClearancesCount > 0
  const canUnlockSanction = preferredAlignment && hasInPrincipleClearances && !isSanctioned

  // Active statutory workflow of the linked project (if sanctioned)
  const linkedProject = proposal.project
  const activeWorkflow = linkedProject?.workflowInstances?.[0]
  const currentStageLabel = activeWorkflow
    ? STAGE_LABELS[activeWorkflow.currentStage] || activeWorkflow.currentStage
    : '1. SIA (Social Impact Assessment - Sec 4 RFCTLARR)'

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
          <Link href="/dashboard" className="hover:text-gray-800">Dashboard</Link>
          <span>/</span>
          <Link href="/dashboard/proposals" className="hover:text-gray-800">Proposals</Link>
          <span>/</span>
          <span className="font-mono font-bold text-gray-700">{proposal.proposalCode}</span>
        </div>

        {/* Top Notification Banners */}
        {successBanner && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-lg text-sm mb-6 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <span>{successBanner}</span>
            </div>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-700 hover:text-emerald-900 font-bold text-xs">
              ✕
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-300 text-rose-900 px-4 py-3 rounded-lg text-sm mb-6 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-700 hover:text-rose-900 font-bold text-xs">
              ✕
            </button>
          </div>
        )}

        {/* Proposal Header Card */}
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {proposal.category}
                </span>
                <span className="text-xs font-mono font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {proposal.proposalCode}
                </span>
                {proposal.district?.name && (
                  <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                    <span>📍</span> {proposal.district.name}{proposal.state?.name ? `, ${proposal.state.name}` : ''}
                  </span>
                )}
                {isSanctioned ? (
                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    AA&FS Sanctioned
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase">
                    {proposal.status.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 mt-2">{proposal.title}</h1>
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                <span>Sponsoring Agency:</span>
                <strong className="text-gray-900">{proposal.sponsoringMinistry}</strong>
              </p>
            </div>

            <div className="text-left md:text-right bg-blue-50/50 p-4 rounded-lg border border-blue-100 min-w-[200px]">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Total Estimated CapEx</span>
              <span className="text-2xl md:text-3xl font-black text-blue-700">₹ {proposal.estimatedBudgetCr} Cr</span>
              <span className="text-xs text-gray-400 block mt-0.5">PM GatiShakti National Master Plan</span>
            </div>
          </div>

          {/* Stepper */}
          <div className="mt-8 border-t pt-6">
            <div className="flex items-center justify-between overflow-x-auto pb-2">
              {steps.map((step, idx) => {
                const isPassed = idx <= currentStepIndex
                const isCurrent = idx === currentStepIndex
                return (
                  <div key={step.key} className="flex-1 min-w-[120px] flex flex-col items-center relative">
                    {idx < steps.length - 1 && (
                      <div
                        className={`absolute top-4 left-1/2 w-full h-1 z-0 ${
                          idx < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      />
                    )}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs relative z-10 transition shadow-sm ${
                        isPassed
                          ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                          : 'bg-gray-200 text-gray-500'
                      } ${isCurrent ? 'ring-4 ring-blue-300 scale-110' : ''}`}
                    >
                      {idx + 1}
                    </div>
                    <span
                      className={`text-xs font-semibold mt-2 text-center max-w-[110px] ${
                        isCurrent ? 'text-blue-700 font-bold' : isPassed ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* IF SANCTIONED: DOWNSTREAM LAND ACQUISITION PROJECT BANNER */}
        {/* ======================================================== */}
        {isSanctioned && (
          <div className="mb-8 space-y-6">
            {/* Project Conversion Announcement Card */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-xl p-6 shadow-xl border border-blue-800">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
                    <span>🏛️</span> Active Statutory Project Initialized
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white">
                    {proposal.title}
                  </h2>
                  <p className="text-blue-200 text-sm max-w-3xl">
                    This infrastructure corridor has successfully completed pre-construction feasibility and received official Administrative Approval & Financial Sanction (AA&FS). It is now being actively executed under the <strong>RFCTLARR Act 2013</strong>.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2 text-xs">
                    <div>
                      <span className="text-blue-300 block uppercase font-bold">Current Stage</span>
                      <span className="font-extrabold text-emerald-400 text-sm">{currentStageLabel}</span>
                    </div>
                    <div>
                      <span className="text-blue-300 block uppercase font-bold">Jurisdiction</span>
                      <span className="font-bold text-white text-sm">
                        📍 {linkedProject?.district?.name || proposal.district?.name || 'District'}, {linkedProject?.state?.name || proposal.state?.name || 'State'}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-300 block uppercase font-bold">Acquisition Area</span>
                      <span className="font-bold text-white text-sm">
                        {linkedProject?.totalAreaHectares ? `${linkedProject.totalAreaHectares} Ha` : '120 Ha'}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-300 block uppercase font-bold">System Project ID</span>
                      <span className="font-mono text-blue-200 text-xs truncate block max-w-[140px]">
                        {linkedProject?.id || 'PROJ-INIT'}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-300 block uppercase font-bold">SLA Timeline</span>
                      <span className="font-bold text-yellow-300 text-xs">180 Days (SIA Window)</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto shrink-0">
                  <Link
                    href="/dashboard/central"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-lg shadow-md transition text-center flex items-center justify-center gap-2"
                  >
                    <span>🚀</span> Open in Central Workflow
                  </Link>
                  <Link
                    href="/dashboard/map"
                    className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-sm rounded-lg shadow-sm transition text-center flex items-center justify-center gap-2"
                  >
                    <span>🗺️</span> View on National GIS Map
                  </Link>
                  <button
                    onClick={exportEnvelope}
                    className="px-5 py-2.5 bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold text-sm rounded-lg shadow-sm transition text-center flex items-center justify-center gap-2"
                  >
                    <span>📂</span> Export Sanctioned GeoJSON
                  </button>
                </div>
              </div>
            </div>

            {/* Official Sanction Certificate Summary Card */}
            {proposal.financialSanction && (
              <div className="bg-white border border-emerald-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between border-b pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📜</span>
                    <div>
                      <h3 className="text-base font-bold text-gray-900">Official AA&FS Sanction Order Certificate</h3>
                      <p className="text-xs text-gray-500">Issued pursuant to Ministry & CCEA statutory approval guidelines</p>
                    </div>
                  </div>
                  <span className="text-xs bg-emerald-50 text-emerald-700 font-mono font-bold px-3 py-1 rounded-md border border-emerald-200">
                    ORDER NO: {proposal.financialSanction.sanctionOrderNo}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="text-xs text-gray-500 font-bold uppercase block">Sanctioning Authority</span>
                    <span className="font-bold text-gray-900">{proposal.financialSanction.sanctioningAuthority}</span>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <span className="text-xs text-gray-500 font-bold uppercase block">Date of Sanction</span>
                    <span className="font-bold text-gray-900">
                      {new Date(proposal.financialSanction.sanctionDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                    <span className="text-xs text-emerald-700 font-bold uppercase block">Land Acquisition Budget</span>
                    <span className="font-black text-emerald-800 text-base">₹ {proposal.financialSanction.landAcquisitionBudgetCr} Cr</span>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <span className="text-xs text-blue-700 font-bold uppercase block">Civil Works Allocation</span>
                    <span className="font-black text-blue-800 text-base">₹ {proposal.financialSanction.civilWorksBudgetCr} Cr</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Grid: Left (Map & Alignments) / Right (Clearances & Sanction Gate) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Columns - Alignments & Spatial MCDA */}
          <div className="lg:col-span-2 space-y-8">
            {/* Map Card */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Corridor Alignment GIS Map</h2>
                  <p className="text-xs text-gray-500">Visualizing centerline & spatial buffer envelope evaluated against PostGIS layers</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-400 border border-amber-600 inline-block" />
                    <span className="font-semibold text-gray-700">Preferred (Locked)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-cyan-400 border border-cyan-600 inline-block" />
                    <span className="font-semibold text-gray-700">Alternative Options</span>
                  </div>
                </div>
              </div>

              <div
                ref={mapContainer}
                className="w-full h-[420px] rounded-lg border border-gray-300 bg-gray-100 relative overflow-hidden shadow-inner"
              />
            </div>

            {/* Alignment MCDA Matrix */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Multi-Criteria Decision Analysis (MCDA) Matrix</h2>
                  <p className="text-xs text-gray-500">Spatial overlap vetting across forest zones, water bodies, and high-tension utility crossings</p>
                </div>

                {alignments.length === 0 && (
                  <button
                    disabled={actionLoading}
                    onClick={handleAutoGenerateAlignments}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg shadow transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <span>⚡</span> Auto-Generate Feasibility Corridors
                  </button>
                )}
              </div>

              {alignments.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                  <span className="text-3xl block mb-2">🛣️</span>
                  <h4 className="text-sm font-bold text-gray-800">No corridor alignments evaluated yet</h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-4">
                    Initialize automated GIS alignment alternatives to run environmental and spatial risk vetting.
                  </p>
                  <button
                    disabled={actionLoading}
                    onClick={handleAutoGenerateAlignments}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow transition disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    <span>⚡</span> Run Spatial Alignment Engine (PostGIS)
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 text-left">Corridor Name</th>
                        <th className="px-4 py-3 text-left">Length</th>
                        <th className="px-4 py-3 text-left">Forest Impact</th>
                        <th className="px-4 py-3 text-left">Water Overlap</th>
                        <th className="px-4 py-3 text-left">Utility Crossings</th>
                        <th className="px-4 py-3 text-left">Risk Score</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {alignments.map((a) => (
                        <tr key={a.id} className={a.isPreferred ? 'bg-amber-50/50 font-medium' : 'hover:bg-gray-50'}>
                          <td className="px-4 py-3 text-gray-900 flex items-center gap-2">
                            {a.isPreferred && (
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-sm" />
                            )}
                            <span className="font-semibold">{a.alignmentName}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{a.totalLengthKm} km</td>
                          <td className="px-4 py-3">
                            <span className={a.forestOverlapHa > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600'}>
                              {a.forestOverlapHa} Ha
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{a.waterbodyOverlapHa} Ha</td>
                          <td className="px-4 py-3 text-gray-700">{a.utilityIntersectsCount ?? 2}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                a.clearanceRiskScore === 'HIGH'
                                  ? 'bg-red-100 text-red-800'
                                  : a.clearanceRiskScore === 'MEDIUM'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {a.clearanceRiskScore} RISK
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {a.isPreferred ? (
                              <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 font-black px-2.5 py-1 rounded uppercase tracking-wider">
                                LOCKED
                              </span>
                            ) : isSanctioned ? (
                              <span className="text-xs text-gray-400">Archived Option</span>
                            ) : (
                              <button
                                disabled={actionLoading}
                                onClick={() => handleLockAlignment(a.id)}
                                className="px-3 py-1 text-xs text-blue-700 hover:text-white hover:bg-blue-600 rounded-md border border-blue-600 transition font-bold"
                              >
                                Lock Preferred
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Statutory Clearances & Sanction Gatekeeper */}
          <div className="space-y-8">
            {/* Statutory Clearances Matrix */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Statutory Clearances</h2>
                  <p className="text-xs text-gray-500">In-Principle & working clearances required under Indian statutory law</p>
                </div>
                {!isSanctioned && (
                  <button
                    disabled={actionLoading}
                    onClick={handleFastTrackClearances}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                    title="Expedite In-Principle Stage-1 Clearances (MoEFCC & ToR)"
                  >
                    <span>⚡</span> Fast-Track
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {clearances.map((c) => {
                  const label = CLEARANCE_NAMES[c.clearanceType] || c.clearanceType
                  const isApproved = c.status === 'APPROVED'

                  return (
                    <div key={c.id} className="border border-gray-100 bg-gray-50/50 p-3 rounded-lg space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-900">{label}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            isApproved
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : c.status === 'NOT_APPLIED'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[11px] text-gray-500">
                        <span className="truncate max-w-[180px]">
                          Ref: <span className="font-mono text-gray-700">{c.referenceNo || 'Not Registered'}</span>
                        </span>
                        {!isSanctioned && (
                          <button
                            onClick={() => {
                              setEditingClearance(c)
                              setClearanceStatus(c.status)
                              setClearanceRefNo(c.referenceNo || '')
                              setClearanceRemarks(c.remarks || '')
                            }}
                            className="text-blue-600 hover:underline font-semibold"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Clearance Edit Modal / Drawer */}
            {editingClearance && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-blue-900 uppercase mb-3">
                  Update Clearance: {CLEARANCE_NAMES[editingClearance.clearanceType] || editingClearance.clearanceType}
                </h3>
                <form onSubmit={handleUpdateClearance} className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-700 font-semibold mb-1">Status</label>
                    <select
                      value={clearanceStatus}
                      onChange={(e) => setClearanceStatus(e.target.value)}
                      className="w-full text-xs border rounded p-2 bg-white text-gray-900 font-semibold"
                    >
                      <option value="SUBMITTED">SUBMITTED (Applied with DPR)</option>
                      <option value="IN_REVIEW">IN_REVIEW (Under Scrutiny)</option>
                      <option value="APPROVED">APPROVED (In-Principle NOC Accorded)</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 font-semibold mb-1">Official Reference Number</label>
                    <input
                      type="text"
                      value={clearanceRefNo}
                      onChange={(e) => setClearanceRefNo(e.target.value)}
                      className="w-full text-xs border rounded p-2 bg-white text-gray-900 font-mono"
                      placeholder="e.g. MOEFCC-REC-2026/09"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-700 font-semibold mb-1">Official Remarks</label>
                    <textarea
                      value={clearanceRemarks}
                      onChange={(e) => setClearanceRemarks(e.target.value)}
                      className="w-full text-xs border rounded p-2 bg-white text-gray-900"
                      rows={2}
                      placeholder="Vetting conditions or notes"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow transition"
                    >
                      Save Clearance
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingClearance(null)}
                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs rounded font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Financial Sanction & AA&FS Gatekeeper Card */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Financial Sanction Gatekeeper</h2>
              <p className="text-xs text-gray-500 mb-4">PIB / CCEA Administrative Approval & Financial Sanction (AA&FS)</p>

              {isSanctioned ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-lg text-xs leading-relaxed font-semibold">
                    ✅ <strong>AA&FS Financial Sanction Officially Accorded.</strong>
                    <p className="text-gray-600 font-normal mt-1">
                      Project capital has been sanctioned and released for Land Acquisition execution under RFCTLARR Act Section 4.
                    </p>
                  </div>
                  <button
                    onClick={exportEnvelope}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow transition flex items-center justify-center gap-2"
                  >
                    <span>📂</span> Download Sanction Envelope GeoJSON
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Gatekeeper Checklists */}
                  <div className="space-y-2.5 text-xs bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2.5">
                      <span className={preferredAlignment ? 'text-emerald-600 font-bold text-sm' : 'text-rose-500 font-bold text-sm'}>
                        {preferredAlignment ? '✔' : '✖'}
                      </span>
                      <span className={preferredAlignment ? 'text-gray-800 font-semibold' : 'text-gray-500'}>
                        Preferred Corridor Alignment Locked
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className={hasInPrincipleClearances ? 'text-emerald-600 font-bold text-sm' : 'text-rose-500 font-bold text-sm'}>
                        {hasInPrincipleClearances ? '✔' : '✖'}
                      </span>
                      <span className={hasInPrincipleClearances ? 'text-gray-800 font-semibold' : 'text-gray-500'}>
                        In-Principle Clearances Accorded ({approvedClearancesCount}/{clearances.length})
                      </span>
                    </div>
                  </div>

                  {canUnlockSanction ? (
                    <button
                      onClick={() => setShowSanctionModal(true)}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-lg transition flex items-center justify-center gap-2"
                    >
                      <span>🔓</span> Issue AA&FS Sanction Order
                    </button>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-lg text-xs leading-relaxed space-y-2">
                      <div className="font-bold flex items-center gap-1.5">
                        <span>⚠️</span> Gatekeeper Prerequisite Pending:
                      </div>
                      <p className="text-gray-700">
                        {!preferredAlignment
                          ? 'Select and lock a preferred corridor alignment in the MCDA matrix.'
                          : 'Approve in-principle statutory clearances. You can use the "⚡ Fast-Track" button above.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Sanction Modal Overlay */}
      {showSanctionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-5 border border-gray-200">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  Issue AA&FS Sanction Order
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Administrative Approval & Financial Sanction (PIB / CCEA Order)
                </p>
              </div>
              <button
                onClick={() => setShowSanctionModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmSanction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Sanction Order Number *</label>
                <input
                  required
                  type="text"
                  value={sanctionForm.sanctionOrderNo}
                  onChange={(e) => setSanctionForm({ ...sanctionForm, sanctionOrderNo: e.target.value })}
                  className="w-full text-xs border rounded-lg p-2.5 bg-white font-mono font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. CCEA-FS-2026/NH-108"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Total CapEx (₹ Cr) *</label>
                  <input
                    required
                    type="number"
                    value={sanctionForm.sanctionedAmountCr}
                    onChange={(e) => setSanctionForm({ ...sanctionForm, sanctionedAmountCr: Number(e.target.value) })}
                    className="w-full text-xs border rounded-lg p-2.5 bg-white font-bold text-blue-700 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">LA Budget (₹ Cr) *</label>
                  <input
                    required
                    type="number"
                    value={sanctionForm.landAcquisitionBudgetCr}
                    onChange={(e) => setSanctionForm({ ...sanctionForm, landAcquisitionBudgetCr: Number(e.target.value) })}
                    className="w-full text-xs border rounded-lg p-2.5 bg-white font-bold text-emerald-700 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Civil Works (₹ Cr) *</label>
                  <input
                    required
                    type="number"
                    value={sanctionForm.civilWorksBudgetCr}
                    onChange={(e) => setSanctionForm({ ...sanctionForm, civilWorksBudgetCr: Number(e.target.value) })}
                    className="w-full text-xs border rounded-lg p-2.5 bg-white font-bold text-gray-700 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Competent Authority *</label>
                  <select
                    value={sanctionForm.sanctioningAuthority}
                    onChange={(e) => setSanctionForm({ ...sanctionForm, sanctioningAuthority: e.target.value })}
                    className="w-full text-xs border rounded-lg p-2.5 bg-white font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Cabinet Committee on Economic Affairs (CCEA)">CCEA</option>
                    <option value="Public Investment Board (PIB)">PIB</option>
                    <option value="Ministry Standing Finance Committee (SFC)">Ministry SFC</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Sanction Order Date *</label>
                <input
                  required
                  type="date"
                  value={sanctionForm.sanctionDate}
                  onChange={(e) => setSanctionForm({ ...sanctionForm, sanctionDate: e.target.value })}
                  className="w-full text-xs border rounded-lg p-2.5 bg-white font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Target Project Jurisdiction */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                <div className="text-gray-500 font-bold uppercase text-[10px] tracking-wider">Statutory Project Jurisdiction</div>
                <div className="font-bold text-gray-900 flex items-center gap-1.5 text-sm">
                  <span>📍</span>
                  <span>{proposal.district?.name || 'District Jurisdiction'}, {proposal.state?.name || 'State'}</span>
                </div>
                <p className="text-gray-500 text-[11px]">
                  This project and RFCTLARR Act Section 4 acquisition will be assigned to the Competent Authority in {proposal.district?.name || 'this district'}.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                <span className="font-bold">Downstream Conversion Note:</span> Confirming this order will immediately register the Land Acquisition Project under Section 4 of RFCTLARR Act 2013 and allocate the Land Acquisition Budget.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowSanctionModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-lg shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading ? 'Sanctioning Project...' : 'Confirm Financial Sanction & Convert to Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
