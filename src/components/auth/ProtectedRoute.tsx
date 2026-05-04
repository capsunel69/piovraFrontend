import React from 'react';
import { useAuth } from '../../context/AuthContext';
import LoginScreen from './LoginScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return null;
  }
  if (!isAuthenticated) {
    return <LoginScreen />;
  }
  return <>{children}</>;
};

export default ProtectedRoute;
