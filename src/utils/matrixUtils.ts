/**
 * Utilitaires pour gérer les transformations SVG (Matrices)
 * Permet de maintenir la position visuelle lors du reparentage.
 */

// On crée un élément SVG invisible pour accéder aux méthodes de création de matrices natives
const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

/**
 * Récupère la matrice locale d'un élément à partir de son attribut 'transform'
 */
export function getLocalMatrix(el: Element): DOMMatrix {
  const transform = el.getAttribute('transform') || '';
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute('transform', transform);
  // On utilise baseVal.consolidate() pour obtenir la matrice combinée
  const transformList = g.transform.baseVal;
  if (transformList.numberOfItems === 0) {
    return svg.createSVGMatrix() as unknown as DOMMatrix;
  }
  return transformList.consolidate()!.matrix as unknown as DOMMatrix;
}

/**
 * Calcule la matrice cumulée (globale) d'un élément jusqu'à la racine SVG
 */
export function getGlobalMatrix(el: Element): DOMMatrix {
  let matrix = svg.createSVGMatrix() as unknown as DOMMatrix;
  let curr: Element | null = el;
  
  while (curr && curr.nodeName.toLowerCase() !== 'svg') {
    const local = getLocalMatrix(curr);
    matrix = local.multiply(matrix); // Ordre : Parent * Enfant
    curr = curr.parentElement;
  }
  
  return matrix;
}

/**
 * Calcule la matrice cumulée d'un futur parent
 */
export function getParentGlobalMatrix(parent: Element): DOMMatrix {
   if (parent.nodeName.toLowerCase() === 'svg') {
       return svg.createSVGMatrix() as unknown as DOMMatrix;
   }
   return getGlobalMatrix(parent);
}

/**
 * Convertit une DOMMatrix en chaîne d'attribut SVG matrix(...)
 */
export function matrixToSVGString(m: DOMMatrix): string {
  return `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.e}, ${m.f})`;
}

/**
 * Calcule la nouvelle transformation locale nécessaire pour qu'un élément 
 * garde sa position globale M_global après avoir été déplacé sous NewParent.
 * 
 * Formule : M_local_new = (M_parent_new)^-1 * M_global
 */
export function compensateTransform(node: Element, newParent: Element) {
  const globalM = getGlobalMatrix(node);
  const newParentM = getParentGlobalMatrix(newParent);
  const newLocalM = newParentM.inverse().multiply(globalM);
  
  node.setAttribute('transform', matrixToSVGString(newLocalM));
}
