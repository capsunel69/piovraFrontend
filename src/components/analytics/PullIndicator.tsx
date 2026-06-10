import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { useToast } from '../ui/Toast';
import { useAnalyticsPull } from '../../stores/analyticsPull';
import { Spinner } from '../ui/primitives';

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

/**
 * Styled to match Toast items (same position, accent bar, shadow) so it reads
 * as a persistent "in progress" toast at the top right.
 */
const ToastPill = styled.button`
  position: fixed;
  top: calc(var(--topbar-h, 56px) + 12px);
  right: 16px;
  z-index: 9998;
  min-width: 280px;
  max-width: 380px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--r-md);
  border: 1px solid var(--border-2);
  background: linear-gradient(180deg, var(--bg-3), var(--bg-2));
  color: var(--text-1);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  animation: ${slideIn} 180ms ease-out;
  transition: border-color 0.15s;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--accent);
    box-shadow: 0 0 12px var(--accent);
  }

  &:hover { border-color: var(--accent); }

  .sub {
    display: block;
    font-size: 12px;
    font-weight: 400;
    color: var(--text-3);
    margin-top: 2px;
  }

  @media (max-width: 720px) {
    left: 12px;
    right: 12px;
    max-width: none;
  }
`;

/**
 * Global indicator that an analytics pull is still running. Mounted at the
 * layout level so it stays visible when the user navigates away from the
 * Analytics page; clicking it brings them back. Also fires a toast when the
 * pull finishes (success or error), wherever the user is.
 */
export const AnalyticsPullIndicator: React.FC = () => {
  const { status, error, completionId } = useAnalyticsPull();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const lastCompletion = useRef(completionId);

  useEffect(() => {
    if (completionId === lastCompletion.current) return;
    lastCompletion.current = completionId;
    if (status === 'done') {
      toast.success('Analytics data ready', 'All tabs are up to date.');
    } else if (status === 'error') {
      toast.error('Analytics pull failed', error ?? undefined);
    }
  }, [completionId, status, error, toast]);

  const onAnalyticsPage = location.pathname.startsWith('/analytics');
  if (status !== 'pulling' || onAnalyticsPage) return null;

  return (
    <ToastPill onClick={() => navigate('/analytics')} title="Back to Analytics">
      <Spinner $size={16} />
      <span>
        Gathering analytics data…
        <span className="sub">Still running in the background — click to return.</span>
      </span>
    </ToastPill>
  );
};
