import React, { useMemo, useState, useRef, useEffect } from 'react';
import styled, { css } from 'styled-components';
import { format, formatDistanceToNow, isSameDay } from 'date-fns';
import { IconButton } from '../ui/primitives';
import { IconPin, IconSmile, IconTrash, IconCheck } from '../ui/icons';
import { detectLinks } from '../../services/chat';
import { useWorkChat } from '../../context/WorkChatContext';
import LinkPreview from './LinkPreview';
import EmojiPicker from './EmojiPicker';
import type { ChatMessage } from '../../types';

interface Props {
  message: ChatMessage;
  showAuthor: boolean;
  seenByOthers: boolean;
}

const AVATAR = 36;
const GUTTER = 12;

const OutRow = styled.div<{ $mine: boolean; $grouped: boolean }>`
  display: flex;
  flex-direction: row;
  justify-content: ${(p) => (p.$mine ? 'flex-end' : 'flex-start')};
  align-items: flex-end;
  gap: ${GUTTER}px;
  width: 100%;
  padding: ${(p) => (p.$grouped ? '3px var(--s-4)' : '10px var(--s-4) 6px')};
  position: relative;

  &:hover .bubble-tools {
    opacity: 1;
    pointer-events: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .bubble-tools {
      transition: none;
    }
  }

  @media (max-width: 520px) {
    padding-left: var(--s-3);
    padding-right: var(--s-3);
  }
`;

const AvatarRail = styled.div`
  width: ${AVATAR}px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 2px;
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
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  flex-shrink: 0;

  ${(p) =>
    p.$src &&
    css`
      background: url(${p.$src}) center/cover no-repeat, var(--bg-4);
      color: transparent;
    `}
`;

const TimeInRail = styled.div`
  font-size: 10px;
  color: var(--text-4);
  font-variant-numeric: tabular-nums;
  text-align: center;
  margin-top: 4px;
  opacity: 0;
  transition: opacity 0.15s;

  ${OutRow}:hover & {
    opacity: 1;
  }
`;

const SpacerRail = styled.div`
  width: ${AVATAR}px;
  flex-shrink: 0;
`;

const BubbleColumn = styled.div<{ $mine: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$mine ? 'flex-end' : 'flex-start')};
  max-width: min(78%, 520px);
  min-width: 0;
  position: relative;
`;

const MetaRow = styled.div<{ $mine: boolean }>`
  display: flex;
  align-items: baseline;
  gap: var(--s-2);
  flex-wrap: wrap;
  margin-bottom: 4px;
  max-width: 100%;
  ${(p) =>
    p.$mine
      ? css`
          justify-content: flex-end;
          flex-direction: row-reverse;
        `
      : css`
          justify-content: flex-start;
        `}
`;

const Author = styled.span`
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-1);
`;

const TimeStamp = styled.span`
  font-size: 11px;
  color: var(--text-4);
`;

const PinTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: var(--accent);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  svg {
    width: 10px;
    height: 10px;
  }
`;

const Bubble = styled.div<{ $mine: boolean }>`
  position: relative;
  border-radius: ${(p) => (p.$mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px')};
  padding: 10px 14px 10px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2);

  ${(p) =>
    p.$mine
      ? css`
          background: linear-gradient(
            165deg,
            rgba(76, 194, 255, 0.16) 0%,
            rgba(76, 194, 255, 0.07) 100%
          );
          border: 1px solid rgba(76, 194, 255, 0.28);
        `
      : css`
          background: var(--bg-3);
          border: 1px solid var(--border-2);
        `}

  transition: border-color 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    border-color: ${(p) => (p.$mine ? 'rgba(76, 194, 255, 0.45)' : 'var(--border-3)')};
    box-shadow: ${(p) =>
      p.$mine ? '0 0 0 1px rgba(76, 194, 255, 0.12)' : '0 1px 0 rgba(0, 0, 0, 0.25)'};
  }
`;

const BubbleBody = styled.div`
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-1);
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;

  a {
    color: var(--accent);
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }
`;

const BubbleFooterTime = styled.div<{ $mine: boolean }>`
  margin-top: 6px;
  font-size: 10px;
  color: var(--text-4);
  font-variant-numeric: tabular-nums;
  ${(p) => (p.$mine ? 'text-align: right;' : 'text-align: left;')}
`;

const GifMedia = styled.img`
  display: block;
  max-width: 100%;
  max-height: 220px;
  margin-top: 6px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-1);
`;

const BelowBubble = styled.div<{ $mine: boolean }>`
  width: 100%;
  max-width: 100%;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: ${(p) => (p.$mine ? 'flex-end' : 'flex-start')};
`;

const Reactions = styled.div<{ $mine: boolean }>`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: ${(p) => (p.$mine ? 'flex-end' : 'flex-start')};
`;

const Pill = styled.button<{ $mine: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  color: ${(p) => (p.$mine ? 'var(--accent)' : 'var(--text-2)')};
  background: ${(p) => (p.$mine ? 'var(--accent-soft)' : 'var(--bg-2)')};
  border: 1px solid ${(p) => (p.$mine ? 'rgba(76, 194, 255, 0.35)' : 'var(--border-1)')};
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    border-color: var(--accent);
  }
`;

const Tools = styled.div<{ $mine: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${(p) => (p.$mine ? 'flex-end' : 'flex-start')};
  gap: 2px;
  margin: -4px -6px 6px;
  padding: 2px 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  min-height: 28px;
`;

