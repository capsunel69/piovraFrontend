import { useAuth } from '../context/AuthContext';

export type SwitchableFeature = 'whatsapp' | 'comment_sentinel' | 'analytics';

export function useFeatures() {
  const { hasFeature, disabledFeatures } = useAuth();
  return { hasFeature, disabledFeatures };
}
