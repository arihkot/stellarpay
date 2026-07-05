import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

function ErrorFallback({ error, onRetry }) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <p>{error?.message || 'An unexpected error occurred'}</p>
      {onRetry && (
        <button onClick={onRetry} data-testid="retry-btn">
          Try Again
        </button>
      )}
    </div>
  )
}

describe('ErrorFallback', () => {
  it('renders error message', () => {
    render(<ErrorFallback error={{ message: 'Test error' }} />)
    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('renders default message when no error provided', () => {
    render(<ErrorFallback /> )
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
  })

  it('renders retry button when onRetry is provided', () => {
    render(<ErrorFallback error={{ message: 'err' }} onRetry={vi.fn()} />)
    expect(screen.getByTestId('retry-btn')).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorFallback error={{ message: 'err' }} onRetry={onRetry} />)
    fireEvent.click(screen.getByTestId('retry-btn'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
