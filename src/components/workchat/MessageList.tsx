import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { format, isSameDay } from 'date-fns';
import { useWorkChat } from '../../context/WorkChatContext';
import MessageItem from './MessageItem';

const Wrap = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: var(--s-2) 0 var(--s-4);
  display: flex;
  flex-direction: column;
  min-height: 0;
  scroll-behavior: smooth;

  /* WhatsApp-style subtle wallpaper using a low-contrast geometric pattern. */
  background-color: var(--bg-0, #0b1018);
  background-image:
    radial-gradient(circle at 20% 12%, rgba(76, 194, 255, 0.04) 0, transparent 35%),
    radial-gradient(circle at 80% 78%, rgba(76, 194, 255, 0.03) 0, transparent 40%),
    repeating-linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.012) 0,
      rgba(255, 255, 255, 0.012) 1px,
      transparent 1px,
      transparent 14px
    );

  @media (prefers-reduced-motion: reduce) {
    scroll-behavior: auto;
  }
`;

const DayDivider = styled.div`
  display: flex;
  justify-content: center;
  margin: var(--s-3) 0 var(--s-2);

  & > span {
    background: var(--bg-2);
    border: 1px solid var(--border-1);
    color: var(--text-3);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 10px;
    border-radius: 999px;
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

const SearchSummary = styled.div`
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border-1);
  padding: 6px var(--s-4);
  font-size: 12px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  gap: var(--s-2);

  strong {
    color: var(--text-1);
    font-weight: 600;
  }
`;

const GROUPING_WINDOW_MS = 5 * 60 * 1000;

const MessageList: React.FC = () => {
  const { messages, activeChannel, me, reads, searchQuery } = useWorkChat();
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

  const seenCutoff = useMemo(() => {
    if (!me) return null;
    const others = reads.filter((r) => r.channelId === activeChannel?.id);
    if (others.length === 0) return null;
    return others.reduce<string | null>(
      (acc, r) => (acc === null || r.lastReadAt > acc ? r.lastReadAt : acc),
      null,
    );
  }, [reads, activeChannel?.id, me]);

  const trimmed = searchQuery.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!trimmed) return messages;
    return messages.filter((m) => m.text.toLowerCase().includes(trimmed));
  }, [messages, trimmed]);

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
      {trimmed && (
        <SearchSummary>
          {filtered.length === 0 ? (
            <span>No results for <strong>"{searchQuery}"</strong></span>
          ) : (
            <span>
              <strong>{filtered.length}</strong>
              {filtered.length === 1 ? ' result' : ' results'} for <strong>"{searchQuery}"</strong>
            </span>
          )}
        </SearchSummary>
      )}

      {filtered.map((m, i) => {
        const prev = filtered[i - 1];
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
              <DayDivider>
                <span>{format(new Date(m.createdAt), 'EEEE, MMM d')}</span>
              </DayDivider>
            )}
            <MessageItem
              message={m}
              showAuthor={showAuthor}
              seenByOthers={seenByOthers}
              highlight={trimmed}
            />
          </React.Fragment>
        );
      })}
    </Wrap>
  );
};

export default MessageList;
