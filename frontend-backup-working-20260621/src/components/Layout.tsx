import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navLinks = [
  {
    to: '/',
    label: 'DASHBOARD',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="2" y="2" width="5" height="5" />
        <rect x="9" y="2" width="5" height="5" />
        <rect x="2" y="9" width="5" height="5" />
        <rect x="9" y="9" width="5" height="5" />
      </svg>
    ),
    end: true,
  },
  {
    to: '/new',
    label: 'NEW COMPARISON',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v6M5 8h6" />
      </svg>
    ),
    end: true,
  },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen bg-blueprint-grid text-ink font-sans">
      {/* Sidebar / Drafting Ledger Panel */}
      <aside className="w-56 bg-paper border-r border-hairline flex flex-col min-h-screen flex-shrink-0">
        {/* Title Block */}
        <div className="px-5 pt-6 pb-5 border-b border-hairline">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-blueprint flex items-center justify-center bg-transparent text-blueprint font-mono text-base font-bold">
              ⬡
            </div>
            <div>
              <p className="text-ink font-serif font-bold text-lg leading-tight tracking-tight">ArchBench</p>
              <p className="text-graphite font-mono text-[9px] tracking-wider uppercase">ARCH. SPEC PLATFORM</p>
            </div>
          </div>
        </div>

        {/* Technical Navigation */}
        <nav className="flex flex-col gap-1 p-3 flex-1 font-mono text-xs">
          <p className="text-[9px] font-semibold tracking-widest uppercase text-graphite px-2.5 py-2">LEDGER INDEX</p>
          {navLinks.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-sm transition-colors duration-100 ${
                  isActive
                    ? 'bg-blueprint/10 text-blueprint font-bold border-l-2 border-blueprint'
                    : 'text-graphite hover:text-ink hover:bg-hairline/20'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex-shrink-0 ${isActive ? 'text-blueprint' : 'text-graphite/70'}`}>
                    {icon}
                  </span>
                  <span className="tracking-wide">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer — User & Logout Info */}
        <div className="p-4 border-t border-hairline font-mono text-[11px] text-graphite">
          <div className="truncate mb-2" title={user?.email}>
            USER: <span className="text-ink font-medium">{user?.email}</span>
          </div>
          <button
            onClick={logout}
            className="text-[10px] text-annotation hover:underline font-bold uppercase tracking-wider block"
          >
            [ LOG OUT ]
          </button>
        </div>
      </aside>

      {/* Main Drawing Area */}
      <main className="flex-1 overflow-auto">
        <div className="h-[2px] w-full bg-blueprint" />
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}