import React, { useMemo, useRef, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { format, isSameDay } from 'date-fns';
import { IconButton } from '../ui/primitives';
import {
  IconPin, IconSmile, IconTrash, IconCheck, IconCheckDouble, IconMoreVertical,
} from '../ui/icons';
import { detectLinks } from '../../services/chat';
import { useWorkChat } from '../../context/WorkChatContext';
import LinkPreview from './LinkPreview';
import AttachmentPreview from './AttachmentPreview';
import ReactionPicker from './ReactionPicker';
import Menu from './Menu';
import type { ChatMessage } from '../../types';

interface Props {
  message: ChatMessage;
  showAuthor: boolean;
  seenByOthers: boolean;
  highlight?: string;
  focused?: boolean;
}

const focusPulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(76, 194, 255, 0.55); background: rgba(76, 194, 255, 0.18); }
  55%  { box-shadow: 0 0 0 6px rgba(76, 194, 255, 0); background: rgba(76, 194, 255, 0.1); }
  100% { box-shadow: 0 0 0 0 rgba(76, 194, 255, 0); background: transparent; }
`;

const AVATAR = 30;
const AVATAR_GAP = 8;

const Row = styled.div<{ $mine: boolean; $grouped: boolean; $focused?: boolean }>`
  display: flex;
  flex-direction: ${(p) => (p.$mine ? 'row-reverse' : 'row')};
  align-items: flex-end;
  gap: ${AVATAR_GAP}px;
  width: 100%;
  padding: ${(p) => (p.$grouped ? '1px var(--s-4)' : '6px var(--s-4) 1px')};
  border-radius: 10px;
  scroll-margin-block: 72px;

  &:hover .msg-menu {
    opacity: 1;
    pointer-events: auto;
  }

  ${(p) =>
    p.$focused &&
    css`
      animation: ${focusPulse} 1.8s ease-out;
    `}

  @media (max-width: 520px) {
    padding-left: var(--s-3);
    padding-right: var(--s-3);
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    ${(p) =>
      p.$focused &&
      css`
        outline: 2px solid var(--accent);
        outline-offset: -2px;
      `}
  }
`;

const AvatarSlot = styled.div`
  width: ${AVATAR}px;
  flex-shrink: 0;
  align-self: flex-end;
`;

const Avatar = styled.div<{ $src: string | null }>`
  width: ${AVATAR}px;
  height: ${AVATAR}px;
  border-radius: 999px;
  background: var(--bg-4);
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

const Column = styled.div<{ $mine: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$mine ? 'flex-end' : 'flex-start')};
  max-width: min(72%, 560px);
  min-width: 0;
`;

/* No CSS triangle — sender's top corner is squared off (4px), the rest are rounded. */
const Bubble = styled.div<{ $mine: boolean; $first: boolean; $pinned: boolean }>`
  position: relative;
  padding: 6px 10px 4px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.42;
  color: var(--text-1);
  word-wrap: break-word;
  overflow-wrap: anywhere;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.18);

  ${(p) =>
    p.$mine
      ? css`
          background: #1f3e52;
        `
      : css`
          background: var(--bg-3);
        `}

  ${(p) =>
    p.$first &&
    p.$mine &&
    css`
      border-top-right-radius: 4px;
    `}

  ${(p) =>
    p.$first &&
    !p.$mine &&
    css`
      border-top-left-radius: 4px;
    `}

  ${(p) =>
    p.$pinned &&
    css`
      box-shadow: 0 0 0 1px rgba(76, 194, 255, 0.45), 0 1px 1px rgba(0, 0, 0, 0.18);
    `}
`;

const AuthorLine = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #4cc2ff;
  margin-bottom: 2px;
  user-select: none;
`;

const Body = styled.div`
  font-size: 14px;
  line-height: 1.42;
  color: var(--text-1);
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;

  a {
    color: #82d3ff;
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

const Mention = styled.span`
  color: #4cc2ff;
  font-weight: 600;
  background: rgba(76, 194, 255, 0.12);
  border-radius: 3px;
  padding: 0 2px;
`;

const Gif = styled.img`
  display: block;
  max-width: 100%;
  max-height: 240px;
  margin-top: 4px;
  border-radius: 8px;
`;

const Attachments = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
`;

const MetaRow = styled.div<{ $mine: boolean }>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 2px;
  font-size: 10.5px;
  color: ${(p) => (p.$mine ? 'rgba(255, 255, 255, 0.5)' : 'var(--text-4)')};
  font-variant-numeric: tabular-nums;
  user-select: none;
  line-height: 1;

  svg {
    width: 14px;
    height: 14px;
  }
`;

const SeenTick = styled.span<{ $seen: boolean }>`
  display: inline-flex;
  color: ${(p) => (p.$seen ? '#53bdeb' : 'rgba(255, 255, 255, 0.55)')};
`;

const PinBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 2px;
  font-size: 10px;
  color: #4cc2ff;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;

  svg { width: 10px; height: 10px; }
`;

