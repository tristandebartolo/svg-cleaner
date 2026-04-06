// src/utils/svgCleaner.ts

const CSS_TO_SVG_ATTRS = new Set([
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap",
  "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset",
  "stroke-opacity", "opacity", "display", "visibility", "color", "clip-path",
  "clip-rule", "mask", "filter", "flood-color", "flood-opacity", "lighting-color",
  "stop-color", "stop-opacity", "color-interpolation", "color-interpolation-filters",
  "font-family", "font-size", "font-style", "font-variant", "font-weight",
  "font-stretch", "text-anchor", "text-decoration", "dominant-baseline",
  "alignment-baseline", "baseline-shift", "direction", "letter-spacing",
  "word-spacing", "writing-mode", "glyph-orientation-horizontal",
  "glyph-orientation-vertical", "image-rendering", "shape-rendering",
  "text-rendering", "pointer-events", "marker", "marker-start", "marker-mid",
  "marker-end", "paint-order", "vector-effect", "line-height"
]);

const CSS_TO_REMOVE = new Set([
  "-inkscape-stroke",
  "-inkscape-font-specification",
  "font-variation-settings"
]);

const ATTRS_TO_REMOVE = new Set([
  "xml:space",
  "sodipodi:docname",
  "inkscape:version"
]);

const NAMESPACES_TO_REMOVE = [
  "http://www.inkscape.org/namespaces/inkscape",
  "http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd",
  "http://creativecommons.org/ns#",
  "http://purl.org/dc/elements/1.1/",
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
];

const METADATA_TAGS = ["metadata", "sodipodi:namedview"];

export function cleanSvgString(rawSvg: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, "image/svg+xml");
  
  if (doc.documentElement.nodeName === "parsererror") {
    throw new Error("Invalid SVG string");
  }

  const root = doc.documentElement;

  // 1. Remove unwanted namespaces from root
  for (const ns of NAMESPACES_TO_REMOVE) {
    // Find the prefix mapping for this namespace. Usually looks like xmlns:inkscape="..."
    for (let i = root.attributes.length - 1; i >= 0; i--) {
      const attr = root.attributes[i];
      if (attr.name.startsWith('xmlns:') && attr.value === ns) {
        root.removeAttribute(attr.name);
      }
    }
  }
  
  // Double xmlns:svg fix
  if (root.hasAttribute("xmlns:svg")) {
      root.removeAttribute("xmlns:svg");
  }

  // 2. Clean elements recursively
  function traverse(node: Element) {
    // Remove specific attributes (xml:space, id etc.)
    for (const attr of ATTRS_TO_REMOVE) {
      if (node.hasAttribute(attr)) {
        node.removeAttribute(attr);
      }
    }

    // Convert styles to explicit attributes
    const styleStr = node.getAttribute("style");
    if (styleStr) {
      const parts = styleStr.split(";").filter(Boolean);
      const remaining: string[] = [];
      
      parts.forEach(part => {
        const [keyRaw, valRaw] = part.split(":");
        if (!keyRaw || !valRaw) return;
        const key = keyRaw.trim();
        const val = valRaw.trim();

        if (CSS_TO_REMOVE.has(key)) {
          // ignore
          return;
        }

        if (CSS_TO_SVG_ATTRS.has(key)) {
          if (!node.hasAttribute(key)) {
            node.setAttribute(key, val);
          }
        } else {
          remaining.push(`${key}:${val}`);
        }
      });

      if (remaining.length > 0) {
        node.setAttribute("style", remaining.join(";"));
      } else {
        node.removeAttribute("style");
      }
    }

    // Remove specific inkscape/metadata elements
    const elementsToRemove: Element[] = [];
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const tagLower = child.tagName.toLowerCase();
      
      // if it's metadata, sodipodi:namedview, or from a removed namespace (prefix format)
      if (METADATA_TAGS.includes(tagLower) || child.namespaceURI && NAMESPACES_TO_REMOVE.includes(child.namespaceURI)) {
        elementsToRemove.push(child);
      } else if (tagLower === "defs" && child.children.length === 0) {
        elementsToRemove.push(child);
      } else {
        traverse(child); // recurse
      }
    }

    elementsToRemove.forEach(child => node.removeChild(child));
  }

  traverse(root);

  // 3. Serialize back to string
  const serializer = new XMLSerializer();
  let cleaned = serializer.serializeToString(root);

  // 4. Basic pretty print (very rudimentary format for better human readability)
  cleaned = cleaned.replace(/></g, ">\n<");
  
  return cleaned;
}
