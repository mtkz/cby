import CsvImport from './components/CsvImport'
import FacetSidebar from './components/FacetSidebar'
import ProfileDetail from './components/ProfileDetail'
import ProfileSearch from './components/ProfileSearch'
import { useDetailStore } from './stores/detailStore'
import './App.css'

export default function App() {
  const profile = useDetailStore((s) => s.profile)
  const closeProfile = useDetailStore((s) => s.closeProfile)

  if (profile) {
    return (
      <div className="app">
        <header className="app-header">
          <h1>Cyberyan</h1>
        </header>
        <ProfileDetail profile={profile} onClose={closeProfile} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Cyberyan</h1>
        <p>LinkedIn profile search — import a CSV, then explore the data.</p>
      </header>

      <div className="layout">
        <FacetSidebar />
        <main className="main-col">
          <CsvImport />
          <ProfileSearch />
        </main>
      </div>

      <footer className="app-footer">
        Backend: <code>POST /api/profiles/upload-csv</code> ·{' '}
        <code>GET /api/profiles/search</code> ·{' '}
        <code>GET /api/profiles/aggregations/:field</code>
      </footer>
    </div>
  )
}