import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  PageContainer,
  Input,
  Label,
  Field,
  EmptyState,
} from '../components/ui/primitives';
import { DOC_ARTICLES, articleById, matchesDocSearch, type DocArticle } from '../docs/registry';

const MOBILE_BP = 720;

const Hero = styled.div`
  max-width: 640px;
  margin-bottom: var(--s-6);

  h1 {
    font-size: clamp(1.5rem, 3.5vw, 1.85rem);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text-1);
    margin: 0 0 var(--s-3);
    line-height: 1.2;
  }

  p {
    margin: 0;
    font-size: 15px;
    line-height: 1.6;
    color: var(--text-3);
  }
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  gap: var(--s-6);
  align-items: start;

  @media (max-width: ${MOBILE_BP}px) {
    grid-template-columns: 1fr;
  }
`;

const TopicPanel = styled.aside`
  position: sticky;
  top: var(--s-3);
  max-height: calc(100dvh - var(--topbar-h) - var(--s-8));
  display: flex;
  flex-direction: column;
  border-radius: var(--r-lg);
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.12);
  overflow: hidden;

  @media (max-width: ${MOBILE_BP}px) {
    position: relative;
    max-height: none;
  }
`;

const TopicPanelHeader = styled.div`
  padding: var(--s-4) var(--s-4) var(--s-3);
  background: linear-gradient(180deg, rgba(76, 194, 255, 0.06), transparent);
  border-bottom: 1px solid var(--border-1);
`;

const TopicPanelLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-4);
  margin-bottom: var(--s-2);
`;

const TopicList = styled.div`
  overflow-y: auto;
  padding: var(--s-2);
  flex: 1;
`;

const TopicBtn = styled.button<{ $active: boolean }>`
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  margin-bottom: 4px;
  border: 1px solid ${(p) => (p.$active ? 'var(--accent-soft)' : 'transparent')};
  border-radius: var(--r-md);
  background: ${(p) => (p.$active ? 'var(--bg-3)' : 'transparent')};
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  box-shadow: ${(p) => (p.$active ? '0 0 0 1px var(--accent-soft)' : 'none')};

  &:hover {
    background: var(--bg-3);
    border-color: var(--border-1);
  }

  .cat {
    display: block;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
    margin-bottom: 4px;
    opacity: 0.9;
  }

  .name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-1);
    line-height: 1.35;
  }
`;

const ArticleFrame = styled.article`
  border-radius: var(--r-lg);
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  overflow: hidden;
  max-width: 720px;
`;

const ArticleBanner = styled.div`
  padding: var(--s-5) var(--s-6);
  background: linear-gradient(135deg, rgba(76, 194, 255, 0.08), rgba(164, 120, 255, 0.06));
  border-bottom: 1px solid var(--border-1);

  @media (max-width: ${MOBILE_BP}px) {
    padding: var(--s-4);
  }

  .chip {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
    margin-bottom: var(--s-2);
  }

  h2 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text-1);
    line-height: 1.25;
  }
