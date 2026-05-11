import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Input } from '../ui/primitives';

interface Props {
  onSelect: (emoji: string) => void;
}

/** Compact curated emoji set. Grouped for fast scanning. */
const GROUPS: Array<{ name: string; emojis: string[] }> = [
  {
    name: 'Smileys',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇',
      '😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐',
      '🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️',
      '😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳',
    ],
  },
  {
    name: 'Hands',
    emojis: [
      '👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️',
      '✋','🤚','🖐','🖖','👋','🤝','🙏','👏','🙌','💪','🦾','🤲',
    ],
  },
  {
    name: 'Hearts',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞',
      '💓','💗','💖','💘','💝','💟','💌',
    ],
  },
  {
    name: 'Work',
    emojis: [
      '🚀','✨','💡','🔥','⭐','🌟','💯','✅','❌','⚠️','🆗','📌','📍',
      '🔖','🗂','📁','📂','🗒','📝','✏️','📊','📈','📉','💼','💻','📱',
      '⌨️','🖥','🧠','⚙️','🛠','🧪','🔧','🪛','🧰','🔍','🔎','🔒','🔓',
    ],
  },
  {
    name: 'Party',
    emojis: [
      '🎉','🎊','🥂','🍾','🍻','🍕','🍔','🍟','🌮','🍣','🍩','🍪','🍰',
      '🎂','🍓','☕','🍵','🍺','🥤','🧋','🎁','🎈','🏆','🥇','🎯',
    ],
  },
];

const ALL_EMOJIS = GROUPS.flatMap((g) => g.emojis);

const Wrap = styled.div`
  width: 320px;
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
  max-height: 280px;
  overflow-y: auto;
  padding: var(--s-2);
`;

const Group = styled.div`
  margin-bottom: var(--s-3);
  &:last-child { margin-bottom: 0; }
`;

const GroupName = styled.div`
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
  padding: 4px 6px 6px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
`;

const EmojiBtn = styled.button`
  height: 32px;
  font-size: 20px;
  border-radius: var(--r-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .12s;

  &:hover { background: var(--bg-3); }
`;

const EmojiPicker: React.FC<Props> = ({ onSelect }) => {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return null;
    return ALL_EMOJIS.filter(() => true); // emoji-name search is heavy; keep it simple: show all on any term
  }, [q]);

  return (
    <Wrap onMouseDown={(e) => e.preventDefault()}>
      <SearchBox>
        <Input
          autoFocus
          placeholder="Search emoji…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </SearchBox>
      <Scroll>
        {filtered ? (
          <Group>
            <Grid>
              {filtered.map((e, i) => (
                <EmojiBtn key={`${e}-${i}`} type="button" onClick={() => onSelect(e)}>{e}</EmojiBtn>
              ))}
            </Grid>
          </Group>
        ) : (
          GROUPS.map((g) => (
            <Group key={g.name}>
              <GroupName>{g.name}</GroupName>
              <Grid>
                {g.emojis.map((e, i) => (
                  <EmojiBtn key={`${e}-${i}`} type="button" onClick={() => onSelect(e)}>{e}</EmojiBtn>
                ))}
              </Grid>
            </Group>
          ))
        )}
      </Scroll>
    </Wrap>
  );
};

export default EmojiPicker;
