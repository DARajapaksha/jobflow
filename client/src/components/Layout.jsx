import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Container, buttonClass } from './ui';
import { cn } from '../lib/cn';
import { initials } from '../lib/format';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#1F3FBF" />
        <path d="M18 8v11a5 5 0 0 1-5 5h-1.5" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="18" cy="5.2" r="2.1" fill="#EF6F5A" />
      </svg>
      jobflow
    </Link>
  );
}

function navLinksFor(user) {
  const links = [{ to: '/', label: 'Jobs', end: true }];
  if (user?.role === 'seeker') links.push({ to: '/saved', label: 'Saved' }, { to: '/applications', label: 'Applications' });
  if (user?.role === 'employer') links.push({ to: '/employer', label: 'Dashboard' });
  return links;
}

const linkClass = ({ isActive }) =>
  cn('rounded-lg px-3 py-2 text-[0.95rem] font-medium transition-colors', isActive ? 'bg-sapphire-tint text-sapphire-deep' : 'text-ink-soft hover:bg-moon-deep hover:text-ink');

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/');
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 hover:bg-moon-deep">
        <span className="grid size-8 place-items-center rounded-full bg-sapphire text-sm font-semibold text-white">{initials(user.fullName)}</span>
        <span className="hidden max-w-32 truncate text-sm font-medium sm:block">{user.fullName}</span>
        <ChevronDown className="size-4 text-ink-soft" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-line bg-white p-1.5 shadow-lg">
          <div className="px-3 py-2">
            <p className="truncate font-medium">{user.fullName}</p>
            <p className="truncate text-sm text-ink-soft">{user.email}</p>
          </div>
          <div className="my-1 border-t border-line" />
          <Link role="menuitem" to="/profile" className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-moon">
            <UserRound className="size-4 text-ink-soft" aria-hidden />
            {user.role === 'employer' ? 'Company profile' : 'Your profile'}
          </Link>
          <button role="menuitem" type="button" onClick={onLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-moon">
            <LogOut className="size-4 text-ink-soft" aria-hidden />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const { user, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  const links = navLinksFor(user);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-moon/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>)}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {!loading && (user ? (
            <UserMenu />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/login" className={buttonClass('ghost', 'md')}>Log in</Link>
              <Link to="/register" className={buttonClass('primary', 'md')}>Sign up</Link>
            </div>
          ))}
          <button type="button" onClick={() => setMobileOpen((o) => !o)} aria-expanded={mobileOpen} aria-controls="mobile-nav" aria-label="Menu" className="grid size-10 place-items-center rounded-lg hover:bg-moon-deep md:hidden">
            {mobileOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </Container>
      {mobileOpen && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-moon md:hidden">
          <Container className="flex flex-col gap-1 py-3">
            {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>)}
            {!loading && !user && (
              <div className="mt-2 flex gap-2">
                <Link to="/login" className={buttonClass('secondary', 'md', 'flex-1')}>Log in</Link>
                <Link to="/register" className={buttonClass('primary', 'md', 'flex-1')}>Sign up</Link>
              </div>
            )}
          </Container>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <Container className="flex flex-col gap-2 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between">
        <p>Jobflow is a portfolio project by Dinsanda Amajith.</p>
        <a href="https://github.com/DARajapaksha/jobflow" className="font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-sapphire">View the code on GitHub</a>
      </Container>
    </footer>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <Navbar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
