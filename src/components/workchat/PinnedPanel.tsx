import React, { useMemo } from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';
import { useWorkChat } from '../../context/WorkChatContext';
import { IconButton } from '../ui/primitives';
import { IconPin, IconX } from '../ui/icons';

interface Props { onClose: () => void }

const Wrap = styled.aside`
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--s-3) var(--s-4);
  background: var(--bg-2);
  border-bottom: 1px solid var(--border-1);
  gap: var(--s-2);
`;

const HeadTitle = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);

  svg { color: var(--accent); }
`;

const List = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: var(--s-2);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
`;

const Item = styled.div`
  padding: var(--s-3);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  position: relative;
`;

const Meta = styled.div`
  display: flex;
  align-items: baseline;
  gap: var(--s-2);
  flex-wrap: wrap;
  margin-bottom: 4px;
`;

const Author = styled.span`
  font-weight: 600;
  font-size: 12.5px;
  color: var(--text-1);
`;

const TimeS = styled.span`
  font-size: 10.5px;
  color: var(--text-4);
`;

const Body = styled.div`
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.4;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Unpin = styled.button`
  margin-top: var(--s-2);
  font-size: 11px;
  color: var(--text-3);
  &:hover { color: var(--danger); }
`;

const Empty = styled.div`
  padding: var(--s-5);
  text-align: center;
  color: var(--text-3);
  font-size: 12.5px;
  line-height: 1.5;
`;

const GifThumb = styled.img`
  display: block;
  max-width: 100%;
  max-height: 120px;
  margin-top: 6px;
  border-radius: var(--r-xs);
  border: 1px solid var(--border-1);
`;

const PinnedPanel: React.FC<Props> = ({ onClose }) => {
  const { activeChannel, messages, unpinMessage, isAdmin } = useWorkChat();

  const pinned = useMemo(() => {
    if (!activeChannel) return [];
    const set = new Set(activeChannel.pinnedMessageIds);
    return messages.filter((m) => set.has(m.id)).sort(
      (a, b) => (b.pinnedAt ?? '').localeCompare(a.pinnedAt ?? ''),
    );
  }, [activeChannel, messages]);

  return (
    <Wrap>
      <Head>
        <HeadTitle>
          <IconPin />
          Pinned {activeChannel ? `· #${activeChannel.name}` : ''}
        </HeadTitle>
        <IconButton type="button" $variant="ghost" $size="sm" onClick={onClose} title="Close">
          <IconX />
        </IconButton>
      </Head>
      <List>
        {pinned.length === 0 ? (
          <Empty>
            No pinned messages yet.
            {isAdmin
              ? ' Hover any message and click the pin icon.'
              : ' Admins can pin important messages.'}
          </Empty>
        ) : (
          pinned.map((m) => (
            <Item key={m.id}>
              <Meta>
                <Author>{m.authorName}</Author>
                <TimeS>{format(new Date(m.createdAt), 'MMM d · HH:mm')}</TimeS>
              </Meta>
              {m.text && <Body>{m.text}</Body>}
              {m.gif && <GifThumb src={m.gif.previewUrl} alt={m.gif.alt} />}
              {isAdmin && (
                <Unpin type="button" onClick={() => unpinMessage(m.id)}>Unpin</Unpin>
              )}
            </Item>
          ))
        )}
      </List>
    </Wrap>
  );
};

export default PinnedPanel;
