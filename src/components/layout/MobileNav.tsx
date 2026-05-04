import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { IconButton } from '../ui/primitives';
import { IconX } from '../ui/icons';
import { AppLogoMark } from './AppLogoMark';

/**
 * Always-mounted, portal-rendered mobile navigation drawer.
 *
 * Rendering it unconditionally and toggling visibility via CSS avoids the
 * mount/unmount race that was making the drawer appear "open" in React state
 * but invisible to the user (no animation frame to apply the open transform,
 * stacking-context glitches, etc).
 */

const Root = styled.div<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  visibility: ${(p) => (p.$open ? 'visible' : 'hidden')};
  /* Delay hiding visibility until after the slide-out completes. */
  transition: visibility 0s linear ${(p) => (p.$open ? '0s' : '0.25s')};
`;

const Backdrop = styled.div<{ $open: boolean }>`
  position: absolute;
  inset: 0;
  background: rgba(2, 4, 8, 0.55);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
  opacity: ${(p) => (p.$open ? 1 : 0)};
  transition: opacity 0.22s ease-out;
`;

const Panel = styled.aside<{ $open: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  max-width: 86vw;
  background: var(--bg-1, #0c1015);
  color: var(--text-1, #e7ecf3);
  border-right: 1px solid var(--border-1, rgba(255, 255, 255, 0.06));
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translate3d(${(p) => (p.$open ? '0' : '-100%')}, 0, 0);
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: transform;
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: var(--topbar-h, 56px);
  border-bottom: 1px solid var(--border-1, rgba(255, 255, 255, 0.06));
  flex-shrink: 0;

  .logo {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    line-height: 0;

    img { display: block; width: 100%; height: 100%; object-fit: cover; }
  }

  .name {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
    overflow: hidden;
    flex: 1;
  }

  .name strong {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-1, #e7ecf3);
    letter-spacing: 0.02em;
  }
  .name span {
    font-size: 10.5px;
    color: var(--text-3, #6b7484);
    font-family: var(--font-mono, ui-monospace, monospace);
    margin-top: 2px;
  }
`;

const SectionLabel = styled.div`
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-3, #6b7484);
  letter-spacing: 0.08em;
  padding: 12px 20px 8px;
`;

const Nav = styled.nav`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px 8px 12px;
  gap: 2px;
  overflow-y: auto;
`;

const NavItem = styled(Link)<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  margin: 0 8px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  min-height: 44px;
  color: ${(p) => (p.$active ? 'var(--text-1, #e7ecf3)' : 'var(--text-2, #a4adbb)')};
  background: ${(p) => (p.$active ? 'var(--bg-3, #161c25)' : 'transparent')};
  text-decoration: none;
  position: relative;
  transition: background 0.15s, color 0.15s;

  &:hover, &:focus-visible {
    color: var(--text-1, #e7ecf3);
    background: var(--bg-3, #161c25);
  }

  ${(p) =>
    p.$active &&
    `
      &:before {
        content: '';
        position: absolute;
        left: -10px;
        top: 6px;
        bottom: 6px;
        width: 3px;
        border-radius: 2px;
        background: var(--accent, #4cc2ff);
        box-shadow: 0 0 12px var(--accent-glow, rgba(76, 194, 255, 0.35));
      }
    `}

  svg { width: 18px; height: 18px; flex-shrink: 0; }
`;

const Footer = styled.div`
  padding: 12px;
  border-top: 1px solid var(--border-1, rgba(255, 255, 255, 0.06));
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const FooterButton = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 6px;
  color: var(--text-2, #a4adbb);
  font-size: 14px;
  font-weight: 500;
  width: 100%;
  background: transparent;
  border: 0;
  cursor: pointer;
  min-height: 44px;
  transition: background 0.15s, color 0.15s;

  &:hover, &:focus-visible {
    background: var(--bg-3, #161c25);
    color: var(--text-1, #e7ecf3);
  }

  svg { width: 18px; height: 18px; flex-shrink: 0; }
`;

export interface MobileNavItem {
  to: string;
  label: string;
  icon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>;
}

export interface MobileNavFooterLink {
  to: string;
  label: string;
  icon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>;
}

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  items: MobileNavItem[];
  activePath: string;
  /** Rendered above Sign out (e.g. Documentation). */
  footerLinks?: MobileNavFooterLink[];
  onLogout: () => void;
  logoutIcon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>;
}

const FooterNavItem = styled(Link)<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 6px;
  color: ${(p) => (p.$active ? 'var(--text-1, #e7ecf3)' : 'var(--text-2, #a4adbb)')};
  background: ${(p) => (p.$active ? 'var(--bg-3, #161c25)' : 'transparent')};
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  width: 100%;
  min-height: 44px;
  transition: background 0.15s, color 0.15s;

  &:hover, &:focus-visible {
    background: var(--bg-3, #161c25);
    color: var(--text-1, #e7ecf3);
  }

  svg { width: 18px; height: 18px; flex-shrink: 0; }
`;

const MobileNav: React.FC<MobileNavProps> = ({
  open,
  onClose,
  items,
  activePath,
  footerLinks,
  onLogout,
  logoutIcon: LogoutIcon,
}) => {
  // Lock body scroll while open. We do it here (not in the parent) to keep
  // all drawer concerns colocated.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <Root $open={open} aria-hidden={!open}>
      <Backdrop
        $open={open}
        onClick={onClose}
        onTouchEnd={(e) => {
          // Some iOS versions can swallow click after touchend; use both.
          e.preventDefault();
          onClose();
        }}
      />
      <Panel
        $open={open}
        role="dialog"
        aria-modal="true"
        aria-label="Primary navigation"
      >
        <Brand>
          <div className="logo"><AppLogoMark size={32} /></div>
          <div className="name">
            <strong>Piovra</strong>
            <span>workspace</span>
          </div>
          <IconButton
            $variant="ghost"
            onClick={onClose}
            aria-label="Close menu"
            type="button"
          >
            <IconX />
          </IconButton>
        </Brand>

        <SectionLabel>Workspace</SectionLabel>
        <Nav>
          {items.map((item) => {
            const Icon = item.icon;
            const active = activePath === item.to;
            return (
              <NavItem
                key={item.to}
                to={item.to}
                $active={active}
                onClick={onClose}
              >
                <Icon />
                <span>{item.label}</span>
              </NavItem>
            );
          })}
        </Nav>

        <Footer>
          {footerLinks?.map((link) => {
            const Icon = link.icon;
            return (
              <FooterNavItem
                key={link.to}
                to={link.to}
                $active={activePath === link.to}
                onClick={onClose}
              >
                <Icon />
                <span>{link.label}</span>
              </FooterNavItem>
            );
          })}
          <FooterButton type="button" onClick={onLogout}>
            <LogoutIcon />
            <span>Sign out</span>
          </FooterButton>
        </Footer>
      </Panel>
    </Root>,
    document.body,
  );
};

export default MobileNav;
