import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import {
  PageContainer, PageHeader, PageTitle, PageSubtitle, Button, Badge, IconButton, Input,
} from '../components/ui/primitives';
import {
  IconChat, IconHash, IconPin, IconUsers, IconSearch, IconX, IconMoreVertical, IconTrash,
} from '../components/ui/icons';
import { useWorkChat } from '../context/WorkChatContext';
import ChannelList from '../components/workchat/ChannelList';
import MessageList from '../components/workchat/MessageList';
import MessageComposer from '../components/workchat/MessageComposer';
import PinnedPanel from '../components/workchat/PinnedPanel';
import Menu from '../components/workchat/Menu';

const MOBILE_BP = 900;

const Shell = styled.div<{ $showPinned: boolean; $sidebarOpen: boolean }>`
  display: grid;
  grid-template-columns:
    260px
    minmax(0, 1fr)
    ${(p) => (p.$showPinned ? '320px' : '0px')};
  gap: var(--s-4);
  align-items: stretch;
  min-height: calc(100vh - 200px);
  transition: grid-template-columns .2s;

  @media (max-width: ${MOBILE_BP}px) {
    grid-template-columns: ${(p) => (p.$sidebarOpen ? '1fr' : '0px')} 1fr 0px;
    gap: ${(p) => (p.$sidebarOpen ? 'var(--s-3)' : '0')};
    min-height: calc(100vh - 180px);
  }
`;

const Main = styled.section`
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  overflow: hidden;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  background: var(--bg-2);
  border-bottom: 1px solid var(--border-1);
  min-height: 56px;
  flex-wrap: wrap;
`;

const ChannelTitle = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  min-width: 0;

  svg { color: var(--accent); flex-shrink: 0; }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const TopicLine = styled.div`
  font-size: 12px;
  color: var(--text-3);
  margin-left: var(--s-3);
  padding-left: var(--s-3);
  border-left: 1px solid var(--border-2);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: ${MOBILE_BP}px) {
    border-left: 0;
    padding-left: 0;
    margin-left: 0;
    width: 100%;
  }
`;

const TopActions = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-1);
  margin-left: auto;
`;

const MobileNavBtn = styled(Button)`
  display: none;

  @media (max-width: ${MOBILE_BP}px) {
    display: inline-flex;
  }
`;

const SideRail = styled.div<{ $open: boolean }>`
  min-height: 0;
  display: ${(p) => (p.$open ? 'flex' : 'flex')};

  @media (max-width: ${MOBILE_BP}px) {
    display: ${(p) => (p.$open ? 'flex' : 'none')};
  }
`;

const PinnedWrap = styled.div<{ $open: boolean }>`
  min-height: 0;
  display: ${(p) => (p.$open ? 'flex' : 'none')};

  @media (max-width: ${MOBILE_BP}px) {
    display: none;
  }
`;

const EmptyMain = styled.div`
  margin: auto;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
  padding: var(--s-7);
  line-height: 1.6;
`;

const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: 8px var(--s-4);
  background: var(--bg-2);
  border-bottom: 1px solid var(--border-1);
  position: relative;
`;

const SearchIconWrap = styled.span`
  position: absolute;
  left: calc(var(--s-4) + 10px);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-3);
  pointer-events: none;

  svg { width: 14px; height: 14px; }
`;

const SearchField = styled(Input)`
  flex: 1;
  padding-left: 32px;
  padding-right: 32px;
  height: 34px;
  font-size: 13px;
`;

const ClearBtn = styled.button`
  position: absolute;
  right: calc(var(--s-4) + 78px);
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: var(--bg-3);
  border: 0;
  color: var(--text-3);
  cursor: pointer;

  &:hover { color: var(--text-1); background: var(--bg-4); }

  svg { width: 12px; height: 12px; }
`;

