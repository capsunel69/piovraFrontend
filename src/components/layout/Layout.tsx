import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useAppContext } from '../../context/AppContext';
import { useRegisterOverlay } from '../../hooks/useOverlayStack';
import BackgroundFx from './BackgroundFx';
import ChatWidget from '../chat/ChatWidget';
import MobileNav, { type MobileNavItem } from './MobileNav';
import { AppLogoMark } from './AppLogoMark';
import {
  IconDashboard, IconTasks, IconCalendar, IconBell, IconNote, IconContacts,
  IconLogout, IconChevronLeft, IconClock, IconBot,
  IconMenu, IconLock, IconBook,
} from '../ui/icons';
import { IconButton } from '../ui/primitives';

/* ── Module registry — add a new entry to expose a new section ─────────── */

const NAV_PRIMARY: MobileNavItem[] = [
  { to: '/',          label: 'Overview',  icon: IconDashboard },
  { to: '/tasks',     label: 'Tasks',     icon: IconTasks },
  { to: '/meetings',  label: 'Meetings',  icon: IconCalendar },
  { to: '/reminders', label: 'Reminders', icon: IconBell },
  { to: '/notes',     label: 'Notes',     icon: IconNote },
  { to: '/contacts',  label: 'Contacts',  icon: IconContacts },
  { to: '/agents',    label: 'Agents',    icon: IconBot },
];

/** Mobile drawer breakpoint — keep this in sync with CSS @media queries. */
const MOBILE_BP = 720;

/* ── Layout chrome ─────────────────────────────────────────────────────── */

const Shell = styled.div<{ $collapsed: boolean }>`
  display: grid;
  grid-template-columns: ${p => p.$collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)'} 1fr;
  height: 100vh;
  /* Use the dynamic viewport when supported so the URL bar collapsing on
   * mobile Safari doesn't cause the layout to overflow. */
  height: 100dvh;
  width: 100vw;
  background: var(--bg-0);
  position: relative;
  z-index: 1;
  transition: grid-template-columns 0.2s ease;

  @media (max-width: ${MOBILE_BP}px) {
    grid-template-columns: 1fr;
  }
`;

/** Desktop-only sidebar (in the grid). Hidden entirely on mobile so the
 *  layout collapses to a single column without leaving a phantom track. */
const Sidebar = styled.aside`
  background: var(--bg-1);
  border-right: 1px solid var(--border-1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;

  @media (max-width: ${MOBILE_BP}px) {
    display: none;
  }
`;

const Brand = styled.div<{ $collapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: 0 var(--s-4);
  height: var(--topbar-h);
  border-bottom: 1px solid var(--border-1);
  flex-shrink: 0;

  .logo {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    line-height: 0;
    box-shadow: 0 0 20px var(--accent-glow);

    img { display: block; width: 100%; height: 100%; object-fit: cover; }
  }

  .name {
    display: ${p => p.$collapsed ? 'none' : 'flex'};
    flex-direction: column;
    line-height: 1.1;
    overflow: hidden;
  }

  .name strong { font-size: 13px; font-weight: 600; color: var(--text-1); letter-spacing: 0.02em; }
  .name span { font-size: 10.5px; color: var(--text-3); font-family: var(--font-mono); margin-top: 2px; }
`;

const SidebarSectionLabel = styled.div<{ $collapsed: boolean }>`
  display: ${p => p.$collapsed ? 'none' : 'block'};
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-3);
  letter-spacing: 0.08em;
  padding: var(--s-3) var(--s-5) var(--s-2);
`;

const Nav = styled.nav`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--s-2) var(--s-2) var(--s-3);
  gap: 2px;
  overflow-y: auto;
`;

const NavLinkStyled = styled(Link)<{ $active: boolean; $collapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: ${p => p.$collapsed ? '10px' : '8px 12px'};
  margin: 0 var(--s-2);
  border-radius: var(--r-sm);
  font-size: 13px;
  font-weight: 500;
  color: ${p => p.$active ? 'var(--text-1)' : 'var(--text-2)'};
  background: ${p => p.$active ? 'var(--bg-3)' : 'transparent'};
  text-decoration: none;
  position: relative;
  transition: background 0.15s, color 0.15s;
  justify-content: ${p => p.$collapsed ? 'center' : 'flex-start'};

  &:hover { color: var(--text-1); background: var(--bg-3); }

  ${p => p.$active && `
    &:before {
      content: '';
      position: absolute;
      left: -10px;
      top: 6px;
      bottom: 6px;
      width: 3px;
      border-radius: 2px;
      background: var(--accent);
      box-shadow: 0 0 12px var(--accent-glow);
    }
  `}

  svg { width: 18px; height: 18px; flex-shrink: 0; }
  .label { display: ${p => p.$collapsed ? 'none' : 'inline'}; }
`;

