import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export default function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <label 
      className={cn(
        "flex items-start gap-3 cursor-pointer group select-none",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="relative inline-flex items-center pt-0.5">
        <input 
          type="checkbox" 
          className="sr-only" 
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        
        {/* Track */}
        <div 
          className={cn(
            "w-9 h-5 rounded-full transition-all duration-300 ease-in-out",
            checked ? "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]" : "bg-muted-foreground/30",
            "group-hover:ring-4 group-hover:ring-primary/10"
          )}
        />
        
        {/* Thumb */}
        <div 
          className={cn(
            "absolute left-0.5 top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ease-in-out shadow-sm",
            checked ? "translate-x-4 scale-110" : "translate-x-0"
          )}
        />
      </div>

      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-medium leading-tight">{label}</span>}
          {description && <span className="text-[10px] text-muted-foreground mt-0.5">{description}</span>}
        </div>
      )}
    </label>
  );
}
