import React, { useState } from 'react';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentStep } from '../../services/piovra';
import { Badge } from '../ui/primitives';

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
`;

const AssistantBubble = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-md);
  padding: 10px 14px;
  color: var(--text-1);
  font-size: 14px;
  line-height: 1.55;
  max-width: 100%;
  overflow-wrap: anywhere;

  p { margin: 0 0 0.65em; }
  p:last-child { margin-bottom: 0; }
  h1, h2, h3, h4 {
    margin: 0.85em 0 0.4em;
    color: var(--text-1);
    line-height: 1.3;
    font-weight: 600;
  }
  h1:first-child, h2:first-child, h3:first-child, h4:first-child { margin-top: 0; }
  h1 { font-size: 16px; }
  h2 { font-size: 15px; }
  h3, h4 { font-size: 14px; }
  ul, ol {
    margin: 0.25em 0 0.65em;
    padding-left: 1.25em;
  }
  li { margin-bottom: 0.3em; }
  li > p { margin: 0; }
  strong { font-weight: 600; color: var(--text-1); }
  em { font-style: italic; }
  blockquote {
    margin: 0.4em 0 0.65em;
    padding: 0 0 0 10px;
    border-left: 2px solid var(--border-2);
    color: var(--text-2);
  }
  hr {
    border: 0;
    border-top: 1px solid var(--border-1);
    margin: 0.75em 0;
  }
  code {
    font-family: var(--font-mono);
    font-size: 0.88em;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 4px;
    padding: 1px 5px;
  }
  pre {
    margin: 0.45em 0 0.65em;
    background: var(--bg-1);
    border: 1px solid var(--border-1);
    border-radius: 8px;
    padding: 10px 12px;
    overflow-x: auto;
  }
  pre code { background: none; border: 0; padding: 0; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    margin: 0.4em 0 0.65em;
  }
  th, td {
    border: 1px solid var(--border-1);
    padding: 4px 8px;
    text-align: left;
  }
  th { color: var(--text-2); font-weight: 600; }
`;

const UserBubble = styled.div`
  align-self: flex-end;
  background: var(--accent-soft);
  color: var(--text-1);
  border-radius: var(--r-md);
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  max-width: 80%;
  word-wrap: break-word;
`;

const ThoughtLine = styled.div`
  color: var(--text-3);
  font-size: 12.5px;
  font-style: italic;
  padding: 2px 6px;
`;

const ToolCard = styled.div`
  border: 1px dashed var(--border-2);
  border-radius: var(--r-sm);
  background: var(--bg-1);
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-2);

  header {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    margin-bottom: 6px;
  }

  header .skill {
    font-family: var(--font-mono);
    color: var(--text-1);
    font-weight: 500;
  }

  pre {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--text-3);
    white-space: pre-wrap;
    word-wrap: break-word;
    max-height: 180px;
    overflow: auto;
  }
`;

const MailPreview = styled.div`
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  border-radius: var(--r-sm);
  padding: 10px 12px;
  margin-bottom: 8px;
  color: var(--text-1);
  font-size: 13.5px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 320px;
  overflow: auto;
`;

const MailMeta = styled.div`
  font-size: 11.5px;
  color: var(--text-3);
  margin-bottom: 6px;
  font-family: var(--font-mono);
`;

const ErrorBanner = styled.div`
  background: var(--danger-soft);
  color: var(--danger);
  border: 1px solid rgba(255, 93, 108, 0.25);
  border-radius: var(--r-sm);
  padding: 8px 12px;
  font-size: 13px;
`;

const Toggle = styled.button`
  background: transparent;
  border: 0;
  color: var(--text-3);
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  margin-left: auto;

  &:hover { color: var(--text-1); }
`;

