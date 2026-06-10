import React from 'react';
import styled from 'styled-components';

const Wrap = styled.span`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid var(--border-2);
  background: var(--bg-3);
  color: var(--text-3);
  font-size: 11px;
  font-weight: 700;
  cursor: help;
  user-select: none;
  flex-shrink: 0;

  &:hover { color: var(--text-1); border-color: var(--border-3); }

  .tip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) translateY(4px);
    width: max-content;
    max-width: 280px;
    padding: 8px 10px;
    border-radius: var(--r-md);
    background: var(--bg-4);
    border: 1px solid var(--border-2);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    color: var(--text-1);
    font-size: 12px;
    font-weight: 400;
    line-height: 1.45;
    text-align: left;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.12s, transform 0.12s;
    z-index: 100;
  }

  &:hover .tip, &:focus-visible .tip {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
`;

/** Small "?" badge that reveals a tooltip on hover/focus. */
export const InfoTip: React.FC<{ text: React.ReactNode }> = ({ text }) => (
  <Wrap tabIndex={0} role="note" aria-label={typeof text === 'string' ? text : undefined}>
    ?
    <span className="tip">{text}</span>
  </Wrap>
);
