import { useState } from 'react';
import type { SvgItem } from '../store/svgStore';
import { X, Trash2 } from 'lucide-react';

interface LibraryModalProps {
  items: SvgItem[];
  onClose: () => void;
  onSelect: (item: SvgItem) => void;
  onDelete: (id: string) => void;
}

export default function LibraryModal({ items, onClose, onSelect, onDelete }: LibraryModalProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border border-border shadow-2xl overflow-hidden ring-1 ring-white/5">
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
          <h2 className="text-2xl font-bold tracking-tight">Bibliothèque SVG</h2>
          <button 
            onClick={onClose}
            className="p-2 bg-muted hover:bg-destructive/10 hover:text-destructive rounded-full transition-colors"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12">
              <p>Aucun SVG n'a encoré été ajouté.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {items.map((item) => (
                <div 
                  key={item.id} 
                  className="group relative flex flex-col items-center p-4 rounded-xl border border-border bg-background hover:border-primary/50 transition-all shadow-sm hover:shadow-md cursor-pointer"
                  onClick={() => onSelect(item)}
                >
                  {/* Thumb Preview */}
                  <div 
                    className="w-full aspect-square mb-4 flex items-center justify-center rounded-lg p-2 overflow-hidden checker-bg bg-white/5"
                    dangerouslySetInnerHTML={{ __html: item.cleanedRaw }}
                    style={{
                      '--svg-maxWidth': '100%',
                      '--svg-maxHeight': '100%',
                    } as React.CSSProperties}
                  />

                  <p className="text-sm font-medium w-full truncate text-center mb-1" title={item.name}>
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.lastUpdated).toLocaleDateString()}
                  </p>

                  {deletingId === item.id ? (
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-background/90 p-1 rounded-full shadow-sm backdrop-blur">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                          setDeletingId(null);
                        }}
                        className="px-2 py-1 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full transition-colors"
                      >
                        Confirmer
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(null);
                        }}
                        className="p-1 rounded-full text-muted-foreground hover:bg-muted transition-colors"
                        title="Annuler"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingId(item.id);
                      }}
                      className="absolute top-2 right-2 p-2 bg-background/90 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur shadow-sm"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
