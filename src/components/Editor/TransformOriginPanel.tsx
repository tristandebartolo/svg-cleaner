import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type TransformOrigin = 
  'top-left' | 'top-center' | 'top-right' |
  'center-left' | 'center' | 'center-right' |
  'bottom-left' | 'bottom-center' | 'bottom-right';

interface TransformOriginPanelProps {
  origin: TransformOrigin;
  setOrigin: (origin: TransformOrigin) => void;
  visible: boolean;
}

export default function TransformOriginPanel({ origin, setOrigin, visible }: TransformOriginPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  
  // Try to load saved position from localStorage, otherwise null (means use default top-right CSS)
  const [position, setPosition] = useState<{ x: number | null; y: number | null }>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('svg-origin-panel-pos');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return { x: null, y: null };
  });

  useEffect(() => {
    if (position.x !== null) {
      localStorage.setItem('svg-origin-panel-pos', JSON.stringify(position));
    }
  }, [position]);
  
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return;
    isDragging.current = true;
    const rect = panelRef.current.getBoundingClientRect();
    const parentRect = panelRef.current.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    
    // In case this is the first drag, ensure position switches to exact explicit px values
    if (position.x === null) {
       setPosition({ x: rect.left - parentRect.left, y: rect.top - parentRect.top });
    }
    
    dragOffset.current = {
      x: e.clientX - (rect.left - parentRect.left),
      y: e.clientY - (rect.top - parentRect.top),
    };
    e.preventDefault();
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !panelRef.current) return;
    const parentRect = panelRef.current.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    
    const panelRect = panelRef.current.getBoundingClientRect();
    let newX = e.clientX - dragOffset.current.x;
    let newY = e.clientY - dragOffset.current.y;
    
    // Clamp inside parent
    newX = Math.max(0, Math.min(newX, parentRect.width - panelRect.width));
    newY = Math.max(0, Math.min(newY, parentRect.height - panelRect.height));
    
    setPosition({ x: newX, y: newY });
  }, []);

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

  if (!visible) return null;

  const points: { id: TransformOrigin, x: number, y: number }[] = [
    { id: 'top-left', x: 0, y: 0 },
    { id: 'top-center', x: 1, y: 0 },
    { id: 'top-right', x: 2, y: 0 },
    { id: 'center-left', x: 0, y: 1 },
    { id: 'center', x: 1, y: 1 },
    { id: 'center-right', x: 2, y: 1 },
    { id: 'bottom-left', x: 0, y: 2 },
    { id: 'bottom-center', x: 1, y: 2 },
    { id: 'bottom-right', x: 2, y: 2 },
  ];

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute z-50 bg-card/95 backdrop-blur border border-border shadow-lg rounded-lg overflow-hidden flex flex-col pointer-events-auto",
        position.x === null ? "top-4 right-4" : ""
      )}
      style={position.x !== null ? { left: position.x, top: position.y! } : undefined}
    >
      <div className="flex flex-col">
        {/* Header / Drag handle */}
        <div className="flex items-center justify-between px-1 py-1 bg-muted/50 border-b border-border/50">
          <div 
            className="flex-1 flex items-center gap-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground py-0.5 px-1 transition-colors"
            onMouseDown={handleMouseDown}
          >
            <GripVertical className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wider select-none">Origine</span>
          </div>
          <button 
            onClick={() => setCollapsed(c => !c)}
            className="p-1 hover:bg-muted rounded text-muted-foreground transition-colors ml-1"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Matrix Grid */}
        {!collapsed && (
          <div className="p-3 select-none">
            <div className="grid grid-cols-3 gap-1.5 w-[72px] h-[72px] mx-auto relative border-[1px] border-border/40 bg-background/50 outline outline-1 outline-border/20 outline-offset-1">
              {/* Lines bridging points for visual guide */}
              <div className="absolute top-1/2 left-0 right-0 h-px bg-border/40 -translate-y-1/2 pointer-events-none" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/40 -translate-x-1/2 pointer-events-none" />
              
              {points.map((p) => (
                <button
                  key={p.id}
                  className="w-full h-full p-0 flex items-center justify-center relative z-10"
                  onClick={() => setOrigin(p.id)}
                  title={`Origine: ${p.id.replace('-', ' ')}`}
                >
                  <div className={cn(
                    "w-3 h-3 border transition-all duration-200",
                    origin === p.id 
                      ? "bg-purple-500 border-purple-600 scale-125 rounded-[3px]" 
                      : "bg-background border-border hover:border-purple-400 hover:bg-purple-500/20"
                  )} />
                </button>
              ))}
            </div>
            
            <div className="mt-3 text-center text-[10px] text-muted-foreground leading-tight">
              Axe de rotation
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
