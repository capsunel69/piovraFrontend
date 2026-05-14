import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { WorkChatProvider } from './context/WorkChatContext';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Meetings from './pages/Meetings';
import Reminders from './pages/Reminders';
import Notes from './pages/Notes';
import Contacts from './pages/Contacts';
import Agents from './pages/Agents';
import Admin from './pages/Admin';
import Chat from './pages/Chat';
import Documentation from './pages/Documentation';
import CommentSentinel from './pages/CommentSentinel';
import Timer from './components/timer/Timer';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { ToastProvider } from './components/ui/Toast';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppProvider>
          <ChatProvider>
            <WorkChatProvider>
              <Router>
                <ProtectedRoute>
                  <Layout>
                    <Timer />
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/tasks" element={<Tasks />} />
                      <Route path="/meetings" element={<Meetings />} />
                      <Route path="/reminders" element={<Reminders />} />
                      <Route path="/notes" element={<Notes />} />
                      <Route path="/contacts" element={<Contacts />} />
                      <Route path="/comment-sentinel" element={<CommentSentinel />} />
                      <Route path="/agents" element={<Agents />} />
                      <Route path="/chat" element={<Chat />} />
                      <Route path="/admin" element={<Admin />} />
                      <Route path="/docs" element={<Documentation />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              </Router>
            </WorkChatProvider>
          </ChatProvider>
        </AppProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