const SidebarFooter = styled.div`
  padding: var(--s-3);
  border-top: 1px solid var(--border-1);
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const FooterButton = styled.button<{ $collapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: ${p => p.$collapsed ? '10px' : '8px 12px'};
  border-radius: var(--r-sm);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  width: 100%;
  justify-content: ${p => p.$collapsed ? 'center' : 'flex-start'};
  transition: background 0.15s, color 0.15s;

  &:hover { background: var(--bg-3); color: var(--text-1); }

  svg { width: 18px; height: 18px; flex-shrink: 0; }
  .label { display: ${p => p.$collapsed ? 'none' : 'inline'}; }
`;

const FooterNavLink = styled(Link)<{ $collapsed: boolean; $active: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: ${p => p.$collapsed ? '10px' : '8px 12px'};
  border-radius: var(--r-sm);
  font-size: 13px;
  font-weight: 500;
  width: 100%;
  justify-content: ${p => p.$collapsed ? 'center' : 'flex-start'};
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  color: ${p => (p.$active ? 'var(--text-1)' : 'var(--text-2)')};
  background: ${p => (p.$active ? 'var(--bg-3)' : 'transparent')};

  &:hover { background: var(--bg-3); color: var(--text-1); }

  svg { width: 18px; height: 18px; flex-shrink: 0; }
  .label { display: ${p => p.$collapsed ? 'none' : 'inline'}; }
`;

/* ── Topbar / content ──────────────────────────────────────────────────── */

const Main = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
`;

const Topbar = styled.header`
  height: var(--topbar-h);
  border-bottom: 1px solid var(--border-1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--s-5);
  background: rgba(7, 9, 13, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  flex-shrink: 0;
  gap: var(--s-3);
  position: relative;
  z-index: 5;

  @media (max-width: ${MOBILE_BP}px) {
    padding: 0 var(--s-3);
    gap: var(--s-2);
  }
`;

const TopbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-width: 0;
`;

const SidebarToggle = styled(IconButton)`
  /** Hide the desktop chevron on mobile — we render a hamburger instead. */
  @media (max-width: ${MOBILE_BP}px) {
    display: none;
  }
`;

const HamburgerToggle = styled(IconButton)`
  display: none;

  @media (max-width: ${MOBILE_BP}px) {
    display: inline-flex;
    /* Slightly larger hit area on touch devices. */
    width: 40px;
    height: 40px;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
`;

const Crumbs = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: 12px;
  color: var(--text-3);
  min-width: 0;

  .prefix,
  .sep { color: var(--text-4); }
  .here { color: var(--text-1); font-weight: 500; }

  @media (max-width: ${MOBILE_BP}px) {
    font-size: 13px;
    .prefix,
    .sep { display: none; }
    .here {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.005em;
    }
  }
`;

const TopbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  flex-shrink: 0;

  @media (max-width: ${MOBILE_BP}px) {
    gap: var(--s-2);
  }
`;

const StatusPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  font-size: 11px;
  color: var(--text-2);
  font-family: var(--font-mono);

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--success);
    box-shadow: 0 0 8px var(--success);
  }

  @media (max-width: ${MOBILE_BP}px) {
    display: none;
  }
`;

const Clock = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  svg { width: 14px; height: 14px; color: var(--text-3); flex-shrink: 0; }

  .day { color: var(--text-2); }
  .sep { color: var(--text-3); }
  .time { color: var(--text-1); font-weight: 500; }

  @media (max-width: ${MOBILE_BP}px) {
    gap: 4px;
    font-size: 12.5px;

    svg { display: none; }
    .day,
    .sep { display: none; }
  }
`;

const Content = styled.main`
  flex: 1;
  overflow: auto;
  position: relative;
  isolation: isolate;
  -webkit-overflow-scrolling: touch;
  /* Main column scrolls over the fixed BackgroundFx; keep chrome transparent here. */
  background: transparent;
`;

const ContentInner = styled.div`
  position: relative;
  z-index: 1;
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--s-6) var(--s-6);

  @media (max-width: ${MOBILE_BP}px) {
    padding: var(--s-3);
    /* Leave room for the floating chat bubble. */
    padding-bottom: calc(var(--s-3) + 80px);
  }
`;

const StickyLayer = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  pointer-events: none;
  > * { pointer-events: auto; }
`;

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { signOut, me } = useAuth();
  const { currentDate, setCurrentDate } = useAppContext();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebarCollapsed') === '1';
  });
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);

  // Register the mobile drawer in the global overlay stack so the chat
  // bubble auto-hides while it's open.
  useRegisterOverlay(mobileNavOpen);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    const t = setInterval(() => setCurrentDate(new Date()), 30_000);
    return () => clearInterval(t);
  }, [setCurrentDate]);

  // Close drawer on route change so users don't see it linger after a tap.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Auto-close the drawer if the viewport grows past the breakpoint.
  useEffect(() => {
    if (typeof window === 'undefined' || !mobileNavOpen) return;
    const onResize = (): void => {
      if (window.innerWidth > MOBILE_BP) setMobileNavOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mobileNavOpen]);

  const navItems = useMemo<MobileNavItem[]>(() => {
    if (me?.role === 'admin') {
      return [...NAV_PRIMARY, { to: '/admin', label: 'Admin', icon: IconLock }];
    }
    return NAV_PRIMARY;
  }, [me?.role]);

  const currentLabel = useMemo(() => {
    if (location.pathname === '/docs') return 'Help center';
    const match = navItems.find(n => n.to === location.pathname);
    return match?.label ?? 'Overview';
  }, [location.pathname, navItems]);

  useEffect(() => {
    document.title = `${currentLabel} · Piovra`;
  }, [currentLabel]);

  const handleLogout = useCallback(() => {
    if (window.confirm('Sign out of Piovra?')) void signOut();
  }, [signOut]);

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  const openMobileNav = useCallback(() => {
    setMobileNavOpen(true);
  }, []);

  return (
    <>
      <Shell $collapsed={collapsed}>
        <Sidebar aria-label="Primary navigation">
          <Brand $collapsed={collapsed}>
            <div className="logo"><AppLogoMark size={32} /></div>
            <div className="name">
              <strong>Piovra</strong>
              <span>workspace</span>
            </div>
          </Brand>

          <SidebarSectionLabel $collapsed={collapsed}>Workspace</SidebarSectionLabel>
          <Nav>
            {navItems.map(item => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <NavLinkStyled
                  key={item.to}
                  to={item.to}
                  $active={active}
                  $collapsed={collapsed}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon />
                  <span className="label">{item.label}</span>
                </NavLinkStyled>
              );
            })}
          </Nav>

          <SidebarFooter>
            <FooterNavLink
              to="/docs"
              $collapsed={collapsed}
              $active={location.pathname === '/docs'}
              title={collapsed ? 'Help' : undefined}
            >
              <IconBook /> <span className="label">Help</span>
            </FooterNavLink>
            <FooterButton
              $collapsed={collapsed}
              onClick={handleLogout}
              title={collapsed ? 'Sign out' : undefined}
            >
              <IconLogout /> <span className="label">Sign out</span>
            </FooterButton>
          </SidebarFooter>
        </Sidebar>

        <Main>
          <Topbar>
            <TopbarLeft>
              <HamburgerToggle
                type="button"
                $variant="ghost"
                onClick={openMobileNav}
                aria-label="Open navigation"
                aria-expanded={mobileNavOpen}
              >
                <IconMenu />
              </HamburgerToggle>
              <SidebarToggle
                $variant="ghost"
                onClick={() => setCollapsed(c => !c)}
                aria-label="Toggle sidebar"
                style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
              >
                <IconChevronLeft />
              </SidebarToggle>
              <Crumbs>
                <span className="prefix">Workspace</span>
                <span className="sep">/</span>
                <span className="here">{currentLabel}</span>
              </Crumbs>
            </TopbarLeft>
            <TopbarRight>
              {me && (
                <StatusPill title={me.email}>
                  {me.pictureUrl && (
                    <img
                      src={me.pictureUrl}
                      alt=""
                      style={{ width: 16, height: 16, borderRadius: 999 }}
                    />
                  )}
                  <span>{me.name ?? me.email}</span>
                </StatusPill>
              )}
              <Clock>
                <IconClock />
                <span className="day">{format(currentDate, 'EEE, MMM d')}</span>
                <span className="sep">·</span>
                <span className="time">{format(currentDate, 'HH:mm')}</span>
              </Clock>
            </TopbarRight>
          </Topbar>

          <Content>
            <BackgroundFx sidebarCollapsed={collapsed} />
            <ContentInner>{children}</ContentInner>
          </Content>
        </Main>

        <StickyLayer>
          <ChatWidget />
        </StickyLayer>
      </Shell>

      <MobileNav
        open={mobileNavOpen}
        onClose={closeMobileNav}
        items={navItems}
        activePath={location.pathname}
        footerLinks={[
          { to: '/docs', label: 'Help', icon: IconBook },
        ]}
        onLogout={handleLogout}
        logoutIcon={IconLogout}
      />
    </>
  );
};

export default Layout;
