import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { format, isSameDay } from 'date-fns';
import { useWorkChat } from '../../context/WorkChatContext';
import MessageItem from './MessageItem';

const Wrap = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: var(--s-3) 0 var(--s-3);
  display: flex;
  flex-direction: column;
  min-height: 0;
  scroll-behavior: smooth;
`;

const DayDivider = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-4);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);

  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-1);
  }
`;

const Empty = styled.div`
  margin: auto;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
  padding: var(--s-6);
  line-height: 1.6;
`;

const Hint = styled.div`
  font-size: 12px;
  color: var(--text-4);
  margin-top: 6px;
`;

const GROUPING_WINDOW_MS = 5 * 60 * 1000;

const MessageList: React.FC = () => {
  const { messages, activeChannel, me, reads } = useWorkChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLenRef = useRef(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeChannel?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (messages.length > lastLenRef.current) {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 200) el.scrollTop = el.scrollHeight;
    }
    lastLenRef.current = messages.length;
  }, [messages]);

  /* Read receipts: latest message that anyone besides me has read. */
  const seenCutoff = useMemo(() => {
    if (!me) return null;
    const others = reads.filter((r) => r.channelId === activeChannel?.id);
    if (others.length === 0) return null;
    return others.reduce<string | null>(
      (acc, r) => (acc === null || r.lastReadAt > acc ? r.lastReadAt : acc),
      null,
    );
  }, [reads, activeChannel?.id, me]);

  if (!activeChannel) {
    return <Empty>Select a channel to start chatting.</Empty>;
  }

  if (messages.length === 0) {
    return (
      <Wrap ref={scrollRef}>
        <Empty>
          This is the very beginning of <strong>#{activeChannel.name}</strong>.
          <Hint>Say hi, share a link, or drop a GIF.</Hint>
        </Empty>
      </Wrap>
    );
  }

  return (
    <Wrap ref={scrollRef}>
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const showDay = !prev || !isSameDay(new Date(prev.createdAt), new Date(m.createdAt));
        const sameAuthor =
          prev &&
          prev.authorId === m.authorId &&
          new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUPING_WINDOW_MS;
        const showAuthor = showDay || !sameAuthor || Boolean(m.pinnedAt);

        const seenByOthers =
          me?.id === m.authorId &&
          seenCutoff !== null &&
          seenCutoff >= m.createdAt;

        return (
          <React.Fragment key={m.id}>
            {showDay && (
              <DayDivider>{format(new Date(m.createdAt), 'EEEE, MMM d')}</DayDivider>
            )}
            <MessageItem message={m} showAuthor={showAuthor} seenByOthers={seenByOthers} />
          </React.Fragment>
        );
      })}
    </Wrap>
  );
};

export default MessageList;
