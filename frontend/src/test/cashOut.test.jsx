import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useState } from 'react'

function CashOutQuote({ getQuoteFn }) {
  const [sellAmount, setSellAmount] = useState('')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const assets = [
    { code: 'BRL', issuer: null },
    { code: 'NGN', issuer: null },
    { code: 'ARS', issuer: null },
  ]

  async function handleGetQuote() {
    if (!sellAmount || !selectedAsset) return
    setLoading(true)
    setError(null)
    try {
      const result = await getQuoteFn(sellAmount, selectedAsset.code)
      setQuote(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input
        data-testid="sell-amount"
        type="number"
        value={sellAmount}
        onChange={(e) => setSellAmount(e.target.value)}
        placeholder="0.00"
      />
      <div>
        {assets.map((asset) => (
          <button
            key={asset.code}
            data-testid={`asset-${asset.code}`}
            onClick={() => setSelectedAsset(asset)}
            className={selectedAsset?.code === asset.code ? 'selected' : ''}
          >
            {asset.code}
          </button>
        ))}
      </div>
      <button
        data-testid="get-quote-btn"
        onClick={handleGetQuote}
        disabled={!sellAmount || !selectedAsset || loading}
      >
        {loading ? 'Getting Quote...' : 'Get Quote'}
      </button>
      {quote && (
        <div data-testid="quote-result">
          <span data-testid="sell-amount-display">{quote.sell_amount}</span>
          <span data-testid="buy-amount-display">{quote.buy_amount}</span>
          {quote.fee && <span data-testid="fee-display">{quote.fee.total}</span>}
        </div>
      )}
      {error && <span data-testid="quote-error">{error}</span>}
    </div>
  )
}

describe('CashOut quote component', () => {
  it('renders available currency options', () => {
    render(<CashOutQuote getQuoteFn={vi.fn()} />)
    expect(screen.getByTestId('asset-BRL')).toBeInTheDocument()
    expect(screen.getByTestId('asset-NGN')).toBeInTheDocument()
    expect(screen.getByTestId('asset-ARS')).toBeInTheDocument()
  })

  it('disables Get Quote button until amount and asset are selected', () => {
    render(<CashOutQuote getQuoteFn={vi.fn()} />)
    expect(screen.getByTestId('get-quote-btn')).toBeDisabled()

    fireEvent.click(screen.getByTestId('asset-BRL'))
    expect(screen.getByTestId('get-quote-btn')).toBeDisabled()

    fireEvent.change(screen.getByTestId('sell-amount'), { target: { value: '100' } })
    expect(screen.getByTestId('get-quote-btn')).not.toBeDisabled()
  })

  it('displays quote data on successful response', async () => {
    const mockQuote = {
      sell_amount: '100',
      buy_amount: '550.50',
      fee: { total: '1.00', asset: 'stellar:USDC:GBBD...' },
      total_price: '100',
    }

    const getQuoteFn = vi.fn().mockResolvedValue(mockQuote)

    render(<CashOutQuote getQuoteFn={getQuoteFn} />)

    fireEvent.click(screen.getByTestId('asset-BRL'))
    fireEvent.change(screen.getByTestId('sell-amount'), { target: { value: '100' } })

    await act(async () => {
      fireEvent.click(screen.getByTestId('get-quote-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('quote-result')).toBeInTheDocument()
    })

    expect(screen.getByTestId('sell-amount-display').textContent).toBe('100')
    expect(screen.getByTestId('buy-amount-display').textContent).toBe('550.50')
    expect(screen.getByTestId('fee-display').textContent).toBe('1.00')
  })

  it('displays error on failed quote', async () => {
    const getQuoteFn = vi.fn().mockRejectedValue(new Error('SEP-38 quote failed'))

    render(<CashOutQuote getQuoteFn={getQuoteFn} />)

    fireEvent.click(screen.getByTestId('asset-BRL'))
    fireEvent.change(screen.getByTestId('sell-amount'), { target: { value: '100' } })

    await act(async () => {
      fireEvent.click(screen.getByTestId('get-quote-btn'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('quote-error')).toBeInTheDocument()
    })

    expect(screen.getByTestId('quote-error').textContent).toBe('SEP-38 quote failed')
  })
})
