import styled from 'styled-components';
import { consentLabelForScopes, type NeedsConsentInfo } from '../../services/piovra';

const Banner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: var(--r-sm);
  background: rgba(255, 90, 90, 0.08);
  border: 1px solid rgba(255, 90, 90, 0.25);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-1);
  max-width: 100%;
`;

const Link = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  padding: 8px 14px;
  border-radius: var(--r-sm);
  background: var(--accent);
  color: #06121d;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    filter: brightness(1.06);
  }
`;

interface GoogleConsentPromptProps {
  consent: NeedsConsentInfo;
}

export default function GoogleConsentPrompt({ consent }: GoogleConsentPromptProps) {
  const label = consentLabelForScopes(consent.missingScopes);
  return (
    <Banner>
      <span>
        <strong>{label} access required.</strong> Connect your Google account to use mail features in
        chat.
      </span>
      <Link href={consent.upgradeUrl}>Connect {label}</Link>
    </Banner>
  );
}
