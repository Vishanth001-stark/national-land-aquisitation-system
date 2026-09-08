'use client'

import { useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import { ROLES } from '@/lib/roles'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CitizenActivatePage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setError('Please enter your 8-character invitation code')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await fetch('/api/citizen/activate-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to activate invitation code')
      } else {
        setSuccessMsg(data.message)
        setTimeout(() => {
          router.push('/dashboard/citizen')
        }, 1500)
      }
    } catch (err) {
      console.error('Error activating invitation:', err)
      setError('Network error while activating invitation code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <RoleGuard allowedRoles={[ROLES.CITIZEN, ROLES.SYSTEM_ADMIN]}>
      <div className="max-w-xl mx-auto px-4 py-12 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto text-2xl">
            🔑
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Citizen Portal Activation
          </h1>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            Enter the secure 1-time activation invitation code issued in your notification preview (e.g. <span className="font-mono font-bold text-indigo-700">INV-8F3A-9K2P</span>) to link your notified land parcel to your Citizen account.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 sm:p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-sm font-medium">
              ✓ {successMsg}
              <p className="text-xs text-emerald-700 mt-1">Redirecting to your Citizen Dashboard...</p>
            </div>
          )}

          <form onSubmit={handleActivate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Invitation Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. INV-8F3A9K2P"
                maxLength={12}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-mono font-bold tracking-widest text-center uppercase focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm rounded-lg transition shadow disabled:opacity-50"
            >
              {loading ? 'Activating Account...' : 'Activate & Link Land Parcel'}
            </button>
          </form>

          <div className="pt-4 border-t border-gray-100 text-center">
            <Link
              href="/dashboard/citizen"
              className="text-xs text-gray-500 hover:text-gray-800 font-medium underline"
            >
              ← Back to Citizen Dashboard
            </Link>
          </div>
        </div>

        {/* Honesty Footer */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 text-center">
          <strong>Demo Notice:</strong> In production, activation links are sent directly to landowner contact channels upon official statutory notification dispatch.
        </div>
      </div>
    </RoleGuard>
  )
}
