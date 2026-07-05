import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useState } from 'react'

function PayrollFormValidator({ poolBalance = 1000 }) {
  const [payouts, setPayouts] = useState([{ address: '', amount: '' }])
  const [error, setError] = useState(null)

  function validate() {
    const addresses = new Set()
    for (const p of payouts) {
      if (!p.address || !p.amount) { setError('All fields are required'); return }
      if (parseFloat(p.amount) <= 0) { setError('Amounts must be positive'); return }
      if (addresses.has(p.address)) { setError('Duplicate worker addresses'); return }
      addresses.add(p.address)
    }
    const total = payouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
    if (total > poolBalance) { setError('Total exceeds pool balance'); return }
    setError(null)
  }

  return (
    <div>
      {payouts.map((p, i) => (
        <div key={i}>
          <input
            data-testid={`address-${i}`}
            value={p.address}
            onChange={(e) => {
              const next = [...payouts]
              next[i] = { ...next[i], address: e.target.value }
              setPayouts(next)
            }}
          />
          <input
            data-testid={`amount-${i}`}
            value={p.amount}
            onChange={(e) => {
              const next = [...payouts]
              next[i] = { ...next[i], amount: e.target.value }
              setPayouts(next)
            }}
          />
        </div>
      ))}
      <button data-testid="validate-btn" onClick={validate}>Validate</button>
      {error && <span data-testid="error-msg">{error}</span>}
    </div>
  )
}

describe('Payroll form validation', () => {
  it('rejects empty fields', () => {
    render(<PayrollFormValidator />)
    act(() => {
      screen.getByTestId('validate-btn').click()
    })
    expect(screen.queryByTestId('error-msg')).not.toBeNull()
    expect(screen.getByTestId('error-msg').textContent).toBe('All fields are required')
  })

  it('rejects negative amounts', () => {
    render(<PayrollFormValidator />)
    act(() => {
      fireEvent.change(screen.getByTestId('address-0'), {
        target: { value: 'GBBMTQRZMKH4WFYNRBQHCNDRJJZPYDSE6JTRZTSHPQST6DQIE6VAJ6SG' },
      })
      fireEvent.change(screen.getByTestId('amount-0'), {
        target: { value: '-5' },
      })
    })
    act(() => {
      screen.getByTestId('validate-btn').click()
    })
    expect(screen.queryByTestId('error-msg')).not.toBeNull()
    expect(screen.getByTestId('error-msg').textContent).toBe('Amounts must be positive')
  })

  it('rejects zero amounts', () => {
    render(<PayrollFormValidator />)
    act(() => {
      fireEvent.change(screen.getByTestId('address-0'), {
        target: { value: 'GBBMTQRZMKH4WFYNRBQHCNDRJJZPYDSE6JTRZTSHPQST6DQIE6VAJ6SG' },
      })
      fireEvent.change(screen.getByTestId('amount-0'), {
        target: { value: '0' },
      })
    })
    act(() => {
      screen.getByTestId('validate-btn').click()
    })
    expect(screen.queryByTestId('error-msg')).not.toBeNull()
    expect(screen.getByTestId('error-msg').textContent).toBe('Amounts must be positive')
  })

  it('accepts valid payout', () => {
    render(<PayrollFormValidator />)
    const addr = 'GBBMTQRZMKH4WFYNRBQHCNDRJJZPYDSE6JTRZTSHPQST6DQIE6VAJ6SG'
    act(() => {
      fireEvent.change(screen.getByTestId('address-0'), { target: { value: addr } })
      fireEvent.change(screen.getByTestId('amount-0'), { target: { value: '10' } })
    })
    act(() => {
      screen.getByTestId('validate-btn').click()
    })
    expect(screen.queryByTestId('error-msg')).toBeNull()
  })

  it('rejects total exceeding pool balance', () => {
    render(<PayrollFormValidator poolBalance={100} />)
    act(() => {
      fireEvent.change(screen.getByTestId('address-0'), {
        target: { value: 'GBBMTQRZMKH4WFYNRBQHCNDRJJZPYDSE6JTRZTSHPQST6DQIE6VAJ6SG' },
      })
      fireEvent.change(screen.getByTestId('amount-0'), {
        target: { value: '200' },
      })
    })
    act(() => {
      screen.getByTestId('validate-btn').click()
    })
    expect(screen.queryByTestId('error-msg')).not.toBeNull()
    expect(screen.getByTestId('error-msg').textContent).toBe('Total exceeds pool balance')
  })
})
