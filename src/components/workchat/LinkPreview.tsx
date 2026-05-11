import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { fetchLinkPreview } from '../../services/chat';
import type { LinkPreviewData } from '../../types';

interface Props { url: string }

const Card = styled.a`
  display: flex;
  gap: var(--s-3);
  margin-top: 6px;
  padding: var(--s-3);
  background: var(--bg-3);
  border: 1px solid var(--border-1);
  border-left: 3px solid var(--accent);
  border-radius: var(--r-sm);
  text-decoration: none;
  color: inherit;
  max-width: 480px;
  transition: background .15s, border-color .15s;

  &:hover {
    background: var(--bg-4);
    border-color: var(--border-2);
    border-left-color: var(--accent);
  }
`;

const Thumb = styled.div<{ $src: string }>`
  width: 84px;
  height: 84px;
  flex-shrink: 0;
  background: url(${(p) => p.$src}) center/cover no-repeat, var(--bg-4);
  border-radius: var(--r-xs);
`;

const Text = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
`;

const Site = styled.div`
  font-size: 10.5px;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
`;

const Title = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const Desc = styled.div`
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

function safeHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

const LinkPreview: React.FC<Props> = ({ url }) => {
  const [data, setData] = useState<LinkPreviewData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const d = await fetchLinkPreview(url);
      if (!cancelled) setData(d);
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (!data || data.failed) return null;
  if (!data.title && !data.description && !data.image) return null;

  return (
    <Card href={url} target="_blank" rel="noopener noreferrer">
      {data.image && <Thumb $src={data.image} />}
      <Text>
        <Site>{data.siteName ?? safeHostname(url)}</Site>
        {data.title && <Title>{data.title}</Title>}
        {data.description && <Desc>{data.description}</Desc>}
      </Text>
    </Card>
  );
};

export default LinkPreview;
