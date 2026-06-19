import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'dashboard' },
  { to: '/new', label: 'new project' },
  { to: '/projects', label: 'all projects' },
]

export default function Sidebar() {
  return (
    <aside className="w-52 bg-dark-800 border-r border-dark-700 flex flex-col min-h-screen">
      <div className="px-4 py-5 text-accent-purple_light font-semibold text-sm tracking-widest">
        ⬡ archbench
      </div>
      <nav className="flex flex-col gap-1 mt-2">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'text-accent-purple_light bg-dark-700 border-r-2 border-accent-purple'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-dark-700'
              }`
            }
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}