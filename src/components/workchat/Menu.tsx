import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

interface MenuItemSpec {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface Props {
  trigger: React.ReactNode;
  items: MenuItemSpec[];
  align?: 'left' | 'right';
  ariaLabel?: string;
}

const Anchor = styled.div`
  position: relative;
  display: inline-flex;
`;

const Sheet = styled.div<{ $align: 'left' | 'right' }>`
  position: absolute;
  top: calc(100% + 4px);
  ${(p) => (p.$align === 'right' ? 'right: 0;' : 'left: 0;')}
  z-index: 60;
  min-width: 180px;
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: var(--r-md);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  animation: menuIn 0.12s ease-out;

  @keyframes menuIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Item = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--r-sm);
  font-size: 13px;
  text-align: left;
  background: transparent;
  border: 0;
  color: ${(p) => (p.$danger ? 'var(--danger, #f87171)' : 'var(--text-2)')};
  cursor: pointer;
  transition: background 0.1s ease, color 0.1s ease;

  &:hover:not(:disabled) {
    background: ${(p) => (p.$danger ? 'rgba(248, 113, 113, 0.12)' : 'var(--bg-3)')};
    color: ${(p) => (p.$danger ? 'var(--danger, #f87171)' : 'var(--text-1)')};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
`;

const Menu: React.FC<Props> = ({ trigger, items, align = 'right', ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <Anchor ref={ref}>
      <div
        role="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{ display: 'inline-flex' }}
      >
        {trigger}
      </div>
      {open && (
        <Sheet $align={align} role="menu" onClick={(e) => e.stopPropagation()}>
          {items.map((it) => (
            <Item
              key={it.id}
              role="menuitem"
              type="button"
              $danger={it.danger}
              disabled={it.disabled}
              onClick={() => {
                if (it.disabled) return;
                setOpen(false);
                it.onSelect();
              }}
            >
              {it.icon}
              <span>{it.label}</span>
            </Item>
          ))}
        </Sheet>
      )}
    </Anchor>
  );
};

export default Menu;
