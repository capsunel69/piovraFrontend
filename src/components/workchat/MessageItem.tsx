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

const Wrap = styled.div<{ $grouped: boolean }>`
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: var(--s-3);
  padding: ${(p) => (p.$grouped ? '2px 12px' : '10px 12px 6px')};
  border-radius: var(--r-sm);
  position: relative;

  &:hover { background: rgba(255,255,255,0.025); }
  &:hover .row-tools { opacity: 1; pointer-events: auto; }
`;

const AvatarCol = styled.div`
  display: flex;
  justify-content: center;
  padding-top: 2px;
`;

const Avatar = styled.div<{ $src: string | null; $hidden?: boolean }>`
  width: 36px;
  height: 36px;
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
  visibility: ${(p) => (p.$hidden ? 'hidden' : 'visible')};

  ${(p) => p.$src && css`
    background: url(${p.$src}) center/cover no-repeat, var(--bg-4);
    color: transparent;
  `}
`;

const HoverTime = styled.div`
  font-size: 10px;
  color: var(--text-4);
  font-variant-numeric: tabular-nums;
  text-align: center;
  margin-top: 4px;
  opacity: 0;
  transition: opacity .15s;
`;

const GroupedAvatarCol = styled(AvatarCol)`
  &:hover ${HoverTime} { opacity: 1; }
`;

const Body = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: var(--s-2);
  flex-wrap: wrap;
`;

const Author = styled.div`
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-1);
`;

const TimeStamp = styled.div`
  font-size: 11px;
  color: var(--text-4);
`;

const PinTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  color: var(--accent);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  svg { width: 11px; height: 11px; }
`;

const Text = styled.div`
  font-size: 14px;
  line-height: 1.45;
  color: var(--text-1);
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;

  a {
    color: var(--accent);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
`;

const GifMedia = styled.img`
  display: block;
  max-width: 320px;
  max-height: 240px;
  margin-top: 4px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border-1);
`;

const Reactions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
`;

const Pill = styled.button<{ $mine: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  color: ${(p) => (p.$mine ? 'var(--accent)' : 'var(--text-2)')};
  background: ${(p) => (p.$mine ? 'var(--accent-soft)' : 'var(--bg-3)')};
  border: 1px solid ${(p) => (p.$mine ? 'var(--accent)' : 'var(--border-1)')};
  transition: background .12s, border-color .12s;

  &:hover { border-color: var(--accent); }
`;

const Tools = styled.div`
  position: absolute;
  top: -10px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: var(--r-sm);
  box-shadow: var(--shadow-sm);
  opacity: 0;
  pointer-events: none;
  transition: opacity .12s;
  z-index: 2;
`;

const PopAnchor = styled.div`
  position: relative;
`;

const PopoverWrap = styled.div`
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 6px;
  z-index: 50;
`;

const SeenLine = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-4);

  svg { width: 11px; height: 11px; color: var(--success); }
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
      <a key={key++} href={match} target="_blank" rel="noopener noreferrer">{match}</a>,
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

  return (
    <Wrap $grouped={!showAuthor}>
      {showAuthor ? (
        <AvatarCol>
          <Avatar
            $src={message.authorPictureUrl}
            title={`${message.authorName} · ${createdAt.toLocaleString()}`}
          >
            {!message.authorPictureUrl && initial}
          </Avatar>
        </AvatarCol>
      ) : (
        <GroupedAvatarCol>
          <Avatar $src={null} $hidden>{initial}</Avatar>
          <HoverTime>{format(createdAt, 'HH:mm')}</HoverTime>
        </GroupedAvatarCol>
      )}
      <Body>
        {showAuthor && (
          <HeaderRow>
            <Author>{message.authorName}</Author>
            <TimeStamp title={createdAt.toLocaleString()}>
              {timeLabel} · {formatDistanceToNow(createdAt, { addSuffix: true })}
            </TimeStamp>
            {isPinned && (
              <PinTag><IconPin /> Pinned</PinTag>
            )}
          </HeaderRow>
        )}

        {message.text && <Text>{linkify(message.text)}</Text>}

        {message.gif && (
          <GifMedia
            src={message.gif.url}
            alt={message.gif.alt}
            width={message.gif.width}
            height={message.gif.height}
          />
        )}

        {links.slice(0, 2).map((u) => (
          <LinkPreview key={u} url={u} />
        ))}

        {Object.keys(message.reactions).length > 0 && (
          <Reactions>
            {Object.entries(message.reactions).map(([emoji, users]) => {
              const mine = me ? users.includes(me.id) : false;
              return (
                <Pill
                  key={emoji}
                  $mine={mine}
                  type="button"
                  onClick={() => toggleReaction(message.id, emoji)}
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
      </Body>

      <Tools className="row-tools">
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
            <PopoverWrap>
              <EmojiPicker
                onSelect={(e) => {
                  toggleReaction(message.id, e);
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
            onClick={() => (isPinned ? unpinMessage(message.id) : pinMessage(message.id))}
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
              if (window.confirm('Delete this message?')) deleteMessage(message.id);
            }}
            title="Delete message"
          >
            <IconTrash />
          </IconButton>
        )}
      </Tools>
    </Wrap>
  );
};

export default MessageItem;
