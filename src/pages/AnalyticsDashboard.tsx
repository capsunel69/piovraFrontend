import React from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { PageContainer, PageHeader, PageTitle, PageSubtitle } from '../components/ui/primitives';
import { IconDashboard } from '../components/ui/icons';
import LoadingState from '../components/shared/LoadingState';
import ErrorMessage from '../components/shared/ErrorMessage';
import { AdWorkspaceProvider, useAdWorkspace } from '../context/AdWorkspaceContext';
import { AdLayout, AdMain, AdNavBtn, AdSideNav } from '../components/analytics/AdShared';
import OverviewTab from '../components/analytics/OverviewTab';
import MasterTab from '../components/analytics/MasterTab';
import PlatformTab from '../components/analytics/PlatformTab';
import SettingsTab from '../components/analytics/SettingsTab';
import UsageTab from '../components/analytics/UsageTab';
import LogsTab from '../components/analytics/LogsTab';
type AdTab =
  | 'overview'
  | 'master'
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'settings'
  | 'usage'
  | 'logs';

const NAV: { id: AdTab; label: string; section?: 'dash' | 'platform' | 'settings' }[] = [
  { id: 'overview', label: 'Overview', section: 'dash' },
  { id: 'master', label: 'Master Overview', section: 'dash' },
  { id: 'youtube', label: 'YouTube', section: 'platform' },
  { id: 'facebook', label: 'Facebook', section: 'platform' },
  { id: 'instagram', label: 'Instagram', section: 'platform' },
  { id: 'tiktok', label: 'TikTok', section: 'platform' },
  { id: 'settings', label: 'Settings', section: 'settings' },
  { id: 'usage', label: 'API Usage', section: 'settings' },
  { id: 'logs', label: 'Logs', section: 'settings' },
];

const NavSection = styled.div`
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-3);
  padding: 8px 12px 4px;
`;

const AnalyticsBody: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as AdTab | null) ?? 'overview';
  const { loading, error, refresh, projects, activeProjectId } = useAdWorkspace();

  const setTab = (next: AdTab) => setParams(next === 'overview' ? {} : { tab: next });

  if (loading && projects.length === 0 && !error) {
    return <LoadingState message="Loading workspace…" />;
  }

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <PageTitle>
            <IconDashboard />
            Analytics
          </PageTitle>
          <PageSubtitle>
            {activeProject ? `Project: ${activeProject.name}` : 'Social analytics'} — YouTube, TikTok, Facebook, Instagram
          </PageSubtitle>
        </div>
      </PageHeader>

      {error && <ErrorMessage message={error} onRetry={() => void refresh()} />}

      <AdLayout>
        <AdSideNav>
          <NavSection>Dashboard</NavSection>
          {NAV.filter((n) => n.section === 'dash').map((n) => (
            <AdNavBtn key={n.id} type="button" $active={tab === n.id} onClick={() => setTab(n.id)}>
              {n.label}
            </AdNavBtn>
          ))}
          <NavSection>Platforms</NavSection>
          {NAV.filter((n) => n.section === 'platform').map((n) => (
            <AdNavBtn key={n.id} type="button" $active={tab === n.id} onClick={() => setTab(n.id)}>
              {n.label}
            </AdNavBtn>
          ))}
          <NavSection>Settings</NavSection>
          {NAV.filter((n) => n.section === 'settings').map((n) => (
            <AdNavBtn key={n.id} type="button" $active={tab === n.id} onClick={() => setTab(n.id)}>
              {n.label}
            </AdNavBtn>
          ))}
        </AdSideNav>

        <AdMain>
          {tab === 'overview' && <OverviewTab />}
          {tab === 'master' && <MasterTab />}
          {tab === 'youtube' && <PlatformTab platform="youtube" />}
          {tab === 'facebook' && <PlatformTab platform="facebook" />}
          {tab === 'instagram' && <PlatformTab platform="instagram" />}
          {tab === 'tiktok' && <PlatformTab platform="tiktok" />}
          {tab === 'settings' && <SettingsTab />}
          {tab === 'usage' && <UsageTab />}
          {tab === 'logs' && <LogsTab />}
        </AdMain>
      </AdLayout>
    </PageContainer>
  );
};

const AnalyticsDashboard: React.FC = () => (
  <AdWorkspaceProvider>
    <AnalyticsBody />
  </AdWorkspaceProvider>
);

export default AnalyticsDashboard;
