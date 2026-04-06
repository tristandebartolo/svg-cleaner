import { HelpCircle, Info, Trash2, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ModalType = 'info' | 'confirm' | 'danger';

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type: ModalType;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function AlertModal({ 
  isOpen, title, message, type, onConfirm, onCancel, confirmText = "Confirmer", cancelText = "Annuler" 
}: AlertModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return <Trash2 className="w-10 h-10 text-destructive mb-4" />;
      case 'confirm': return <HelpCircle className="w-10 h-10 text-primary mb-4" />;
      default: return <Info className="w-10 h-10 text-blue-500 mb-4" />;
    }
  };

  const getConfirmStyle = () => {
    switch (type) {
      case 'danger': return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
      default: return "bg-primary text-primary-foreground hover:bg-primary/90";
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-background/60 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        onClick={onCancel}
      />
      
      {/* Modal Box */}
      <div 
        className={cn(
          "relative w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl p-6 flex flex-col items-center text-center",
          "animate-in zoom-in-95 duration-200"
        )}
      >
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        {getIcon()}
        
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-8">{message}</p>

        <div className="flex items-center gap-3 w-full">
          {type !== 'info' && (
            <button 
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-border hover:bg-muted font-medium transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button 
            onClick={onConfirm}
            className={cn("flex-1 py-2.5 rounded-xl font-bold transition-all active:scale-95 shadow-lg", getConfirmStyle())}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
