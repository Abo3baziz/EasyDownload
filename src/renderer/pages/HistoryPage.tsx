import { EmptyState } from '../components/EmptyState'

export function HistoryPage() {
  // Placeholder section; to be connected to the persisted download history.
  return (
    <section className="page">
      <h1>History</h1>
      <EmptyState message="No history yet." />
    </section>
  )
}
