import React, { useMemo, useRef, useState, useEffect } from 'react';
import styled, { css } from 'styled-components';
import { format, isSameDay } from 'date-fns';
import { IconButton } from '../ui/primitives';
import {
  IconPin, IconSmile, IconTrash, IconCheck, IconCheckDouble, IconMoreVertical,
} from '../ui/icons';
import { detectLinks } from '../../services/chat';
import { useWorkChat } from '../../context/WorkChatContext';
import LinkPreview from './LinkPreview';
import EmojiPicker from './EmojiPicker';
import Menu from './Menu';
import type { ChatMessage } from '../../types';

interface Props {
  message: ChatMessage;
  showAuthor: boolean;
  seenByOthers: boolean;
  highlight?: string;
}

const AVATAR = 28;

const Row = styled.div<{ $mine: boolean; $grouped: boolean }>`
  display: flex;
  flex-direction: ${(p) => (p.$mine ? 'row-reverse' : 'row')};
  align-items: flex-end;
  gap: 8px;
  width: 100%;
  padding: ${(p) => (p.$grouped ? '1px var(--s-4)' : '6px var(--s-4) 1px')};
  position: relative;

  &:hover .msg-menu {
    opacity: 1;
    pointer-events: auto;
  }

  @media (max-width: 520px) {
    padding-left: var(--s-3);
    padding-right: var(--s-3);
  }
`;

const AvatarSlot = styled.div`
  width: ${AVATAR}px;
  flex-shrink: 0;
`;

const Avatar = styled.div<{ $src: string | null }>`
  width: ${AVATAR}px;
  height: ${AVATAR}px;
  border-radius: 999px;
  background: var(--bg-4);
  border: 1px solid var(--border-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;

  ${(p) =>
    p.$src &&
    css`
      background: url(${p.$src}) center/cover no-repeat, var(--bg-4);
      color: transparent;
    `}
`;

const BubbleWrap = styled.div<{ $mine: boolean }>`
  position: relative;
  max-width: min(72%, 520px);
  min-width: 64px;
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$mine ? 'flex-end' : 'flex-start')};
`;

/* Bubble with a single notched corner (tail) on the sender side. */
const Bubble = styled.div<{ $mine: boolean; $tail: boolean; $pinned: boolean }>`
  position: relative;
  padding: 6px 10px 4px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--text-1);
  border-radius: 8px;
  box-shadow: 0 1px 0.5px rgba(0, 0, 0, 0.25);
  word-wrap: break-word;
  overflow-wrap: anywhere;

  ${(p) =>
    p.$mine
      ? css`
          background: linear-gradient(180deg, rgba(76, 194, 255, 0.22) 0%, rgba(76, 194, 255, 0.14) 100%);
          border: 1px solid rgba(76, 194, 255, 0.32);
        `
      : css`
          background: var(--bg-3);
          border: 1px solid var(--border-2);
        `}

  ${(p) =>
    p.$tail &&
    p.$mine &&
    css`
      border-top-right-radius: 2px;
      &::after {
        content: '';
        position: absolute;
        top: -1px;
        right: -7px;
        width: 8px;
        height: 12px;
        background: rgba(76, 194, 255, 0.22);
        border-top: 1px solid rgba(76, 194, 255, 0.32);
        border-right: 1px solid rgba(76, 194, 255, 0.32);
        clip-path: polygon(0 0, 100% 0, 0 100%);
      }
    `}

  ${(p) =>
    p.$tail &&
    !p.$mine &&
    css`
      border-top-left-radius: 2px;
      &::after {
        content: '';
        position: absolute;
        top: -1px;
        left: -7px;
        width: 8px;
        height: 12px;
        background: var(--bg-3);
        border-top: 1px solid var(--border-2);
        border-left: 1px solid var(--border-2);
        clip-path: polygon(0 0, 100% 0, 100% 100%);
      }
    `}

  ${(p) =>
    p.$pinned &&
    css`
      box-shadow: 0 0 0 1px var(--accent-soft), 0 1px 0.5px rgba(0, 0, 0, 0.25);
    `}
`;

const AuthorLine = styled.div<{ $mine: boolean }>`
  font-size: 12px;
  font-weight: 700;
  color: ${(p) => (p.$mine ? 'var(--accent)' : 'var(--text-1)')};
  margin-bottom: 1px;
  user-select: none;
`;

