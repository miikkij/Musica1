/**
 * Right-click context menu for clips on the timeline.
 * Active in any mode (not just Move) for usability.
 */

const menu = document.getElementById('context-menu');
let actionCallback = null;

export function initContextMenu(onAction) {
  actionCallback = onAction;

  menu.querySelectorAll('.ctx-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      hideContextMenu();
      if (actionCallback) actionCallback(action);
    });
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) hideContextMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideContextMenu();
  });
}

export function showContextMenu(x, y) {
  const posX = Math.min(x, window.innerWidth - 170);
  const posY = Math.min(y, window.innerHeight - 210);

  menu.style.left = posX + 'px';
  menu.style.top = posY + 'px';
  menu.classList.add('visible');
}

export function hideContextMenu() {
  menu.classList.remove('visible');
}
