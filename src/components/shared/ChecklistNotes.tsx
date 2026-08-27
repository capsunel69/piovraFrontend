import React from 'react';
import styled from 'styled-components';
import LinkifyText from './LinkifyText';
import { Checkbox } from '../ui/primitives';

const CHECK_RE = /^(\s*)(?:[-*]|\d+\.)\s+\[([ xX])\]\s?(.*)$/;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Item = styled.div<{ $depth: number; $done: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-left: ${(p) => p.$depth * 14}px;

  .label {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    line-height: 1.45;
    color: ${(p) => (p.$done ? 'var(--text-3)' : 'var(--text-2)')};
    text-decoration: ${(p) => (p.$done ? 'line-through' : 'none')};
  }
`;

const Plain = styled.div`
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
`;

function indentDepth(spaces: string): number {
  return Math.min(6, Math.floor(spaces.replace(/\t/g, '  ').length / 2));
}

export function hasMarkdownChecklist(text: string): boolean {
  return text.split('\n').some((line) => CHECK_RE.test(line));
}

function toggleLine(text: string, lineIndex: number): string {
  const lines = text.split('\n');
  const line = lines[lineIndex];
  if (line == null) return text;
  lines[lineIndex] = line.replace(/\[([ xX])\]/, (_, mark: string) =>
    mark.trim() ? '[ ]' : '[x]',
  );
  return lines.join('\n');
}

interface ChecklistNotesProps {
  text: string;
  onChange: (next: string) => void;
}

const ChecklistNotes: React.FC<ChecklistNotesProps> = ({ text, onChange }) => {
  if (!hasMarkdownChecklist(text)) {
    return (
      <Plain>
        <LinkifyText text={text} />
      </Plain>
    );
  }

  const lines = text.split('\n');

  return (
    <Wrap>
      {lines.map((line, i) => {
        const match = line.match(CHECK_RE);
        if (!match) {
          if (!line.trim()) return null;
          return (
            <Plain key={i}>
              <LinkifyText text={line} />
            </Plain>
          );
        }
        const done = match[2].trim().length > 0;
        return (
          <Item key={i} $depth={indentDepth(match[1])} $done={done}>
            <Checkbox
              type="button"
              $checked={done}
              aria-label={done ? `Uncheck ${match[3]}` : `Check ${match[3]}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(toggleLine(text, i));
              }}
              style={{ width: 15, height: 15, minWidth: 15, marginTop: 2 }}
            />
            <span className="label">
              <LinkifyText text={match[3]} />
            </span>
          </Item>
        );
      })}
    </Wrap>
  );
};

export default ChecklistNotes;
