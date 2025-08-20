// Main injection script that runs in the page's context
(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__reactGoogleTranslateFix) {
    return;
  }
  window.__reactGoogleTranslateFix = true;

  console.log('[Translate Crash Fix] Initializing...');

  // Store original methods
  const originalRemoveChild = Node.prototype.removeChild;
  const originalInsertBefore = Node.prototype.insertBefore;
  const originalReplaceChild = Node.prototype.replaceChild;
  const originalAppendChild = Node.prototype.appendChild;

  // Track text nodes to prevent unnecessary DOM mutations
  const textNodeMap = new WeakMap();
  const translatedNodes = new WeakSet();

  // Enhanced removeChild with error handling
  Node.prototype.removeChild = function(child) {
    try {
      // Check if the child is actually a child of this node
      if (!this.contains(child)) {
        console.warn('[Translate Crash Fix] Attempted to remove non-child node, ignoring');
        return child;
      }
      return originalRemoveChild.call(this, child);
    } catch (error) {
      if (error.name === 'NotFoundError' || error.message.includes('not a child')) {
        console.warn('[Translate Crash Fix] RemoveChild error caught and handled:', error.message);
        return child;
      }
      throw error;
    }
  };

  // Enhanced insertBefore with error handling
  Node.prototype.insertBefore = function(newNode, referenceNode) {
    try {
      // If referenceNode is null, append instead
      if (!referenceNode) {
        return this.appendChild(newNode);
      }
      
      // Check if referenceNode is actually a child of this node
      if (!this.contains(referenceNode)) {
        console.warn('[Translate Crash Fix] Reference node not found, appending instead');
        return this.appendChild(newNode);
      }
      
      return originalInsertBefore.call(this, newNode, referenceNode);
    } catch (error) {
      if (error.name === 'NotFoundError' || error.message.includes('not a child')) {
        console.warn('[Translate Crash Fix] InsertBefore error caught, appending instead:', error.message);
        try {
          return this.appendChild(newNode);
        } catch (appendError) {
          console.warn('[Translate Crash Fix] AppendChild also failed:', appendError.message);
          return newNode;
        }
      }
      throw error;
    }
  };

  // Enhanced replaceChild with error handling
  Node.prototype.replaceChild = function(newChild, oldChild) {
    try {
      // Check if oldChild is actually a child of this node
      if (!this.contains(oldChild)) {
        console.warn('[Translate Crash Fix] Old child not found, appending new child instead');
        return this.appendChild(newChild);
      }
      return originalReplaceChild.call(this, newChild, oldChild);
    } catch (error) {
      if (error.name === 'NotFoundError' || error.message.includes('not a child')) {
        console.warn('[Translate Crash Fix] ReplaceChild error caught:', error.message);
        try {
          return this.appendChild(newChild);
        } catch (appendError) {
          console.warn('[Translate Crash Fix] AppendChild fallback failed:', appendError.message);
          return newChild;
        }
      }
      throw error;
    }
  };

  // Intercept Google Translate's font tag creation
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function(tagName, options) {
    const element = originalCreateElement(tagName, options);
    
    // If Google Translate is creating font tags, try to prevent DOM disruption
    if (tagName.toLowerCase() === 'font' && isGoogleTranslateContext()) {
      // Mark this as a translate element
      element.__isGoogleTranslateFont = true;
      
      // Override methods that could disrupt React's DOM tracking
      const originalSetAttribute = element.setAttribute;
      element.setAttribute = function(name, value) {
        try {
          return originalSetAttribute.call(this, name, value);
        } catch (error) {
          console.warn('[Translate Crash Fix] SetAttribute error caught:', error.message);
        }
      };
    }
    
    return element;
  };

  // Detect if we're in Google Translate context
  function isGoogleTranslateContext() {
    const stack = new Error().stack;
    return stack && (
      stack.includes('translate_m.js') ||
      stack.includes('translate.googleapis.com') ||
      stack.includes('translate_a/element.js') ||
      window.google?.translate
    );
  }

  // Monitor for Google Translate initialization
  function observeGoogleTranslate() {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        // Handle added nodes
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for Google Translate font tags
            if (node.tagName === 'FONT' && node.__isGoogleTranslateFont) {
              handleGoogleTranslateFont(node);
            }
            
            // Check for nested font tags
            const fontTags = node.querySelectorAll && node.querySelectorAll('font[style*="background-color"]');
            if (fontTags) {
              fontTags.forEach(handleGoogleTranslateFont);
            }
          }
        });
        
        // Handle text node changes
        if (mutation.type === 'characterData') {
          handleTextNodeChange(mutation.target);
        }
      });
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true
    });

    return observer;
  }

  // Handle Google Translate font tags
  function handleGoogleTranslateFont(fontElement) {
    try {
      // If this font element wraps text nodes, try to preserve the original structure
      const textNodes = [];
      const walker = document.createTreeWalker(
        fontElement,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let textNode;
      while (textNode = walker.nextNode()) {
        textNodes.push({
          node: textNode,
          content: textNode.textContent
        });
      }

      // Mark as processed to avoid infinite loops
      fontElement.__processed = true;
      translatedNodes.add(fontElement);

    } catch (error) {
      console.warn('[Translate Crash Fix] Error handling font element:', error);
    }
  }

  // Handle text node changes
  function handleTextNodeChange(textNode) {
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      return;
    }

    try {
      // Store original content if not already stored
      if (!textNodeMap.has(textNode)) {
        textNodeMap.set(textNode, textNode.textContent);
      }
    } catch (error) {
      console.warn('[Translate Crash Fix] Error handling text node change:', error);
    }
  }

  // Prevent React from normalizing translated nodes
  const originalNormalize = Node.prototype.normalize;
  Node.prototype.normalize = function() {
    try {
      // Don't normalize if this node or its children contain translated content
      const hasTranslatedContent = this.querySelector && this.querySelector('font[style*="background-color"]');
      if (hasTranslatedContent) {
        console.warn('[Translate Crash Fix] Skipping normalization of translated content');
        return;
      }
      return originalNormalize.call(this);
    } catch (error) {
      console.warn('[Translate Crash Fix] Normalization error:', error);
    }
  };

  // Enhanced error boundary for React
  window.addEventListener('error', function(event) {
    const error = event.error;
    if (error && error.message && (
      error.message.includes('removeChild') ||
      error.message.includes('insertBefore') ||
      error.message.includes('not a child')
    )) {
      console.warn('[Translate Crash Fix] DOM manipulation error caught:', error.message);
      event.preventDefault();
      return false;
    }
  }, true);

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(observeGoogleTranslate, 100);
    });
  } else {
    setTimeout(observeGoogleTranslate, 100);
  }

  // Also initialize immediately for early translate attempts
  observeGoogleTranslate();

  console.log('[Translate Crash Fix] Successfully initialized');

  // Add a marker to help detect if DOM methods are patched
  if (Node.prototype.removeChild.toString().includes('React Google Translate Fix')) {
    console.log('[Translate Crash Fix] DOM methods successfully patched');
  }

  // Expose debug information
  window.__reactGoogleTranslateFixDebug = {
    textNodeMap,
    translatedNodes,
    isGoogleTranslateContext,
    version: '1.0.0',
    patchedMethods: {
      removeChild: Node.prototype.removeChild.toString().includes('React Google Translate Fix'),
      insertBefore: Node.prototype.insertBefore.toString().includes('React Google Translate Fix'),
      replaceChild: Node.prototype.replaceChild.toString().includes('React Google Translate Fix')
    }
  };
})();