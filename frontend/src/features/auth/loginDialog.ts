import { createContext, useContext } from 'react';

// Lets any page open the login card rendered by LoginDialogProvider.
export const LoginDialogContext = createContext<{ open: () => void } | null>(
  null,
);

export function useLoginDialog() {
  const context = useContext(LoginDialogContext);
  if (!context) {
    throw new Error('useLoginDialog must be used inside LoginDialogProvider');
  }
  return context;
}
