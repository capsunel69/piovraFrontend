import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  PageContainer,
  PageHeader,
  PageTitle,
  PageSubtitle,
  Card,
  CardBody,
  Input,
  Label,
  Field,
  EmptyState,
} from '../components/ui/primitives';
import { DOC_ARTICLES, articleById, matchesDocSearch, type DocArticle } from '../docs/registry';

const MOBILE_BP = 720;

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: var(--s-5);
  align-items: start;

  @media (max-width: ${MOBILE_BP}px) {
    grid-template-columns: 1fr;
  }
`;

const Sidebar = styled(Card)`
  position: sticky;
  top: var(--s-3);
  max-height: calc(100dvh - var(--topbar-h) - var(--s-8));
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (max-width: ${MOBILE_BP}px) {
    position: relative;
    max-height: none;
  }
`;

const SearchField = styled.div`
  padding: var(--s-4) var(--s-4) var(--s-3);
  border-bottom: 1px solid var(--border-1);
`;

const ArticleList = styled.div`
  overflow-y: auto;
  padding: var(--s-2);
  flex: 1;
`;

const ArticleButton = styled.button<{ $active: boolean }>`
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  margin-bottom: 2px;
  border: none;
  border-radius: var(--r-sm);
  background: ${(p) => (p.$active ? 'var(--bg-3)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--text-1)' : 'var(--text-2)')};
  cursor: pointer;
  font-size: 13px;
  transition: background 0.12s, color 0.12s;

  &:hover {
    background: var(--bg-3);
    color: var(--text-1);
  }

  .sec {
    display: block;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-4);
    margin-bottom: 2px;
  }

  .ttl {
    font-weight: 500;
    color: var(--text-1);
  }
`;

const Prose = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-lg);
  padding: var(--s-6);
  font-size: 14px;
  color: var(--text-1);
  line-height: 1.65;
  max-width: 880px;

  @media (max-width: ${MOBILE_BP}px) {
    padding: var(--s-4);
  }

  h1 {
    font-size: 1.35rem;
    margin: 0 0 var(--s-4);
    letter-spacing: -0.02em;
  }
  h2 {
    font-size: 1.1rem;
    margin: var(--s-5) 0 var(--s-3);
    color: var(--text-1);
  }
  h3,
  h4 {
    font-size: 1rem;
    margin: var(--s-4) 0 var(--s-2);
  }
  p {
    margin: 0 0 var(--s-3);
  }
  ul,
  ol {
    margin: 0 0 var(--s-3) 1.25rem;
  }
  li {
    margin-bottom: 6px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin: var(--s-3) 0;
  }
  th,
  td {
    border: 1px solid var(--border-1);
    padding: 8px 10px;
    text-align: left;
  }
  th {
    background: var(--bg-3);
    color: var(--text-2);
    font-weight: 600;
  }
  code {
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 6px;
    padding: 1px 6px;
    font-family: var(--font-mono);
    font-size: 12.5px;
  }
  pre {
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: var(--r-sm);
    padding: var(--s-3) var(--s-4);
    overflow-x: auto;
    font-size: 12.5px;
  }
  hr {
    border: 0;
    border-top: 1px solid var(--border-1);
    margin: var(--s-5) 0;
  }
  a {
    color: var(--accent);
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }
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
      <PageHeader>
        <div>
          <PageTitle>Documentation</PageTitle>
          <PageSubtitle>
            How Capsuna and Piovra fit together. Articles live in{' '}
            <code style={{ fontSize: '12px' }}>src/docs/articles</code> — register each file in{' '}
            <code style={{ fontSize: '12px' }}>src/docs/registry.ts</code>. Share a deep link with{' '}
            <code style={{ fontSize: '12px' }}>?article=tasks</code> (see article ids in the registry).
          </PageSubtitle>
        </div>
      </PageHeader>

      <Layout>
        <Sidebar>
          <SearchField>
            <Field>
              <Label htmlFor="doc-search">Search</Label>
              <Input
                id="doc-search"
                type="search"
                placeholder="Filter by title, section, or any word…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </Field>
          </SearchField>
          <ArticleList>
            {filtered.length === 0 ? (
              <EmptyState style={{ padding: 'var(--s-5)' }}>No articles match this search.</EmptyState>
            ) : (
              filtered.map((a) => (
                <ArticleButton
                  key={a.id}
                  type="button"
                  $active={selected?.id === a.id}
                  onClick={() => selectArticle(a)}
                >
                  <span className="sec">{a.section}</span>
                  <span className="ttl">{a.title}</span>
                </ArticleButton>
              ))
            )}
          </ArticleList>
        </Sidebar>

        <div>
          {selected ? (
            <Prose key={selected.id}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.body}</ReactMarkdown>
            </Prose>
          ) : (
            <Card>
              <CardBody>
                <EmptyState>No article matches this search — clear the filter to see docs again.</EmptyState>
              </CardBody>
            </Card>
          )}
        </div>
      </Layout>
    </PageContainer>
  );
};

export default Documentation;
