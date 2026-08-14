// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HistoryPage } from './HistoryPage'

describe('HistoryPage', () => {
  it('renders the placeholder history section', () => {
    render(<HistoryPage />)

    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByText('No history yet.')).toBeInTheDocument()
  })
})