`;

const Prose = styled.div`
  padding: var(--s-6);
  font-size: 15px;
  color: var(--text-1);
  line-height: 1.7;

  @media (max-width: ${MOBILE_BP}px) {
    padding: var(--s-4);
  }

  h1 {
    font-size: 1.25rem;
    margin: 0 0 var(--s-4);
    letter-spacing: -0.02em;
  }
  h2 {
    font-size: 1.05rem;
    margin: var(--s-6) 0 var(--s-3);
    color: var(--text-1);
    font-weight: 600;
  }
  h3,
  h4 {
    font-size: 1rem;
    margin: var(--s-5) 0 var(--s-2);
    font-weight: 600;
  }
  p {
    margin: 0 0 var(--s-4);
    color: var(--text-2);
  }
  ul,
  ol {
    margin: 0 0 var(--s-4) 1.2rem;
    color: var(--text-2);
  }
  li {
    margin-bottom: 8px;
  }
  li::marker {
    color: var(--accent);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    margin: var(--s-4) 0;
    border-radius: var(--r-sm);
    overflow: hidden;
    border: 1px solid var(--border-1);
  }
  th,
  td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-1);
  }
  tr:last-child td {
    border-bottom: none;
  }
  th {
    background: var(--bg-3);
    color: var(--text-2);
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  td {
    color: var(--text-2);
  }
  code {
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 6px;
    padding: 2px 7px;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--text-1);
  }
  pre {
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: var(--r-md);
    padding: var(--s-4);
    overflow-x: auto;
    font-size: 13px;
    margin: var(--s-4) 0;
  }
  pre code {
    border: none;
    padding: 0;
    background: none;
  }
  hr {
    border: 0;
    border-top: 1px solid var(--border-1);
    margin: var(--s-6) 0;
  }
  a {
    color: var(--accent);
    text-decoration: none;
    font-weight: 500;
    &:hover {
      text-decoration: underline;
    }
  }
  strong {
    color: var(--text-1);
  }
`;

const EmptyPanel = styled.div`
  border-radius: var(--r-lg);
  background: var(--bg-2);
  border: 1px dashed var(--border-2);
  padding: var(--s-7);
  max-width: 720px;
`;

const Documentation: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const articleParam = searchParams.get('article');
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => DOC_ARTICLES.filter((a) => matchesDocSearch(a, search)),
    [search],
  );

  const selected = useMemo((): DocArticle | undefined => {
    const fromUrl = articleById(articleParam);
    if (fromUrl && filtered.some((f) => f.id === fromUrl.id)) return fromUrl;
    if (filtered.length > 0) return filtered[0];
    return undefined;
  }, [articleParam, filtered]);

  useEffect(() => {
    const id = selected?.id;
    if (!id) return;
    if (searchParams.get('article') === id) return;
    setSearchParams({ article: id }, { replace: true });
  }, [selected?.id, searchParams, setSearchParams]);

  const selectArticle = (a: DocArticle): void => {
    setSearchParams({ article: a.id }, { replace: true });
  };

  return (
    <PageContainer>
      <Hero>
        <h1>Help center</h1>
        <p>
          Simple guides for tasks, calendar, notes, the assistant, and more. Use the search to jump to a topic,
          or pick one from the list.
        </p>
      </Hero>

      <Layout>
        <TopicPanel>
          <TopicPanelHeader>
            <TopicPanelLabel>Find a topic</TopicPanelLabel>
            <Field>
              <Label htmlFor="doc-search" style={{ display: 'none' }}>
                Search guides
              </Label>
              <Input
                id="doc-search"
                type="search"
                placeholder="e.g. reminders, email, timer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </Field>
          </TopicPanelHeader>
          <TopicList>
            {filtered.length === 0 ? (
              <EmptyState style={{ padding: 'var(--s-5)', fontSize: '14px' }}>
                Nothing matches. Try a shorter word or clear the search.
              </EmptyState>
            ) : (
              filtered.map((a) => (
                <TopicBtn
                  key={a.id}
                  type="button"
                  $active={selected?.id === a.id}
                  onClick={() => selectArticle(a)}
                >
                  <span className="cat">{a.section}</span>
                  <span className="name">{a.title}</span>
                </TopicBtn>
              ))
            )}
          </TopicList>
        </TopicPanel>

        <div>
          {selected ? (
            <ArticleFrame>
              <ArticleBanner>
                <span className="chip">{selected.section}</span>
                <h2>{selected.title}</h2>
              </ArticleBanner>
              <Prose>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.body}</ReactMarkdown>
              </Prose>
            </ArticleFrame>
          ) : (
            <EmptyPanel>
              <EmptyState style={{ padding: 0 }}>
                No guide matches your search. Clear the box on the left to see everything again.
              </EmptyState>
            </EmptyPanel>
          )}
        </div>
      </Layout>
    </PageContainer>
  );
};

export default Documentation;
