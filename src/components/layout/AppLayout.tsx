import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Building2, CalendarDays, ClipboardCheck, LayoutDashboard, LogOut, Medal, Menu, School, Trophy, UserCog, UserRound, Users, Wallet, X,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useAccess } from '../../hooks/useAccess'
import type { AccessValue } from '../../contexts/AccessContext'
import { Logo } from '../ui/Logo'
import { Avatar } from '../ui/Avatar'
import { Dropdown, MenuItem } from '../ui/Dropdown'

interface NavItem { to: string; label: string; icon: typeof Users; show: (a: AccessValue) => boolean }
interface NavGroup { title: string; items: NavItem[] }

const groups: NavGroup[] = [
  { title: 'Ikhtisar', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, show: () => true }] },
  { title: 'Organisasi', items: [
    { to: '/organisasi', label: 'Organisasi', icon: Building2, show: () => true },
    { to: '/dojo', label: 'Dojo', icon: School, show: () => true },
  ] },
  { title: 'Latihan', items: [
    { to: '/atlet', label: 'Atlet', icon: Users, show: (a) => a.anyStaff || a.isParticipant },
    { to: '/pelatih', label: 'Pelatih', icon: UserCog, show: (a) => a.anyStaff },
    { to: '/jadwal', label: 'Jadwal latihan', icon: CalendarDays, show: (a) => a.dojos.length > 0 },
    { to: '/kehadiran', label: 'Kehadiran', icon: ClipboardCheck, show: (a) => a.anyStaff || a.isParticipant },
  ] },
  { title: 'Prestasi', items: [
    { to: '/kompetisi', label: 'Kompetisi', icon: Trophy, show: (a) => a.organizations.length > 0 },
    { to: '/prestasi', label: 'Prestasi', icon: Medal, show: (a) => a.anyStaff || a.isParticipant },
  ] },
  { title: 'Keuangan', items: [{ to: '/pembayaran', label: 'Pembayaran', icon: Wallet, show: (a) => a.anyManage || a.isParticipant }] },
]

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const access = useAccess()
  const visible = groups.map((g) => ({ ...g, items: g.items.filter((i) => i.show(access)) })).filter((g) => g.items.length > 0)
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 pb-4" aria-label="Navigasi utama">
      {visible.map((g) => (
        <div key={g.title}>
          <p className="px-3 pb-1.5 text-xs font-semibold text-ink-400">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} end={n.to === '/'} onClick={onNavigate}
                  className={({ isActive }) => `group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors lg:min-h-10 ${isActive ? 'bg-white/10 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white'}`}>
                  {({ isActive }) => (<>
                    <span aria-hidden="true" className={`absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-400 transition-all duration-200 ${isActive ? 'opacity-100' : 'scale-y-0 opacity-0'}`} />
                    <n.icon size={18} aria-hidden="true" className={`transition-colors ${isActive ? 'text-brand-300' : 'text-ink-400 group-hover:text-ink-200'}`} />
                    {n.label}
                  </>)}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function ContextCard() {
  const access = useAccess()
  const orgs = access.organizations
  const name = orgs.length === 1 ? orgs[0].name : orgs.length > 1 ? `${orgs.length} organisasi` : 'Belum ada organisasi'
  return (
    <div className="mx-3 mb-5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <p className="text-xs text-ink-400">Konteks aktif</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-white" title={name}>{name}</p>
      <p className="truncate text-xs text-ink-300">{access.loading ? 'Memuat…' : `${access.roleLabel} · ${access.dojos.length} dojo`}</p>
    </div>
  )
}

function ProfileBlock({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, user, signOut } = useAuth()
  const name = profile?.full_name || user?.email || 'Pengguna'
  return (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
        <Avatar name={name} src={profile?.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <p className="truncate text-xs text-ink-400">{user?.email}</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link to="/profil" onClick={onNavigate} className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white/5 text-sm font-medium text-ink-200 transition hover:bg-white/10 hover:text-white">
          <UserRound size={16} aria-hidden="true" /> Profil
        </Link>
        <button type="button" onClick={() => void signOut()} className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white/5 text-sm font-medium text-ink-200 transition hover:bg-red-500/20 hover:text-red-200">
          <LogOut size={16} aria-hidden="true" /> Keluar
        </button>
      </div>
    </div>
  )
}

export function AppLayout() {
  const { profile, user, signOut } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const drawer = useRef<HTMLDivElement>(null)
  const menuBtn = useRef<HTMLButtonElement>(null)
  const name = profile?.full_name || user?.email || 'Pengguna'

  // Tutup drawer saat berpindah halaman
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Drawer: kunci scroll, jebak fokus, Esc menutup, kembalikan fokus ke tombol menu
  useEffect(() => {
    if (!open) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawer.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    const trigger = menuBtn.current
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key !== 'Tab' || !drawer.current) return
      const items = [...drawer.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const a = items[0], z = items[items.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    const mq = window.matchMedia('(min-width: 1024px)')
    const onMq = () => { if (mq.matches) setOpen(false) }
    document.addEventListener('keydown', onKey)
    mq.addEventListener('change', onMq)
    return () => { document.removeEventListener('keydown', onKey); mq.removeEventListener('change', onMq); document.body.style.overflow = overflow; trigger?.focus() }
  }, [open])

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <a href="#konten" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg">Lewati ke konten</a>

      {/* Sidebar desktop */}
      <aside className="hidden bg-ink-900 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="px-5 py-6"><Logo light /></div>
        <ContextCard />
        <NavList />
        <ProfileBlock />
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-(--z-drawer) lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-ink-900/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div ref={drawer} id="drawer-nav" role="dialog" aria-modal="true" aria-label="Menu navigasi"
            className="absolute inset-y-0 left-0 flex w-[min(85vw,18rem)] animate-[drawer-in_0.22s_ease-out_both] flex-col bg-ink-900 shadow-(--shadow-pop)">
            <div className="flex items-center justify-between px-5 py-5">
              <Logo light />
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup menu" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-300 transition hover:bg-white/10 hover:text-white"><X size={20} /></button>
            </div>
            <ContextCard />
            <NavList onNavigate={() => setOpen(false)} />
            <ProfileBlock onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        {/* Bilah atas (ponsel/tablet) */}
        <header className="sticky top-0 z-(--z-sticky) flex items-center justify-between border-b border-ink-200 bg-white/90 px-3 py-2 backdrop-blur lg:hidden">
          <button ref={menuBtn} type="button" onClick={() => setOpen(true)} aria-label="Buka menu navigasi" aria-expanded={open} aria-controls="drawer-nav"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-800 transition hover:bg-ink-100 active:bg-ink-200"><Menu size={22} /></button>
          <Link to="/" aria-label="KarateOS — ke dashboard"><Logo /></Link>
          <Dropdown label="Menu akun" trigger={<span className="flex h-11 w-11 items-center justify-center"><Avatar name={name} src={profile?.avatar_url} size="sm" /></span>}>
            {(close) => (<>
              <div className="border-b border-ink-100 px-3 py-2.5">
                <p className="truncate text-sm font-semibold">{name}</p>
                <p className="truncate text-xs text-ink-500">{user?.email}</p>
              </div>
              <Link to="/profil" role="menuitem" onClick={close} className="flex min-h-11 items-center gap-2.5 px-3 text-sm text-ink-800 hover:bg-ink-50"><UserRound size={16} aria-hidden="true" /> Profil saya</Link>
              <MenuItem danger icon={<LogOut size={16} aria-hidden="true" />} onClick={() => void signOut()}>Keluar</MenuItem>
            </>)}
          </Dropdown>
        </header>
        <main id="konten" tabIndex={-1} className="flex-1 px-4 py-5 outline-none sm:px-6 sm:py-7 lg:px-8">
          <div key={location.pathname} className="mx-auto max-w-7xl animate-fade-in"><Outlet /></div>
        </main>
      </div>
    </div>
  )
}
