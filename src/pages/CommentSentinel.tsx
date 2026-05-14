import React, { useMemo } from 'react';
import styled from 'styled-components';

const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';

const FrameWrap = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Frame = styled.iframe`
  flex: 1;
  width: 100%;
  min-height: 0;
  border: 0;
  background: var(--bg-0);
`;

const CommentSentinel: React.FC = () => {
  const src = useMemo(() => {
    const base = '/comment-sentinel/index.html';
    const pio = PIOVRA_BASE_URL.trim();
    if (!pio) return base;
    return `${base}?pio=${encodeURIComponent(pio.replace(/\/$/, ''))}`;
  }, []);

  return (
    <FrameWrap>
      <Frame title="Comment Sentinel" src={src} />
    </FrameWrap>
  );
};

export default CommentSentinel;