const Body = styled.div`
  font-size: 14px;
  line-height: 1.4;
  color: var(--text-1);
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  /* Trailing space so the footer time can sit under the last line. */
  padding-bottom: 16px;

  a {
    color: var(--accent);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }

  mark {
    background: rgba(255, 213, 79, 0.32);
    color: inherit;
    border-radius: 2px;
    padding: 0 2px;
  }
`;

const Gif = styled.img`
  display: block;
  max-width: 100%;
  max-height: 240px;
  margin-top: 4px;
  border-radius: 6px;
  border: 1px solid var(--border-1);
`;

const Footer = styled.div`
  position: absolute;
  bottom: 4px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  color: var(--text-4);
  font-variant-numeric: tabular-nums;
  pointer-events: none;

  svg {
    width: 14px;
    height: 14px;
  }
`;

const SeenTick = styled.span<{ $seen: boolean }>`
  display: inline-flex;
  color: ${(p) => (p.$seen ? '#4cc2ff' : 'var(--text-4)')};
`;

const PinBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;

  svg { width: 10px; height: 10px; }
`;

const HeadRow = styled.div<{ $mine: boolean }>`
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 1px;
  ${(p) =>
    p.$mine
      ? css`flex-direction: row-reverse;`
      : css`flex-direction: row;`}
`;

const MenuBtnWrap = styled.div<{ $mine: boolean }>`
  position: absolute;
  top: 2px;
  ${(p) => (p.$mine ? 'left: -28px;' : 'right: -28px;')}
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const ReactRow = styled.div<{ $mine: boolean }>`
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 4px;
  justify-content: ${(p) => (p.$mine ? 'flex-end' : 'flex-start')};
  max-width: 100%;
`;

const Pill = styled.button<{ $mine: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  cursor: pointer;
  color: ${(p) => (p.$mine ? 'var(--accent)' : 'var(--text-2)')};
  background: ${(p) => (p.$mine ? 'var(--accent-soft)' : 'var(--bg-2)')};
  border: 1px solid ${(p) => (p.$mine ? 'rgba(76, 194, 255, 0.35)' : 'var(--border-1)')};
  transition: border-color 0.12s ease;

  &:hover { border-color: var(--accent); }
`;

const EmojiPop = styled.div<{ $mine: boolean }>`
  position: absolute;
  top: -8px;
  ${(p) => (p.$mine ? 'right: 100%;' : 'left: 100%;')}
  z-index: 70;
  ${(p) => (p.$mine ? 'margin-right: 8px;' : 'margin-left: 8px;')}
`;

const PreviewWrap = styled.div<{ $mine: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  margin-top: 4px;
  align-items: ${(p) => (p.$mine ? 'flex-end' : 'flex-start')};
`;

const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;

function highlightInString(text: string, query: string): React.ReactNode[] {
  if (!query) return [text];
  const out: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      out.push(text.slice(i));
      break;
    }
    if (idx > i) out.push(text.slice(i, idx));
    out.push(<mark key={`m-${key++}`}>{text.slice(idx, idx + needle.length)}</mark>);
    i = idx + needle.length;
  }
  return out;
}

function linkifyAndHighlight(text: string, query: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  text.replace(URL_RE, (match, _g1, offset) => {
    const o = offset as number;
    if (o > last) out.push(<React.Fragment key={`t-${key++}`}>{highlightInString(text.slice(last, o), query)}</React.Fragment>);
    out.push(
      <a key={`a-${key++}`} href={match} target="_blank" rel="noopener noreferrer">
        {highlightInString(match, query)}
      </a>,
    );
    last = o + match.length;
    return match;
  });
  if (last < text.length) {
    out.push(<React.Fragment key={`t-${key++}`}>{highlightInString(text.slice(last), query)}</React.Fragment>);
  }
  return out;
}

