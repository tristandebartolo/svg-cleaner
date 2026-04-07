import { useEffect, useRef, useState, useCallback } from 'react';
import type { EditorMode, HistoryEntry } from './EditorLayout';
import type { TransformOrigin } from './TransformOriginPanel';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { parsePath, serializePath, getPathPoints, absolutize, insertPointInPath, getHandleLines, convertSegmentToCurve, convertSegmentToLine, convertSegmentToQuadCurve, type PathPoint, type PathCommand } from '../../utils/pathUtils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── PERF: Incremental attribute sync instead of full innerHTML rebuild ──

function syncAttributes(source: Element, target: Element) {
  const toRemove: string[] = [];
  for (let i = 0; i < target.attributes.length; i++) {
    const name = target.attributes[i].name;
    if (name === 'style') continue;
    if (!source.hasAttribute(name)) toRemove.push(name);
  }
  toRemove.forEach(n => target.removeAttribute(n));
  for (let i = 0; i < source.attributes.length; i++) {
    const { name, value } = source.attributes[i];
    if (target.getAttribute(name) !== value) {
      target.setAttribute(name, value);
    }
  }
}

function syncTrees(source: Element, target: Element): boolean {
  if (source.tagName !== target.tagName) return false;
  if (source.children.length !== target.children.length) return false;
  syncAttributes(source, target);
  for (let i = 0; i < source.children.length; i++) {
    if (!syncTrees(source.children[i], target.children[i])) return false;
  }
  return true;
}

function applyRootOverrides(svgEl: HTMLElement | SVGElement) {
  svgEl.removeAttribute('width');
  svgEl.removeAttribute('height');
  (svgEl as HTMLElement).style.width = '100%';
  (svgEl as HTMLElement).style.height = '100%';
  (svgEl as HTMLElement).style.maxHeight = 'none';
  (svgEl as HTMLElement).style.maxWidth = 'none';
}

// ─────────────────────────────────────────────────────────────────────────

interface SvgPreviewProps {
  doc: Document;
  selectedNodes: Element[];
  onSelectNode: (node: Element | null, multi?: boolean) => void;
  revision: number;
  mutate: (label?: string, type?: HistoryEntry['type'], nodeId?: string, color?: string) => void;
  mode: EditorMode;
  grid: { visible: boolean; size: number; color: string };
  transformOrigin?: TransformOrigin;
}

