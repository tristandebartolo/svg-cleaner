import { useState } from 'react';
import { UploadCloud, FileType } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DropzoneAreaProps {
  onFileDrop: (file: File) => void;
}

export default function DropzoneArea({ onFileDrop }: DropzoneAreaProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
        onFileDrop(file);
      } else {
        alert('Seuls les fichiers SVG sont acceptés.');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
        onFileDrop(file);
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center p-12 text-center rounded-2xl border-2 border-dashed transition-all duration-300 bg-card/40 backdrop-blur shadow-sm",
        isDragActive ? "border-primary bg-primary/10 shadow-primary/20 scale-[1.02]" : "border-border hover:border-primary/50 hover:bg-card/80"
      )}
    >
      <div className="bg-primary/20 p-4 rounded-full mb-6 text-primary shadow-inner">
        {isDragActive ? <FileType className="w-10 h-10 animate-bounce" /> : <UploadCloud className="w-10 h-10" />}
      </div>
      
      <h3 className="text-xl font-semibold mb-2">
        {isDragActive ? "Lâchez le fichier ici..." : "Glissez et déposez un SVG ici"}
      </h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-[300px]">
        Le fichier sera instantanément pris en charge sans être envoyé à aucun back-end.
      </p>

      <label className="relative cursor-pointer bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 transition-colors shadow-lg active:scale-95">
        OU PARCOURIR
        <input
          type="file"
          accept=".svg, image/svg+xml"
          className="hidden"
          onChange={handleFileSelect}
        />
      </label>
    </div>
  );
}
