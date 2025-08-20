// Simple popup script for production
document.addEventListener('DOMContentLoaded', function() {
  // Just show basic extension information
  const statusEl = document.getElementById('status');
  const statusTextEl = document.getElementById('status-text');
  
  // Set a simple status
  statusEl.className = 'status active';
  statusTextEl.textContent = 'Extension is active and working';
  
  // Remove debug section and test buttons
  const debugSection = document.querySelector('.debug-section');
  if (debugSection) {
    debugSection.remove();
  }
});