const PopAnchor = styled.div`
  position: relative;
`;

const PopoverWrap = styled.div<{ $mine: boolean }>`
  position: absolute;
  top: 100%;
  margin-top: 6px;
  z-index: 50;
  ${(p) => (p.$mine ? 'right: 0;' : 'left: 0;')}
`;

const SeenLine = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-4);

  svg {
    width: 11px;
    height: 11px;
    color: var(--success);
  }
`;

const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;

function linkify(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  text.replace(URL_RE, (match, _g1, offset) => {
    const o = offset as number;
    if (o > last) out.push(text.slice(last, o));
    out.push(
      <a key={key++} href={match} target="_blank" rel="noopener noreferrer">
        {match}
      </a>,
    );
    last = o + match.length;
    return match;
  });
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const MessageItem: React.FC<Props> = ({ message, showAuthor, seenByOthers }) => {
  const { me, isAdmin, toggleReaction, pinMessage, unpinMessage, deleteMessage } = useWorkChat();
  const [showEmoji, setShowEmoji] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  const links = useMemo(() => detectLinks(message.text), [message.text]);
  const isMine = me?.id === message.authorId;
  const isPinned = Boolean(message.pinnedAt);

  useEffect(() => {
    if (!showEmoji) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [showEmoji]);

  const createdAt = useMemo(() => new Date(message.createdAt), [message.createdAt]);
  const today = new Date();
  const timeLabel = isSameDay(createdAt, today)
    ? format(createdAt, 'HH:mm')
    : format(createdAt, 'MMM d, HH:mm');

  const initial = (message.authorName?.[0] ?? '?').toUpperCase();
  const grouped = !showAuthor;

  return (
    <OutRow $mine={Boolean(isMine)} $grouped={grouped}>
      {!isMine &&
        (showAuthor ? (
          <AvatarRail>
            <Avatar $src={message.authorPictureUrl} title={`${message.authorName} · ${createdAt.toLocaleString()}`}>
              {!message.authorPictureUrl && initial}
            </Avatar>
            {!grouped && (
              <TimeInRail title={createdAt.toLocaleString()}>{format(createdAt, 'HH:mm')}</TimeInRail>
            )}
          </AvatarRail>
        ) : (
          <SpacerRail aria-hidden />
        ))}

      <BubbleColumn $mine={Boolean(isMine)}>
        {showAuthor && (
          <MetaRow $mine={Boolean(isMine)}>
            {!isMine && <Author>{message.authorName}</Author>}
            {isMine && <Author>You</Author>}
            <TimeStamp title={createdAt.toLocaleString()}>
              {timeLabel} · {formatDistanceToNow(createdAt, { addSuffix: true })}
            </TimeStamp>
            {isPinned && (
              <PinTag>
                <IconPin /> Pinned
              </PinTag>
            )}
          </MetaRow>
        )}

        <Bubble $mine={Boolean(isMine)}>
          <Tools className="bubble-tools" $mine={Boolean(isMine)}>
            <PopAnchor ref={popRef}>
              <IconButton
                type="button"
                $size="sm"
                $variant="ghost"
                onClick={() => setShowEmoji((v) => !v)}
                title="Add reaction"
              >
                <IconSmile />
              </IconButton>
              {showEmoji && (
                <PopoverWrap $mine={Boolean(isMine)}>
                  <EmojiPicker
                    onSelect={(e) => {
                      void toggleReaction(message.id, e);
                      setShowEmoji(false);
                    }}
                  />
                </PopoverWrap>
              )}
            </PopAnchor>
            {isAdmin && (
              <IconButton
                type="button"
                $size="sm"
                $variant="ghost"
                onClick={() => void (isPinned ? unpinMessage(message.id) : pinMessage(message.id))}
                title={isPinned ? 'Unpin message' : 'Pin message'}
                style={isPinned ? { color: 'var(--accent)' } : undefined}
              >
                <IconPin />
              </IconButton>
            )}
            {(isMine || isAdmin) && (
              <IconButton
                type="button"
                $size="sm"
                $variant="ghost"
                onClick={() => {
                  if (window.confirm('Delete this message?')) void deleteMessage(message.id);
                }}
                title="Delete message"
              >
                <IconTrash />
              </IconButton>
            )}
          </Tools>
          {message.text && <BubbleBody>{linkify(message.text)}</BubbleBody>}
          {message.gif && (
            <GifMedia
              src={message.gif.url}
              alt={message.gif.alt}
              width={message.gif.width}
              height={message.gif.height}
            />
          )}
          {grouped && (
            <BubbleFooterTime $mine={Boolean(isMine)} title={createdAt.toLocaleString()}>
              {timeLabel}
            </BubbleFooterTime>
          )}
        </Bubble>

        {(links.length > 0 || Object.keys(message.reactions).length > 0 || (isMine && seenByOthers)) && (
          <BelowBubble $mine={Boolean(isMine)}>
            {links.slice(0, 2).map((u) => (
              <LinkPreview key={u} url={u} />
            ))}
            {Object.keys(message.reactions).length > 0 && (
              <Reactions $mine={Boolean(isMine)}>
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
              </Reactions>
            )}
            {isMine && seenByOthers && (
              <SeenLine title="Seen by others">
                <IconCheck /> Seen
              </SeenLine>
            )}
          </BelowBubble>
        )}
      </BubbleColumn>
    </OutRow>
  );
};

export default MessageItem;
