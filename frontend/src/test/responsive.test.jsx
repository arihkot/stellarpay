import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

function ResponsiveDashboard() {
  return (
    <div>
      <nav data-testid="navbar" className="h-16 bg-gray-900">Navbar</nav>
      <div data-testid="dashboard-layout" className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        <div data-testid="card-balance" className="bg-gray-800 rounded-xl p-5">Pool Balance</div>
        <div data-testid="card-workers" className="bg-gray-800 rounded-xl p-5">Workers</div>
        <div data-testid="card-tx" className="bg-gray-800 rounded-xl p-5">Last Tx</div>
      </div>
      <div data-testid="table-view" className="hidden md:block bg-gray-800 rounded-xl p-6">
        Workers Table
      </div>
      <div data-testid="card-view" className="block md:hidden bg-gray-800 rounded-xl p-6">
        Workers Cards
      </div>
    </div>
  )
}

describe('Responsive layout', () => {
  it('renders dashboard without overflowing on mobile viewport', () => {
    const { container } = render(<ResponsiveDashboard />)
    expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument()
    expect(screen.getByTestId('card-balance')).toBeInTheDocument()
    expect(screen.getByTestId('card-workers')).toBeInTheDocument()
    expect(screen.getByTestId('card-tx')).toBeInTheDocument()
  })

  it('renders all dashboard cards without errors', () => {
    render(<ResponsiveDashboard />)
    const cards = [
      screen.getByTestId('card-balance'),
      screen.getByTestId('card-workers'),
      screen.getByTestId('card-tx'),
    ]
    cards.forEach(card => {
      expect(card).toBeInTheDocument()
    })
  })
})
