import { useState } from 'react'
import { useWalletContext } from '../contexts/WalletContext.jsx'
import { signTx } from '../hooks/useWallet.js'
import {
  getSep38Info,
  getSep38Quote,
  authSep10,
  initiateSep24Withdrawal,
  pollSep24Transaction,
} from '../lib/sepHelpers.js'
import { executePathPayment } from '../lib/sepHelpers.js'
import { USDC_ISSUER, STELLAR_EXPERT_TX } from '../lib/constants.js'

export default function CashOutFlow({ usdcBalance, onClose }) {
  const { publicKey } = useWalletContext()
  const [step, setStep] = useState('select')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [assets, setAssets] = useState([])
  const [sellAmount, setSellAmount] = useState('')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [quote, setQuote] = useState(null)
  const [pathTxHash, setPathTxHash] = useState(null)
  const [sep24TxHash, setSep24TxHash] = useState(null)
  const [sep24Url, setSep24Url] = useState(null)
  const [sep24Id, setSep24Id] = useState(null)
  const [polling, setPolling] = useState(false)

  async function loadAssets() {
    setLoading(true)
    setError(null)
    try {
      const info = await getSep38Info()
      const assetList = Object.entries(info.assets || {})
        .filter(([code]) => code !== 'USDC')
        .map(([code, data]) => ({
          code,
          issuer: data.issuer || null,
          sellDeliveryMethods: data.sell_delivery_methods || [],
          buyDeliveryMethods: data.buy_delivery_methods || [],
        }))
      setAssets(assetList)
    } catch (err) {
      setError('Failed to load available currencies: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGetQuote() {
    if (!sellAmount || parseFloat(sellAmount) <= 0 || !selectedAsset) return
    setLoading(true)
    setError(null)
    try {
      const sellAssetStr = `stellar:USDC:${USDC_ISSUER}`
      const buyAssetStr = selectedAsset.issuer
        ? `stellar:${selectedAsset.code}:${selectedAsset.issuer}`
        : `iso4217:${selectedAsset.code}`

      const quoteResult = await getSep38Quote(sellAssetStr, buyAssetStr, sellAmount)
      setQuote(quoteResult)
      setStep('quote')
    } catch (err) {
      setError('Failed to get quote: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleExecutePath() {
    setLoading(true)
    setError(null)
    try {
      const sellAssetStr = `stellar:USDC:${USDC_ISSUER}`
      const buyAssetStr = selectedAsset.issuer
        ? `${selectedAsset.code}:${selectedAsset.issuer}`
        : selectedAsset.code

      const minBuyAmount = Math.floor(Number(quote.buy_amount) * 0.99).toString()
      const sellStroops = String(Math.floor(parseFloat(sellAmount) * 1e7))

      const result = await executePathPayment(
        publicKey,
        signTx,
        sellAssetStr,
        buyAssetStr,
        sellStroops,
        minBuyAmount,
      )

      setPathTxHash(result.hash)
      setStep('path_done')
    } catch (err) {
      setError('Path payment failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCashOut() {
    setLoading(true)
    setError(null)
    try {
      const authToken = await authSep10(publicKey, (txXDR, _opts) =>
        signTx(txXDR, { networkPassphrase: undefined }),
      )

      const withdrawalResult = await initiateSep24Withdrawal(
        authToken,
        selectedAsset.code,
        sellAmount,
      )

      if (withdrawalResult.id) {
        setSep24Id(withdrawalResult.id)
      }

      if (withdrawalResult.url) {
        setSep24Url(withdrawalResult.url)
        setStep('sep24')

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        if (isMobile) {
          window.location.href = withdrawalResult.url
        } else {
          const width = 480
          const height = 700
          const left = Math.max(0, (window.innerWidth - width) / 2)
          const top = Math.max(0, (window.innerHeight - height) / 2)
          const popup = window.open(
            withdrawalResult.url,
            'sep24_withdrawal',
            `width=${width},height=${height},left=${left},top=${top}`,
          )
          if (!popup) {
            window.location.href = withdrawalResult.url
          }
        }
      }

      startPolling()
    } catch (err) {
      setError('Cash out failed: ' + err.message)
      setLoading(false)
    }
  }

  async function startPolling() {
    if (!sep24Id) return
    setPolling(true)
    setLoading(true)

    let attempts = 0
    const maxAttempts = 60

    const poll = setInterval(async () => {
      attempts++
      try {
        const txStatus = await pollSep24Transaction(sep24Id)
        if (txStatus.stellar_transaction_id) {
          setSep24TxHash(txStatus.stellar_transaction_id)
        }

        const status = txStatus.status || txStatus.kind
        if (status === 'completed' || status === 'error') {
          clearInterval(poll)
          setPolling(false)
          setLoading(false)
          if (status === 'completed') {
            setStep('success')
          } else {
            setError(`Withdrawal ${status}: ${txStatus.message || ''}`)
          }
        }
      } catch (_e) {
        // continue polling
      }

      if (attempts >= maxAttempts) {
        clearInterval(poll)
        setPolling(false)
        setLoading(false)
        setError('Withdrawal is taking longer than expected. Please check back later.')
      }
    }, 3000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Cash Out USDC</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'select' && (
          <>
            <p className="text-sm text-gray-400 mb-4">
              Convert USDC to local currency using Stellar path payments and the anchor network.
            </p>
            {assets.length === 0 && (
              <button
                onClick={loadAssets}
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors text-sm"
              >
                {loading ? 'Loading...' : 'Load Available Currencies'}
              </button>
            )}
            {assets.length > 0 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Amount (USDC)</label>
                  <input
                    type="number"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    max={usdcBalance}
                    className="w-full px-3 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
                  />
                  {usdcBalance > 0 && (
                    <button
                      onClick={() => setSellAmount(String(usdcBalance))}
                      className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                    >
                      Max: {usdcBalance.toFixed(2)}
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Destination Currency</label>
                  <div className="grid grid-cols-2 gap-2">
                    {assets.map((asset) => (
                      <button
                        key={asset.code}
                        onClick={() => setSelectedAsset(asset)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors border ${
                          selectedAsset?.code === asset.code
                            ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                            : 'border-gray-600 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        {asset.code}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleGetQuote}
                  disabled={!sellAmount || !selectedAsset || loading}
                  className="w-full px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors text-sm"
                >
                  {loading ? 'Getting Quote...' : 'Get Quote'}
                </button>
              </div>
            )}
          </>
        )}

        {step === 'quote' && quote && (
          <>
            <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">You send</span>
                <span className="text-sm">${quote.sell_amount} USDC</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">You receive</span>
                <span className="text-sm">{quote.buy_amount} {selectedAsset?.code}</span>
              </div>
              {quote.fee && (
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-400">Fee</span>
                  <span className="text-sm">{quote.fee.total} {quote.fee.asset?.split(':')[0]}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('select')}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm"
              >
                Back
              </button>
              <button
                onClick={handleExecutePath}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors text-sm"
              >
                {loading ? 'Converting...' : 'Convert via Path Payment'}
              </button>
            </div>
          </>
        )}

        {step === 'path_done' && pathTxHash && (
          <>
            <div className="bg-green-900/30 border border-green-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-400 font-medium">Path Payment Complete</p>
              <p className="text-xs text-green-500 mt-1">
                USDC converted to {selectedAsset?.code}. You can now withdraw.
              </p>
              <a
                href={`${STELLAR_EXPERT_TX}/${pathTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
              >
                View tx on StellarExpert
              </a>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('quote')}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm"
              >
                Back
              </button>
              <button
                onClick={handleCashOut}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors text-sm"
              >
                {loading ? 'Processing...' : 'Withdraw via Anchor'}
              </button>
            </div>
          </>
        )}

        {step === 'sep24' && (
          <div className="text-center py-4">
            {polling && (
              <>
                <div className="animate-pulse mb-3">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
                <p className="text-sm text-gray-400">
                  Waiting for withdrawal completion...
                </p>
              </>
            )}
            {!polling && (
              <p className="text-sm text-gray-400">
                Complete the withdrawal in the anchor window.
              </p>
            )}
            {sep24Url && (
              <a
                href={sep24Url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 block mt-2 text-sm"
              >
                Re-open withdrawal window
              </a>
            )}
            {!polling && (
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm"
              >
                Done
              </button>
            )}
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-green-400">Cash Out Complete!</p>
            <p className="text-xs text-gray-400 mt-1">
              Your {quote?.buy_amount} {selectedAsset?.code} is on its way.
            </p>
            <div className="mt-3 space-y-1">
              {pathTxHash && (
                <a
                  href={`${STELLAR_EXPERT_TX}/${pathTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 block"
                >
                  Path Payment Tx
                </a>
              )}
              {sep24TxHash && (
                <a
                  href={`${STELLAR_EXPERT_TX}/${sep24TxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 block"
                >
                  Withdrawal Tx
                </a>
              )}
            </div>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-900/30 border border-red-800">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
