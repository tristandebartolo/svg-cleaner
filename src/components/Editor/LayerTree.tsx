import React, { useState } from 'react';
import { ChevronRight, ChevronDown, MoveDown, MoveUp, Folder, FileCode, GripVertical, Eye, EyeOff, Trash2, LogOut, FolderPlus } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getGlobalMatrix, getParentGlobalMatrix, matrixToSVGString } from '../../utils/matrixUtils';
import { useNotify } from '../../context/NotificationContext';
import type { HistoryEntry } from './EditorLayout';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type MutateFn = (label?: string, type?: HistoryEntry['type'], nodeId?: string, color?: string) => void;

interface LayerTreeProps {
  doc: Document;
  root: Element;
  selectedNodes: Element[];
  onSelect: (node: Element | null, multi?: boolean) => void;
  mutate: MutateFn;
  revision: number;
}

interface LayerItemProps {
  node: Element;
  depth: number;
  selectedNodes: Element[];
  onSelect: (node: Element | null, multi?: boolean) => void;
  mutate: MutateFn;
  revision: number;
}

const LayerItem = React.memo(({ node, depth, selectedNodes, onSelect, mutate, revision }: LayerItemProps) => {
  const [expanded, setExpanded] = useState(true);
  const [isDragTarget, setIsDragTarget] = useState(false);
  const { confirm } = useNotify();
  const tagName = node.nodeName.toLowerCase();
  const id = node.getAttribute('id') || '';
  const name = tagName + (id ? `#${id}` : '');

  const children = Array.from(node.children);
  const hasChildren = children.length > 0;
  const isSelected = selectedNodes.includes(node);
  const isGroup = tagName === 'g';

  const moveUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const parent = node.parentNode;
    if (parent && node.previousElementSibling) {
      parent.insertBefore(node, node.previousElementSibling);
      mutate("Déplacement", "move", node.getAttribute('id') || node.tagName);
    }
  };

  const moveDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const parent = node.parentNode;
    if (parent && node.nextElementSibling) {
      parent.insertBefore(node.nextElementSibling, node);
      mutate("Déplacement", "move", node.getAttribute('id') || node.tagName);
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', ''); // Required for some browsers
    // We store the node temporarily in a global-ish way or use a custom event
    // Since we are in the same window, we can use a window property or similar
    (window as any)._draggedNode = node;
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dragged = (window as any)._draggedNode as Element;
    if (!dragged || dragged === node || node.contains(dragged)) return;
    setIsDragTarget(true);
  };

  const handleDragLeave = () => {
    setIsDragTarget(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragTarget(false);

    const dragged = (window as any)._draggedNode as Element;
    if (!dragged || dragged === node || node.contains(dragged)) return;

    // Calculer la matrice globale AVANT le déplacement
    const globalM = getGlobalMatrix(dragged);

    const rect = e.currentTarget.getBoundingClientRect();
    const relY = (e.clientY - rect.top) / rect.height;

    let targetParent: Element | null = null;

    if (relY < 0.2) {
      node.parentNode?.insertBefore(dragged, node);
      targetParent = node.parentNode as Element;
      mutate("Déplacement", "move", dragged.getAttribute('id') || dragged.tagName);
    } else if (relY > 0.8) {
      node.parentNode?.insertBefore(dragged, node.nextSibling);
      targetParent = node.parentNode as Element;
      mutate("Déplacement", "move", dragged.getAttribute('id') || dragged.tagName);
    } else if (isGroup) {
      node.appendChild(dragged);
      targetParent = node;
      mutate("Déplacement", "move", dragged.getAttribute('id') || dragged.tagName);
    } else {
      node.parentNode?.insertBefore(dragged, node.nextSibling);
      targetParent = node.parentNode as Element;
      mutate("Déplacement", "move", dragged.getAttribute('id') || dragged.tagName);
    }

    if (targetParent) {
      const parentM = getParentGlobalMatrix(targetParent);
      const newLocalM = parentM.inverse().multiply(globalM);
      dragged.setAttribute('transform', matrixToSVGString(newLocalM));
    }

    mutate("Déplacement");
    (window as any)._draggedNode = null;
  };

  const deleteNode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm(
      'Supprimer l\'élément',
      'Êtes-vous sûr de vouloir supprimer cet élément et tout son contenu ?',
      'danger'
    );
    if (ok) {
      if (node.parentNode) {
        const nodeId = node.getAttribute('id') || node.tagName;
        node.parentNode.removeChild(node);
        mutate("Suppression", "delete", nodeId);
      }
    }
  };

  const moveOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    const parent = node.parentNode;
    if (parent && parent instanceof Element && parent.nodeName.toLowerCase() === 'g') {
      const globalM = getGlobalMatrix(node);
      const grandParent = parent.parentNode as Element;

      if (grandParent) {
        grandParent.insertBefore(node, parent.nextSibling);
        const parentM = getParentGlobalMatrix(grandParent);
        const newLocalM = parentM.inverse().multiply(globalM);
        node.setAttribute('transform', matrixToSVGString(newLocalM));
        mutate("Sortie de groupe", "group", node.getAttribute('id') || node.tagName);
      }
    }
  };

  const isHidden = node.getAttribute('display') === 'none';

  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isHidden) {
      node.removeAttribute('display');
    } else {
      node.setAttribute('display', 'none');
    }
    mutate(isHidden ? "Afficher" : "Masquer", "style", node.getAttribute('id') || node.tagName);
  };

  return (
    <div className="w-full flex flex-col mt-0.5">
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}

        className={cn(
          "group flex items-center justify-between w-full h-8 hover:bg-muted/50 rounded cursor-pointer transition-colors p-0 text-sm select-none border-y border-transparent relative",
          isSelected && "bg-primary/20 font-medium text-primary hover:bg-primary/30",
          isDragTarget && "border-primary bg-primary/10 shadow-[inset_0_0_0_1px_var(--primary)]"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node, e.shiftKey || e.metaKey || e.ctrlKey);
        }}
      >
        <div className="flex items-center gap-1 flex-1 overflow-hidden">
          <GripVertical className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 shrink-0" />

          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-4 h-4 shrink-0" />
          )}

          {isGroup ? (
            <Folder className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
          ) : (
            <FileCode className="w-3.5 h-3.5 text-blue-500/70 shrink-0" />
          )}

          <span className={cn("truncate flex-1 ml-0.5", isGroup && "font-semibold", isHidden && "opacity-40 line-through")}>{name}</span>
        </div>

        <div className="flex bg-background/80 rounded opacity-0 group-hover:opacity-100 shadow-sm border border-border/10 p-0.5 items-center gap-0.5 mr-1">
          <button
            onClick={toggleVisibility}
            className={cn("p-1 hover:bg-muted rounded transition-colors", isHidden ? "text-muted-foreground" : "text-primary")}
            title={isHidden ? "Afficher" : "Cacher"}
          >
            {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>

          <div className="w-px h-3 bg-border/50 mx-0.5"></div>

          {node.parentNode && node.parentNode.nodeName.toLowerCase() === 'g' && (
            <button onClick={moveOut} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Sortir du groupe">
              <LogOut className="w-3 h-3" />
            </button>
          )}

          <button onClick={moveUp} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Monter"><MoveUp className="w-3 h-3" /></button>
          <button onClick={moveDown} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Descendre"><MoveDown className="w-3 h-3" /></button>

          <div className="w-px h-3 bg-border/50 mx-0.5"></div>

          <button
            onClick={deleteNode}
            className="p-1 hover:bg-destructive/20 rounded text-muted-foreground hover:text-destructive transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="w-full border-l border-border/20 ml-[calc(0.5rem+4px)] pl-px mt-px">
          {children.map((child, idx) => (
            <LayerItem
              key={`${tagName}-${idx}-${child.getAttribute('id') || ''}`}
              node={child}
              depth={depth + 1}
              selectedNodes={selectedNodes}
              onSelect={onSelect}
              mutate={mutate}
              revision={revision}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default function LayerTree({ doc, root, selectedNodes, onSelect, mutate, revision }: LayerTreeProps) {

  const handleNewGroup = () => {
    const newG = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    newG.setAttribute('id', `group-${Math.floor(Math.random() * 1000)}`);

    // If a group is selected, add into it. Otherwise add to root.
    const selectedGroup = selectedNodes.find(n => n.tagName.toLowerCase() === 'g');
    if (selectedGroup) {
      selectedGroup.appendChild(newG);
    } else {
      doc.documentElement.appendChild(newG);
    }
    mutate("Nouveau Groupe", "add", newG.getAttribute('id') || "groupe");
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dragged = (window as any)._draggedNode as Element;
    if (dragged) {
      doc.documentElement.appendChild(dragged);
      mutate("Déplacement Racine", "move", dragged.getAttribute('id') || dragged.tagName);
      (window as any)._draggedNode = null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Mini Layer Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-muted/20">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Arborescence</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewGroup}
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary transition-colors"
            title="Nouveau Groupe Vide"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto py-2">
        <LayerItem
          node={root}
          depth={0}
          selectedNodes={selectedNodes}
          onSelect={onSelect}
          mutate={mutate}
          revision={revision}
        />

        {/* Workspace Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleRootDrop}
          className="h-10 mt-2 border-2 border-dashed border-border/20 rounded-md mx-2 flex items-center justify-center text-[10px] text-muted-foreground/40 hover:border-primary/40 hover:text-primary/40 transition-all cursor-default"
        >
          Glisser ici pour déplacer à la racine
        </div>
      </div>
    </div>
  );
}