export default function SvgPreview({ doc, selectedNodes, onSelectNode, revision, mutate, mode, grid, transformOrigin = 'center' }: SvgPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightBox, setHighlightBox] = useState<{top: number, left: number, width: number, height: number} | null>(null);
  const [pathPoints, setPathPoints] = useState<PathPoint[]>([]);
  const [screenHandleLines, setScreenHandleLines] = useState<{ax: number; ay: number; cx: number; cy: number}[]>([]);

  const editingCommandsRef = useRef<PathCommand[]>([]);
  const draggedPointIndexRef = useRef<number | null>(null);
  const [, forceRender] = useState(0);

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Compute container size from SVG viewBox (fit into max 800px preserving aspect ratio)
  const canvasSize = (() => {
    const svgEl = doc?.documentElement as unknown as SVGSVGElement | null;
    const vb = svgEl?.viewBox?.baseVal;
    const w = vb?.width || parseInt(svgEl?.getAttribute('width') || '800') || 800;
    const h = vb?.height || parseInt(svgEl?.getAttribute('height') || '800') || 800;
    const maxDim = 800;
    const scale = Math.min(maxDim / w, maxDim / h);
    return { w: w * scale, h: h * scale };
  })();

  const realSelectedNodesRef = useRef<Element[]>([]);

  // PERF: Stable refs to avoid re-running effects on every render
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onSelectNodeRef = useRef(onSelectNode);
  onSelectNodeRef.current = onSelectNode;
  const selectedNodesRef = useRef(selectedNodes);
  selectedNodesRef.current = selectedNodes;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // PERF: Node map (clone element → real doc element) survives incremental syncs
  const nodeMapRef = useRef<Map<Element, Element>>(new Map());
  const lastDocRef = useRef<Document | null>(null);

  const projectToScreen = useCallback((sx: number, sy: number, ctm: DOMMatrix, containerRect: DOMRect, z: number) => {
    const pt = new DOMPoint(sx, sy).matrixTransform(ctm);
    return { x: (pt.x - containerRect.left) / z, y: (pt.y - containerRect.top) / z };
  }, []);

  const computeScreenPoints = useCallback((commands: PathCommand[], visualPathEl: SVGGraphicsElement): PathPoint[] => {
    if (!containerRef.current) return [];
    const ctm = visualPathEl.getScreenCTM();
    if (!ctm) return [];
    const containerRect = containerRef.current.getBoundingClientRect();
    const points = getPathPoints(commands);
    const z = zoomRef.current;
    return points.map(p => {
      const s = projectToScreen(p.x, p.y, ctm, containerRect, z);
      return { ...p, x: s.x, y: s.y };
    });
  }, [projectToScreen]);

  const computeScreenHandles = useCallback((commands: PathCommand[], visualPathEl: SVGGraphicsElement) => {
    if (!containerRef.current) return [];
    const ctm = visualPathEl.getScreenCTM();
    if (!ctm) return [];
    const containerRect = containerRef.current.getBoundingClientRect();
    const z = zoomRef.current;
    const handles = getHandleLines(commands);
    return handles.map(h => {
      const a = projectToScreen(h.ax, h.ay, ctm, containerRect, z);
      const c = projectToScreen(h.cx, h.cy, ctm, containerRect, z);
      return { ax: a.x, ay: a.y, cx: c.x, cy: c.y };
    });
  }, [projectToScreen]);

  // PERF: updateHighlight reads from refs — no deps that change frequently
  const updateHighlight = useCallback(() => {
    const currentMode = modeRef.current;
    const currentSelected = selectedNodesRef.current;

    if (!containerRef.current || realSelectedNodesRef.current.length === 0) {
      setHighlightBox(null);
      setPathPoints([]);
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    realSelectedNodesRef.current.forEach(node => {
      const nodeRect = node.getBoundingClientRect();
      if (nodeRect.width > 0 && nodeRect.height > 0) {
        minX = Math.min(minX, nodeRect.left);
        minY = Math.min(minY, nodeRect.top);
        maxX = Math.max(maxX, nodeRect.right);
        maxY = Math.max(maxY, nodeRect.bottom);
      }
    });

    if (minX !== Infinity) {
      const z = zoomRef.current;
      setHighlightBox({
        top: (minY - containerRect.top) / z,
        left: (minX - containerRect.left) / z,
        width: (maxX - minX) / z,
        height: (maxY - minY) / z
      });
    } else {
      setHighlightBox(null);
    }

    if (currentMode === 'edit_path' && currentSelected.length === 1 && currentSelected[0].tagName.toLowerCase() === 'path') {
      const d = currentSelected[0].getAttribute('d');
      if (d) {
        let commands = parsePath(d);
        commands = absolutize(commands);
        editingCommandsRef.current = commands;
        const visualPathEl = realSelectedNodesRef.current[0] as SVGGraphicsElement;
        if (visualPathEl) {
          setPathPoints(computeScreenPoints(commands, visualPathEl));
          setScreenHandleLines(computeScreenHandles(commands, visualPathEl));
        }
      }
    } else if (currentMode !== 'edit_path') {
      setPathPoints([]);
      setScreenHandleLines([]);
      editingCommandsRef.current = [];
    }
  }, [computeScreenPoints, computeScreenHandles]);

  // PERF: Update selection mapping from nodeMap without walking the DOM
  const updateSelectionMapping = useCallback(() => {
    realSelectedNodesRef.current = [];
    const sel = selectedNodesRef.current;
    nodeMapRef.current.forEach((realNode, cloneNode) => {
      if (sel.includes(realNode)) {
        realSelectedNodesRef.current.push(cloneNode);
      }
    });
  }, []);

  // ── Main DOM sync/rebuild effect ──
  useEffect(() => {
    if (!containerRef.current) return;

    let didFullRebuild = false;
    const existingSvg = containerRef.current.querySelector('svg');

    // PERF: If same document object, try incremental attribute sync
    if (existingSvg && doc === lastDocRef.current) {
      const synced = syncTrees(doc.documentElement, existingSvg);
      if (synced) {
        applyRootOverrides(existingSvg);
        didFullRebuild = false;
      } else {
        didFullRebuild = true;
      }
    } else {
      didFullRebuild = true;
    }

    if (didFullRebuild) {
      lastDocRef.current = doc;

      const serializer = new XMLSerializer();
      const raw = serializer.serializeToString(doc.documentElement);
      containerRef.current.innerHTML = raw;

      const svgEl = containerRef.current.querySelector('svg');
      if (svgEl) applyRootOverrides(svgEl);

      // Build node map + attach listeners (parallel walk)
      nodeMapRef.current = new Map();
      const walkPair = (cloneNode: Element, realNode: Element) => {
        nodeMapRef.current.set(cloneNode, realNode);
        cloneNode.addEventListener('pointerdown', (e) => {
          if (modeRef.current === 'pan') return;
          e.stopPropagation();
          const me = e as PointerEvent;
          onSelectNodeRef.current(realNode, me.shiftKey || me.metaKey || me.ctrlKey);
        });
        const len = Math.min(cloneNode.children.length, realNode.children.length);
        for (let i = 0; i < len; i++) {
          walkPair(cloneNode.children[i], realNode.children[i]);
        }
      };

      if (svgEl) {
        const len = Math.min(svgEl.children.length, doc.documentElement.children.length);
        for (let i = 0; i < len; i++) {
          walkPair(svgEl.children[i], doc.documentElement.children[i]);
        }
      }
    }

    // Update selection + highlight
    updateSelectionMapping();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => updateHighlight());
    });
  }, [doc, revision, updateSelectionMapping, updateHighlight]);

  // ── Selection/mode change effect (no DOM rebuild needed) ──
  useEffect(() => {
    updateSelectionMapping();
    requestAnimationFrame(() => updateHighlight());
  }, [selectedNodes, mode, updateSelectionMapping, updateHighlight]);

  // ── Pan & Zoom handlers ──
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  const isDrawing = useRef(false);
  const drawingLineEl = useRef<SVGLineElement | null>(null);

  // ── Marquee (rubber-band) selection ──
  const isMarquee = useRef(false);
  const marqueeStart = useRef({ x: 0, y: 0 });
  const [marqueeRect, setMarqueeRect] = useState<{x: number; y: number; w: number; h: number} | null>(null);

  // ── Draw Path state ──
  const isDrawingPath = useRef(false);
  const drawPathPointsRef = useRef<{x: number; y: number}[]>([]);
  const drawPathPreviewEl = useRef<SVGPathElement | null>(null);
  const drawPathPreviewLine = useRef<SVGLineElement | null>(null);
  const drawPathTargetRef = useRef<SVGGraphicsElement | null>(null);
  const [drawPathPoints, setDrawPathPoints] = useState<{x: number; y: number}[]>([]);

  const getDrawPathTargetNode = (): SVGGraphicsElement | null => {
    const svgEl = containerRef.current?.querySelector('svg');
    if (!svgEl) return null;
    let target: SVGGraphicsElement = svgEl;
    if (selectedNodes.length === 1 && selectedNodes[0].tagName.toLowerCase() === 'g' && realSelectedNodesRef.current[0] instanceof SVGGraphicsElement) {
      target = realSelectedNodesRef.current[0] as SVGGraphicsElement;
    }
    return target;
  };

  const svgPointFromClient = (clientX: number, clientY: number, target: SVGGraphicsElement): {x: number; y: number} | null => {
    const ctm = target.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  };

  const buildPathD = (points: {x: number; y: number}[]): string => {
    if (points.length === 0) return '';
    return points.map((p, i) => i === 0 ? `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}` : `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  };

  const finalizeDrawPath = useCallback(() => {
    if (!isDrawingPath.current) return;
    isDrawingPath.current = false;
    const points = drawPathPointsRef.current;
    
    // Clean up preview elements
    if (drawPathPreviewEl.current?.parentNode) drawPathPreviewEl.current.parentNode.removeChild(drawPathPreviewEl.current);
    if (drawPathPreviewLine.current?.parentNode) drawPathPreviewLine.current.parentNode.removeChild(drawPathPreviewLine.current);
    drawPathPreviewEl.current = null;
    drawPathPreviewLine.current = null;
    drawPathTargetRef.current = null;
    drawPathPointsRef.current = [];
    setDrawPathPoints([]);
    
    // Only create if at least 2 points
    if (points.length >= 2 && doc && doc.documentElement) {
      const newPath = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      newPath.setAttribute('d', buildPathD(points));
      newPath.setAttribute('fill', 'none');
      newPath.setAttribute('stroke', '#000000');
      newPath.setAttribute('stroke-width', '2');
      newPath.setAttribute('stroke-linecap', 'round');
      newPath.setAttribute('stroke-linejoin', 'round');
      
      let target: Element = doc.documentElement;
      if (selectedNodes.length === 1 && selectedNodes[0].tagName.toLowerCase() === 'g') {
        target = selectedNodes[0];
      }
      target.appendChild(newPath);
      mutate("Tracer chemin", "add", "path");
    }
  }, [doc, selectedNodes, mutate]);

  // Keyboard handler for Escape/Enter to finalize path
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Escape' || e.key === 'Enter') && isDrawingPath.current) {
        e.preventDefault();
        finalizeDrawPath();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finalizeDrawPath]);

  const onWorkspacePointerDown = (e: React.PointerEvent) => {
    // ── Draw Path: each click adds a point ──
    if (mode === 'draw_path') {
      const targetNode = getDrawPathTargetNode();
      if (!targetNode) return;
      const svgPt = svgPointFromClient(e.clientX, e.clientY, targetNode);
      if (!svgPt) return;
      
      if (!isDrawingPath.current) {
        // Start a new path
        isDrawingPath.current = true;
        drawPathPointsRef.current = [svgPt];
        drawPathTargetRef.current = targetNode;
        
        // Create preview path element
        const previewPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        previewPath.setAttribute('d', buildPathD([svgPt]));
        previewPath.setAttribute('fill', 'none');
        previewPath.setAttribute('stroke', '#80f63bff');
        previewPath.setAttribute('stroke-width', '2');
        previewPath.setAttribute('stroke-dasharray', '6 3');
        previewPath.setAttribute('stroke-linecap', 'round');
        previewPath.setAttribute('stroke-linejoin', 'round');
        previewPath.setAttribute('pointer-events', 'none');
        targetNode.appendChild(previewPath);
        drawPathPreviewEl.current = previewPath;
        
        // Create preview line (from last point to cursor)
        const previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        previewLine.setAttribute('x1', svgPt.x.toString());
        previewLine.setAttribute('y1', svgPt.y.toString());
        previewLine.setAttribute('x2', svgPt.x.toString());
        previewLine.setAttribute('y2', svgPt.y.toString());
        previewLine.setAttribute('stroke', '#3b82f680');
        previewLine.setAttribute('stroke-width', '1.5');
        previewLine.setAttribute('stroke-dasharray', '4 4');
        previewLine.setAttribute('pointer-events', 'none');
        targetNode.appendChild(previewLine);
        drawPathPreviewLine.current = previewLine;
        
        setDrawPathPoints([svgPt]);
      } else {
        // Add a new segment
        drawPathPointsRef.current.push(svgPt);
        const pts = [...drawPathPointsRef.current];
        setDrawPathPoints(pts);
        
        // Update preview path
        if (drawPathPreviewEl.current) {
          drawPathPreviewEl.current.setAttribute('d', buildPathD(pts));
        }
        // Update preview line origin
        if (drawPathPreviewLine.current) {
          drawPathPreviewLine.current.setAttribute('x1', svgPt.x.toString());
          drawPathPreviewLine.current.setAttribute('y1', svgPt.y.toString());
        }
      }
      return;
    }

    // ── Draw Line ──
    if (mode === 'draw_line') {
      const svgEl = containerRef.current?.querySelector('svg');
      if (!svgEl) return;
      
      let targetVisualNode: SVGGraphicsElement = svgEl;
      if (selectedNodes.length === 1 && selectedNodes[0].tagName.toLowerCase() === 'g' && realSelectedNodesRef.current[0] instanceof SVGGraphicsElement) {
        targetVisualNode = realSelectedNodesRef.current[0] as SVGGraphicsElement;
      }

      const ctm = targetVisualNode.getScreenCTM();
      if (!ctm) return;
      
      const invM = ctm.inverse();
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(invM);
      
      isDrawing.current = true;
      drawingLineEl.current = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      drawingLineEl.current.setAttribute('x1', pt.x.toString());
      drawingLineEl.current.setAttribute('y1', pt.y.toString());
      drawingLineEl.current.setAttribute('x2', pt.x.toString());
      drawingLineEl.current.setAttribute('y2', pt.y.toString());
      drawingLineEl.current.setAttribute('stroke', '#000000');
      drawingLineEl.current.setAttribute('stroke-width', '2');
      drawingLineEl.current.setAttribute('stroke-linecap', 'round');
      drawingLineEl.current.setAttribute('pointer-events', 'none');
      
      targetVisualNode.appendChild(drawingLineEl.current);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (mode === 'pan' || e.button === 1) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else if (mode === 'select') {
      // Any click that reaches here was NOT on a known SVG element
      // (those have stopPropagation in their mousedown listener).
      // Start marquee selection.
      // Store workspace-relative coordinates (backdrop-blur creates a containing block that breaks fixed positioning)
      const wsRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      isMarquee.current = true;
      marqueeStart.current = { x: e.clientX - wsRect.left, y: e.clientY - wsRect.top };
      setMarqueeRect(null);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onWorkspacePointerMove = (e: React.PointerEvent) => {
    // ── Draw Path: preview line follows cursor ──
    if (isDrawingPath.current && mode === 'draw_path' && drawPathPreviewLine.current && drawPathTargetRef.current) {
      const svgPt = svgPointFromClient(e.clientX, e.clientY, drawPathTargetRef.current);
      if (svgPt) {
        drawPathPreviewLine.current.setAttribute('x2', svgPt.x.toString());
        drawPathPreviewLine.current.setAttribute('y2', svgPt.y.toString());
      }
      return;
    }

    // ── Draw Line ──
    if (isDrawing.current && mode === 'draw_line' && drawingLineEl.current) {
      const svgEl = containerRef.current?.querySelector('svg');
      if (!svgEl) return;
      
      let targetVisualNode: SVGGraphicsElement = svgEl;
      if (selectedNodes.length === 1 && selectedNodes[0].tagName.toLowerCase() === 'g' && realSelectedNodesRef.current[0] instanceof SVGGraphicsElement) {
        targetVisualNode = realSelectedNodesRef.current[0] as SVGGraphicsElement;
      }
      
      const ctm = targetVisualNode.getScreenCTM();
      if (!ctm) return;
      
      const invM = ctm.inverse();
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(invM);
      
      drawingLineEl.current.setAttribute('x2', pt.x.toString());
      drawingLineEl.current.setAttribute('y2', pt.y.toString());
      return;
    }

    // ── Marquee drag ──
    if (isMarquee.current && mode === 'select') {
      const wsRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const cx = e.clientX - wsRect.left;
      const cy = e.clientY - wsRect.top;
      const x = Math.min(marqueeStart.current.x, cx);
      const y = Math.min(marqueeStart.current.y, cy);
      const w = Math.abs(cx - marqueeStart.current.x);
      const h = Math.abs(cy - marqueeStart.current.y);
      setMarqueeRect({ x, y, w, h });
      return;
    }

    if (isPanning.current) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    }
  };

  const onWorkspacePointerUp = (e: React.PointerEvent) => {
    if (isDrawing.current && mode === 'draw_line' && drawingLineEl.current) {
      isDrawing.current = false;
      const el = drawingLineEl.current;
      drawingLineEl.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      
      if (el.parentNode) {
         el.parentNode.removeChild(el);
      }
      
      const x1 = parseFloat(el.getAttribute('x1') || '0');
      const x2 = parseFloat(el.getAttribute('x2') || '0');
      const y1 = parseFloat(el.getAttribute('y1') || '0');
      const y2 = parseFloat(el.getAttribute('y2') || '0');
      
      if (Math.hypot(x2 - x1, y2 - y1) > 2) {
         if (doc && doc.documentElement) {
            const newEl = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
            newEl.setAttribute('x1', x1.toFixed(2));
            newEl.setAttribute('y1', y1.toFixed(2));
            newEl.setAttribute('x2', x2.toFixed(2));
            newEl.setAttribute('y2', y2.toFixed(2));
            newEl.setAttribute('stroke', '#000000');
            newEl.setAttribute('stroke-width', '2');
            newEl.setAttribute('stroke-linecap', 'round');
            
            let target: Element = doc.documentElement;
            if (selectedNodes.length === 1 && selectedNodes[0].tagName.toLowerCase() === 'g') {
              target = selectedNodes[0];
            }
            target.appendChild(newEl);
            mutate("Tracer ligne", "add", "line");
         }
      }
      return;
    }

    // ── Marquee release ──
    if (isMarquee.current && mode === 'select') {
      isMarquee.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      const rect = marqueeRect;
      setMarqueeRect(null);
      
      if (!rect || rect.w < 4 || rect.h < 4) {
        // Tiny drag = click on empty = deselect
        onSelectNode(null);
        return;
      }
      
      // Find all visible leaf SVG elements whose screen rects intersect the marquee
      const svgEl = containerRef.current?.querySelector('svg');
      if (!svgEl) return;
      
      // Convert workspace-relative marquee rect to viewport coords for comparing with getBoundingClientRect
      const wsRect2 = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const absRect = {
        left: rect.x + wsRect2.left,
        top: rect.y + wsRect2.top,
        right: rect.x + rect.w + wsRect2.left,
        bottom: rect.y + rect.h + wsRect2.top
      };
      
      const matched: Element[] = [];
      const walk = (cloneParent: Element, realParent: Element) => {
        for (let i = 0; i < cloneParent.children.length; i++) {
          const cloneChild = cloneParent.children[i];
          const realChild = realParent.children[i];
          if (!realChild) continue;
          
          const tag = cloneChild.tagName.toLowerCase();
          if (['defs', 'title', 'desc', 'metadata', 'style'].includes(tag)) continue;
          
          // If it's a group, recurse into children
          if (tag === 'g') {
            walk(cloneChild, realChild);
            continue;
          }
          
          const childRect = cloneChild.getBoundingClientRect();
          if (childRect.width <= 0 || childRect.height <= 0) continue;
          
          // Check intersection using viewport coords
          if (
            childRect.left < absRect.right &&
            childRect.right > absRect.left &&
            childRect.top < absRect.bottom &&
            childRect.bottom > absRect.top
          ) {
            matched.push(realChild);
          }
        }
      };
      
      walk(svgEl, doc.documentElement);
      
      if (matched.length > 0) {
        // Select all matched by calling onSelectNode with multi=true for each
        onSelectNode(null); // clear first
        matched.forEach((node, i) => {
          onSelectNode(node, i > 0); // first = solo, rest = multi
        });
      } else {
        onSelectNode(null);
      }
      return;
    }

    if (isPanning.current) {
      isPanning.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  // ── Element drag handlers ──
  const isDraggingEl = useRef(false);
  const dragStartPosEl = useRef({ x: 0, y: 0 });
  const startTransformsRef = useRef<string[]>([]);
  const activeCornerRef = useRef<string | null>(null);
  const startBBoxRef = useRef<{ x: number, y: number, width: number, height: number } | null>(null);

  const getOriginPoint = (bbox: NonNullable<typeof startBBoxRef.current>, originType: TransformOrigin) => {
    let ox = bbox.x + bbox.width / 2;
    let oy = bbox.y + bbox.height / 2;
    
    if (originType.includes('left')) ox = bbox.x;
    if (originType.includes('right')) ox = bbox.x + bbox.width;
    if (originType.includes('top')) oy = bbox.y;
    if (originType.includes('bottom')) oy = bbox.y + bbox.height;
    
    return { ox, oy };
  };

  const onElPointerDown = (e: React.PointerEvent, corner?: string) => {
    if (mode === 'edit_path' && pathPoints.length > 0) return;
    if (mode !== 'select' && mode !== 'scale' && mode !== 'rotate') return;
    if (selectedNodes.length === 0 || realSelectedNodesRef.current.length === 0) return;
    
    // Constraint: Only corners can be dragged in scale/rotate mode
    if ((mode === 'scale' || mode === 'rotate') && !corner) return;
    
    e.stopPropagation();
    isDraggingEl.current = true;
    dragStartPosEl.current = { x: e.clientX, y: e.clientY };
    startTransformsRef.current = selectedNodes.map(n => n.getAttribute('transform') || '');
    activeCornerRef.current = corner || null;
    
    // Store original BBox for origin math
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    realSelectedNodesRef.current.forEach(node => {
      const nodeRect = node.getBoundingClientRect();
      if (nodeRect.width > 0 && nodeRect.height > 0) {
        minX = Math.min(minX, nodeRect.left);
        minY = Math.min(minY, nodeRect.top);
        maxX = Math.max(maxX, nodeRect.right);
        maxY = Math.max(maxY, nodeRect.bottom);
      }
    });
    if (minX !== Infinity) {
      startBBoxRef.current = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    } else {
      startBBoxRef.current = null;
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onElPointerMove = (e: React.PointerEvent) => {
    // Path node dragging
    if (draggedPointIndexRef.current !== null && selectedNodes.length === 1 && containerRef.current) {
      const pointIndex = draggedPointIndexRef.current;
      const commands = editingCommandsRef.current;
      const point = getPathPoints(commands)[pointIndex];
      if (!point) return;

      const visualPathEl = realSelectedNodesRef.current[0] as SVGGraphicsElement;
      if (!visualPathEl) return;
      const ctm = visualPathEl.getScreenCTM();
      if (!ctm) return;
      const invM = ctm.inverse();
      const localPoint = new DOMPoint(e.clientX, e.clientY).matrixTransform(invM);

      const newCommands = commands.map((cmd, i) => i === point.cmdIndex ? { ...cmd, values: [...cmd.values] } : cmd);
      const cmd = newCommands[point.cmdIndex];

      if (cmd.type === 'V') {
        cmd.values[point.valIndex] = localPoint.y;
      } else if (cmd.type === 'H') {
        cmd.values[point.valIndex] = localPoint.x;
      } else {
        cmd.values[point.valIndex] = localPoint.x;
        cmd.values[point.valIndex + 1] = localPoint.y;
      }

      editingCommandsRef.current = newCommands;
      const newD = serializePath(newCommands);
      visualPathEl.setAttribute('d', newD);
      selectedNodes[0].setAttribute('d', newD);
      setPathPoints(computeScreenPoints(newCommands, visualPathEl));
      setScreenHandleLines(computeScreenHandles(newCommands, visualPathEl));
      return;
    }

    // Element Transformation (Move, Scale, Rotate)
    if (isDraggingEl.current && selectedNodes.length > 0) {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      realSelectedNodesRef.current.forEach((gEl, idx) => {
        const svgGraphicsEl = gEl as SVGGraphicsElement;
        const ctm = svgGraphicsEl.getScreenCTM();
        if (!ctm) return;
        
        let newTransform = startTransformsRef.current[idx];

        const parentEl = svgGraphicsEl.parentNode as SVGGraphicsElement;
        const parentCTM = parentEl && typeof parentEl.getScreenCTM === 'function' ? parentEl.getScreenCTM() : null;
        const invM = parentCTM ? parentCTM.inverse() : ctm.inverse();

        if (mode === 'select') {
          // MOVE logic
          const p1 = new DOMPoint(dragStartPosEl.current.x, dragStartPosEl.current.y).matrixTransform(invM);
          const p2 = new DOMPoint(e.clientX, e.clientY).matrixTransform(invM);
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          newTransform = `translate(${dx}, ${dy}) ${startTransformsRef.current[idx]}`.trim();
        } 
        else if (mode === 'scale' && startBBoxRef.current) {
          // SCALE logic
          const bbox = startBBoxRef.current;
          const cx = bbox.x + bbox.width / 2;
          const cy = bbox.y + bbox.height / 2;
          
          const startDist = Math.hypot(dragStartPosEl.current.x - cx, dragStartPosEl.current.y - cy);
          const currentDist = Math.hypot(e.clientX - cx, e.clientY - cy);
          if (startDist > 0) {
             const scaleF = currentDist / startDist;
             const parentCenter = new DOMPoint(cx, cy).matrixTransform(invM);
             newTransform = `translate(${parentCenter.x}, ${parentCenter.y}) scale(${scaleF}) translate(${-parentCenter.x}, ${-parentCenter.y}) ${startTransformsRef.current[idx]}`.trim();
          }
        }
        else if (mode === 'rotate' && startBBoxRef.current) {
          // ROTATE logic
          const bbox = startBBoxRef.current;
          const { ox, oy } = getOriginPoint(bbox, transformOrigin);
          
          const startAngle = Math.atan2(dragStartPosEl.current.y - oy, dragStartPosEl.current.x - ox);
          const currentAngle = Math.atan2(e.clientY - oy, e.clientX - ox);
          let deltaAngle = (currentAngle - startAngle) * 180 / Math.PI;

          // Snap to 15deg if Shift is held
          if (e.shiftKey) deltaAngle = Math.round(deltaAngle / 15) * 15;

          const parentCenter = new DOMPoint(ox, oy).matrixTransform(invM);
          newTransform = `translate(${parentCenter.x}, ${parentCenter.y}) rotate(${deltaAngle}) translate(${-parentCenter.x}, ${-parentCenter.y}) ${startTransformsRef.current[idx]}`.trim();
        }

        svgGraphicsEl.setAttribute('transform', newTransform);
      });
      updateHighlight();
    }
  };

  const onElPointerUp = (e: React.PointerEvent) => {
    if (isDraggingEl.current) {
      isDraggingEl.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      realSelectedNodesRef.current.forEach((gEl, idx) => {
        selectedNodes[idx].setAttribute('transform', gEl.getAttribute('transform') || '');
      });
      const firstId = selectedNodes[0]?.getAttribute('id') || selectedNodes[0]?.tagName || "élément";
      
      let actionLabel = "Déplacement";
      let actionType: HistoryEntry['type'] = "move";
      
      if (mode === 'scale') {
        actionLabel = "Agrandissement";
        actionType = "scale";
      } else if (mode === 'rotate') {
        actionLabel = "Rotation";
        actionType = "rotate";
      }
      
      mutate(actionLabel, actionType, firstId);
      activeCornerRef.current = null;
    }
    if (draggedPointIndexRef.current !== null) {
      draggedPointIndexRef.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      const firstId = selectedNodes[0]?.getAttribute('id') || selectedNodes[0]?.tagName || "tracé";
      mutate("Modifier Tracé", "stroke", firstId);
      forceRender(n => n + 1);
    }
  };

  const onPathNodePointerDown = (e: React.PointerEvent, pointIndex: number) => {
    e.stopPropagation();

    // Alt+click: convert segment L↔C (Alt+Shift: L↔Q)
    if (e.altKey && selectedNodes.length === 1) {
      const commands = editingCommandsRef.current;
      const points = getPathPoints(commands);
      const point = points[pointIndex];
      if (!point || point.isControlPoint) return; // Only convert on anchor points

      const cmd = commands[point.cmdIndex];
      const upper = cmd.type.toUpperCase();
      let newCommands: PathCommand[];

      if (upper === 'L' || upper === 'H' || upper === 'V') {
        // Convert to curve
        newCommands = e.shiftKey
          ? convertSegmentToQuadCurve(commands, point.cmdIndex)
          : convertSegmentToCurve(commands, point.cmdIndex);
      } else if (upper === 'C' || upper === 'Q') {
        // Convert back to line
        newCommands = convertSegmentToLine(commands, point.cmdIndex);
      } else {
        return;
      }

      editingCommandsRef.current = newCommands;
      const newD = serializePath(newCommands);
      const visualPathEl = realSelectedNodesRef.current[0] as SVGGraphicsElement;
      if (visualPathEl) {
        visualPathEl.setAttribute('d', newD);
        selectedNodes[0].setAttribute('d', newD);
        setPathPoints(computeScreenPoints(newCommands, visualPathEl));
        setScreenHandleLines(computeScreenHandles(newCommands, visualPathEl));
        mutate('Convertir segment', 'stroke', selectedNodes[0].id || undefined);
      }
      return;
    }

    draggedPointIndexRef.current = pointIndex;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleZoomIn = () => setZoom(z => Math.min(10, z * 1.2));
  const handleZoomOut = () => setZoom(z => Math.max(0.1, z / 1.2));
  const handleResetPanZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // ── Zoom Shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleResetPanZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className={`w-full h-full relative overflow-hidden bg-background/50 backdrop-blur-sm rounded-2xl shadow-inner ring-1 ring-border/50 ${mode === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
      onPointerDown={onWorkspacePointerDown}
      onPointerMove={onWorkspacePointerMove}
      onPointerUp={onWorkspacePointerUp}
      onPointerCancel={onWorkspacePointerUp}
      onDoubleClick={(e) => {
        // If in draw_path mode and actively drawing, finalize
        if (mode === 'draw_path' && isDrawingPath.current) {
          e.stopPropagation();
          finalizeDrawPath();
          return;
        }
        // If clicking on the SVG container background or empty space, deselect all.
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('pointer-events-auto')) {
           onSelectNode(null);
           return;
        }

        // Add point to path on double click in edit_path mode
        if (mode === 'edit_path' && selectedNodes.length === 1 && selectedNodes[0].tagName.toLowerCase() === 'path') {
          const targetEl = e.target as Element;
          if (targetEl.tagName.toLowerCase() === 'path') {
            e.stopPropagation();
            const realElement = selectedNodes[0];
            const visualElement = realSelectedNodesRef.current[0] as SVGGraphicsElement;
            const pt = svgPointFromClient(e.clientX, e.clientY, visualElement);
            if (pt) {
              const d = realElement.getAttribute('d');
              if (d) {
                const newD = insertPointInPath(d, pt);
                if (newD !== d) {
                  realElement.setAttribute('d', newD);
                  mutate('Ajouter point', 'move', realElement.id || undefined);
                  
                  // Update pathPoints locally to avoid waiting for doc update latency
                  const commands = absolutize(parsePath(newD));
                  if (containerRef.current) {
                     setPathPoints(computeScreenPoints(commands, visualElement));
                     setScreenHandleLines(computeScreenHandles(commands, visualElement));
                  }
                }
              }
            }
          }
        }
      }}
    >
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-1 bg-card/80 backdrop-blur border border-border rounded shadow p-1">
        <button onClick={handleZoomIn} className="p-1 hover:bg-muted rounded text-muted-foreground" title="Zoom avant (+)"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={handleResetPanZoom} className="p-1 hover:bg-muted rounded text-muted-foreground text-[10px] font-bold" title="Reset Zoom (0)">1:1</button>
        <button onClick={handleZoomOut} className="p-1 hover:bg-muted rounded text-muted-foreground" title="Zoom arrière (-)"><ZoomOut className="w-4 h-4" /></button>
      </div>

      {/* Marquee selection rectangle */}
      {marqueeRect && (
        <div
          className="absolute z-40 border border-blue-500 bg-blue-500/10 pointer-events-none"
          style={{
            left: marqueeRect.x,
            top: marqueeRect.y,
            width: marqueeRect.w,
            height: marqueeRect.h,
            borderStyle: 'dashed',
          }}
        />
      )}

      {grid.visible && (
        <svg
          className="absolute w-[4000px] h-[4000px] left-1/2 top-1/2 -ml-[2000px] -mt-[2000px] pointer-events-none z-0 opacity-40"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center' }}
        >
          <defs>
            <pattern id="gridPattern" width={grid.size} height={grid.size} patternUnits="userSpaceOnUse" patternTransform="translate(2000, 2000)">
              <path d={`M ${grid.size} 0 L 0 0 0 ${grid.size}`} fill="none" stroke={grid.color} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gridPattern)" />
        </svg>
      )}

      <div
        className="absolute pointer-events-auto border-2 border-dashed border-foreground/15"
        style={{
          width: canvasSize.w,
          height: canvasSize.h,
          left: '50%',
          top: '50%',
          marginLeft: -canvasSize.w / 2,
          marginTop: -canvasSize.h / 2,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center'
        }}
      >
        <div ref={containerRef} className="w-full h-full flex items-center justify-center relative" />

        {highlightBox && selectedNodes.length > 0 && mode !== 'pan' && (
          <div
            className={cn(
              "absolute border-2 z-10 box-border group",
              mode === 'edit_path' ? "pointer-events-none" : "pointer-events-auto",
              mode === 'select' && "border-blue-500/80 bg-blue-500/10 cursor-move",
              mode === 'scale' && "border-green-500/80 bg-transparent",
              mode === 'rotate' && "border-purple-500/80 bg-transparent",
            )}
            style={{
              top: highlightBox.top,
              left: highlightBox.left,
              width: highlightBox.width,
              height: highlightBox.height
            }}
            onPointerDown={(e) => onElPointerDown(e)}
            onPointerMove={onElPointerMove}
            onPointerUp={onElPointerUp}
            onPointerCancel={onElPointerUp}
          >
            {/* Origin internal representation for Rotate */}
            {mode === 'rotate' && (
              <div 
                className="absolute w-2 h-2 bg-purple-500/80 rounded-full z-20 pointer-events-none -ml-1 -mt-1"
                style={{
                  left: transformOrigin.includes('right') ? '100%' : transformOrigin.includes('left') ? '0%' : '50%',
                  top: transformOrigin.includes('bottom') ? '100%' : transformOrigin.includes('top') ? '0%' : '50%'
                }}
              />
            )}

            {/* Handle lines (SVG overlay for bezier control point connections) */}
            {mode === 'edit_path' && screenHandleLines.length > 0 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-15"
                style={{ overflow: 'visible' }}
              >
                {screenHandleLines.map((h, i) => (
                  <line
                    key={i}
                    x1={h.ax - highlightBox.left}
                    y1={h.ay - highlightBox.top}
                    x2={h.cx - highlightBox.left}
                    y2={h.cy - highlightBox.top}
                    stroke="#38bdf8"
                    strokeWidth={1 / zoom}
                    strokeDasharray={`${3 / zoom} ${2 / zoom}`}
                    opacity={0.7}
                  />
                ))}
              </svg>
            )}

            {mode === 'edit_path' && pathPoints.map((p, i) => (
              <div
                key={i}
                onPointerDown={(e) => onPathNodePointerDown(e, i)}
                onPointerMove={onElPointerMove}
                onPointerUp={onElPointerUp}
                className={cn(
                  "absolute z-20 cursor-move",
                  p.isControlPoint
                    ? "w-2.5 h-2.5 bg-sky-400 border border-sky-600 rotate-45"
                    : "w-3 h-3 bg-background border-2 border-destructive rounded-full shadow-sm"
                )}
                style={{
                  left: p.x - highlightBox.left - (p.isControlPoint ? 5 : 6),
                  top: p.y - highlightBox.top - (p.isControlPoint ? 5 : 6),
                  pointerEvents: 'auto',
                  transform: `scale(${1 / zoom})`
                }}
                title={p.isControlPoint ? 'Poignée de contrôle' : 'Alt+clic: courber · Alt+Shift+clic: quadratique'}
              />
            ))}

            {(mode === 'select' || mode === 'scale' || mode === 'rotate') && (
              <>
                <div 
                  className={cn("absolute -top-1.5 -left-1.5 w-3 h-3 bg-background border-2", 
                    mode === 'select' ? "border-blue-500 rounded-full cursor-nwse-resize pointer-events-auto" : 
                    mode === 'scale' ? "border-green-500 rounded-none cursor-nwse-resize pointer-events-auto" : 
                    "border-purple-500 rounded-none cursor-alias pointer-events-auto"
                  )} 
                  onPointerDown={(e) => onElPointerDown(e, 'tl')}
                />
                <div 
                  className={cn("absolute -top-1.5 -right-1.5 w-3 h-3 bg-background border-2", 
                    mode === 'select' ? "border-blue-500 rounded-full cursor-nesw-resize pointer-events-auto" : 
                    mode === 'scale' ? "border-green-500 rounded-none cursor-nesw-resize pointer-events-auto" : 
                    "border-purple-500 rounded-none cursor-alias pointer-events-auto"
                  )} 
                  onPointerDown={(e) => onElPointerDown(e, 'tr')}
                />
                <div 
                  className={cn("absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-background border-2", 
                    mode === 'select' ? "border-blue-500 rounded-full cursor-nesw-resize pointer-events-auto" : 
                    mode === 'scale' ? "border-green-500 rounded-none cursor-nesw-resize pointer-events-auto" : 
                    "border-purple-500 rounded-none cursor-alias pointer-events-auto"
                  )} 
                  onPointerDown={(e) => onElPointerDown(e, 'bl')}
                />
                <div 
                  className={cn("absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-background border-2", 
                    mode === 'select' ? "border-blue-500 rounded-full cursor-nwse-resize pointer-events-auto" : 
                    mode === 'scale' ? "border-green-500 rounded-none cursor-nwse-resize pointer-events-auto" : 
                    "border-purple-500 rounded-none cursor-alias pointer-events-auto"
                  )} 
                  onPointerDown={(e) => onElPointerDown(e, 'br')}
                />
              </>
            )}
          </div>
        )}

        {/* Draw Path point markers */}
        {mode === 'draw_path' && drawPathPoints.length > 0 && (
          <>
            {drawPathPoints.map((p, i) => (
              <div
                key={i}
                className={cn(
                  "absolute rounded-full z-20 pointer-events-none border-2",
                  i === 0 ? "w-3.5 h-3.5 bg-blue-500 border-blue-600" : "w-2.5 h-2.5 bg-white border-blue-500"
                )}
                style={{
                  left: p.x - (i === 0 ? 7 : 5),
                  top: p.y - (i === 0 ? 7 : 5),
                  transform: `scale(${1 / zoom})`
                }}
              />
            ))}
          </>
        )}
      </div>

      {/* Draw Path status bar */}
      {mode === 'draw_path' && drawPathPoints.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card/90 backdrop-blur border border-border rounded-lg shadow-lg px-4 py-2 flex items-center gap-3 select-none pointer-events-auto">
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{drawPathPoints.length}</span> point{drawPathPoints.length > 1 ? 's' : ''}
          </span>
          <span className="text-[10px] text-muted-foreground/70">
            Double-clic ou Entrée pour terminer · Échap pour annuler
          </span>
          <button
            onClick={finalizeDrawPath}
            className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Terminer
          </button>
        </div>
      )}
    </div>
  );
}
