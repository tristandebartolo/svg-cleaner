import { useState, useEffect, useCallback, useRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { SvgItem } from '../../store/svgStore';
import { ArrowLeft, Save, Download, Loader2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Pencil } from 'lucide-react';
import LayerTree from './LayerTree';
import SvgPreview from './SvgPreview';
import Toolbar from './Toolbar';
import type { ToolbarOrientation } from './Toolbar';
import SidebarRight from './SidebarRight';
import TransformOriginPanel, { type TransformOrigin } from './TransformOriginPanel';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type EditorMode = 'select' | 'pan' | 'edit_path' | 'add_shape' | 'scale' | 'rotate' | 'draw_line' | 'draw_path';

interface EditorLayoutProps {
  item: SvgItem;
  onClose: () => void;
  onSave: (updatedRaw: string) => Promise<void>;
  onNameChange: (newName: string) => Promise<void>;
}

export interface HistoryEntry {
  raw: string;
  label: string;
  timestamp: number;
  type: 'move' | 'color' | 'stroke' | 'delete' | 'group' | 'add' | 'init' | 'align' | 'style' | 'scale' | 'rotate';
  nodeId?: string;
  color?: string;
}

export default function EditorLayout({ item, onClose, onSave, onNameChange }: EditorLayoutProps) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Element[]>([]);
  const [revision, setRevision] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [lastItemId, setLastItemId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('select');
  const [isSaving, setIsSaving] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState<TransformOrigin>('center');

  // Keyboard shortcuts preference
  const [shortcutsEnabled, setShortcutsEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('svg-shortcuts-enabled');
      return saved !== 'false'; // enabled by default
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('svg-shortcuts-enabled', shortcutsEnabled.toString());
  }, [shortcutsEnabled]);

  // Responsive sidebar state
  const isMobileQuery = () => typeof window !== 'undefined' && window.innerWidth < 1024;
  const [leftOpen, setLeftOpen] = useState(() => {
    if (isMobileQuery()) return false;
    const saved = localStorage.getItem('svg-sidebar-left');
    return saved !== null ? saved === 'true' : true;
  });
  const [rightOpen, setRightOpen] = useState(() => {
    if (isMobileQuery()) return false;
    const saved = localStorage.getItem('svg-sidebar-right');
    return saved !== null ? saved === 'true' : true;
  });
  const [isMobile, setIsMobile] = useState(() => isMobileQuery());

  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(item.name);

  useEffect(() => { localStorage.setItem('svg-sidebar-left', leftOpen.toString()); }, [leftOpen]);
  useEffect(() => { localStorage.setItem('svg-sidebar-right', rightOpen.toString()); }, [rightOpen]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setLeftOpen(false);
        setRightOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toolbar orientation & position (persisted)
  const [toolbarOrientation, setToolbarOrientation] = useState<ToolbarOrientation>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('svg-toolbar-orientation') as ToolbarOrientation) || 'vertical';
    }
    return 'vertical';
  });

  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('svg-toolbar-position');
      if (saved) {
        try { return JSON.parse(saved); } catch (_e) { }
      }
    }
    return { x: -1, y: -1 }; // -1 means "auto / centered"
  });

  useEffect(() => {
    localStorage.setItem('svg-toolbar-orientation', toolbarOrientation);
  }, [toolbarOrientation]);

  useEffect(() => {
    localStorage.setItem('svg-toolbar-position', JSON.stringify(toolbarPosition));
  }, [toolbarPosition]);

  const containerRef = useRef<HTMLDivElement>(null);

  const [canvasBg, setCanvasBg] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('svg-canvas-bg') || 'transparent';
    }
    return 'transparent';
  });

  useEffect(() => {
    localStorage.setItem('svg-canvas-bg', canvasBg);
  }, [canvasBg]);

  const [autoSave, setAutoSave] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('svg-autosave-enabled');
      return saved === 'true';
    }
    return false;
  });

  const [autoSaveDelay, setAutoSaveDelay] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('svg-autosave-delay');
      return saved ? parseInt(saved) : 30000;
    }
    return 30000;
  });

  useEffect(() => {
    localStorage.setItem('svg-autosave-enabled', autoSave.toString());
  }, [autoSave]);

  useEffect(() => {
    localStorage.setItem('svg-autosave-delay', autoSaveDelay.toString());
  }, [autoSaveDelay]);

  // Debounced Auto Save Effect
  useEffect(() => {
    if (autoSave && doc && revision > 0) {
      const timer = setTimeout(async () => {
        const serializer = new XMLSerializer();
        const raw = serializer.serializeToString(doc.documentElement);
        setIsSaving(true);
        await onSave(raw);
        setTimeout(() => setIsSaving(false), 800); // Visual feedback duration
      }, autoSaveDelay);
      return () => clearTimeout(timer);
    }
  }, [revision, autoSave, doc, onSave, autoSaveDelay]);

  // Storage for Grid Preferences
  const [grid, setGrid] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('svg-grid-config');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { }
      }
    }
    return { visible: false, size: 20, color: '#666666' };
  });

  useEffect(() => {
    localStorage.setItem('svg-grid-config', JSON.stringify(grid));
  }, [grid]);

  // Force re-render when DOM changes and push history
  const mutate = useCallback((label: string = "Modification", type: HistoryEntry['type'] = 'style', nodeId?: string, color?: string) => {
    setRevision(r => r + 1);
    setDoc(currentDoc => {
      if (!currentDoc) return currentDoc;
      const serializer = new XMLSerializer();
      const raw = serializer.serializeToString(currentDoc.documentElement);

      setHistoryIndex(currentIndex => {
        setHistory(prevHistory => {
          const newHistory = prevHistory.slice(0, currentIndex + 1);
          newHistory.push({
            raw,
            label,
            timestamp: Date.now(),
            type,
            nodeId,
            color
          });
          // Limit history to 100 items to prevent memory bloat
          if (newHistory.length > 100) return newHistory.slice(-100);
          return newHistory;
        });
        return currentIndex + 1;
      });
      return currentDoc;
    });
  }, []);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const entry = history[newIndex];
      const parser = new DOMParser();
      setDoc(parser.parseFromString(entry.raw, 'image/svg+xml'));
      setSelectedNodes([]);
      setRevision(r => r + 1);
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const entry = history[newIndex];
      const parser = new DOMParser();
      setDoc(parser.parseFromString(entry.raw, 'image/svg+xml'));
      setSelectedNodes([]);
      setRevision(r => r + 1);
      setHistoryIndex(newIndex);
    }
  }, [history, historyIndex]);

  // Initialisation
  useEffect(() => {
    // Only reset everything if the active item ID has changed (new file)
    if (item.id === lastItemId) return;

    const parser = new DOMParser();
    const parsed = parser.parseFromString(item.cleanedRaw, 'image/svg+xml');
    setDoc(parsed);
    setSelectedNodes([]);
    setRevision(0);
    setHistory([{
      raw: item.cleanedRaw,
      label: "Initialisation",
      timestamp: Date.now(),
      type: 'init'
    }]);
    setHistoryIndex(0);
    setLastItemId(item.id);
  }, [item, lastItemId]);

  const handleSave = async () => {
    if (!doc) return;
    const serializer = new XMLSerializer();
    const raw = serializer.serializeToString(doc.documentElement);
    setIsSaving(true);
    await onSave(raw);
    setTimeout(() => setIsSaving(false), 1000);
  };

  const handleDownload = () => {
    if (!doc) return;
    const serializer = new XMLSerializer();
    const raw = serializer.serializeToString(doc.documentElement);
    const blob = new Blob([raw], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clean-${item.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSelectNode = useCallback((node: Element | null, multi: boolean = false) => {
    setSelectedNodes(prev => {
      if (!node) return [];
      if (multi) {
        if (prev.includes(node)) return prev.filter(n => n !== node);
        return [...prev, node];
      }
      return [node];
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    setSelectedNodes(prev => {
      if (prev.length > 0) {
        prev.forEach(node => {
          if (node.parentNode) node.parentNode.removeChild(node);
        });
        mutate('Supprimer', 'delete');
      }
      return [];
    });
  }, [mutate]);

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    if (!shortcutsEnabled) return;

    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((e.target as HTMLElement).isContentEditable) return;

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z / Ctrl+Shift+Z
      if (ctrl && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) { redo(); } else { undo(); }
        return;
      }
      // Ctrl+S → save
      if (ctrl && key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      // Don't process single keys if Ctrl is held
      if (ctrl) return;

      switch (key) {
        case 'v': e.preventDefault(); setEditorMode('select'); break;
        case 'h': e.preventDefault(); setEditorMode('pan'); break;
        case 'a': e.preventDefault(); setEditorMode('edit_path'); break;
        case 'l': e.preventDefault(); setEditorMode('draw_line'); break;
        case 'p': e.preventDefault(); setEditorMode('draw_path'); break;
        case 's': e.preventDefault(); setEditorMode('scale'); break;
        case 'r': e.preventDefault(); setEditorMode('rotate'); break;
        case 'delete':
        case 'backspace':
          e.preventDefault();
          handleDeleteSelected();
          break;
        case 'escape':
          e.preventDefault();
          setSelectedNodes([]);
          setEditorMode('select');
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcutsEnabled, undo, redo, handleSave, handleDeleteSelected]);

  if (!doc) return <div className="p-8">Chargement...</div>;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden selection:bg-primary/30">
      {/* Navbar */}
      <header className="h-14 lg:h-16 border-b border-border/50 bg-card flex items-center justify-between px-3 lg:px-6 flex-shrink-0 relative z-30 shadow-sm">
        <div className="flex items-center gap-2 lg:gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setLeftOpen(v => !v)}
            className={cn(
              "p-2 rounded-md transition-colors",
              leftOpen ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title={leftOpen ? "Fermer les calques" : "Ouvrir les calques"}
          >
            {leftOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          
          {isEditingName ? (
            <input
              type="text"
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onBlur={() => {
                setIsEditingName(false);
                if (editNameValue.trim() !== '' && editNameValue !== item.name) {
                  onNameChange(editNameValue.trim());
                } else {
                  setEditNameValue(item.name);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  setEditNameValue(item.name);
                  setIsEditingName(false);
                }
              }}
              autoFocus
              className="bg-background border border-primary px-2 py-1 rounded text-sm font-semibold max-w-[150px] sm:max-w-[200px] outline-none"
            />
          ) : (
            <div 
              className="font-semibold text-sm lg:text-lg tracking-tight truncate max-w-[120px] sm:max-w-sm cursor-text hover:text-primary transition-colors flex items-center gap-2 group" 
              title={item.name}
              onClick={() => {
                setEditNameValue(item.name);
                setIsEditingName(true);
              }}
            >
              {item.name}
              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          <button
            onClick={handleSave}
            className={cn(
              "flex items-center gap-2 px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-all",
              isSaving ? 'bg-green-500/20 text-green-500 border border-green-500/50' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent'
            )}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4 cursor-pointer" />
            )}
            <span className="hidden sm:inline">{isSaving ? 'Enregistré !' : 'Sauvegarder'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Télécharger</span>
          </button>
          <button
            onClick={() => setRightOpen(v => !v)}
            className={cn(
              "p-2 rounded-md transition-colors",
              rightOpen ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title={rightOpen ? "Fermer le panneau" : "Ouvrir le panneau"}
          >
            {rightOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-4rem)] relative">

        {/* Mobile overlay */}
        {isMobile && (leftOpen || rightOpen) && (
          <div
            className="fixed inset-0 bg-black/40 z-20 backdrop-blur-sm transition-opacity"
            onClick={() => { setLeftOpen(false); setRightOpen(false); }}
          />
        )}

        {/* Left Sidebar - Layers */}
        <aside className={cn(
          "w-72 flex-shrink-0 border-r border-border/50 bg-card/50 flex flex-col h-full overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out",
          isMobile && "fixed left-0 top-14 bottom-0 z-30 shadow-2xl bg-card",
          leftOpen ? "translate-x-0" : "-translate-x-full",
          !leftOpen && !isMobile && "hidden"
        )}>
          <div className="p-4 border-b border-border/30 bg-card sticky top-0 z-10 backdrop-blur">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Calques / Éléments</h3>
              {isMobile && (
                <button
                  onClick={() => setLeftOpen(false)}
                  className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="p-0 flex-1">
            <LayerTree
              doc={doc}
              root={doc.documentElement}
              selectedNodes={selectedNodes}
              onSelect={handleSelectNode}
              mutate={mutate}
              revision={revision}
            />
          </div>
        </aside>

        {/* Center - Preview Canvas */}
        <main className="flex-1 bg-muted/20 relative overflow-hidden flex items-center justify-center p-0">

          <Toolbar
            doc={doc}
            selectedNodes={selectedNodes}
            mutate={mutate}
            undo={undo}
            redo={redo}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            mode={editorMode}
            setMode={setEditorMode}
            orientation={toolbarOrientation}
            position={toolbarPosition}
            setPosition={setToolbarPosition}
          />

          <div className="absolute inset-0 z-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          <div
            ref={containerRef}
            className={cn(
              "w-full h-full flex items-center justify-center relative",
              canvasBg === 'transparent' && "checker-bg"
            )}
            style={{ backgroundColor: canvasBg !== 'transparent' ? canvasBg : undefined }}
          >
            <SvgPreview
              doc={doc}
              selectedNodes={selectedNodes}
              onSelectNode={handleSelectNode}
              revision={revision}
              mutate={mutate}
              mode={editorMode}
              grid={grid}
              transformOrigin={transformOrigin}
            />

            <TransformOriginPanel
              origin={transformOrigin}
              setOrigin={setTransformOrigin}
              visible={editorMode === 'rotate'}
            />
          </div>
        </main>

        {/* Right Sidebar */}
        <div className={cn(
          "transition-all duration-300 ease-in-out",
          isMobile && "fixed right-0 top-14 bottom-0 z-30 shadow-2xl",
          rightOpen ? "translate-x-0" : "translate-x-full",
          !rightOpen && !isMobile && "hidden"
        )}>
          <SidebarRight
            item={item}
            doc={doc}
            selectedNodes={selectedNodes}
            mutate={mutate}
            onDeleteNodes={handleDeleteSelected}
            grid={grid}
            setGrid={setGrid}
            autoSave={autoSave}
            setAutoSave={setAutoSave}
            autoSaveDelay={autoSaveDelay}
            setAutoSaveDelay={setAutoSaveDelay}
            canvasBg={canvasBg}
            setCanvasBg={setCanvasBg}
            history={history}
            historyIndex={historyIndex}
            setHistoryIndex={(index) => {
              setHistoryIndex(index);
              const parser = new DOMParser();
              setDoc(parser.parseFromString(history[index].raw, 'image/svg+xml'));
              setRevision(r => r + 1);
              setSelectedNodes([]);
            }}
            isMobile={isMobile}
            onClose={() => setRightOpen(false)}
            toolbarOrientation={toolbarOrientation}
            setToolbarOrientation={setToolbarOrientation}
            resetToolbarPosition={() => setToolbarPosition({ x: -1, y: -1 })}
            shortcutsEnabled={shortcutsEnabled}
            setShortcutsEnabled={setShortcutsEnabled}
          />
        </div>
      </div>
    </div>
  );
}
