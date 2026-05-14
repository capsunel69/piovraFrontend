import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useSearchParams } from 'react-router-dom';
import {
  IconCommentSentinel, IconDashboard, IconSearch, IconNote, IconSpark,
  IconSettings, IconLock, IconRefresh, IconBot, IconImage,
} from '../components/ui/icons';
import { useAuth } from '../context/AuthContext';

const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';

type SectionId =
  | 'home'
  | 'scraper'
  | 'import'
  | 'dashboard'
  | 'explorer'
  | 'entity-report'
  | 'training'
  | 'settings'
  | 'keys';

type IconCmp = React.FC<React.SVGProps<SVGSVGElement> & { size?: number }>;

interface SectionDef {
  id: SectionId;
  label: string;
  icon: IconCmp;
  group: 'overview' | 'collect' | 'analyze' | 'configure';
  hint: string;
  adminOnly?: boolean;
}

const ALL_SECTIONS: SectionDef[] = [
  { id: 'home',          label: 'Home',          icon: IconCommentSentinel, group: 'overview',  hint: 'Welcome & shortcuts' },
  { id: 'scraper',       label: 'Scraper',       icon: IconRefresh,         group: 'collect',   hint: 'Pull comments from social platforms' },
  { id: 'import',        label: 'Import CSV',    icon: IconImage,           group: 'collect',   hint: 'Bulk-import comments from a CSV file' },
  { id: 'dashboard',     label: 'Dashboard',     icon: IconDashboard,       group: 'analyze',   hint: 'Sentiment overview & charts' },
  { id: 'explorer',      label: 'Explorer',      icon: IconSearch,          group: 'analyze',   hint: 'Browse, filter & re-classify comments' },
  { id: 'entity-report', label: 'Entity Report', icon: IconNote,            group: 'analyze',   hint: 'Auto-extract entities, themes & sentiment' },
  { id: 'training',      label: 'AI Training',   icon: IconBot,             group: 'configure', hint: 'Teach the classifier with examples' },
  { id: 'settings',      label: 'Settings',      icon: IconSettings,        group: 'configure', hint: 'Project, categories & defaults' },
  { id: 'keys',          label: 'API Keys',      icon: IconLock,            group: 'configure', hint: 'Per-user keys (OpenAI, ScrapeCreators, Apify)', adminOnly: true },
];

/* ── Layout ───────────────────────────────────────────────────────────── */

const PageWrap = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const HeaderArea = styled.div`
  padding: var(--s-5) var(--s-6) 0;
  background: linear-gradient(180deg, rgba(76, 194, 255, 0.04), transparent 70%);
  border-bottom: 1px solid var(--border-1);

  @media (max-width: 720px) {
    padding: var(--s-3) var(--s-3) 0;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s-4);
  flex-wrap: wrap;
  padding-bottom: var(--s-3);
`;

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const Title = styled.h1`
  font-size: 22px;
  font-weight: 600;
  color: var(--text-1);
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: var(--s-3);

  svg { color: var(--accent); }

  @media (max-width: 720px) {
    font-size: 18px;
    gap: var(--s-2);
  }
`;

const Subtitle = styled.p`
  font-size: 13px;
  color: var(--text-3);
  margin: 0;
`;

const Hint = styled.div`
  font-size: 12px;
  color: var(--text-3);
  padding: 6px 0 10px;
  min-height: 18px;
`;

const TabBar = styled.div`
  display: flex;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
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

const Divider = styled.span`
  display: inline-block;
  width: 1px;
  align-self: center;
  height: 16px;
  background: var(--border-1);
  margin: 0 4px;
`;

const FrameArea = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
`;

const Frame = styled.iframe`
  flex: 1;
  width: 100%;
  min-height: 0;
  border: 0;
  background: var(--bg-0);
`;

/* ── Component ────────────────────────────────────────────────────────── */

const CommentSentinel: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';

  const sections = useMemo<SectionDef[]>(
    () => ALL_SECTIONS.filter((s) => !s.adminOnly || isAdmin),
    [isAdmin],
  );
  const isSection = useCallback(
    (v: string | null): v is SectionId => !!v && sections.some((s) => s.id === v),
    [sections],
  );

  const initialSection: SectionId = isSection(params.get('tab')) ? (params.get('tab') as SectionId) : 'home';
  const [section, setSection] = useState<SectionId>(initialSection);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const src = useMemo(() => {
    const base = '/comment-sentinel/embed.html';
    const qs = new URLSearchParams();
    qs.set('embed', '1');
    qs.set('page', initialSection);
    if (!isAdmin) qs.set('hide', 'keys');
    const pio = PIOVRA_BASE_URL.trim().replace(/\/$/, '');
    if (pio) qs.set('pio', pio);
    return `${base}?${qs.toString()}`;
    // initialSection is intentionally captured once; subsequent navigation
    // uses postMessage so we don't remount the iframe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTab = useCallback((id: SectionId) => {
    setSection(id);
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
    const w = iframeRef.current?.contentWindow;
    if (w) {
      try { w.postMessage({ type: 'cs:navigate', page: id }, '*'); } catch { /* ignore */ }
    }
  }, [params, setParams]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent): void => {
      const d = ev.data as { type?: string; page?: string } | null;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'cs:page' && typeof d.page === 'string' && isSection(d.page) && d.page !== section) {
        setSection(d.page);
        const next = new URLSearchParams(params);
        next.set('tab', d.page);
        setParams(next, { replace: true });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [params, section, setParams, isSection]);

  const currentHint = sections.find((s) => s.id === section)?.hint ?? '';

  return (
    <PageWrap>
      <HeaderArea>
        <HeaderRow>
          <TitleBlock>
            <Title>
              <IconCommentSentinel />
              Comment Sentinel
            </Title>
            <Subtitle>
              Scrape social comments, classify sentiment with AI, extract themes, and generate entity reports.
            </Subtitle>
          </TitleBlock>
        </HeaderRow>

        <TabBar role="tablist" aria-label="Comment Sentinel sections">
          {sections.map((s, i) => {
            const prevGroup = i > 0 ? sections[i - 1].group : s.group;
            const Icon = s.icon;
            return (
              <React.Fragment key={s.id}>
                {prevGroup !== s.group && <Divider aria-hidden="true" />}
                <TabButton
                  role="tab"
                  aria-selected={section === s.id}
                  $active={section === s.id}
                  onClick={() => switchTab(s.id)}
                >
                  <Icon />
                  {s.label}
                </TabButton>
              </React.Fragment>
            );
          })}
        </TabBar>
        <Hint>{currentHint}</Hint>
      </HeaderArea>

      <FrameArea>
        <Frame
          ref={iframeRef}
          title="Comment Sentinel"
          src={src}
        />
      </FrameArea>
    </PageWrap>
  );
};

export default CommentSentinel;

// Suppress unused-icon import (kept here for parity with the sidebar entries).
void IconSpark;
