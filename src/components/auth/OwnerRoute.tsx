import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/** Only the WhatsApp-assistant owner may open these routes. */
const OwnerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { me, loading } = useAuth();
  if (loading) return null;
  if (!me?.waAssistant) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default OwnerRoute;
