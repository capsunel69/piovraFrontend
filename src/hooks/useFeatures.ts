import { useAuth } from '../context/AuthContext';

export type SwitchableFeature = 'whatsapp' | 'comment_sentinel' | 'analytics_dashboard';

export function useFeatures() {
  const { hasFeature, disabledFeatures } = useAuth();
  return { hasFeature, disabledFeatures };
}
