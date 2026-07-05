import { useState } from 'react'
import { useWalletContext } from '../contexts/WalletContext.jsx'

export default function Landing({ navigateTo }) {
  const { connected, connect, disconnect, loading, publicKey } = useWalletContext()
  const [error, setError] = useState(null)

  async function handleConnect() {
    setError(null)
    try {
      await connect()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Pay the world, <span className="text-blue-400">instantly</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-lg mx-auto">
            Cross-border payroll and remittance for gig workers —
            powered by Stellar&apos;s path payments and anchor network.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          {connected ? (
            <div className="flex flex-col items-center gap-4">
              <div className="px-4 py-2 rounded-lg bg-green-900/30 border border-green-800 text-green-400 text-sm">
                Connected: {publicKey?.slice(0, 6)}...{publicKey?.slice(-4)}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigateTo('employer')}
                  className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors font-medium"
                >
                  Employer Dashboard
                </button>
                <button
                  onClick={() => navigateTo('worker')}
                  className="px-6 py-3 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors font-medium"
                >
                  Worker Dashboard
                </button>
              </div>
              <button
                onClick={disconnect}
                className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleConnect}
                disabled={loading}
                className="px-8 py-3.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
              >
                {loading ? 'Connecting...' : 'Connect Freighter'}
              </button>

              {error && (
                <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 max-w-md">
                  <p className="text-sm text-red-400">{error}</p>
                  {error === 'Freighter is not connected' && (
                    <a
                      href="https://www.freighter.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
                    >
                      Install Freighter
                    </a>
                  )}
                  {error.includes('Wrong network') && (
                    <p className="text-xs text-yellow-400 mt-2">
                      Open Freighter → Settings → Network → select &quot;Testnet&quot;
                    </p>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-500 mt-4">
                Don&apos;t have Freighter?{' '}
                <a
                  href="https://www.freighter.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  Install the extension
                </a>
              </p>
            </>
          )}
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <div className="p-4 rounded-xl bg-gray-800/50">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-medium text-sm mb-1">Instant Settlement</h3>
            <p className="text-xs text-gray-400">Payments clear in seconds on Stellar, not days via wire transfer.</p>
          </div>
          <div className="p-4 rounded-xl bg-gray-800/50">
            <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-medium text-sm mb-1">Near-Zero Fees</h3>
            <p className="text-xs text-gray-400">Stellar transaction fees are fractions of a cent — keep more of your earnings.</p>
          </div>
          <div className="p-4 rounded-xl bg-gray-800/50">
            <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-medium text-sm mb-1">Cash Out Anywhere</h3>
            <p className="text-xs text-gray-400">Convert USDC to local currency and withdraw via regulated Stellar anchors.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

