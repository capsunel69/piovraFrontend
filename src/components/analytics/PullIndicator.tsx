import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { useToast } from '../ui/Toast';
import { useAnalyticsPull } from '../../stores/analyticsPull';
import { Spinner } from '../ui/primitives';

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Pill = styled.button`
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9998;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid var(--border-2);
  background: linear-gradient(180deg, var(--bg-3), var(--bg-2));
  color: var(--text-1);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  animation: ${slideUp} 200ms ease-out;
  transition: border-color 0.15s;

  &:hover { border-color: var(--accent); }
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
    <Pill onClick={() => navigate('/analytics')} title="Back to Analytics">
      <Spinner $size={16} />
      Gathering analytics data…
    </Pill>
  );
};
