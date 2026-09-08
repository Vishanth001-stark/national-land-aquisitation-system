'use client'

import { useEffect, useState, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface LandParcel {
  id: string
  title: string
  location: string
  landArea: number
  latitude: number
  longitude: number
  status: string
  surveyNumber?: string
  ownerName?: string
  landType?: string
}

const cityCoords: Record<string, [number, number]> = {
  'Delhi': [28.6139, 77.2090],
  'Mumbai': [19.0760, 72.8777],
  'Bangalore': [12.9716, 77.5946],
  'Bengaluru': [12.9716, 77.5946],
  'Chennai': [13.0827, 80.2707],
  'Kolkata': [22.5726, 88.3639],
  'Hyderabad': [17.3850, 78.4867],
  'Pune': [18.5204, 73.8567],
  'Ahmedabad': [23.0225, 72.5714],
  'Jaipur': [26.9124, 75.7873],
  'Lucknow': [26.8467, 80.9462],
  'Mysore': [12.2958, 76.6394],
  'Mangalore': [12.9141, 74.8560],
  'Hubli': [15.3647, 75.1240],
  'Belgaum': [15.8497, 74.4977],
}

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const [parcels, setParcels] = useState<LandParcel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedParcel, setSelectedParcel] = useState<LandParcel | null>(null)
  const [showSatellite, setShowSatellite] = useState(false)
  const [verifying, setVerifying] = useState<string | null>(null)
  const [verifiedData, setVerifiedData] = useState<Record<string, any>>({})

  useEffect(() => {
    fetch('/api/proposals')
      .then((res) => res.json())
      .then((resData) => {
        const proposals = Array.isArray(resData) ? resData : resData?.data || []
        const parcelsWithCoords = proposals.map((proposal: any) => {
          const matchedCity = Object.keys(cityCoords).find((city) =>
            proposal.location.toLowerCase().includes(city.toLowerCase())
          )
          const [lat, lng] = matchedCity ? cityCoords[matchedCity] : [20.5937, 78.9629]

          return {
            id: proposal.id,
            title: proposal.title,
            location: proposal.location,
            landArea: proposal.landArea,
            latitude: lat,
            longitude: lng,
            status: proposal.status,
            surveyNumber: `SY-${Math.floor(Math.random() * 10000)}`,
            ownerName: `Owner ${Math.floor(Math.random() * 100)}`,
            landType: ['Agricultural', 'Residential', 'Commercial', 'Industrial'][Math.floor(Math.random() * 4)],
          }
        })
        setParcels(parcelsWithCoords)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error:', err)
        setLoading(false)
      })
  }, [])

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainer.current || loading) return

    // Clean up existing map instance if any
    if (mapInstance.current) {
      mapInstance.current.remove()
      mapInstance.current = null
    }

    // Default map center: India
    const map = L.map(mapContainer.current).setView([22.5937, 78.9629], 5)

    // Base Tile Layer (OpenStreetMap or Satellite)
    const tileUrl = showSatellite
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

    const attribution = showSatellite
      ? '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

    L.tileLayer(tileUrl, {
      maxZoom: 18,
      attribution,
    }).addTo(map)

    // Custom Marker Icons
    const createCustomIcon = (status: string) => {
      const color = status === 'approved' ? '#16a34a' : status === 'rejected' ? '#dc2626' : '#2563eb'
      return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; borderRadius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">📍</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
    }

    // Add markers for parcels
    parcels.forEach((parcel) => {
      if (parcel.latitude && parcel.longitude) {
        const marker = L.marker([parcel.latitude, parcel.longitude], {
          icon: createCustomIcon(parcel.status),
        }).addTo(map)

        const popupContent = `
          <div style="padding: 4px; min-width: 220px; font-family: sans-serif;">
            <h3 style="font-weight: bold; margin: 0 0 4px 0; color: #0f172a; font-size: 14px;">${parcel.title}</h3>
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b;">📍 ${parcel.location}</p>
            <div style="font-size: 12px; display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #64748b;">Area:</span>
              <span style="font-weight: 600;">${parcel.landArea} acres</span>
            </div>
            <div style="font-size: 12px; display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #64748b;">Status:</span>
              <span style="font-weight: 600; text-transform: capitalize;">${parcel.status}</span>
            </div>
            <button 
              onclick="window.inspectLandRecord('${parcel.id}')"
              style="width: 100%; padding: 6px 12px; background-color: #4f46e5; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;"
            >
              🔍 Inspect Representative Record
            </button>
          </div>
        `

        marker.bindPopup(popupContent)
      }
    })

    // Window inspection handler
    ;(window as any).inspectLandRecord = (parcelId: string) => {
      setVerifying(parcelId)
      setTimeout(() => {
        const parcel = parcels.find((p) => p.id === parcelId)
        if (parcel) {
          setVerifiedData((prev) => ({
            ...prev,
            [parcelId]: {
              surveyNumber: parcel.surveyNumber,
              ownerName: parcel.ownerName,
              landType: parcel.landType,
              area: parcel.landArea,
              rtcVerified: true,
              khataNumber: `KH-${Math.floor(Math.random() * 100000)}`,
              mutationStatus: 'Active',
              landUse: parcel.landType,
              soilType: ['Red Loamy', 'Black Cotton', 'Laterite', 'Alluvial'][Math.floor(Math.random() * 4)],
              irrigationSource: ['Rainfed', 'Canal', 'Borewell', 'Tank'][Math.floor(Math.random() * 4)],
            },
          }))
          setVerifying(null)
          setSelectedParcel(parcel)
        }
      }, 800)
    }

    mapInstance.current = map

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [loading, parcels, showSatellite])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 font-medium">Loading interactive map tiles...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Demo Parcel Data • Representative Cadastral Map
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                🗺️ Land Parcels & GIS Cadastral Map
              </h1>
              <p className="text-gray-600 text-sm">
                Representative land-record data for statutory land acquisition tracking
              </p>
            </div>
            <button
              onClick={() => setShowSatellite(!showSatellite)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-semibold shadow-sm transition"
            >
              {showSatellite ? '🗺️ Street Map View' : '🛰️ Satellite Map View'}
            </button>
          </div>
        </div>

        {/* Leaflet Map Box Container */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden relative">
          <div ref={mapContainer} className="h-[600px] w-full z-0" />
        </div>

        {selectedParcel && verifiedData[selectedParcel.id] && (
          <div className="mt-6 bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                🏛️ Land Record Summary — {selectedParcel.title}
              </h2>
              <button
                onClick={() => setSelectedParcel(null)}
                className="text-gray-500 hover:text-gray-700 font-bold text-sm"
              >
                ✕ Close
              </button>
            </div>

            {verifying === selectedParcel.id ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 text-sm">Loading land record details...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-gray-900 border-b pb-2">📋 RTC Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Survey Number:</span>
                      <p className="font-semibold">{verifiedData[selectedParcel.id].surveyNumber}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Khata Number:</span>
                      <p className="font-semibold">{verifiedData[selectedParcel.id].khataNumber}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Owner Name:</span>
                      <p className="font-semibold">{verifiedData[selectedParcel.id].ownerName}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Land Area:</span>
                      <p className="font-semibold">{verifiedData[selectedParcel.id].area} acres</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Land Type:</span>
                      <p className="font-semibold">{verifiedData[selectedParcel.id].landType}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Mutation Status:</span>
                      <p className="font-semibold text-green-600">{verifiedData[selectedParcel.id].mutationStatus}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg text-gray-900 border-b pb-2">🌾 Land Characteristics</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Soil Type:</span>
                      <p className="font-semibold">{verifiedData[selectedParcel.id].soilType}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Irrigation:</span>
                      <p className="font-semibold">{verifiedData[selectedParcel.id].irrigationSource}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Land Use:</span>
                      <p className="font-semibold">{verifiedData[selectedParcel.id].landUse}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Record Status:</span>
                      <p className="font-semibold text-blue-600">Active Record</p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-900">
                      ℹ️ <strong>Demo parcel data:</strong> In production, integrate authorized state land-record and approved notification services.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Parcels</h3>
            <p className="text-3xl font-bold text-gray-900">{parcels.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Area</h3>
            <p className="text-3xl font-bold text-gray-900">
              {parcels.reduce((sum, p) => sum + p.landArea, 0).toFixed(2)} acres
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Inspected Records</h3>
            <p className="text-3xl font-bold text-indigo-600">
              {Object.keys(verifiedData).length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Active Proposals</h3>
            <p className="text-3xl font-bold text-orange-600">
              {parcels.filter((p) => p.status === 'draft').length}
            </p>
          </div>
        </div>

        <div className="mt-6 bg-slate-900 text-white border border-slate-800 rounded-lg p-6 shadow-md">
          <h3 className="font-semibold text-slate-200 mb-2">🔗 Land Record & Cadastral Feed Architecture</h3>
          <p className="text-xs text-slate-400 mb-4">
            Production: integrate authorized state land-record (DILRMP/State Revenue) and approved notification services.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-amber-400 rounded-full"></div>
              <span className="text-slate-300">State Cadastral GIS Feeds</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-amber-400 rounded-full"></div>
              <span className="text-slate-300">Statutory Notification Gateway</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-amber-400 rounded-full"></div>
              <span className="text-slate-300">PFMS Compensation Linkage</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-blue-400 rounded-full"></div>
              <span className="text-slate-300">DILRMP Standard Compliant</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}