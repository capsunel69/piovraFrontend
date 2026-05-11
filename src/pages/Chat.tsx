import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  PageContainer, PageHeader, PageTitle, PageSubtitle, Button, Badge,
} from '../components/ui/primitives';
import { IconChat, IconHash, IconPin, IconUsers } from '../components/ui/icons';
import { useWorkChat } from '../context/WorkChatContext';
import ChannelList from '../components/workchat/ChannelList';
import MessageList from '../components/workchat/MessageList';
import MessageComposer from '../components/workchat/MessageComposer';
import PinnedPanel from '../components/workchat/PinnedPanel';

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

  svg { color: var(--accent); }
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
  gap: var(--s-2);
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

const Chat: React.FC = () => {
  const { activeChannel, isAdmin, totalUnread } = useWorkChat();
  const [showPinned, setShowPinned] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(true);

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
                  {activeChannel.name}
                </ChannelTitle>
                {activeChannel.topic && <TopicLine>{activeChannel.topic}</TopicLine>}
                <TopActions>
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
                </TopActions>
              </>
            ) : (
              <ChannelTitle><IconHash /> No channel</ChannelTitle>
            )}
          </TopBar>

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
