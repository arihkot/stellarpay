import { useState } from 'react'
import { useWalletContext } from '../contexts/WalletContext.jsx'
export default function Navbar() {
  const { connected, publicKey, connect, disconnect, loading } = useWalletContext()
  const [showMenu, setShowMenu] = useState(false)

  const truncatedAddress = publicKey
    ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`
    : ''

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-white tracking-tight">
              StellarPay
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
              Testnet
            </span>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {connected ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">
                  {truncatedAddress}
                </span>
                <button
                  onClick={disconnect}
                  className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connect}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {loading ? 'Connecting...' : 'Connect Freighter'}
              </button>
            )}
          </div>

          <button
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
            onClick={() => setShowMenu(!showMenu)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={showMenu ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>

        {showMenu && (
          <div className="md:hidden pb-4">
            {connected ? (
              <div className="flex flex-col gap-3">
                <span className="text-sm text-gray-400">{truncatedAddress}</span>
                <button
                  onClick={() => { disconnect(); setShowMenu(false) }}
                  className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors w-fit"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => { connect(); setShowMenu(false) }}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {loading ? 'Connecting...' : 'Connect Freighter'}
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
