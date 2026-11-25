import {
  LayoutGrid,
  List,
  ChartNoAxesColumnIncreasing,
  Wallet,
  Settings,
  Bell,
  ChevronDown,
  Cloud,
  CloudOff,
} from 'lucide-react'
import type { ReactNode } from 'react'
const tabs = [
  { id: 'home', name: 'Beranda', Icon: LayoutGrid },
  { id: 'transactions', name: 'Transaksi', Icon: List },
  { id: 'stats', name: 'Statistik', Icon: ChartNoAxesColumnIncreasing },
  { id: 'wallets', name: 'Dompet', Icon: Wallet },
  { id: 'account', name: 'Akun', Icon: Settings },
]
export function Brand() {
  return (
    <div className="brand">
      <img src="/icons/mark.svg" alt="" width="38" height="38" />
      <div>
        <strong>FINORA</strong>
        <small>Your Money, Your Control.</small>
      </div>
    </div>
  )
}
export function Shell({
  page,
  go,
  workspace,
  setWorkspace,
  demo,
  online,
  sync,
  bell,
  count,
  profile,
  children,
}: {
  page: string
  go: (p: string) => void
  workspace: string
  setWorkspace: (w: string) => void
  demo: boolean
  online: boolean
  sync: () => void
  bell: () => void
  count: number
  profile: string
  children: ReactNode
}) {
  return (
    <div className="shell">
      <aside>
        <button
          className="brand-button"
          aria-label="FINORA Beranda"
          onClick={() => go('home')}
        >
          <Brand />
        </button>
        <nav aria-label="Navigasi utama">
          {tabs.map(({ id, name, Icon }) => (
            <button
              key={id}
              aria-current={page === id ? 'page' : undefined}
              className={page === id ? 'active' : ''}
              onClick={() => go(id)}
            >
              <Icon size={20} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-avatar">
            {profile.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{profile}</strong>
            <small>{demo ? 'Mode demo' : 'Akun FINORA'}</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <button
            className="mobile-brand brand-button"
            onClick={() => go('home')}
          >
            <Brand />
          </button>
          <div className="workspace-select">
            <select
              aria-label="Workspace"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
            >
              <option>Personal</option>
              <option>Business</option>
            </select>
            <ChevronDown size={14} />
          </div>
          <div className="top-actions">
            <button
              className="sync-status"
              aria-label={
                !online ? 'Offline' : demo ? 'Mode Demo' : 'Sinkronisasi'
              }
              onClick={sync}
            >
              {online ? <Cloud size={17} /> : <CloudOff size={17} />}
              <span>
                {!online ? 'Offline' : demo ? 'Mode Demo' : 'Sinkronisasi'}
              </span>
            </button>
            <button
              className="icon notification"
              aria-label="Notifikasi"
              onClick={bell}
            >
              <Bell size={20} />
              {count > 0 && <i />}
            </button>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="footer">
          <span>FINORA</span>
          <span>Rupiah · Asia/Jakarta</span>
        </footer>
      </div>
    </div>
  )
}
