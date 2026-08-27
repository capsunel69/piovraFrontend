import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import ChatSurface from '../components/chat/ChatSurface';
import { useChat } from '../context/ChatContext';

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, var(--bg-1), var(--bg-2));
  border-left: 1px solid var(--border-1);
  overflow: hidden;
`;

/**
 * Fullscreen Piovra assistant. Shares the exact same conversation as the
 * floating chat widget (both consume ChatContext), so expanding mid-chat
 * keeps every turn, attachment and its extracted content.
 */
const Assistant: React.FC = () => {
  const navigate = useNavigate();
  const { open } = useChat();

  const collapse = (): void => {
    navigate(-1);
    open();
  };

  return (
    <Shell>
      <ChatSurface variant="page" active onCollapse={collapse} />
    </Shell>
  );
};

export default Assistant;
