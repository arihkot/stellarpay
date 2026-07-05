import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

function ContractStatus({ loading, error, lastTxHash }) {
  return (
    <div>
      {loading && <span data-testid="loading">Loading...</span>}
      {error && <span data-testid="error">{error}</span>}
      {lastTxHash && <a data-testid="tx-link" href={`https://stellar.expert/explorer/testnet/tx/${lastTxHash}`}>
        View tx: {lastTxHash.slice(0, 10)}...
      </a>}
      {!loading && !error && !lastTxHash && <span data-testid="idle">Ready</span>}
    </div>
  )
}

describe('Contract client status', () => {
  it('shows loading state during contract calls', () => {
    render(<ContractStatus loading={true} error={null} lastTxHash={null} />)
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('shows error state on failed calls', () => {
    render(<ContractStatus loading={false} error="Transaction failed" lastTxHash={null} />)
    expect(screen.getByTestId('error')).toBeInTheDocument()
    expect(screen.getByTestId('error').textContent).toBe('Transaction failed')
  })

  it('shows tx hash link after successful call', () => {
    const hash = 'abc123def456abc123def456abc123def456abc123def456abc123def456abc123'
    render(<ContractStatus loading={false} error={null} lastTxHash={hash} />)
    expect(screen.getByTestId('tx-link')).toBeInTheDocument()
    expect(screen.getByTestId('tx-link').href).toContain(hash)
  })

  it('shows idle state when no operation is in progress', () => {
    render(<ContractStatus loading={false} error={null} lastTxHash={null} />)
    expect(screen.getByTestId('idle')).toBeInTheDocument()
  })
})
