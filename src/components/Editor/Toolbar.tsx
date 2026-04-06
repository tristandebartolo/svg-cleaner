import { useRef, useEffect, useCallback, useState } from 'react';
import { Undo2, Redo2, FlipHorizontal, FlipVertical, AlignLeft, AlignCenter, AlignRight, MousePointer2, Hand, PenLine, SquarePlus, FolderPlus, FolderMinus, GripVertical, Maximize2, RotateCw, Minus, Spline, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { EditorMode, HistoryEntry } from './EditorLayout';
import { getGlobalMatrix, getParentGlobalMatrix, matrixToSVGString } from '../../utils/matrixUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ToolbarOrientation = 'horizontal' | 'vertical';

interface ToolbarProps {
  doc: Document | null;
  selectedNodes: Element[];
  mutate: (label?: string, type?: HistoryEntry['type'], nodeId?: string, color?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  orientation: ToolbarOrientation;
  position: { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
}

export default function Toolbar({ doc, selectedNodes, mutate, undo, redo, canUndo, canRedo, mode, setMode, orientation, position, setPosition }: ToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollUp(scrollTop > 0);
      setCanScrollDown(Math.ceil(scrollTop + clientHeight) < scrollHeight);
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

  // Check scroll when selection changes (since tools might appear/disappear)
  useEffect(() => {
    checkScroll();
  }, [selectedNodes.length, mode, checkScroll]);

  const scrollByAmount = (x: number, y: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: x, top: y, behavior: 'smooth' });
      setTimeout(checkScroll, 300);
    }
  };

  const applyTransform = (node: Element, transformStr: string) => {
    const current = node.getAttribute('transform') || '';
    node.setAttribute('transform', `${transformStr} ${current}`.trim());
  };

  const getBBoxSafe = (node: Element) => {
    const svgEl = doc?.documentElement as unknown as SVGSVGElement | null;
    const cw = svgEl?.viewBox?.baseVal?.width || parseInt(svgEl?.getAttribute('width') || '800') || 800;
    const ch = svgEl?.viewBox?.baseVal?.height || parseInt(svgEl?.getAttribute('height') || '800') || 800;

    const svgNS = 'http://www.w3.org/2000/svg';
    const tempSvg = document.createElementNS(svgNS, 'svg');
    tempSvg.style.visibility = 'hidden';
    tempSvg.style.position = 'absolute';
    tempSvg.style.left = '0px';
    tempSvg.style.top = '0px';
    // Ensure 1:1 mapping between viewBox and CSS pixels
    tempSvg.setAttribute('viewBox', `0 0 ${cw} ${ch}`);
    tempSvg.style.width = `${cw}px`;
    tempSvg.style.height = `${ch}px`;

    const clone = node.cloneNode(true) as SVGGraphicsElement;
    tempSvg.appendChild(clone);
    document.body.appendChild(tempSvg);

    let bbox = { x: 0, y: 0, width: 0, height: 0 };
    try {
      const rect = clone.getBoundingClientRect();
      const svgRect = tempSvg.getBoundingClientRect();
      bbox = {
        x: rect.left - svgRect.left,
        y: rect.top - svgRect.top,
        width: rect.width,
        height: rect.height
      };
    } catch (e) {
      // Ignored
    }
    document.body.removeChild(tempSvg);
    return bbox;
  };

  const getCombinedBBox = () => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedNodes.forEach(node => {
      const bbox = getBBoxSafe(node);
      if (bbox && bbox.width > 0 && bbox.height > 0) {
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
      }
    });
    if (minX === Infinity) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const handleFlipX = () => {
    const bbox = getCombinedBBox();
    if (!bbox) return;
    const cx = bbox.x + bbox.width / 2;
    selectedNodes.forEach(node => {
      applyTransform(node, `translate(${cx * 2}, 0) scale(-1, 1)`);
    });
    mutate("Symétrie H", "move", selectedNodes[0]?.getAttribute('id') || "selection");
  };

  const handleFlipY = () => {
    const bbox = getCombinedBBox();
    if (!bbox) return;
    const cy = bbox.y + bbox.height / 2;
    selectedNodes.forEach(node => {
      applyTransform(node, `translate(0, ${cy * 2}) scale(1, -1)`);
    });
    mutate("Symétrie V", "move", selectedNodes[0]?.getAttribute('id') || "selection");
  };

  const handleGroupSelection = () => {
    if (selectedNodes.length === 0 || !doc) return;

    const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    const firstNode = selectedNodes[0];
    const parent = firstNode.parentNode;

    if (parent) {
      parent.insertBefore(group, firstNode);
      selectedNodes.forEach(node => {
        const globalM = getGlobalMatrix(node);
        group.appendChild(node);
        const parentM = getParentGlobalMatrix(group);
        const newLocalM = parentM.inverse().multiply(globalM);
        node.setAttribute('transform', matrixToSVGString(newLocalM));
      });
      mutate("Grouper", "group", group.getAttribute('id') || "groupe");
    }
  };

  const handleUngroupSelection = () => {
    if (selectedNodes.length === 0 || !doc) return;

    selectedNodes.forEach(node => {
      if (node.tagName.toLowerCase() === 'g') {
        const parent = node.parentNode;
        if (parent && parent instanceof Element) {
          const children = Array.from(node.children);
          children.forEach(child => {
            const globalM = getGlobalMatrix(child);
            parent.insertBefore(child, node);
            const parentM = getParentGlobalMatrix(parent);
            const newLocalM = parentM.inverse().multiply(globalM);
            child.setAttribute('transform', matrixToSVGString(newLocalM));
          });
          parent.removeChild(node);
        }
      }
    });
    mutate("Dégrouper", "group", selectedNodes[0]?.getAttribute('id') || selectedNodes[0]?.tagName);
  };

  const handleAlign = (type: string) => {
    if (selectedNodes.length === 0 || !doc?.documentElement) return;

    const svgEl = doc.documentElement as unknown as SVGSVGElement;
    let canvasW = svgEl.viewBox.baseVal?.width || parseInt(svgEl.getAttribute('width') || '800');
    let canvasH = svgEl.viewBox.baseVal?.height || parseInt(svgEl.getAttribute('height') || '800');

    let targetLeft = 0, targetRight = canvasW;
    let targetTop = 0, targetBottom = canvasH;
    let targetCX = canvasW / 2, targetCY = canvasH / 2;

    if (selectedNodes.length > 1) {
      const cbbox = getCombinedBBox();
      if (cbbox) {
        targetLeft = cbbox.x; targetRight = cbbox.x + cbbox.width;
        targetTop = cbbox.y; targetBottom = cbbox.y + cbbox.height;
        targetCX = cbbox.x + cbbox.width / 2; targetCY = cbbox.y + cbbox.height / 2;
      }
    }

    selectedNodes.forEach(node => {
      const bbox = getBBoxSafe(node);
      if (!bbox) return;
      let dx = 0, dy = 0;
      switch (type) {
        case 'left': dx = targetLeft - bbox.x; break;
        case 'center-x': dx = targetCX - (bbox.x + bbox.width / 2); break;
        case 'right': dx = targetRight - (bbox.x + bbox.width); break;
        case 'top': dy = targetTop - bbox.y; break;
        case 'center-y': dy = targetCY - (bbox.y + bbox.height / 2); break;
        case 'bottom': dy = targetBottom - (bbox.y + bbox.height); break;
      }
      if (dx !== 0 || dy !== 0) {
        applyTransform(node, `translate(${dx}, ${dy})`);
      }
    });

    const nodeId = selectedNodes.length === 1 ? (selectedNodes[0].getAttribute('id') || selectedNodes[0].tagName) : "multi";
    mutate("Aligner", "align", nodeId);
  };

  const handleAddShape = (shape: string) => {
    if (!doc || !doc.documentElement) return;
    let newEl: Element | null = null;

    if (shape === 'rect') {
      newEl = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
      newEl.setAttribute('width', '100');
      newEl.setAttribute('height', '100');
      newEl.setAttribute('x', '0');
      newEl.setAttribute('y', '0');
      newEl.setAttribute('fill', '#cccccc');
    } else if (shape === 'circle') {
      newEl = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
      newEl.setAttribute('r', '50');
      newEl.setAttribute('cx', '50');
      newEl.setAttribute('cy', '50');
      newEl.setAttribute('fill', '#cccccc');
    } else if (shape === 'path') {
      newEl = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      newEl.setAttribute('d', 'M 0 0 L 100 0 L 50 100 Z');
      newEl.setAttribute('fill', '#cccccc');
    } else if (shape === 'line') {
      newEl = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
      newEl.setAttribute('x1', '0');
      newEl.setAttribute('y1', '0');
      newEl.setAttribute('x2', '100');
      newEl.setAttribute('y2', '100');
      newEl.setAttribute('stroke', '#cccccc');
      newEl.setAttribute('stroke-width', '2');
    }

    if (newEl) {
      if (selectedNodes.length === 1 && selectedNodes[0].tagName.toLowerCase() === 'g') {
        selectedNodes[0].appendChild(newEl);
      } else {
        doc.documentElement.appendChild(newEl);
      }
      mutate("Ajouter forme", "add", shape);
    }
  };

  // — Drag logic —
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!toolbarRef.current) return;
    isDragging.current = true;
    const rect = toolbarRef.current.getBoundingClientRect();
    const parentRect = toolbarRef.current.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    dragOffset.current = {
      x: e.clientX - (rect.left - parentRect.left),
      y: e.clientY - (rect.top - parentRect.top),
    };
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !toolbarRef.current) return;
    const parentRect = toolbarRef.current.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    const toolbarRect = toolbarRef.current.getBoundingClientRect();
    let newX = e.clientX - dragOffset.current.x;
    let newY = e.clientY - dragOffset.current.y;

    // Clamp inside parent
    newX = Math.max(0, Math.min(newX, parentRect.width - toolbarRect.width));
    newY = Math.max(0, Math.min(newY, parentRect.height - toolbarRect.height));

    setPosition({ x: newX, y: newY });
  }, [setPosition]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const isVertical = orientation === 'vertical';

  // Separator component
  const Sep = () => isVertical
    ? <div className="h-px w-full bg-border/50 my-0.5" />
    : <div className="w-px h-4 bg-border/50 mx-0.5 shrink-0" />;

  // Has custom position been set?
  const hasCustomPosition = position.x !== -1 && position.y !== -1;

  return (
    <div
      ref={toolbarRef}
      className={cn(
        "z-50 flex bg-card/90 backdrop-blur border border-border shadow-md rounded-lg p-1 gap-0.5 lg:gap-1",
        isVertical ? "flex-col items-center w-auto" : "flex-row items-center max-w-[calc(100vw-2rem)] overflow-x-auto",
        hasCustomPosition
          ? "absolute"
          : isVertical
            ? "absolute top-[115px] left-4" // Under zoom controls
            : "absolute top-4 left-1/2 -translate-x-1/2",
      )}
      style={hasCustomPosition ? { left: position.x, top: position.y } : undefined}
    >
      {/* Drag handle */}
      <div
        className={cn(
          "flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0",
          isVertical ? "w-full py-0.5" : "h-full px-0.5"
        )}
        onMouseDown={handleMouseDown}
        title="Déplacer la barre d'outils"
      >
        <GripVertical className={cn("w-3.5 h-3.5", isVertical && "rotate-90")} />
      </div>

      {/* Scroll Up/Left Arrow */}
      {isVertical ? (
         canScrollUp && <button onClick={() => scrollByAmount(0, -150)} className="p-0.5 mb-0.5 rounded-full hover:bg-muted shrink-0 text-muted-foreground transition-colors"><ChevronUp className="w-3.5 h-3.5"/></button>
      ) : (
         canScrollLeft && <button onClick={() => scrollByAmount(-150, 0)} className="p-0.5 mr-0.5 rounded-full hover:bg-muted shrink-0 text-muted-foreground transition-colors"><ChevronLeft className="w-3.5 h-3.5"/></button>
      )}

      {/* Scrollable Container */}
      <div 
        ref={scrollRef}
        onScroll={checkScroll}
        className={cn(
          "flex shrink-0 w-full overflow-auto pointer-events-auto",
          isVertical ? "flex-col items-center gap-0.5 lg:gap-1 max-h-[calc(100vh-250px)]" : "flex-row items-center gap-0.5 lg:gap-1 max-w-[calc(100vw-8rem)]"
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`.hidden-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        <div className={cn("flex w-full shrink-0", isVertical ? "flex-col items-center gap-0.5" : "flex-row items-center gap-0.5")}>
          {/* Modes */}
          <div className={cn("flex gap-1 shrink-0", isVertical ? "flex-col" : "flex-row items-center")}>
            <button
              onClick={() => setMode('select')}
              className={`p-1 rounded transition-colors ${mode === 'select' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
              title="Outil Sélection (V)"
            >
              <MousePointer2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMode('pan')}
              className={`p-1 rounded transition-colors ${mode === 'pan' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
              title="Outil Main / Déplacement (H)"
            >
              <Hand className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMode('edit_path')}
              className={`p-1 rounded transition-colors ${mode === 'edit_path' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
              title="Éditeur de Nœuds (A)"
            >
              <PenLine className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMode('draw_line')}
              className={`p-1 rounded transition-colors ${mode === 'draw_line' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
              title="Dessiner une ligne (L)"
            >
              <Minus className="w-4 h-4 rotate-45" />
            </button>
            <button
              onClick={() => setMode('draw_path')}
              className={`p-1 rounded transition-colors ${mode === 'draw_path' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
              title="Dessiner un chemin (P)"
            >
              <Spline className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMode('scale')}
              className={`p-1 rounded transition-colors ${mode === 'scale' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
              title="Agrandir (S)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMode('rotate')}
              className={`p-1 rounded transition-colors ${mode === 'rotate' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
              title="Rotation (R)"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <Sep />

          <div className={cn("flex gap-1 group relative shrink-0", isVertical ? "flex-col" : "flex-row items-center")}>
            <button
              onClick={() => handleAddShape('rect')}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors flex items-center gap-1"
              title="Ajouter une forme"
            >
              <SquarePlus className="w-4 h-4" />
            </button>
            {/* Simple hover dropdown pour les formes */}
            <div className={cn(
              "absolute bg-card border border-border rounded shadow-lg hidden group-hover:flex flex-col min-w-[120px] overflow-hidden z-50",
              isVertical ? "left-full top-0 ml-1" : "top-full left-0 mt-1"
            )}>
              <button onClick={() => handleAddShape('rect')} className="px-3 py-2 text-sm text-left hover:bg-muted text-muted-foreground hover:text-foreground">Rectangle</button>
              <button onClick={() => handleAddShape('circle')} className="px-3 py-2 text-sm text-left hover:bg-muted text-muted-foreground hover:text-foreground border-t border-border/50">Cercle</button>
              <button onClick={() => handleAddShape('line')} className="px-3 py-2 text-sm text-left hover:bg-muted text-muted-foreground hover:text-foreground border-y border-border/50">Ligne</button>
              <button onClick={() => handleAddShape('path')} className="px-3 py-2 text-sm text-left hover:bg-muted text-muted-foreground hover:text-foreground">Triangle (Path)</button>
            </div>
          </div>

          <Sep />

          <div className={cn("flex gap-1 shrink-0", isVertical ? "flex-col" : "flex-row items-center")}>
            <button
              onClick={handleGroupSelection} disabled={selectedNodes.length === 0}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent rounded transition-colors"
              title="Grouper la sélection"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <button
              onClick={handleUngroupSelection} disabled={selectedNodes.every(n => n.tagName.toLowerCase() !== 'g')}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent rounded transition-colors"
              title="Dégrouper la sélection"
            >
              <FolderMinus className="w-4 h-4" />
            </button>
          </div>

          <Sep />

          <div className={cn("flex gap-1 shrink-0", isVertical ? "flex-col" : "flex-row items-center")}>
            <button
              onClick={undo} disabled={!canUndo}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent rounded transition-colors"
              title="Annuler (Undo)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo} disabled={!canRedo}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent rounded transition-colors"
              title="Rétablir (Redo)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <Sep />

          <div className={cn("flex gap-1 shrink-0", isVertical ? "flex-col" : "flex-row items-center")}>
            <button
              onClick={handleFlipX} disabled={selectedNodes.length === 0}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent rounded transition-colors"
              title="Symétrie Horizontale"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={handleFlipY} disabled={selectedNodes.length === 0}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent rounded transition-colors"
              title="Symétrie Verticale"
            >
              <FlipVertical className="w-4 h-4" />
            </button>
          </div>

          <Sep />

          <div className={cn("flex gap-1 shrink-0", isVertical ? "flex-col" : "flex-row items-center")}>
            <button onClick={() => handleAlign('left')} disabled={selectedNodes.length === 0} className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 rounded"><AlignLeft className="w-4 h-4" /></button>
            <button onClick={() => handleAlign('center-x')} disabled={selectedNodes.length === 0} className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 rounded" title="Centrer X"><AlignCenter className="w-4 h-4" /></button>
            <button onClick={() => handleAlign('right')} disabled={selectedNodes.length === 0} className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 rounded" title="Aligner Droite"><AlignRight className="w-4 h-4" /></button>

            {isVertical ? <Sep /> : <div className="w-px h-4 bg-border/50 mx-1 shrink-0"></div>}

            <button onClick={() => handleAlign('top')} disabled={selectedNodes.length === 0} className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 rounded rotate-90" title="Aligner Haut"><AlignLeft className="w-4 h-4" /></button>
            <button onClick={() => handleAlign('center-y')} disabled={selectedNodes.length === 0} className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 rounded rotate-90" title="Centrer Y"><AlignCenter className="w-4 h-4" /></button>
            <button onClick={() => handleAlign('bottom')} disabled={selectedNodes.length === 0} className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 rounded rotate-90" title="Aligner Bas"><AlignRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Scroll Down/Right Arrow */}
      {isVertical ? (
         canScrollDown && <button onClick={() => scrollByAmount(0, 150)} className="p-0.5 mt-0.5 rounded-full hover:bg-muted shrink-0 text-muted-foreground transition-colors"><ChevronDown className="w-3.5 h-3.5"/></button>
      ) : (
         canScrollRight && <button onClick={() => scrollByAmount(150, 0)} className="p-0.5 ml-0.5 rounded-full hover:bg-muted shrink-0 text-muted-foreground transition-colors"><ChevronRight className="w-3.5 h-3.5"/></button>
      )}

    </div>
  );
}
