import React, { useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/primitives';
import { IconLock, IconSpark } from '../ui/icons';

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 30px rgba(76,194,255,0.25), inset 0 0 0 1px rgba(76,194,255,0.2); }
  50%      { box-shadow: 0 0 60px rgba(76,194,255,0.45), inset 0 0 0 1px rgba(76,194,255,0.4); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Stage = styled.div`
  position: fixed;
  inset: 0;
  background: radial-gradient(1200px 600px at 50% 30%, rgba(76,194,255,0.08), transparent 60%), var(--bg-0);
  display: grid;
  place-items: center;
  padding: var(--s-5);
  overflow: hidden;
  z-index: 1;

  &:before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px) 0 0 / 100% 40px,
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px) 0 0 / 40px 100%;
    pointer-events: none;
  }
`;

const Panel = styled.div`
  position: relative;
  width: 100%;
  max-width: 420px;
  background: linear-gradient(180deg, var(--bg-2), var(--bg-1));
  border: 1px solid var(--border-2);
  border-radius: var(--r-xl);
  padding: var(--s-7);
  animation: ${fadeIn} 0.4s ease-out, ${pulseGlow} 4s ease-in-out infinite;
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: var(--s-3);
  margin-bottom: var(--s-6);
`;

const Logo = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, var(--accent), var(--purple));
  color: #06121d;

  svg { width: 22px; height: 22px; }
`;

const BrandText = styled.div`
  display: flex;
  flex-direction: column;
  line-height: 1.1;

  strong { font-size: 15px; color: var(--text-1); letter-spacing: 0.02em; }
  span { font-size: 11px; color: var(--text-3); font-family: var(--font-mono); margin-top: 4px; }
`;

const Heading = styled.h1`
  font-size: 22px;
  font-weight: 600;
  color: var(--text-1);
  letter-spacing: -0.01em;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: var(--s-2);

  svg { width: 18px; height: 18px; color: var(--accent); }
`;

const Sub = styled.p`
  font-size: 13px;
  color: var(--text-3);
  margin: 0 0 var(--s-5) 0;
`;

const GoogleButton = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-3);
  border: 1px solid var(--border-2);
  border-radius: var(--r-md);
  color: var(--text-1);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: var(--bg-4, rgba(255, 255, 255, 0.04));
    border-color: var(--accent);
  }

  svg { width: 18px; height: 18px; }
`;

const Mono = styled.div`
  margin-top: var(--s-5);
  padding-top: var(--s-4);
  border-top: 1px solid var(--border-1);
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  letter-spacing: 0.04em;

  .dot {
    display: inline-block;
    width: 6px; height: 6px; border-radius: 999px;
    background: var(--success);
    box-shadow: 0 0 8px var(--success);
    margin-right: 6px;
  }
`;

const LoginScreen: React.FC = () => {
  const { googleSignInUrl } = useAuth();

  useEffect(() => {
    document.title = 'Piovra · Sign in';
  }, []);

  return (
    <Stage>
      <Panel>
        <Brand>
          <Logo><IconSpark /></Logo>
          <BrandText>
            <strong>Piovra</strong>
            <span>workspace</span>
          </BrandText>
        </Brand>

        <Heading><IconLock /> Sign in</Heading>
        <Sub>Sign in with your Google account to access the workspace.</Sub>

        <GoogleButton href={googleSignInUrl}>
          <GoogleIcon />
          Continue with Google
        </GoogleButton>

        <Mono>
          <span><span className="dot" />SECURE LINK</span>
          <span>v2.0 · piovra</span>
        </Mono>
      </Panel>
    </Stage>
  );
};

const GoogleIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.32v2.77h3.55c2.08-1.92 3.29-4.74 3.29-8.1Z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.55-2.77c-.99.66-2.25 1.05-3.73 1.05-2.87 0-5.3-1.94-6.16-4.55H2.18v2.86A11 11 0 0 0 12 23Z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.08A6.6 6.6 0 0 1 5.5 12c0-.72.13-1.42.34-2.08V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.86Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.07 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.86C6.7 7.32 9.13 5.38 12 5.38Z"
    />
  </svg>
);

// Stop unused-import warning if we ever need Button elsewhere.
export { Button };

export default LoginScreen;
