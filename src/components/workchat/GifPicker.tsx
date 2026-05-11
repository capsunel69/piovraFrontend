import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Input, Spinner } from '../ui/primitives';
import { searchGifs, gifSearchEnabled } from '../../services/chat';
import type { ChatGifAttachment } from '../../types';

interface Props {
  onSelect: (gif: ChatGifAttachment) => void;
}

const Wrap = styled.div`
  width: 360px;
  max-width: 90vw;
  background: var(--bg-2);
  border: 1px solid var(--border-2);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SearchBox = styled.div`
  padding: var(--s-2);
  border-bottom: 1px solid var(--border-1);
`;

const Scroll = styled.div`
  max-height: 360px;
  overflow-y: auto;
  padding: var(--s-2);
`;

const Grid = styled.div`
  column-count: 2;
  column-gap: var(--s-2);
`;

const GifTile = styled.button`
  display: block;
  width: 100%;
  margin: 0 0 var(--s-2);
  padding: 0;
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--bg-3);
  break-inside: avoid;

  img {
    display: block;
    width: 100%;
    height: auto;
    transition: transform .15s;
  }

  &:hover img { transform: scale(1.02); }
`;

const Hint = styled.div`
  padding: var(--s-4);
  font-size: 12.5px;
  color: var(--text-3);
  text-align: center;
  line-height: 1.55;
`;

const Footer = styled.div`
  font-size: 10.5px;
  color: var(--text-4);
  padding: 6px var(--s-3);
  border-top: 1px solid var(--border-1);
  text-align: right;
`;

const LoaderBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--s-5);
`;

const GifPicker: React.FC<Props> = ({ onSelect }) => {
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState<ChatGifAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const enabled = useMemo(() => gifSearchEnabled, []);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await searchGifs(q, 24);
        setGifs(r);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to search GIFs');
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [q, enabled]);

  return (
    <Wrap onMouseDown={(e) => e.preventDefault()}>
      <SearchBox>
        <Input
          autoFocus
          placeholder={enabled ? 'Search Tenor GIFs…' : 'GIFs unavailable'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={!enabled}
        />
      </SearchBox>
      <Scroll>
        {!enabled ? (
          <Hint>
            GIF search needs a Tenor API key.<br />
            Set <code>VITE_TENOR_API_KEY</code> in your <code>.env</code> to enable it.
          </Hint>
        ) : err ? (
          <Hint>{err}</Hint>
        ) : loading ? (
          <LoaderBox><Spinner /></LoaderBox>
        ) : gifs.length === 0 ? (
          <Hint>No GIFs found.</Hint>
        ) : (
          <Grid>
            {gifs.map((g) => (
              <GifTile key={g.previewUrl} type="button" title={g.alt} onClick={() => onSelect(g)}>
                <img src={g.previewUrl} alt={g.alt} loading="lazy" />
              </GifTile>
            ))}
          </Grid>
        )}
      </Scroll>
      {enabled && <Footer>Powered by Tenor</Footer>}
    </Wrap>
  );
};

export default GifPicker;
