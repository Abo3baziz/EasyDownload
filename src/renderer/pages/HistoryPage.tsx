import { HistorySection } from '../components/HistorySection'

export function HistoryPage({ onInspect }: { onInspect: (url: string) => void }) {
  return (
    <section className="page">
      <div className="page-header">
        <h1>History</h1>
      </div>
      <HistorySection onInspect={onInspect} />
    </section>
  )
}
