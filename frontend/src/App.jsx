import { useState, useEffect } from 'react'
import Navbar from './components/Navbar.jsx'
import Landing from './components/Landing.jsx'
import EmployerDashboard from './components/EmployerDashboard.jsx'
import WorkerDashboard from './components/WorkerDashboard.jsx'

function App() {
  const [role, setRole] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const roleParam = params.get('role')
    if (roleParam === 'employer' || roleParam === 'worker') {
      setRole(roleParam)
    }

    const errorParam = params.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />

      {error && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 flex items-center justify-between">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300 ml-4"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {role === 'employer' ? (
        <EmployerDashboard />
      ) : role === 'worker' ? (
        <WorkerDashboard />
      ) : (
        <Landing />
      )}
    </div>
  )
}

export default App
