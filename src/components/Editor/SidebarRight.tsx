import { useState } from 'react';
import PropertiesPanel from './PropertiesPanel';
import { ThemeToggle } from '../ThemeToggle';
import { Settings, SlidersHorizontal, ImageDown, History, Clock, Move, Palette, Edit3, Trash2, Layers, PlusSquare, Play, Layout, PanelRightClose, RotateCcw, RectangleHorizontal, RectangleVertical, Keyboard } from 'lucide-react';
import type { SvgItem } from '../../store/svgStore';
import type { HistoryEntry } from './EditorLayout';
import type { ToolbarOrientation } from './Toolbar';
import Switch from '../UI/Switch';

interface SidebarRightProps {
  item: SvgItem;
  doc: Document | null;
  selectedNodes: Element[];
  mutate: (label?: string, type?: HistoryEntry['type'], nodeId?: string, color?: string) => void;
  onDeleteNodes: () => void;
  grid: { visible: boolean; size: number; color: string };
  setGrid: (grid: { visible: boolean; size: number; color: string }) => void;
  autoSave: boolean;
  setAutoSave: (enabled: boolean) => void;
  autoSaveDelay: number;
  setAutoSaveDelay: (delay: number) => void;
  canvasBg: string;
  setCanvasBg: (color: string) => void;
  history: HistoryEntry[];
  historyIndex: number;
  setHistoryIndex: (index: number) => void;
  isMobile?: boolean;
  onClose?: () => void;
  toolbarOrientation?: ToolbarOrientation;
  setToolbarOrientation?: (o: ToolbarOrientation) => void;
  resetToolbarPosition?: () => void;
  shortcutsEnabled?: boolean;
  setShortcutsEnabled?: (enabled: boolean) => void;
}

type TabType = 'properties' | 'history' | 'export' | 'preferences';