const Chat: React.FC = () => {
  const {
    activeChannel, isAdmin, totalUnread, searchQuery, setSearchQuery, deleteChannel,
  } = useWorkChat();
  const [showPinned, setShowPinned] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = activeChannel
      ? `#${activeChannel.name} · Chat`
      : 'Chat';
  }, [activeChannel]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth > MOBILE_BP) return;
    if (activeChannel) setMobileSidebar(false);
  }, [activeChannel?.id]);

  useEffect(() => {
    if (showSearch) searchInputRef.current?.focus();
    else setSearchQuery('');
  }, [showSearch, setSearchQuery]);

  useEffect(() => {
    setShowSearch(false);
  }, [activeChannel?.id]);

  const pinnedCount = activeChannel?.pinnedMessageIds.length ?? 0;

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <PageTitle>
            <IconChat />
            Chat
            {totalUnread > 0 && (
              <Badge $variant="accent">{totalUnread > 99 ? '99+' : totalUnread} new</Badge>
            )}
          </PageTitle>
          <PageSubtitle>
            {isAdmin
              ? 'Create channels and chat with your team.'
              : 'Chat with your team. Admins manage channels.'}
          </PageSubtitle>
        </div>
      </PageHeader>

      <Shell $showPinned={showPinned && Boolean(activeChannel)} $sidebarOpen={mobileSidebar}>
        <SideRail $open={mobileSidebar}>
          <ChannelList />
        </SideRail>

        <Main>
          <TopBar>
            <MobileNavBtn
              type="button"
              $variant="secondary"
              $size="sm"
              onClick={() => setMobileSidebar((v) => !v)}
            >
              <IconUsers /> Channels
            </MobileNavBtn>
            {activeChannel ? (
              <>
                <ChannelTitle>
                  <IconHash />
                  <span>{activeChannel.name}</span>
                </ChannelTitle>
                {activeChannel.topic && <TopicLine>{activeChannel.topic}</TopicLine>}
                <TopActions>
                  <IconButton
                    type="button"
                    $variant={showSearch ? 'primary' : 'ghost'}
                    $size="sm"
                    onClick={() => setShowSearch((v) => !v)}
                    title="Search messages"
                    aria-pressed={showSearch}
                  >
                    <IconSearch />
                  </IconButton>
                  <Button
                    type="button"
                    $variant={showPinned ? 'primary' : 'secondary'}
                    $size="sm"
                    onClick={() => setShowPinned((v) => !v)}
                    title="Pinned messages"
                  >
                    <IconPin />
                    Pinned
                    {pinnedCount > 0 && (
                      <Badge $variant={showPinned ? 'neutral' : 'accent'}>{pinnedCount}</Badge>
                    )}
                  </Button>
                  {isAdmin && (
                    <Menu
                      ariaLabel="Channel options"
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
                              `Delete #${activeChannel.name}? All messages will be permanently removed.`,
                            );
                            if (ok) void deleteChannel(activeChannel.id);
                          },
                        },
                      ]}
                    />
                  )}
                </TopActions>
              </>
            ) : (
              <ChannelTitle><IconHash /> <span>No channel</span></ChannelTitle>
            )}
          </TopBar>

          {activeChannel && showSearch && (
            <SearchRow>
              <SearchIconWrap><IconSearch /></SearchIconWrap>
              <SearchField
                ref={searchInputRef}
                placeholder={`Search in #${activeChannel.name}`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search messages in channel"
              />
              {searchQuery && (
                <ClearBtn type="button" onClick={() => setSearchQuery('')} aria-label="Clear search">
                  <IconX />
                </ClearBtn>
              )}
              <Button
                type="button"
                $variant="ghost"
                $size="sm"
                onClick={() => setShowSearch(false)}
              >
                Close
              </Button>
            </SearchRow>
          )}

          {activeChannel ? (
            <>
              <MessageList />
              <MessageComposer />
            </>
          ) : (
            <EmptyMain>
              {isAdmin
                ? 'Create your first channel to start chatting.'
                : 'No channels available yet — ask an admin to create one.'}
            </EmptyMain>
          )}
        </Main>

        <PinnedWrap $open={showPinned && Boolean(activeChannel)}>
          {showPinned && activeChannel && (
            <PinnedPanel onClose={() => setShowPinned(false)} />
          )}
        </PinnedWrap>
      </Shell>
    </PageContainer>
  );
};

export default Chat;
