import { useState, useEffect } from 'react';
import { Trash2, Plus, Minus } from 'lucide-react';
import type { HistoryEntry } from './EditorLayout';

interface PropertiesPanelProps {
  nodes: Element[];
  mutate: (label?: string, type?: HistoryEntry['type'], nodeId?: string, color?: string) => void;
  onDelete: () => void;
}

const READONLY_ATTRS = ["xmlns", "version", "xml:space"];
const DEDICATED_ATTRS = ["id", "fill", "stroke", "stroke-width", "opacity", "x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2"];

const NumberInput = ({ label, value, onChange, step = 1 }: { label: string, value: string, onChange: (val: string) => void, step?: number }) => {
   const num = parseFloat(value) || 0;
   const stringVal = value || '';
   const handleMinus = () => onChange(String(Number((num - step).toFixed(2))));
   const handlePlus = () => onChange(String(Number((num + step).toFixed(2))));
   
   return (
      <div className="flex flex-col gap-1 w-full relative">
         <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold ml-1 truncate">{label}</label>
         <div className="flex items-center w-full bg-background border border-border rounded overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary">
            <input type="number" step="any" value={stringVal} placeholder="0" onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-sm px-2 py-1.5 outline-none font-mono placeholder:opacity-30" />
            <div className="flex border-l border-border/50 shrink-0 h-full">
               <button onClick={handleMinus} className="px-1.5 hover:bg-muted text-muted-foreground h-full flex items-center justify-center transition-colors"><Minus className="w-3 h-3" /></button>
               <button onClick={handlePlus} className="px-1.5 hover:bg-muted text-muted-foreground border-l border-border/50 h-full flex items-center justify-center transition-colors"><Plus className="w-3 h-3" /></button>
            </div>
         </div>
      </div>
   );
};

