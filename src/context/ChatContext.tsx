import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useOrchestrate, type ChatStatus, type ChatTurn } from '../hooks/useOrchestrate';
import type { OrchestrateUserFile } from '../services/piovra';

interface ChatContextValue {
  turns: ChatTurn[];
  status: ChatStatus;
  send: (input: string, files?: OrchestrateUserFile[]) => Promise<void>;
  abort: () => void;
  reset: () => void;
  isOpen: boolean;
  open: (instanceId?: string) => void;
  close: () => void;
  toggle: () => void;
  instanceId: string | undefined;
  setInstanceId: (id: string | undefined) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [instanceId, setInstanceIdState] = useState<string | undefined>(undefined);
  const { turns, status, send, abort, reset } = useOrchestrate(instanceId);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const setInstanceId = useCallback((id: string | undefined) => {
    setInstanceIdState((prev) => {
      if (prev !== id) reset();
      return id;
    });
  }, [reset]);

  const open = useCallback(
    (id?: string) => {
      if (id !== undefined) setInstanceId(id);
      setIsOpen(true);
    },
    [setInstanceId],
  );
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const value = useMemo<ChatContextValue>(
    () => ({
      turns, status, send, abort, reset,
      isOpen, open, close, toggle,
      instanceId, setInstanceId,
    }),
    [turns, status, send, abort, reset, isOpen, open, close, toggle, instanceId, setInstanceId],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}
