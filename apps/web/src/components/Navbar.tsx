'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

export default function Navbar() {
  const { data: session } = useSession()
  const role = session?.user?.role

  return (
    <nav className="bg-white shadow">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">
              🇮🇳 Land Acquisition
            </Link>
            <div className="hidden md:flex space-x-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
              {(role === 'CENTRAL_MINISTRY' || role === 'SYSTEM_ADMIN' || role === 'STATE_NODAL') && (
                <Link href="/dashboard/proposals" className="text-gray-600 hover:text-gray-900">
                  Proposals
                </Link>
              )}
              <Link href="/dashboard/map" className="text-gray-600 hover:text-gray-900">
                Map
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {session?.user?.name} ({session?.user?.role})
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}