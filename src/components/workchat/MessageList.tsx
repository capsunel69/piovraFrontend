import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { format, isSameDay } from 'date-fns';
import { useWorkChat } from '../../context/WorkChatContext';
import { IconChat } from '../ui/icons';
import MessageItem from './MessageItem';

const Region = styled.div`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

const Wrap = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--s-3) 0 var(--s-4);
  display: flex;
  flex-direction: column;
  min-height: 0;
  scroll-behavior: smooth;
  background: var(--bg-0, #0b1018);

  @media (prefers-reduced-motion: reduce) {
    scroll-behavior: auto;
  }
`;

const FadeTop = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 34px;
  pointer-events: none;
  z-index: 4;
  background: linear-gradient(
    180deg,
    var(--bg-0, #0b1018) 0%,
    color-mix(in srgb, var(--bg-0, #0b1018) 70%, transparent) 45%,
    transparent 100%
  );
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

const EmptyHero = styled.div`
  margin: auto;
  padding: var(--s-7) var(--s-5);
  max-width: 440px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-3);
  text-align: center;
`;

const EmptyBadge = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background:
    radial-gradient(120% 120% at 30% 20%, rgba(76, 194, 255, 0.28), rgba(76, 194, 255, 0) 60%),
    radial-gradient(120% 120% at 80% 80%, rgba(164, 120, 255, 0.22), rgba(164, 120, 255, 0) 60%),
    rgba(76, 194, 255, 0.06);
  border: 1px solid rgba(76, 194, 255, 0.22);
  color: var(--accent);
  box-shadow: 0 8px 32px rgba(76, 194, 255, 0.12);

  svg { width: 28px; height: 28px; }
`;

const EmptyTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
  letter-spacing: -0.01em;

  strong { color: var(--accent); font-weight: 700; }
`;

const EmptyHint = styled.div`
  font-size: 13px;
  color: var(--text-3);
  line-height: 1.55;
  max-width: 360px;
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
  const {
    messages, activeChannel, me, reads, searchQuery,
    focusMessageId, clearFocusMessage,
  } = useWorkChat();
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

  useEffect(() => {
    if (!focusMessageId) return;
    const root = scrollRef.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(focusMessageId)}"]`,
    );
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = window.setTimeout(() => clearFocusMessage(), 2200);
    return () => window.clearTimeout(t);
  }, [focusMessageId, messages, clearFocusMessage]);

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
        <EmptyHero>
          <EmptyBadge><IconChat /></EmptyBadge>
          <EmptyTitle>
            Welcome to <strong>#{activeChannel.name}</strong>
          </EmptyTitle>
          <EmptyHint>
            This is the start of the conversation. Say hi, share a link, or drop a GIF
            to break the ice.
          </EmptyHint>
        </EmptyHero>
      </Wrap>
    );
  }

  return (
    <Region>
      <FadeTop aria-hidden />
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
              focused={focusMessageId === m.id}
            />
          </React.Fragment>
        );
      })}
      </Wrap>
    </Region>
  );
};

export default MessageList;
