import React, { useState } from 'react';
import styled from 'styled-components';
import {
  ModalOverlay, ModalCard, Button, Input, Label, Field, Stack,
} from '../ui/primitives';
import { IconHash } from '../ui/icons';
import { useWorkChat } from '../../context/WorkChatContext';
import { useToast } from '../ui/Toast';

interface Props { onClose: () => void }

const Header = styled.div`
  padding: var(--s-4) var(--s-5);
  border-bottom: 1px solid var(--border-1);
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-weight: 600;
  color: var(--text-1);

  svg { color: var(--accent); }
`;

const Body = styled.div`
  padding: var(--s-5);
`;

const Footer = styled.div`
  padding: var(--s-3) var(--s-5) var(--s-4);
  border-top: 1px solid var(--border-1);
  display: flex;
  justify-content: flex-end;
  gap: var(--s-2);
`;

const Hint = styled.div`
  font-size: 11.5px;
  color: var(--text-3);
  margin-top: 4px;
`;

const CreateChannelDialog: React.FC<Props> = ({ onClose }) => {
  const { createChannel } = useWorkChat();
  const toast = useToast();
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = (): void => {
    setBusy(true);
    try {
      createChannel({ name, topic });
      toast.success('Channel created', `#${name.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create channel');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalOverlay onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <ModalCard onMouseDown={(e) => e.stopPropagation()}>
        <Header><IconHash /> New channel</Header>
        <Body>
          <Stack $gap={3}>
            <Field>
              <Label>Name</Label>
              <Input
                autoFocus
                placeholder="e.g. design-reviews"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) submit(); }}
              />
              <Hint>Lowercase letters, numbers and hyphens. We'll clean it up for you.</Hint>
            </Field>
            <Field>
              <Label>Topic (optional)</Label>
              <Input
                placeholder="What's this channel about?"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </Field>
          </Stack>
        </Body>
        <Footer>
          <Button type="button" $variant="ghost" $size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            $variant="primary"
            $size="sm"
            disabled={busy || !name.trim()}
            onClick={submit}
          >
            Create channel
          </Button>
        </Footer>
      </ModalCard>
    </ModalOverlay>
  );
};

export default CreateChannelDialog;
