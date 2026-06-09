import React, { useMemo } from 'react';
import styled from 'styled-components';
import { IconDashboard } from '../components/ui/icons';

const ANALYTICS_UI_URL =
  (import.meta.env.VITE_ANALYTICS_DASHBOARD_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3001/analytics';

const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';

const PageWrap = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const HeaderArea = styled.div`
  padding: var(--s-5) var(--s-6) 0;
  border-bottom: 1px solid var(--border-1);
`;

const Title = styled.h1`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  margin: 0 0 var(--s-2);
  font-size: 22px;
  font-weight: 600;
  color: var(--text-1);

  svg {
    color: var(--accent);
  }
`;

const Subtitle = styled.p`
  margin: 0 0 var(--s-4);
  color: var(--text-3);
  font-size: 13px;
`;

const FrameArea = styled.div`
  flex: 1;
  min-height: 0;
  padding: var(--s-4) var(--s-6) var(--s-6);
`;

const Frame = styled.iframe`
  width: 100%;
  height: 100%;
  border: 1px solid var(--border-1);
  border-radius: var(--radius-lg);
  background: var(--bg-1);
`;

const AnalyticsDashboard: React.FC = () => {
  const src = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set('embed', '1');
    const pio = PIOVRA_BASE_URL.trim().replace(/\/$/, '');
    if (pio) qs.set('pio', pio);
    return `${ANALYTICS_UI_URL}?${qs.toString()}`;
  }, []);

  return (
    <PageWrap>
      <HeaderArea>
        <Title>
          <IconDashboard />
          Analytics Dashboard
        </Title>
        <Subtitle>Cross-platform social analytics — YouTube, TikTok, Facebook, Instagram.</Subtitle>
      </HeaderArea>
      <FrameArea>
        <Frame title="Analytics Dashboard" src={src} />
      </FrameArea>
    </PageWrap>
  );
};

export default AnalyticsDashboard;
