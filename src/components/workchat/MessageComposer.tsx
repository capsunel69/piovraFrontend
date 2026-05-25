import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { IconButton, Button } from '../ui/primitives';
import { IconSmile, IconGif, IconSend, IconX } from '../ui/icons';
import { useWorkChat } from '../../context/WorkChatContext';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import type { ChatGifAttachment } from '../../types';

const Wrap = styled.div`
  border-top: 1px solid var(--border-1);
  padding: var(--s-3) var(--s-4) var(--s-4);
  background:
    linear-gradient(0deg, rgba(76, 194, 255, 0.03), rgba(76, 194, 255, 0) 70%),
    var(--bg-2);
`;

const Box = styled.form`
  background: var(--bg-1);
  border: 1px solid var(--border-2);
  border-radius: var(--r-md);
  display: flex;
  flex-direction: column;
  transition: border-color .15s, box-shadow .15s;

  &:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
`;

const Textarea = styled.textarea`
  background: transparent;
  border: 0;
  outline: 0;
  resize: none;
  padding: var(--s-3) var(--s-3) 0;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
  min-height: 44px;
  max-height: 180px;

  &::placeholder { color: var(--text-4); }

  @media (max-width: 720px) {
    font-size: 16px;
  }
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  padding: 6px var(--s-2) var(--s-2);
`;

const Spacer = styled.div` flex: 1; `;

const GifChip = styled.div`
  position: relative;
  display: inline-block;
  margin: var(--s-2) 0 0 var(--s-2);
  border-radius: var(--r-sm);
  overflow: hidden;
  border: 1px solid var(--border-2);

  img {
    display: block;
    max-width: 180px;
    max-height: 120px;
  }

  button {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 22px;
    height: 22px;
    background: rgba(0,0,0,0.5);
    border-radius: 999px;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;

    svg { width: 12px; height: 12px; }
  }
`;

const PopAnchor = styled.div`
  position: relative;
`;

const Pop = styled.div`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 60;
`;

const Hint = styled.div`
  font-size: 11px;
  color: var(--text-4);
  margin-right: var(--s-2);
`;

const MessageComposer: React.FC = () => {
  const { activeChannel, send } = useWorkChat();
  const [text, setText] = useState('');
  const [gif, setGif] = useState<ChatGifAttachment | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const gifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText('');
    setGif(null);
    setShowEmoji(false);
    setShowGif(false);
    taRef.current?.focus();
  }, [activeChannel?.id]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showEmoji && emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
      if (showGif && gifRef.current && !gifRef.current.contains(e.target as Node)) {
        setShowGif(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji, showGif]);

  const submit = (e?: React.FormEvent): void => {
    e?.preventDefault();
    if (!activeChannel) return;
    if (!text.trim() && !gif) return;
    send(text, gif ?? undefined);
    setText('');
    setGif(null);
    taRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const insertEmoji = (emoji: string): void => {
    const el = taRef.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + emoji.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const placeholder = activeChannel
    ? `Message #${activeChannel.name}`
    : 'Select a channel to start chatting…';

  return (
    <Wrap>
      <Box onSubmit={submit}>
        <Textarea
          ref={taRef}
          placeholder={placeholder}
          value={text}
          disabled={!activeChannel}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {gif && (
          <GifChip>
            <img src={gif.previewUrl} alt={gif.alt} />
            <button type="button" onClick={() => setGif(null)} aria-label="Remove GIF">
              <IconX />
            </button>
          </GifChip>
        )}
        <Toolbar>
          <PopAnchor ref={emojiRef}>
            <IconButton
              type="button"
              $variant="ghost"
              $size="sm"
              onClick={() => { setShowEmoji((v) => !v); setShowGif(false); }}
              title="Emoji"
              disabled={!activeChannel}
            >
              <IconSmile />
            </IconButton>
            {showEmoji && (
              <Pop>
                <EmojiPicker
                  onSelect={(e) => {
                    insertEmoji(e);
                    setShowEmoji(false);
                  }}
                />
              </Pop>
            )}
          </PopAnchor>
          <PopAnchor ref={gifRef}>
            <IconButton
              type="button"
              $variant="ghost"
              $size="sm"
              onClick={() => { setShowGif((v) => !v); setShowEmoji(false); }}
              title="GIF"
              disabled={!activeChannel}
            >
              <IconGif />
            </IconButton>
            {showGif && (
              <Pop>
                <GifPicker
                  onSelect={(g) => {
                    setGif(g);
                    setShowGif(false);
                  }}
                />
              </Pop>
            )}
          </PopAnchor>
          <Spacer />
          <Hint>Enter to send · Shift+Enter for new line</Hint>
          <Button
            type="submit"
            $variant="primary"
            $size="sm"
            disabled={!activeChannel || (!text.trim() && !gif)}
          >
            <IconSend /> Send
          </Button>
        </Toolbar>
      </Box>
    </Wrap>
  );
};

export default MessageComposer;
