import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useWorkChat } from '../../context/WorkChatContext';
import { Badge, Button, IconButton, Input } from '../ui/primitives';
import {
  IconHash, IconPlus, IconLock, IconSearch, IconX, IconMoreVertical, IconTrash,
} from '../ui/icons';
import CreateChannelDialog from './CreateChannelDialog';
import Menu from './Menu';

const Wrap = styled.aside`
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  overflow: hidden;
`;

const Head = styled.div`
  padding: var(--s-3) var(--s-4);
  border-bottom: 1px solid var(--border-1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-2);
  gap: var(--s-2);
`;

const HeadTitle = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const SearchBar = styled.div`
  padding: var(--s-2) var(--s-3);
  border-bottom: 1px solid var(--border-1);
  background: var(--bg-1);
  position: relative;
`;

const SearchIconWrap = styled.span`
  position: absolute;
  left: calc(var(--s-3) + 8px);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-3);
  pointer-events: none;

  svg { width: 14px; height: 14px; }
`;

const SearchInput = styled(Input)`
  padding-left: 30px;
  padding-right: 30px;
  height: 32px;
  font-size: 12.5px;
`;

const ClearBtn = styled.button`
  position: absolute;
  right: calc(var(--s-3) + 6px);
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--bg-3);
  border: 0;
  color: var(--text-3);
  cursor: pointer;

  &:hover { color: var(--text-1); background: var(--bg-4); }

  svg { width: 12px; height: 12px; }
`;

const List = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: var(--s-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Item = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: 6px 8px 6px 10px;
  border-radius: var(--r-sm);
  font-size: 13px;
  cursor: pointer;
  color: ${(p) => (p.$active ? 'var(--text-1)' : 'var(--text-2)')};
  background: ${(p) => (p.$active ? 'var(--bg-3)' : 'transparent')};
  position: relative;
  transition: background .12s, color .12s;

  &:hover { background: var(--bg-3); color: var(--text-1); }

  & > svg { width: 14px; height: 14px; color: var(--text-3); flex-shrink: 0; }

  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: ${(p) => (p.$active ? 600 : 500)};
  }

  ${(p) => p.$active && `
    &::before {
      content: '';
      position: absolute;
      left: -2px;
      top: 6px;
      bottom: 6px;
      width: 3px;
      border-radius: 2px;
      background: var(--accent);
      box-shadow: 0 0 12px var(--accent-glow);
    }
  `}

  .ch-actions {
    opacity: 0;
    transition: opacity .12s ease;
  }

  &:hover .ch-actions,
  &:focus-within .ch-actions {
    opacity: 1;
  }
`;

const Empty = styled.div`
  padding: var(--s-5);
  text-align: center;
  color: var(--text-3);
  font-size: 12.5px;
  line-height: 1.5;
`;

const AdminHint = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: var(--s-2);
  color: var(--text-4);
  font-size: 11.5px;
  justify-content: center;

  svg { width: 12px; height: 12px; }
`;

const ChannelList: React.FC = () => {
  const {
    channels, activeChannelId, setActiveChannel, isAdmin, unreadByChannel, deleteChannel,
  } = useWorkChat();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('');

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) =>
      c.name.toLowerCase().includes(q) || (c.topic ?? '').toLowerCase().includes(q),
    );
  }, [channels, filter]);

  return (
    <Wrap>
      <Head>
        <HeadTitle>Channels</HeadTitle>
        {isAdmin && (
          <Button
            type="button"
            $variant="ghost"
            $size="sm"
            onClick={() => setShowCreate(true)}
            title="New channel"
          >
            <IconPlus /> New
          </Button>
        )}
      </Head>

      {channels.length > 0 && (
        <SearchBar>
          <SearchIconWrap><IconSearch /></SearchIconWrap>
          <SearchInput
            placeholder="Find a channel"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Search channels"
          />
          {filter && (
            <ClearBtn type="button" onClick={() => setFilter('')} aria-label="Clear filter">
              <IconX />
            </ClearBtn>
          )}
        </SearchBar>
      )}

      <List>
        {channels.length === 0 ? (
          <Empty>
            No channels yet.
            {!isAdmin && (
              <AdminHint><IconLock /> Only admins can create channels</AdminHint>
            )}
          </Empty>
        ) : visible.length === 0 ? (
          <Empty>No channels match "{filter}".</Empty>
        ) : (
          visible.map((ch) => {
            const unread = unreadByChannel[ch.id] ?? 0;
            const active = ch.id === activeChannelId;
            return (
              <Item
                key={ch.id}
                $active={active}
                onClick={() => setActiveChannel(ch.id)}
                title={ch.topic || `#${ch.name}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveChannel(ch.id);
                  }
                }}
              >
                <IconHash />
                <span className="name">{ch.name}</span>
                {unread > 0 && !active && (
                  <Badge $variant="accent">{unread > 99 ? '99+' : unread}</Badge>
                )}
                {isAdmin && (
                  <div className="ch-actions" onClick={(e) => e.stopPropagation()}>
                    <Menu
                      ariaLabel={`Channel ${ch.name} options`}
                      align="right"
                      trigger={
                        <IconButton
                          type="button"
                          $size="sm"
                          $variant="ghost"
                          aria-label="Channel options"
                        >
                          <IconMoreVertical />
                        </IconButton>
                      }
                      items={[
                        {
                          id: 'delete',
                          label: 'Delete channel',
                          icon: <IconTrash />,
                          danger: true,
                          onSelect: () => {
                            const ok = window.confirm(
                              `Delete #${ch.name}? All messages will be permanently removed.`,
                            );
                            if (ok) void deleteChannel(ch.id);
                          },
                        },
                      ]}
                    />
                  </div>
                )}
              </Item>
            );
          })
        )}
      </List>

      {showCreate && (
        <CreateChannelDialog onClose={() => setShowCreate(false)} />
      )}
    </Wrap>
  );
};

export default ChannelList;