const MessageItem: React.FC<Props> = ({ message, showAuthor, seenByOthers, highlight }) => {
  const { me, isAdmin, toggleReaction, pinMessage, unpinMessage, deleteMessage } = useWorkChat();
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  const links = useMemo(() => detectLinks(message.text), [message.text]);
  const isMine = me?.id === message.authorId;
  const isPinned = Boolean(message.pinnedAt);

  useEffect(() => {
    if (!showEmoji) return;
    const onDoc = (e: MouseEvent): void => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showEmoji]);

  const createdAt = useMemo(() => new Date(message.createdAt), [message.createdAt]);
  const today = new Date();
  const timeLabel = isSameDay(createdAt, today)
    ? format(createdAt, 'HH:mm')
    : format(createdAt, 'MMM d HH:mm');

  const initial = (message.authorName?.[0] ?? '?').toUpperCase();
  const grouped = !showAuthor;

  const menuItems = [
    {
      id: 'react',
      label: 'Add reaction',
      icon: <IconSmile />,
      onSelect: () => setShowEmoji(true),
    },
    ...(isAdmin
      ? [{
        id: 'pin',
        label: isPinned ? 'Unpin' : 'Pin message',
        icon: <IconPin />,
        onSelect: () => void (isPinned ? unpinMessage(message.id) : pinMessage(message.id)),
      }]
      : []),
    ...(isMine || isAdmin
      ? [{
        id: 'delete',
        label: 'Delete',
        icon: <IconTrash />,
        danger: true,
        onSelect: () => {
          if (window.confirm('Delete this message?')) void deleteMessage(message.id);
        },
      }]
      : []),
  ];

  return (
    <Row $mine={Boolean(isMine)} $grouped={grouped}>
      {!isMine && (
        <AvatarSlot>
          {showAuthor ? (
            <Avatar
              $src={message.authorPictureUrl}
              title={`${message.authorName} · ${createdAt.toLocaleString()}`}
            >
              {!message.authorPictureUrl && initial}
            </Avatar>
          ) : null}
        </AvatarSlot>
      )}

      <BubbleWrap $mine={Boolean(isMine)}>
        <Bubble $mine={Boolean(isMine)} $tail={showAuthor} $pinned={isPinned}>
          <MenuBtnWrap $mine={Boolean(isMine)} className="msg-menu">
            <Menu
              ariaLabel="Message actions"
              align={isMine ? 'left' : 'right'}
              trigger={
                <IconButton
                  type="button"
                  $size="sm"
                  $variant="ghost"
                  aria-label="Message actions"
                >
                  <IconMoreVertical />
                </IconButton>
              }
              items={menuItems}
            />
            <div ref={emojiRef}>
              {showEmoji && (
                <EmojiPop $mine={Boolean(isMine)}>
                  <EmojiPicker
                    onSelect={(e) => {
                      void toggleReaction(message.id, e);
                      setShowEmoji(false);
                    }}
                  />
                </EmojiPop>
              )}
            </div>
          </MenuBtnWrap>

          {showAuthor && !isMine && (
            <HeadRow $mine={Boolean(isMine)}>
              <AuthorLine $mine={Boolean(isMine)}>{message.authorName}</AuthorLine>
              {isPinned && (
                <PinBadge title="Pinned"><IconPin /> Pinned</PinBadge>
              )}
            </HeadRow>
          )}
          {showAuthor && isMine && isPinned && (
            <HeadRow $mine={Boolean(isMine)}>
              <PinBadge title="Pinned"><IconPin /> Pinned</PinBadge>
            </HeadRow>
          )}

          {message.text && <Body>{linkifyAndHighlight(message.text, highlight ?? '')}</Body>}
          {!message.text && message.gif && <div style={{ paddingBottom: 16 }} />}
          {message.gif && (
            <Gif
              src={message.gif.url}
              alt={message.gif.alt}
              width={message.gif.width}
              height={message.gif.height}
            />
          )}

          <Footer title={createdAt.toLocaleString()}>
            <span>{timeLabel}</span>
            {isMine && (
              <SeenTick $seen={seenByOthers} title={seenByOthers ? 'Seen' : 'Sent'}>
                {seenByOthers ? <IconCheckDouble /> : <IconCheck />}
              </SeenTick>
            )}
          </Footer>
        </Bubble>

        {(links.length > 0 || Object.keys(message.reactions).length > 0) && (
          <PreviewWrap $mine={Boolean(isMine)}>
            {links.slice(0, 2).map((u) => (
              <LinkPreview key={u} url={u} />
            ))}
            {Object.keys(message.reactions).length > 0 && (
              <ReactRow $mine={Boolean(isMine)}>
                {Object.entries(message.reactions).map(([emoji, users]) => {
                  const mineReact = me ? users.includes(me.id) : false;
                  return (
                    <Pill
                      key={emoji}
                      $mine={mineReact}
                      type="button"
                      onClick={() => void toggleReaction(message.id, emoji)}
                      title={users.length === 1 ? '1 reaction' : `${users.length} reactions`}
                    >
                      <span>{emoji}</span>
                      <span>{users.length}</span>
                    </Pill>
                  );
                })}
              </ReactRow>
            )}
          </PreviewWrap>
        )}
      </BubbleWrap>
    </Row>
  );
};

export default MessageItem;