const URL_RE = /(https?:\/\/[^\s<>"'`]+)/g;

function renderWithLinks(text: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    const start = m.index;
    const url = m[0];
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <a key={`url-${i++}-${start}`} href={url} target="_blank" rel="noopener noreferrer">
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length > 0 ? out : text;
}

const formatJSON = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

/** Surface Gmail content above raw JSON so users actually see the mail. */
function GmailResultPreview({ skill, result }: { skill: string; result: unknown }): React.ReactNode {
  if (result === null || result === undefined || typeof result !== 'object') return null;
  const s = skill.replace(/\./g, '_');
  const o = result as Record<string, unknown>;

  if (s.includes('gmail_messages_list')) {
    const messages = o.messages;
    if (!Array.isArray(messages)) return null;
    if (messages.length === 0) {
      return <MailPreview>No messages matched this search (empty inbox for this filter).</MailPreview>;
    }
    return (
      <>
        {messages.map((row, i) => {
          const m = row as {
            subject?: string | null;
            from?: string | null;
            bodyText?: string | null;
            snippet?: string | null;
            date?: string | null;
          };
          const body = (m.bodyText && m.bodyText.trim()) || (m.snippet && m.snippet.trim()) || '—';
          const sub = m.subject || '(no subject)';
          const from = m.from || '';
          const when = m.date || '';
          return (
            <MailPreview key={i}>
              <MailMeta>
                {from}
                {when ? ` · ${when}` : ''}
              </MailMeta>
              <strong style={{ color: 'var(--text-1)' }}>{sub}</strong>
              {'\n\n'}
              {renderWithLinks(body)}
            </MailPreview>
          );
        })}
      </>
    );
  }

  if (s.includes('gmail_messages_get')) {
    const m = o as {
      subject?: string | null;
      from?: string | null;
      bodyText?: string | null;
      snippet?: string | null;
      date?: string | null;
    };
    const body = (m.bodyText && m.bodyText.trim()) || (m.snippet && m.snippet.trim());
    if (!m.subject && !body) return null;
    return (
      <MailPreview>
        <MailMeta>
          {m.from || ''}
          {m.date ? ` · ${m.date}` : ''}
        </MailMeta>
        <strong style={{ color: 'var(--text-1)' }}>{m.subject || '(no subject)'}</strong>
        {body ? <>{'\n\n'}{renderWithLinks(body)}</> : ''}
      </MailPreview>
    );
  }

  return null;
}

interface StepCardProps {
  step: AgentStep;
}

/**
 * Renders a single AgentStep.
 *
 * Used both for live streaming (in ChatPanel) and for replaying persisted runs
 * (in RunDetail) so the two views stay visually identical.
 */
const StepCard: React.FC<StepCardProps> = ({ step }) => {
  const [expanded, setExpanded] = useState(false);

  switch (step.kind) {
    case 'message':
      if (step.role === 'user') return <UserBubble>{step.content}</UserBubble>;
      return (
        <AssistantBubble>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children, ...props }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                </a>
              ),
            }}
          >
            {step.content ?? ''}
          </ReactMarkdown>
        </AssistantBubble>
      );

    case 'thought':
      return <ThoughtLine>{step.text}</ThoughtLine>;

    case 'tool_call':
      return (
        <ToolCard>
          <header>
            <Badge $variant="accent">call</Badge>
            <span className="skill">{step.skill}</span>
          </header>
          <pre>{formatJSON(step.args)}</pre>
        </ToolCard>
      );

    case 'tool_result': {
      const raw = formatJSON(step.result);
      const long = raw.length > 240;
      const shown = long && !expanded ? raw.slice(0, 240) + '…' : raw;
      const preview = step.skill ? GmailResultPreview({ skill: step.skill, result: step.result }) : null;
      return (
        <ToolCard>
          {preview}
          <header>
            <Badge $variant="success">result</Badge>
            <span className="skill">{step.skill}</span>
            {long ? (
              <Toggle onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'collapse' : 'expand'}
              </Toggle>
            ) : null}
          </header>
          <pre>{shown}</pre>
        </ToolCard>
      );
    }

    case 'error':
      return <ErrorBanner>{step.message}</ErrorBanner>;
  }
};

export default StepCard;
export { Wrap as StepStack };
