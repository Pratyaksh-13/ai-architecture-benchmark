import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navLinks = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.3"/>
      </svg>
    ),
    end: true,
  },
  {
    to: '/new',
    label: 'New Project',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    end: true,
  },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="flex min-h-screen bg-dark-900">
      {/* Sidebar */}
      <aside className="w-56 bg-dark-800 border-r border-dark-700 flex flex-col min-h-screen flex-shrink-0">
        {/* Logo */}
        <div className="px-5 pt-5 pb-4 border-b border-dark-700">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-purple/20 border border-accent-purple/30 flex items-center justify-center">
              <span className="text-accent-purple_light text-sm">⬡</span>
            </div>
            <div>
              <p className="text-slate-200 font-semibold text-sm tracking-tight">ArchBench</p>
              <p className="text-slate-600 text-[10px] tracking-wider">AI Architecture Benchmark</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 p-2 flex-1">
          <p className="text-[9px] font-bold tracking-widest uppercase text-slate-600 px-3 py-2">Navigation</p>
          {navLinks.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 group ${
                  isActive
                    ? 'bg-accent-purple/15 text-accent-purple_light border border-accent-purple/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-dark-700'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-accent-purple_light' : 'text-slate-600 group-hover:text-slate-400'}`}>
                    {icon}
                  </span>
                  <span className="font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer — user info + logout */}
        <div className="p-4 border-t border-dark-700">
          <p className="text-slate-500 text-xs mb-2 truncate">{user?.email}</p>
          <button
            onClick={logout}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            log out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-accent-purple/30 to-transparent" />
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}