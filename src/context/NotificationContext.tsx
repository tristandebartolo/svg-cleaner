import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import AlertModal, { type ModalType } from '../components/UI/AlertModal';

interface NotificationContextType {
  confirm: (title: string, message: string, type?: ModalType) => Promise<boolean>;
  alert: (title: string, message: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: ModalType;
    resolve?: (value: boolean) => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const confirm = useCallback((title: string, message: string, type: ModalType = 'confirm') => {
    return new Promise<boolean>((resolve) => {
      setModal({
        isOpen: true,
        title,
        message,
        type,
        resolve,
      });
    });
  }, []);

  const alert = useCallback((title: string, message: string) => {
    setModal({
      isOpen: true,
      title,
      message,
      type: 'info',
      resolve: () => {}, // No-op for alert
    });
  }, []);

  const handleConfirm = () => {
    if (modal.resolve) modal.resolve(true);
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    if (modal.resolve) modal.resolve(false);
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <NotificationContext.Provider value={{ confirm, alert }}>
      {children}
      <AlertModal 
        isOpen={modal.isOpen}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotify must be used within a NotificationProvider');
  }
  return context;
}
