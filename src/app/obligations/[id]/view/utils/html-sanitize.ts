
"use client";

const ALLOWED_TAGS = ['b', 'i', 'u', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'];
const ALLOWED_ATTRS = ['class', 'style']; // Note: style can be risky if not controlled.

/**
 * A very basic HTML sanitizer.
 * It removes script tags, event handlers, and javascript: URLs.
 * It only allows a whitelist of tags and attributes.
 *
 * NOTE: For a production application, a more robust library like DOMPurify is strongly recommended.
 * This is a simplified implementation for demonstration purposes.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';
  if (typeof window === 'undefined') {
    // Cannot perform sanitization on the server, return as is.
    // Proper server-side sanitization would be needed in a real app.
    return input;
  }

  const sanitizer = new DOMParser();
  const doc = sanitizer.parseFromString(`<body>${input}</body>`, 'text/html');
  const body = doc.body;

  const walk = (node: Element) => {
    // 1. Remove disallowed tags
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      if (!ALLOWED_TAGS.includes(tagName)) {
        // Replace with its children, effectively unwrapping the tag
        while (node.firstChild) {
          node.parentNode?.insertBefore(node.firstChild, node);
        }
        node.parentNode?.removeChild(node);
        return; // Node is gone, no further processing needed for it
      }

      // 2. Remove disallowed attributes
      const attrs = Array.from(node.attributes);
      attrs.forEach(attr => {
        const attrName = attr.name.toLowerCase();
        if (attrName.startsWith('on') || !ALLOWED_ATTRS.includes(attrName)) {
          node.removeAttribute(attr.name);
        }
      });
      
      // 3. Check for dangerous URL schemes
      if (node.hasAttribute('href')) {
        const href = node.getAttribute('href') || '';
        if (href.trim().startsWith('javascript:')) {
            node.removeAttribute('href');
        }
      }
    }

    // 4. Recurse through child nodes
    // Create a static copy of children to iterate over, as the live collection will change
    const children = Array.from(node.children);
    children.forEach(walk);
  };

  walk(body);

  return body.innerHTML;
}
