import { useMemo, useState, type ReactNode } from 'react';
import { LoginDialogContext } from '../loginDialog';
import { LoginDialog } from './LoginDialog';

export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo(() => ({ open: () => setIsOpen(true) }), []);

  return (
    <LoginDialogContext.Provider value={value}>
      {children}
      <LoginDialog open={isOpen} onClose={() => setIsOpen(false)} />
    </LoginDialogContext.Provider>
  );
}
