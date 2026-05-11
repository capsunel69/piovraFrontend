import React, { useState } from 'react';
import styled from 'styled-components';
import { useWorkChat } from '../../context/WorkChatContext';
import { Badge, Button } from '../ui/primitives';
import { IconHash, IconPlus, IconLock } from '../ui/icons';
import CreateChannelDialog from './CreateChannelDialog';

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

const List = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: var(--s-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Item = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: 8px 10px;
  border-radius: var(--r-sm);
  font-size: 13px;
  text-align: left;
  width: 100%;
  color: ${(p) => (p.$active ? 'var(--text-1)' : 'var(--text-2)')};
  background: ${(p) => (p.$active ? 'var(--bg-3)' : 'transparent')};
  position: relative;
  transition: background .12s, color .12s;

  &:hover { background: var(--bg-3); color: var(--text-1); }

  svg { width: 14px; height: 14px; color: var(--text-3); flex-shrink: 0; }

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
      top: 8px;
      bottom: 8px;
      width: 3px;
      border-radius: 2px;
      background: var(--accent);
      box-shadow: 0 0 12px var(--accent-glow);
    }
  `}
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
  const { channels, activeChannelId, setActiveChannel, isAdmin, unreadByChannel } = useWorkChat();
  const [showCreate, setShowCreate] = useState(false);

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
      <List>
        {channels.length === 0 ? (
          <Empty>
            No channels yet.
            {!isAdmin && (
              <AdminHint><IconLock /> Only admins can create channels</AdminHint>
            )}
          </Empty>
        ) : (
          channels.map((ch) => {
            const unread = unreadByChannel[ch.id] ?? 0;
            const active = ch.id === activeChannelId;
            return (
              <Item
                key={ch.id}
                $active={active}
                onClick={() => setActiveChannel(ch.id)}
                title={ch.topic || `#${ch.name}`}
              >
                <IconHash />
                <span className="name">{ch.name}</span>
                {unread > 0 && !active && (
                  <Badge $variant="accent">{unread > 99 ? '99+' : unread}</Badge>
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
