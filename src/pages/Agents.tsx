import React, { useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useSearchParams } from 'react-router-dom';
import {
  PageContainer, PageHeader, PageTitle, PageSubtitle,
} from '../components/ui/primitives';
import { IconBot, IconTerminal, IconClock, IconSettings, IconSend, IconNote, IconSpark, IconChat } from '../components/ui/icons';
import DefinitionsList from '../components/agents/DefinitionsList';
import InstancesList from '../components/agents/InstancesList';
import RunsList from '../components/agents/RunsList';
import JobsList from '../components/agents/JobsList';
import ReportsList from '../components/agents/ReportsList';
import UsagePanel from '../components/agents/UsagePanel';
import WhatsAppPanel from '../components/agents/WhatsAppPanel';
import { useChat } from '../context/ChatContext';

type Tab = 'agents' | 'instances' | 'schedules' | 'reports' | 'runs' | 'usage' | 'whatsapp';

const TABS: {
  id: Tab;
  label: string;
  icon: React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>;
  hint: string;
}[] = [
  { id: 'agents',    label: 'Agents',    icon: IconBot,      hint: 'Definitions — prompts + skills'     },
  { id: 'instances', label: 'Instances', icon: IconSettings, hint: 'Deployed copies of a definition'    },
  { id: 'schedules', label: 'Schedules', icon: IconClock,    hint: 'Cron-driven recurring jobs'         },
  { id: 'reports',   label: 'Reports',   icon: IconNote,     hint: 'Outputs from scheduled agent runs'  },
  { id: 'runs',      label: 'Runs',      icon: IconTerminal, hint: 'Full execution history with steps'  },
  { id: 'usage',     label: 'Usage',     icon: IconSpark,    hint: 'Token consumption + estimated cost per model and instance' },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: IconChat,     hint: 'Pair WhatsApp via QR code so agents can read chats and send replies'    },
];

const isTab = (v: string | null): v is Tab => !!v && TABS.some((t) => t.id === v);

/* ── Layout ────────────────────────────────────────────────────────────── */

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--s-4);
  flex-wrap: wrap;

  @media (max-width: 720px) {
    flex-direction: column;
    align-items: stretch;
    gap: var(--s-3);
  }
`;

const HeaderCard = styled.div`
  width: 100%;
  background: linear-gradient(135deg, rgba(76, 194, 255, 0.06), rgba(164, 120, 255, 0.06));
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  padding: var(--s-5) var(--s-5) 0;
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  overflow: hidden;
  position: relative;

  @media (max-width: 720px) {
    padding: var(--s-4) var(--s-4) 0;
    border-radius: var(--r-md);
    gap: var(--s-3);
  }
`;

const ChatCTA = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 0 0 0 var(--accent-glow);

  svg { width: 14px; height: 14px; }

  &:hover {
    background: var(--accent);
    color: #06121d;
    transform: translateY(-1px);
    box-shadow: 0 6px 18px var(--accent-glow);
  }

  @media (max-width: 720px) {
    width: 100%;
    justify-content: center;
  }
`;

const TabBar = styled.div`
  display: flex;
  gap: 2px;
  margin: 0 calc(-1 * var(--s-5));
  padding: 0 var(--s-5);
  border-bottom: 1px solid var(--border-1);
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  @media (max-width: 720px) {
    margin: 0 calc(-1 * var(--s-4));
    padding: 0 var(--s-4);
  }
`;

const TabButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: transparent;
  border: 0;
  color: ${(p) => (p.$active ? 'var(--text-1)' : 'var(--text-3)')};
  font-size: 13px;
  font-weight: ${(p) => (p.$active ? 600 : 500)};
  cursor: pointer;
  position: relative;
  transition: color 0.15s;
  white-space: nowrap;

  svg {
    width: 15px;
    height: 15px;
    color: ${(p) => (p.$active ? 'var(--accent)' : 'var(--text-4)')};
    transition: color 0.15s;
  }

  &:hover { color: var(--text-1); svg { color: var(--accent); } }

  &::after {
    content: '';
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: -1px;
    height: 2px;
    border-radius: 2px 2px 0 0;
    background: var(--accent);
    box-shadow: 0 0 12px var(--accent-glow);
    opacity: ${(p) => (p.$active ? 1 : 0)};
    transform: scaleX(${(p) => (p.$active ? 1 : 0.4)});
    transition: opacity 0.2s, transform 0.2s;
  }

  @media (max-width: 720px) {
    padding: 11px 12px;
    font-size: 12px;
    gap: 6px;
  }
`;

const TabHint = styled.div`
  font-size: 12px;
  color: var(--text-3);
  padding: 6px 2px 12px;
  min-height: 24px;

  @media (max-width: 720px) {
    font-size: 11px;
    padding-bottom: 10px;
  }
`;

const Agents: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { open: openChat } = useChat();
  const tab: Tab = isTab(params.get('tab')) ? (params.get('tab') as Tab) : 'agents';

  useEffect(() => {
    const raw = params.get('tab');
    if (!raw || !isTab(raw)) {
      const next = new URLSearchParams(params);
      next.set('tab', 'agents');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const switchTab = (id: Tab): void => {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
  };

  const content = useMemo(() => {
    switch (tab) {
      case 'agents':    return <DefinitionsList />;
      case 'instances': return <InstancesList />;
      case 'schedules': return <JobsList />;
      case 'reports':   return <ReportsList />;
      case 'runs':      return <RunsList />;
      case 'usage':     return <UsagePanel />;
      case 'whatsapp':  return <WhatsAppPanel />;
    }
  }, [tab]);

  const currentHint = TABS.find((t) => t.id === tab)?.hint ?? '';

  return (
    <PageContainer>
      <HeaderCard>
        <HeaderRow>
          <div>
            <PageHeader style={{ padding: 0, border: 0 }}>
              <div>
                <PageTitle>
                  <IconBot />
                  Agents hub
                </PageTitle>
                <PageSubtitle>
                  Design agents, deploy instances, schedule cron jobs, and replay past runs.
                  The floating assistant stays open as you move around.
                </PageSubtitle>
              </div>
            </PageHeader>
          </div>
          <ChatCTA type="button" onClick={() => openChat()}>
            <IconSend />
            Open assistant
          </ChatCTA>
        </HeaderRow>

        <TabBar role="tablist" aria-label="Agents sections">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabButton
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                $active={tab === t.id}
                onClick={() => switchTab(t.id)}
              >
                <Icon />
                {t.label}
              </TabButton>
            );
          })}
        </TabBar>
        <TabHint>{currentHint}</TabHint>
      </HeaderCard>

      {content}
    </PageContainer>
  );
};

export default Agents;
