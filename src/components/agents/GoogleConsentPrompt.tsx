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
  color: var(--accent);
  font-weight: 600;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
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
