import styled from 'styled-components';
import { useAuth } from '../../context/AuthContext';

const Banner = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 14px;
  padding: 12px 14px;
  border-radius: var(--r-sm);
  background: rgba(76, 194, 255, 0.08);
  border: 1px solid rgba(76, 194, 255, 0.28);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-1);
`;

const Text = styled.div`
  flex: 1 1 200px;
`;

const ConnectBtn = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: var(--r-sm);
  background: var(--accent);
  color: #06121d;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    filter: brightness(1.06);
  }
`;

interface ConnectGmailBannerProps {
  /** Shorter copy for tight layouts (e.g. chat widget). */
  compact?: boolean;
}

export default function ConnectGmailBanner({ compact }: ConnectGmailBannerProps) {
  const { loading, isAuthenticated, gmailConnected, googleGmailUpgradeUrl } = useAuth();

  if (loading || !isAuthenticated || gmailConnected) return null;

  return (
    <Banner>
      <Text>
        {compact ? (
          <>
            <strong>Gmail not connected.</strong> Connect to send mail and load contact suggestions.
          </>
        ) : (
          <>
            <strong>Gmail is not connected yet.</strong> Grant mail access so the assistant can send
            email and you can pull names from recent threads.
          </>
        )}
      </Text>
      <ConnectBtn href={googleGmailUpgradeUrl}>Connect Gmail</ConnectBtn>
    </Banner>
  );
}
