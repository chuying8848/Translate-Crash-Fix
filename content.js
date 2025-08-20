// Content script to inject the fix into the page
(function() {
  'use strict';

  // Inject the fix script into the page's main world
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = function() {
    this.remove();
  };
  
  // Insert before any other scripts to ensure early execution
  (document.head || document.documentElement).appendChild(script);
})();