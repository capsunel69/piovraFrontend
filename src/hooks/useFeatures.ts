import { useAuth } from '../context/AuthContext';

export type SwitchableFeature = 'comment_sentinel' | 'analytics' | 'transcribe';

export function useFeatures() {
  const { hasFeature, disabledFeatures } = useAuth();
  return { hasFeature, disabledFeatures };
}