const MenuBtnWrap = styled.div<{ $mine: boolean }>`
  position: absolute;
  top: 0;
  ${(p) => (p.$mine ? 'left: -64px;' : 'right: -64px;')}
  display: flex;
  align-items: center;
  gap: 2px;
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
  color: ${(p) => (p.$mine ? '#4cc2ff' : 'var(--text-2)')};
  background: ${(p) => (p.$mine ? 'var(--accent-soft)' : 'var(--bg-2)')};
  border: 1px solid ${(p) => (p.$mine ? 'rgba(76, 194, 255, 0.35)' : 'var(--border-1)')};
  transition: border-color 0.12s ease;

  &:hover { border-color: var(--accent); }
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
const MENTION_TOKEN_RE = /@([a-zA-Z0-9_.-]+)/g;

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

function renderPlainChunk(
  text: string,
  query: string,
  knownHandles: Set<string>,
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let mLast = 0;
  let key = 0;
  MENTION_TOKEN_RE.lastIndex = 0;
  let mm: RegExpExecArray | null;
  while ((mm = MENTION_TOKEN_RE.exec(text))) {
    const offset = mm.index;
    if (offset > mLast) {
      out.push(
        <React.Fragment key={`t-${key++}`}>
          {highlightInString(text.slice(mLast, offset), query)}
        </React.Fragment>,
      );
    }
    const token = mm[0];
    if (knownHandles.has(mm[1].toLowerCase())) {
      out.push(<Mention key={`mn-${key++}`}>{token}</Mention>);
    } else {
      out.push(
        <React.Fragment key={`t-${key++}`}>
          {highlightInString(token, query)}
        </React.Fragment>,
      );
    }
    mLast = offset + token.length;
  }
  if (mLast < text.length) {
    out.push(
      <React.Fragment key={`t-${key++}`}>
        {highlightInString(text.slice(mLast), query)}
      </React.Fragment>,
    );
  }
  return out;
}

function linkifyAndHighlight(
  text: string,
  query: string,
  knownHandles: Set<string>,
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  text.replace(URL_RE, (match, _g1, offset) => {
    const o = offset as number;
    if (o > last) {
      out.push(
        <React.Fragment key={`t-${key++}`}>
          {renderPlainChunk(text.slice(last, o), query, knownHandles)}
        </React.Fragment>,
      );
    }
    out.push(
      <a key={`a-${key++}`} href={match} target="_blank" rel="noopener noreferrer">
        {highlightInString(match, query)}
      </a>,
    );
    last = o + match.length;
    return match;
  });
  if (last < text.length) {
    out.push(
      <React.Fragment key={`t-${key++}`}>
        {renderPlainChunk(text.slice(last), query, knownHandles)}
      </React.Fragment>,
    );
  }
  return out;
}

const MessageItem: React.FC<Props> = ({ message, showAuthor, seenByOthers, highlight, focused }) => {
  const { me, isAdmin, toggleReaction, pinMessage, unpinMessage, deleteMessage, mentionHandles } = useWorkChat();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const links = useMemo(() => detectLinks(message.text), [message.text]);
  const isMine = me?.id === message.authorId;
  const isPinned = Boolean(message.pinnedAt);

  const openReactionPicker = (): void => setShowReactionPicker(true);

  const createdAt = useMemo(() => new Date(message.createdAt), [message.createdAt]);
  const today = new Date();
  const timeLabel = isSameDay(createdAt, today)
    ? format(createdAt, 'HH:mm')
    : format(createdAt, 'MMM d HH:mm');

  const initial = (message.authorName?.[0] ?? '?').toUpperCase();
  const grouped = !showAuthor;
  const hasText = Boolean(message.text);

  const menuItems = [
    {
      id: 'react',
      label: 'Add reaction',
      icon: <IconSmile />,
      onSelect: openReactionPicker,
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
    <Row
      data-message-id={message.id}
      $mine={Boolean(isMine)}
      $grouped={grouped}
      $focused={focused}
    >
      {!isMine && (
        <AvatarSlot>
          {showAuthor && (
            <Avatar
              $src={message.authorPictureUrl}
              title={`${message.authorName} · ${createdAt.toLocaleString()}`}
            >
              {!message.authorPictureUrl && initial}
            </Avatar>
          )}
        </AvatarSlot>
      )}

      <Column $mine={Boolean(isMine)} ref={bubbleRef}>
        <Bubble
          $mine={Boolean(isMine)}
          $first={showAuthor}
          $pinned={isPinned}
        >
          <MenuBtnWrap $mine={Boolean(isMine)} className="msg-menu">
            <IconButton
              type="button"
              $size="sm"
              $variant="ghost"
              aria-label="React to message"
              title="React"
              onClick={openReactionPicker}
            >
              <IconSmile />
            </IconButton>
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
          </MenuBtnWrap>

          {isPinned && showAuthor && (
            <PinBadge title="Pinned"><IconPin /> Pinned</PinBadge>
          )}
          {showAuthor && !isMine && (
            <AuthorLine>{message.authorName}</AuthorLine>
          )}

          {hasText && (
            <Body className="msg-text">
              {linkifyAndHighlight(message.text, highlight ?? '', mentionHandles)}
            </Body>
          )}
          {message.gif && (
            <Gif
              src={message.gif.url}
              alt={message.gif.alt}
              width={message.gif.width}
              height={message.gif.height}
            />
          )}
          {message.attachments && message.attachments.length > 0 && (
            <Attachments>
              {message.attachments.map((att) => (
                <AttachmentPreview key={att.id} att={att} />
              ))}
            </Attachments>
          )}

          <MetaRow $mine={Boolean(isMine)} title={createdAt.toLocaleString()}>
            <span>{timeLabel}</span>
            {isMine && (
              <SeenTick $seen={seenByOthers} title={seenByOthers ? 'Seen' : 'Sent'}>
                {seenByOthers ? <IconCheckDouble /> : <IconCheck />}
              </SeenTick>
            )}
          </MetaRow>
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
      </Column>

      {showReactionPicker && (
        <ReactionPicker
          anchorEl={bubbleRef.current}
          onSelect={(emoji) => void toggleReaction(message.id, emoji)}
          onClose={() => setShowReactionPicker(false)}
        />
      )}
    </Row>
  );
};

export default MessageItem;