export default function SidebarRight({
  item, doc, selectedNodes, mutate, onDeleteNodes,
  grid, setGrid, autoSave, setAutoSave, autoSaveDelay, setAutoSaveDelay,
  canvasBg, setCanvasBg, history, historyIndex, setHistoryIndex,
  isMobile, onClose,
  toolbarOrientation, setToolbarOrientation, resetToolbarPosition,
  shortcutsEnabled, setShortcutsEnabled
}: SidebarRightProps) {
  const [activeTab, setActiveTab] = useState<TabType>('properties');

  const exportSvgToImage = (format: 'png' | 'jpeg') => {
    if (!doc) return;
    const serializer = new XMLSerializer();
    const raw = serializer.serializeToString(doc.documentElement);

    // Create an image source from SVG
    const svgBlob = new Blob([raw], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      // Create canvas
      const canvas = document.createElement('canvas');
      const svgEl = doc.documentElement as unknown as SVGSVGElement;

      const width = svgEl.viewBox.baseVal?.width || parseInt(svgEl.getAttribute('width') || '800') || 800;
      const height = svgEl.viewBox.baseVal?.height || parseInt(svgEl.getAttribute('height') || '800') || 800;

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      const imgURI = canvas.toDataURL(`image/${format}`, 1.0);
      const a = document.createElement('a');
      a.download = `clean-${item.name.replace('.svg', '')}.${format === 'jpeg' ? 'jpg' : 'png'}`;
      a.href = imgURI;
      a.click();
    };
    img.src = url;
  };

  const handleDownloadSvg = () => {
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

  return (
    <aside className="w-80 flex-shrink-0 border-l border-border/50 bg-card flex flex-col h-full overflow-hidden">
      {isMobile && onClose && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-card shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Panneau</span>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex border-b border-border/30 bg-card/80 backdrop-blur shrink-0">
        <button
          onClick={() => setActiveTab('properties')}
          className={`flex-1 flex flex-col items-center justify-center p-3 gap-1 text-[10px] font-medium cursor-pointer transition-colors ${activeTab === 'properties' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
        >
          <SlidersHorizontal className="w-4 h-4 mb-0.5" />
          Éditer
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex flex-col items-center justify-center p-3 gap-1 text-[10px] font-medium cursor-pointer transition-colors ${activeTab === 'history' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
        >
          <History className="w-4 h-4 mb-0.5" />
          Historique
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`flex-1 flex flex-col items-center justify-center p-3 gap-1 text-[10px] font-medium cursor-pointer transition-colors ${activeTab === 'export' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
        >
          <ImageDown className="w-4 h-4 mb-0.5" />
          Export
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex-1 flex flex-col items-center justify-center p-3 gap-1 text-[10px] font-medium cursor-pointer transition-colors ${activeTab === 'preferences' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
        >
          <Settings className="w-4 h-4 mb-0.5" />
          Réglages
        </button>
      </div>

      <div className="overflow-y-auto w-full flex-1 custom-scrollbar">
        {activeTab === 'properties' && (
          <div className="p-4">
            {selectedNodes.length > 0 ? (
              <PropertiesPanel
                nodes={selectedNodes}
                mutate={mutate}
                onDelete={onDeleteNodes}
              />
            ) : (
              <div className="text-center text-muted-foreground text-sm flex flex-col items-center py-10 gap-3">
                <SlidersHorizontal className="w-10 h-10 opacity-20" />
                <p>Sélectionnez un ou plusieurs éléments pour éditer leurs propriétés.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-2">
            <div className="flex flex-col gap-1">
              {[...history].reverse().map((entry, revIndex) => {
                const actualIndex = history.length - 1 - revIndex;
                const isActive = actualIndex === historyIndex;
                const isFuture = actualIndex > historyIndex;

                const getHistoryIcon = (type: HistoryEntry['type']) => {
                  switch (type) {
                    case 'move': return <Move className="w-3.5 h-3.5" />;
                    case 'color': return <Palette className="w-3.5 h-3.5" />;
                    case 'stroke': return <Edit3 className="w-3.5 h-3.5" />;
                    case 'delete': return <Trash2 className="w-3.5 h-3.5" />;
                    case 'group': return <Layers className="w-3.5 h-3.5" />;
                    case 'add': return <PlusSquare className="w-3.5 h-3.5" />;
                    case 'init': return <Play className="w-3.5 h-3.5" />;
                    case 'align': return <Layout className="w-3.5 h-3.5" />;
                    default: return <Clock className="w-3.5 h-3.5" />;
                  }
                };

                return (
                  <button
                    key={actualIndex}
                    onClick={() => setHistoryIndex(actualIndex)}
                    className={`flex items-start gap-3 p-3 rounded-xl text-left transition-all group ${isActive ? 'bg-primary/10 border border-primary/20 ring-1 ring-primary/10' : isFuture ? 'opacity-40 grayscale hover:opacity-70 border border-transparent' : 'hover:bg-muted border border-transparent'}`}
                  >
                    <div className={`mt-1 p-1.5 rounded-full transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'}`}>
                      {entry.type === 'color' && entry.color ? (
                        <div className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: entry.color }} />
                      ) : (
                        getHistoryIcon(entry.type)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                        {entry.label}
                        {entry.nodeId && <span className="ml-1.5 text-[10px] opacity-60 font-mono">#{entry.nodeId}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex justify-between items-center mt-1">
                        <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        {isActive && <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">Actuel</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
              {history.length === 0 && (
                <div className="py-20 text-center text-muted-foreground text-sm flex flex-col items-center gap-3">
                  <History className="w-12 h-12 opacity-10" />
                  <p>Aucun historique disponible.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'export' && (() => {
          // Read current SVG dimensions
          const svgEl = doc?.documentElement as unknown as SVGSVGElement | null;
          const vb = svgEl?.viewBox?.baseVal;
          const currentW = vb?.width || parseInt(svgEl?.getAttribute('width') || '800') || 800;
          const currentH = vb?.height || parseInt(svgEl?.getAttribute('height') || '800') || 800;

          const applyFormat = (w: number, h: number) => {
            if (!doc) return;
            const el = doc.documentElement;
            el.setAttribute('viewBox', `0 0 ${w} ${h}`);
            el.setAttribute('width', w.toString());
            el.setAttribute('height', h.toString());
            mutate('Format → ' + w + '×' + h, 'style');
          };

          const presets = [
            { label: '16:9', w: 1920, h: 1080, sub: '1920×1080' },
            { label: '4:3', w: 1024, h: 768, sub: '1024×768' },
            { label: '1:1', w: 1080, h: 1080, sub: '1080×1080' },
            { label: 'A4', w: 595, h: 842, sub: '595×842' },
            { label: 'A3', w: 842, h: 1191, sub: '842×1191' },
            { label: 'Icon', w: 24, h: 24, sub: '24×24' },
            { label: 'Favicon', w: 512, h: 512, sub: '512×512' },
            { label: 'Story', w: 1080, h: 1920, sub: '9:16' },
          ];

          return (
            <div className="p-4 flex flex-col gap-6">
              {/* Format Section */}
              <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                <div className="font-semibold text-sm mb-1">Format du document</div>
                <p className="text-xs text-muted-foreground mb-4">Dimensions de l'espace de travail SVG (viewBox).</p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Largeur</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="1" step="1"
                        defaultValue={currentW}
                        key={`w-${currentW}`}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value);
                          if (v > 0 && v !== currentW) applyFormat(v, currentH);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                      />
                      <span className="text-[10px] text-muted-foreground shrink-0">px</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Hauteur</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="1" step="1"
                        defaultValue={currentH}
                        key={`h-${currentH}`}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value);
                          if (v > 0 && v !== currentH) applyFormat(currentW, v);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                      />
                      <span className="text-[10px] text-muted-foreground shrink-0">px</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Formats prédéfinis</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {presets.map(p => {
                      const isActive = currentW === p.w && currentH === p.h;
                      return (
                        <button
                          key={p.label}
                          onClick={() => applyFormat(p.w, p.h)}
                          className={`flex flex-col items-center py-2 px-1 rounded-md border text-center transition-all ${isActive
                              ? 'bg-primary/10 border-primary/50 text-primary ring-1 ring-primary/20'
                              : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                        >
                          <span className="text-[11px] font-semibold leading-tight">{p.label}</span>
                          <span className="text-[8px] opacity-60 mt-0.5">{p.sub}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                <div className="font-semibold text-sm mb-1">Standard (Vecteur)</div>
                <p className="text-xs text-muted-foreground mb-3">Parfait pour le web, ne perd aucune qualité lors du zoom.</p>
                <button onClick={handleDownloadSvg} className="w-full bg-primary text-primary-foreground py-2 rounded shadow-sm text-sm font-medium hover:bg-primary/90 transition-colors">
                  Télécharger SVG
                </button>
              </div>

              <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                <div className="font-semibold text-sm mb-1">Image Rastérisée</div>
                <p className="text-xs text-muted-foreground mb-3">Convertir le vecteur en pixels plats en conservant la haute résolution du document.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => exportSvgToImage('png')} className="bg-secondary text-secondary-foreground py-2 rounded shadow-sm text-sm font-medium hover:bg-secondary/80 transition-colors">
                    Format PNG
                  </button>
                  <button onClick={() => exportSvgToImage('jpeg')} className="bg-secondary text-secondary-foreground py-2 rounded shadow-sm text-sm font-medium hover:bg-secondary/80 transition-colors tooltip" title="Fond blanc appliqué">
                    Format JPG
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === 'preferences' && (
          <div className="p-4 flex flex-col gap-6">
            <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-4">
              <div>
                <div className="font-semibold text-sm mb-1">Environnement de Travail</div>
                <p className="text-xs text-muted-foreground mb-4">Personnaliser l'apparence du poste de travail.</p>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-muted-foreground font-medium">Couleur de fond du Canvas</label>
                    <div className="grid grid-cols-5 gap-2">
                      <button
                        onClick={() => setCanvasBg('transparent')}
                        className={`w-full aspect-square rounded border border-border checker-bg ${canvasBg === 'transparent' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                        title="Transparent (Damiers)"
                      />
                      <button
                        onClick={() => setCanvasBg('#ffffff')}
                        className={`w-full aspect-square rounded border border-border bg-white ${canvasBg === '#ffffff' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                        title="Blanc"
                      />
                      <button
                        onClick={() => setCanvasBg('#000000')}
                        className={`w-full aspect-square rounded border border-border bg-black ${canvasBg === '#000000' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                        title="Noir"
                      />
                      <button
                        onClick={() => setCanvasBg('#333333')}
                        className={`w-full aspect-square rounded border border-border bg-[#333333] ${canvasBg === '#333333' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                        title="Gris Sombre"
                      />
                      <div className="relative">
                        <input
                          type="color"
                          value={canvasBg === 'transparent' ? '#ffffff' : canvasBg}
                          onChange={(e) => setCanvasBg(e.target.value)}
                          className="w-full aspect-square cursor-pointer opacity-0 absolute inset-0 z-10"
                        />
                        <div
                          className={`w-full aspect-square rounded border border-border bg-gradient-to-br from-red-500 via-green-500 to-blue-500 ${canvasBg !== 'transparent' && !['#ffffff', '#000000', '#333333'].includes(canvasBg) ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                          title="Couleur personnalisée"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-4">
              <div>
                <div className="font-semibold text-sm mb-1">Barre d'outils</div>
                <p className="text-xs text-muted-foreground mb-3">Orientation et position de la toolbar.</p>

                {toolbarOrientation && setToolbarOrientation && (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-muted-foreground font-medium">Orientation</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setToolbarOrientation('horizontal')}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-sm font-medium transition-all ${toolbarOrientation === 'horizontal'
                              ? 'bg-primary/10 border-primary/50 text-primary ring-1 ring-primary/20'
                              : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                        >
                          <RectangleHorizontal className="w-4 h-4" />
                          Horizontal
                        </button>
                        <button
                          onClick={() => setToolbarOrientation('vertical')}
                          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-sm font-medium transition-all ${toolbarOrientation === 'vertical'
                              ? 'bg-primary/10 border-primary/50 text-primary ring-1 ring-primary/20'
                              : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                        >
                          <RectangleVertical className="w-4 h-4" />
                          Vertical
                        </button>
                      </div>
                    </div>

                    {resetToolbarPosition && (
                      <button
                        onClick={resetToolbarPosition}
                        className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-md border border-border bg-background text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Réinitialiser la position
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-4">
              <div>
                <div className="font-semibold text-sm mb-1">Thème Visuel</div>
                <p className="text-xs text-muted-foreground mb-3">Changez l'ambiance de l'éditeur.</p>
                <ThemeToggle />
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-4">
              <div>
                <Switch
                  checked={autoSave}
                  onChange={setAutoSave}
                  label="Sauvegarde Automatique"
                  description="Enregistre vos changements silencieusement."
                />

                {autoSave && (
                  <div className="mt-4 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
                    <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Délai de sauvegarde (secondes)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min="5" max="300" step="5"
                        value={autoSaveDelay / 1000}
                        onChange={(e) => setAutoSaveDelay(parseInt(e.target.value) * 1000)}
                        className="flex-1"
                      />
                      <span className="text-sm font-mono bg-background border border-border px-2 py-1 rounded min-w-[3rem] text-center">
                        {autoSaveDelay / 1000}s
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-4">
              <div>
                <div className="font-semibold text-sm mb-1">Grille de fond (Canvas)</div>
                <p className="text-xs text-muted-foreground mb-3">Utile pour s'aligner visuellement.</p>
                <Switch
                  checked={grid.visible}
                  onChange={(v) => setGrid({ ...grid, visible: v })}
                  label="Aperçu Grille Visible"
                  description="Afficher une grille de repères sur le canvas."
                />

                {grid.visible && (
                  <div className="flex flex-col gap-3 mt-4 animate-in fade-in slide-in-from-top-1">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground font-medium">Taille (px)</label>
                      <input
                        type="number" min="5" max="200"
                        value={grid.size}
                        onChange={(e) => setGrid({ ...grid, size: parseInt(e.target.value) || 20 })}
                        className="w-full bg-background border border-border rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground font-medium">Couleur d'accent</label>
                      <input
                        type="color"
                        value={grid.color}
                        onChange={(e) => setGrid({ ...grid, color: e.target.value })}
                        className="w-full h-8 cursor-pointer rounded"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-4">
              <div>
                <Switch
                  checked={shortcutsEnabled ?? true}
                  onChange={(v) => setShortcutsEnabled?.(v)}
                  label="Raccourcis Clavier"
                  description="Activez les raccourcis clavier pour un accès rapide aux outils."
                />

                {(shortcutsEnabled ?? true) && (
                  <div className="mt-4 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Keyboard className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Référence</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {[
                        ['V', 'Sélection'],
                        ['H', 'Main (Pan)'],
                        ['A', 'Éditeur nœuds'],
                        ['L', 'Dessiner ligne'],
                        ['P', 'Dessiner chemin'],
                        ['S', 'Agrandir'],
                        ['R', 'Rotation'],
                        ['Suppr', 'Supprimer'],
                        ['Échap', 'Désélectionner'],
                        ['⌘Z', 'Annuler'],
                        ['⌘⇧Z', 'Rétablir'],
                        ['⌘S', 'Sauvegarder'],
                        ['-', 'Zoom arrière'],
                        ['+', 'Zoom avant'],
                        ['0', 'Reset Zoom'],
                      ].map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between py-0.5">
                          <span className="text-[11px] text-muted-foreground">{label}</span>
                          <kbd className="text-[10px] font-mono bg-background border border-border rounded px-1.5 py-0.5 text-foreground/70 shadow-sm">{key}</kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
