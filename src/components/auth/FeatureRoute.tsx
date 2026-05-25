import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { SwitchableFeature } from '../../hooks/useFeatures';

interface Props {
  feature: SwitchableFeature;
  children: React.ReactNode;
}

const FeatureRoute: React.FC<Props> = ({ feature, children }) => {
  const { hasFeature, loading } = useAuth();
  if (loading) return null;
  if (!hasFeature(feature)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

export default FeatureRoute;
