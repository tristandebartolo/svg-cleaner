import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { type SvgItem, svgStore } from './store/svgStore';
import { cleanSvgString } from './utils/svgCleaner';
import EditorLayout from './components/Editor/EditorLayout';
import DropzoneArea from './components/DropzoneArea';
import LibraryModal from './components/LibraryModal';
import { ThemeToggle } from './components/ThemeToggle';
import { Library, Plus } from 'lucide-react';
import { useNotify } from './context/NotificationContext';
import CookieConsent from './components/CookieConsent';

function App() {
  const [items, setItems] = useState<SvgItem[]>([]);
  const [activeItem, setActiveItem] = useState<SvgItem | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const { alert } = useNotify();

  const refreshLibrary = useCallback(async () => {
    const all = await svgStore.getAllItems();
    setItems(all);
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const handleProcessFile = async (file: File) => {
    const text = await file.text();
    let cleaned = '';
    try {
      cleaned = cleanSvgString(text);
    } catch (e) {
      alert("Erreur", "Le fichier SVG est malformé ou n'a pas pu être nettoyé.");
      return;
    }

    const newItem: SvgItem = {
      id: uuidv4(),
      name: file.name,
      originalRaw: text,
      cleanedRaw: cleaned,
      lastUpdated: Date.now(),
    };

    await svgStore.saveItem(newItem);
    await refreshLibrary();
    setActiveItem(newItem);
  };

  const handleCreateEmptySvg = async () => {
    const text = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">\n  <g id="layer1"></g>\n</svg>`;
    const cleaned = cleanSvgString(text);
    const newItem: SvgItem = {
      id: uuidv4(),
      name: 'Nouveau document',
      originalRaw: text,
      cleanedRaw: cleaned,
      lastUpdated: Date.now(),
    };
    await svgStore.saveItem(newItem);
    await refreshLibrary();
    setActiveItem(newItem);
  };

  if (activeItem) {
    return (
      <>
        <CookieConsent />
        <EditorLayout 
        item={activeItem} 
        onClose={() => setActiveItem(null)} 
        onSave={async (updatedRaw) => {
          const updated = { ...activeItem, cleanedRaw: updatedRaw };
          await svgStore.saveItem(updated);
          setActiveItem(updated);
          refreshLibrary();
        }}
        onNameChange={async (newName) => {
          const updated = { ...activeItem, name: newName };
          await svgStore.saveItem(updated);
          setActiveItem(updated);
          refreshLibrary();
        }}
        />
      </>
    );
  }

  return (
    <>
      <CookieConsent />
      <div className="min-h-screen bg-background text-foreground flex flex-col p-8 items-center justify-center relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="z-10 text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">SVG Cleaner & Editor</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Nettoyez, optimisez, et éditez vos fichiers SVG dynamiquement dans le navigateur. Absolument aucune donnée n'est envoyée sur un serveur.
        </p>
      </div>

      <div className="w-full max-w-2xl z-10 flex flex-col gap-6">
        <DropzoneArea onFileDrop={handleProcessFile} />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={handleCreateEmptySvg}
            className="flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors p-4 rounded-xl shadow-lg ring-1 ring-white/5"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Créer un SVG vide</span>
          </button>

          {items.length > 0 ? (
            <button 
              onClick={() => setShowLibrary(true)}
              className="flex items-center justify-center gap-2 bg-card border border-border hover:bg-accent/50 transition-colors p-4 rounded-xl shadow-lg ring-1 ring-white/5"
            >
              <Library className="w-5 h-5 text-primary" />
              <span className="font-medium">Ouvrir la bibliothèque ({items.length})</span>
            </button>
          ) : (
            <div className="flex items-center justify-center p-4 border border-dashed border-border rounded-xl opacity-50 bg-card/30">
              <span className="text-sm">Bibliothèque vide</span>
            </div>
          )}
        </div>
      </div>

      {showLibrary && (
        <LibraryModal 
          items={items} 
          onClose={() => setShowLibrary(false)} 
          onSelect={(item) => {
            setActiveItem(item);
            setShowLibrary(false);
          }}
          onDelete={async (id) => {
            await svgStore.removeItem(id);
            refreshLibrary();
          }}
        />
      )}
    </div>
    </>
  );
}

export default App;