const ColorInput = ({ label, value, onChange }: { label: string, value: string, onChange: (val: string) => void }) => {
   const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(value) || /^#[0-9A-Fa-f]{3}$/.test(value);
   return (
      <div className="flex flex-col gap-1 w-full">
         <div className="flex justify-between items-center px-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold truncate">{label}</label>
            <button onClick={() => onChange('none')} className="text-[9px] text-muted-foreground hover:text-destructive hover:underline font-medium transition-colors shrink-0 ml-2">Auto/Retirer</button>
         </div>
         <div className="flex w-full items-center bg-background border border-border rounded overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary pr-1 h-8">
            <div className="relative shrink-0 flex items-center justify-center p-0.5 rounded cursor-pointer checker-bg border border-border/30 w-5 h-5 ml-1.5">
               <input type="color" value={isValidHex ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
               <div className="w-full h-full rounded-sm" style={{ backgroundColor: isValidHex ? value : value || 'transparent' }} />
            </div>
            <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="none" className="w-full bg-transparent text-sm px-2 py-1 outline-none font-mono" />
         </div>
      </div>
   );
};

const OpacityInput = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => {
   let opacity = 1;
   if (value !== '') {
      opacity = parseFloat(value);
      if (isNaN(opacity)) opacity = 1;
   }
   
   return (
      <div className="flex flex-col gap-2 w-full mt-3">
         <div className="flex justify-between items-center px-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Opacité</label>
            <span className="text-[10px] text-muted-foreground font-mono">{Math.round(opacity * 100)}%</span>
         </div>
         <input type="range" min="0" max="1" step="0.01" value={opacity} onChange={(e) => onChange(e.target.value)} className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary" />
      </div>
   );
};

export default function PropertiesPanel({ nodes, mutate, onDelete }: PropertiesPanelProps) {
  const node = nodes[0];
  const isMulti = nodes.length > 1;
  const tagName = node ? node.tagName.toLowerCase() : '';

  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  useEffect(() => {
    refreshAttrs();
  }, [nodes]);

  const refreshAttrs = () => {
    if (!node) return;
    const newAttrs: Record<string, string> = {};
    
    if (isMulti) {
      const shared = ['fill', 'stroke', 'stroke-width', 'opacity'];
      shared.forEach(k => newAttrs[k] = node.getAttribute(k) || '');
    } else {
      for (let i = 0; i < node.attributes.length; i++) {
        newAttrs[node.attributes[i].name] = node.attributes[i].value;
      }
    }

    // Force defaults to exist in state if not present
    if (!isMulti) {
      if (newAttrs['id'] === undefined) newAttrs['id'] = '';
      if (['rect', 'image', 'use', 'foreignObject'].includes(tagName)) {
        if (newAttrs['x'] === undefined) newAttrs['x'] = '0';
        if (newAttrs['y'] === undefined) newAttrs['y'] = '0';
        if (newAttrs['width'] === undefined) newAttrs['width'] = '0';
        if (newAttrs['height'] === undefined) newAttrs['height'] = '0';
      }
      if (tagName === 'rect') {
        if (newAttrs['rx'] === undefined) newAttrs['rx'] = '';
        if (newAttrs['ry'] === undefined) newAttrs['ry'] = '';
      }
      if (tagName === 'circle' || tagName === 'ellipse') {
         if (newAttrs['cx'] === undefined) newAttrs['cx'] = '0';
         if (newAttrs['cy'] === undefined) newAttrs['cy'] = '0';
         if (tagName === 'circle' && newAttrs['r'] === undefined) newAttrs['r'] = '0';
         if (tagName === 'ellipse' && newAttrs['rx'] === undefined) newAttrs['rx'] = '0';
         if (tagName === 'ellipse' && newAttrs['ry'] === undefined) newAttrs['ry'] = '0';
      }
      if (tagName === 'line') {
         if (newAttrs['x1'] === undefined) newAttrs['x1'] = '0';
         if (newAttrs['y1'] === undefined) newAttrs['y1'] = '0';
         if (newAttrs['x2'] === undefined) newAttrs['x2'] = '0';
         if (newAttrs['y2'] === undefined) newAttrs['y2'] = '0';
      }
    }
    
    setAttrs(newAttrs);
  };

const ATTR_HELP_DOCS: Record<string, string> = {
  "class": "Classes CSS. Utile pour styliser cet élément.",
  "transform": "Matrice de transformation (translate, rotate, scale...).",
  "viewBox": "Définit le système de coordonnées et la vue.",
  "preserveAspectRatio": "Gestion de la déformation (ex: xMidYMid meet).",
  "data-id": "Identifiant de donnée personnalisé.",
  "vector-effect": "ex: 'non-scaling-stroke' garde la taille du trait peu importe le zoom.",
};

  const handleAttrChange = (name: string, val: string | null) => {
    try {
      nodes.forEach(n => {
          if (val === null || val === '') {
            n.removeAttribute(name);
          } else {
            n.setAttribute(name, val);
          }
      });
      
      setAttrs(prev => {
        const next = { ...prev };
        if (val === null || val === '') {
           delete next[name];
        } else {
           next[name] = val;
        }
        return next;
      });
      
      let type: HistoryEntry['type'] = 'style';
      if (name === 'fill') type = 'color';
      if (name === 'stroke' || name === 'stroke-width' || name === 'd') type = 'stroke';
      if (['x', 'y', 'cx', 'cy'].includes(name)) type = 'move';
      if (['width', 'height', 'r', 'rx', 'ry'].includes(name)) type = 'scale';
      
      const firstId = nodes[0].getAttribute('id') || nodes[0].tagName;
      mutate(name === 'id' ? `Renommer` : `Attr ${name}`, type, firstId, name === 'fill' ? (val || undefined) : undefined);
    } catch (e) {
      console.error("Impossible de modifier cet attribut :", e);
    }
  };

  const handleAddAttribute = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const key = newKey.trim();
    const val = newVal.trim();

    if (key) {
      if (attrs[key] !== undefined) {
        alert(`L'attribut "${key}" existe déjà.`);
        return;
      }
      handleAttrChange(key, val);
      setNewKey('');
      setNewVal('');
    }
  };

  const advancedKeys = Object.keys(attrs).filter(k => !DEDICATED_ATTRS.includes(k) && k !== 'd');

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER */}
      <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
        <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Type de Noeud</div>
        <div className="text-lg font-bold text-foreground truncate select-all">
          {isMulti ? `${nodes.length} Éléments (Edition groupée)` : tagName}
        </div>
      </div>

      {/* SECTION: GENERAL */}
      {!isMulti && (
        <div className="space-y-3 px-1">
          <h4 className="font-semibold text-xs uppercase tracking-wider border-b border-border/50 pb-2 text-primary">Général</h4>
          <div className="flex flex-col gap-1 w-full relative">
            <label className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold ml-1">Identifiant (ID)</label>
            <input 
              type="text" 
              value={attrs['id'] || ''} 
              onChange={e => handleAttrChange('id', e.target.value)} 
              placeholder="ex: mon-logo" 
              className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm font-mono focus:ring-1 focus:ring-primary outline-none" 
            />
          </div>
        </div>
      )}

      {/* SECTION: GÉOMÉTRIE (S'adapte au tagName) */}
      {!isMulti && ['rect', 'image', 'use', 'foreignObject', 'circle', 'ellipse', 'line'].includes(tagName) && (
        <div className="space-y-3 px-1">
          <h4 className="font-semibold text-xs uppercase tracking-wider border-b border-border/50 pb-2 text-primary">Géométrie</h4>
          
          {['rect', 'image', 'use', 'foreignObject'].includes(tagName) && (
             <div className="grid grid-cols-2 gap-3">
                <NumberInput label="X" value={attrs['x'] || ''} onChange={v => handleAttrChange('x', v)} step={10} />
                <NumberInput label="Y" value={attrs['y'] || ''} onChange={v => handleAttrChange('y', v)} step={10} />
                <NumberInput label="Largeur" value={attrs['width'] || ''} onChange={v => handleAttrChange('width', v)} step={10} />
                <NumberInput label="Hauteur" value={attrs['height'] || ''} onChange={v => handleAttrChange('height', v)} step={10} />
                
                {tagName === 'rect' && (
                  <>
                    <NumberInput label="Rayon X (rx)" value={attrs['rx'] || ''} onChange={v => handleAttrChange('rx', v)} step={1} />
                    <NumberInput label="Rayon Y (ry)" value={attrs['ry'] || ''} onChange={v => handleAttrChange('ry', v)} step={1} />
                  </>
                )}
             </div>
          )}

          {tagName === 'circle' && (
             <div className="grid grid-cols-2 gap-3">
                <NumberInput label="CX (Centre X)" value={attrs['cx'] || ''} onChange={v => handleAttrChange('cx', v)} step={10} />
                <NumberInput label="CY (Centre Y)" value={attrs['cy'] || ''} onChange={v => handleAttrChange('cy', v)} step={10} />
                <div className="col-span-2">
                  <NumberInput label="Rayon (R)" value={attrs['r'] || ''} onChange={v => handleAttrChange('r', v)} step={5} />
                </div>
             </div>
          )}

          {tagName === 'ellipse' && (
             <div className="grid grid-cols-2 gap-3">
                <NumberInput label="CX" value={attrs['cx'] || ''} onChange={v => handleAttrChange('cx', v)} step={10} />
                <NumberInput label="CY" value={attrs['cy'] || ''} onChange={v => handleAttrChange('cy', v)} step={10} />
                <NumberInput label="Rayon X" value={attrs['rx'] || ''} onChange={v => handleAttrChange('rx', v)} step={5} />
                <NumberInput label="Rayon Y" value={attrs['ry'] || ''} onChange={v => handleAttrChange('ry', v)} step={5} />
             </div>
          )}

          {tagName === 'line' && (
             <div className="grid grid-cols-2 gap-3">
                <NumberInput label="X1" value={attrs['x1'] || ''} onChange={v => handleAttrChange('x1', v)} step={10} />
                <NumberInput label="Y1" value={attrs['y1'] || ''} onChange={v => handleAttrChange('y1', v)} step={10} />
                <NumberInput label="X2" value={attrs['x2'] || ''} onChange={v => handleAttrChange('x2', v)} step={10} />
                <NumberInput label="Y2" value={attrs['y2'] || ''} onChange={v => handleAttrChange('y2', v)} step={10} />
             </div>
          )}
        </div>
      )}

      {/* SECTION: APPARENCE */}
      <div className="space-y-3 px-1">
        <h4 className="font-semibold text-xs uppercase tracking-wider border-b border-border/50 pb-2 text-primary">Apparence</h4>
        <div className="grid grid-cols-2 gap-3">
           <ColorInput label="Remlissage" value={attrs['fill'] || ''} onChange={v => handleAttrChange('fill', v)} />
           <ColorInput label="Contour" value={attrs['stroke'] || ''} onChange={v => handleAttrChange('stroke', v)} />
        </div>
        <div className="pt-1">
          <NumberInput label="Épaisseur du contour" value={attrs['stroke-width'] || ''} onChange={v => handleAttrChange('stroke-width', v)} step={1} />
        </div>
        <OpacityInput value={attrs['opacity'] || ''} onChange={v => handleAttrChange('opacity', v)} />
      </div>

      {/* SECTION: PATH */}
      {tagName === 'path' && !isMulti && (
        <div className="space-y-3 px-1">
          <h4 className="font-semibold text-xs uppercase tracking-wider border-b border-border/50 pb-2 text-primary">Données du Tracé</h4>
          <textarea 
            value={attrs['d'] || ''} 
            onChange={e => handleAttrChange('d', e.target.value)} 
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none font-mono min-h-[120px] custom-scrollbar" 
          />
        </div>
      )}

      <hr className="border-border/50" />

      {/* SECTION: ATTRIBUTS AVANCÉS */}
      <div className="space-y-3 px-1">
        <h4 className="font-semibold text-xs uppercase tracking-wider border-b border-border/50 pb-2 text-muted-foreground flex justify-between items-center">
          <span>Attributs Avancés</span>
          <span className="bg-muted px-1.5 py-0.5 rounded text-[9px] font-bold">{advancedKeys.length}</span>
        </h4>
        
        {advancedKeys.length === 0 ? (
          <div className="text-[11px] text-muted-foreground/60 italic px-1">Aucun attribut supplémentaire.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {advancedKeys.map(k => {
               const isReadonly = READONLY_ATTRS.includes(k);
               const helpText = ATTR_HELP_DOCS[k];
               return (
                 <div key={k} className="flex border border-border rounded overflow-hidden group" title={helpText}>
                   <div className="bg-muted/50 px-2 py-1 text-xs font-mono text-muted-foreground border-r border-border min-w-[70px] flex items-center shrink-0 max-w-[120px] truncate" title={helpText ? `${k} : ${helpText}` : k}>
                     {k}
                   </div>
                   <input 
                     type="text" 
                     value={attrs[k] || ''} 
                     readOnly={isReadonly}
                     onChange={e => handleAttrChange(k, e.target.value)} 
                     className="bg-background flex-1 text-xs px-2 outline-none font-mono py-1.5 focus:bg-muted/10 transition-colors w-0"
                   />
                   {!isReadonly && (
                     <button 
                       onClick={() => handleAttrChange(k, null)}
                       className="px-2 text-destructive/50 hover:bg-destructive hover:text-destructive-foreground transition-colors border-l border-border opacity-0 group-hover:opacity-100"
                     >
                       <Trash2 className="w-3 h-3" />
                     </button>
                   )}
                 </div>
               );
            })}
          </div>
        )}

        {/* AJOUTER */}
        <form onSubmit={handleAddAttribute} className="bg-muted/10 p-3 rounded border border-dashed border-border/50 flex flex-col gap-2 mt-3">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Nouvel Attribut</div>
          <div className="flex items-center gap-2">
             <input type="text" name="key" value={newKey} onChange={e => setNewKey(e.target.value)} required placeholder="nom (ex: class)" list="attr-suggestions" className="w-[80px] bg-background border border-border rounded px-2 py-1 text-xs font-mono outline-none focus:border-primary shrink-0" />
             <input type="text" name="val" value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="valeur (optionnel)" className="flex-1 bg-background border border-border rounded px-2 py-1 text-xs font-mono outline-none focus:border-primary w-0" />
             <button type="submit" className="bg-secondary hover:bg-secondary/80 text-secondary-foreground p-1 rounded transition-colors shrink-0"><Plus className="w-3.5 h-3.5" /></button>
          </div>
          <datalist id="attr-suggestions">
            {Object.keys(ATTR_HELP_DOCS).map(opt => <option key={opt} value={opt} />)}
          </datalist>
        </form>
      </div>

      <div className="pt-4 mt-2">
        <button 
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground py-2.5 rounded-md transition-colors text-sm font-semibold shadow-sm ring-1 ring-destructive/20"
        >
          <Trash2 className="w-4 h-4" />
          Supprimer
        </button>
      </div>

    </div>
  );
}
