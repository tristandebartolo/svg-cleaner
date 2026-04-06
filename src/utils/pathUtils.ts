/**
 * Utilitaires avancés pour le tracé SVG (Path)
 * Incorpore la conversion de coordonnées relatives vers absolues.
 */

export interface PathCommand {
  type: string;
  values: number[];
}

export interface PathPoint {
  x: number;
  y: number;
  cmdIndex: number;
  valIndex: number;
  isControlPoint?: boolean;
}

/**
 * Nombre d'arguments attendus par type de commande
 */
const ARG_COUNTS: Record<string, number> = {
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0
};

/**
 * Découpe une chaîne 'd' en commandes structurées, 
 * en gérant les commandes implicites (chaînage de paramètres).
 */
export function parsePath(d: string): PathCommand[] {
  const commands: PathCommand[] = [];
  const cmdRegex = /([A-Za-z])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  let match;
  
  let currentCmd: string | null = null;
  let currentValues: number[] = [];

  const push = () => {
    if (currentCmd) {
      const upper = currentCmd.toUpperCase();
      const count = ARG_COUNTS[upper] || 0;
      
      if (count === 0) {
        commands.push({ type: currentCmd, values: [] });
      } else {
        // Gérer le chaînage implicite (ex: L x1 y1 x2 y2 -> L x1 y1, L x2 y2)
        for (let i = 0; i < currentValues.length; i += count) {
          let type = currentCmd;
          // Si c'est un M et qu'on a encore des points, les suivants sont des L
          if (i > 0 && upper === 'M') {
            type = currentCmd === 'm' ? 'l' : 'L';
          }
          commands.push({ 
            type, 
            values: currentValues.slice(i, i + count) 
          });
        }
      }
    }
    currentValues = [];
  };

  while ((match = cmdRegex.exec(d)) !== null) {
    if (match[1]) { // C'est une lettre (commande)
      push();
      currentCmd = match[1];
    } else if (match[2]) { // C'est un nombre
      currentValues.push(Number(match[2]));
    }
  }
  push();

  return commands;
}

/**
 * Convertit un ensemble de commandes en coordonnées ABSOLUES exclusivement (Majuscules).
 * Très important pour un éditeur afin de pouvoir déplacer des points sans tout casser.
 */
export function absolutize(commands: PathCommand[]): PathCommand[] {
  let cx = 0, cy = 0; // Cursor position
  let subx = 0, suby = 0; // Subpath start position
  
  return commands.map(cmd => {
    const type = cmd.type;
    const upper = type.toUpperCase();
    const isRel = type !== upper;
    const values = [...cmd.values];

    if (upper === 'M') {
      if (isRel) { values[0] += cx; values[1] += cy; }
      cx = values[0]; cy = values[1];
      subx = cx; suby = cy;
    } else if (upper === 'L' || upper === 'T') {
      if (isRel) { values[0] += cx; values[1] += cy; }
      cx = values[0]; cy = values[1];
    } else if (upper === 'H') {
      if (isRel) values[0] += cx;
      cx = values[0];
    } else if (upper === 'V') {
      if (isRel) values[0] += cy;
      cy = values[0];
    } else if (upper === 'C') {
      if (isRel) {
        values[0] += cx; values[1] += cy;
        values[2] += cx; values[3] += cy;
        values[4] += cx; values[5] += cy;
      }
      cx = values[4]; cy = values[5];
    } else if (upper === 'S' || upper === 'Q') {
      if (isRel) {
        values[0] += cx; values[1] += cy;
        values[2] += cx; values[3] += cy;
      }
      cx = values[2]; cy = values[3];
    } else if (upper === 'A') {
      if (isRel) { values[5] += cx; values[6] += cy; }
      cx = values[5]; cy = values[6];
    } else if (upper === 'Z') {
      cx = subx; cy = suby;
    }

    return { type: upper, values };
  });
}

/**
 * Sérialise une liste de commandes en chaîne 'd'
 */
export function serializePath(commands: PathCommand[]): string {
  return commands.map(cmd => `${cmd.type}${cmd.values.join(' ')}`).join(' ');
}

/**
 * Identifie les points interactifs d'un tracé
 */
export function getPathPoints(commands: PathCommand[]): PathPoint[] {
  const points: PathPoint[] = [];

  commands.forEach((cmd, cmdIndex) => {
    const type = cmd.type; // On suppose qu'ils sont absolus ici (majuscules)
    const v = cmd.values;

    switch (type) {
      case 'M':
      case 'L':
      case 'T':
        if (v.length >= 2) points.push({ x: v[0], y: v[1], cmdIndex, valIndex: 0 });
        break;
      case 'H':
        // On devrait idéalement porter la position Y précédente ici, mais pour l'instant on se concentre sur X
        break;
      case 'V':
        break;
      case 'C':
        if (v.length >= 6) {
          points.push({ x: v[0], y: v[1], cmdIndex, valIndex: 0, isControlPoint: true });
          points.push({ x: v[2], y: v[3], cmdIndex, valIndex: 2, isControlPoint: true });
          points.push({ x: v[4], y: v[5], cmdIndex, valIndex: 4 });
        }
        break;
      case 'S':
      case 'Q':
        if (v.length >= 4) {
          points.push({ x: v[0], y: v[1], cmdIndex, valIndex: 0, isControlPoint: true });
          points.push({ x: v[2], y: v[3], cmdIndex, valIndex: 2 });
        }
        break;
      case 'A':
        if (v.length >= 7) {
          points.push({ x: v[5], y: v[6], cmdIndex, valIndex: 5 });
        }
        break;
    }
  });

  return points;
}

/**
 * Insère un point (commande L) dans le tracé au segment le plus proche du point donné.
 */
export function insertPointInPath(d: string, pt: { x: number, y: number }): string {
  let commands = parsePath(d);
  commands = absolutize(commands);
  const points = getPathPoints(commands);
  if (points.length < 2) return d;
  
  let minIndex = -1;
  let minDist = Infinity;
  let prevPoint = points[0];

  for (let i = 1; i < points.length; i++) {
    const p1 = prevPoint;
    const p2 = points[i];
    
    if (!p2.isControlPoint) {
      prevPoint = p2; // Next segment start
    }
    
    if (p1.isControlPoint || p2.isControlPoint) continue;
    
    const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
    let t = 0;
    if (l2 > 0) {
      t = ((pt.x - p1.x) * (p2.x - p1.x) + (pt.y - p1.y) * (p2.y - p1.y)) / l2;
      t = Math.max(0, Math.min(1, t));
    }
    const projX = p1.x + t * (p2.x - p1.x);
    const projY = p1.y + t * (p2.y - p1.y);
    const dist = Math.sqrt((pt.x - projX) ** 2 + (pt.y - projY) ** 2);
    
    if (dist < minDist) {
      minDist = dist;
      minIndex = p2.cmdIndex; // insert before this command
    }
  }
  
  if (minIndex !== -1) {
    commands.splice(minIndex, 0, { type: 'L', values: [pt.x, pt.y] });
    return serializePath(commands);
  }
  return d;
}
