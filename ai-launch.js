'use strict';
document.getElementById('btnAiPlanner').addEventListener('click', async () => {
  try { await window.electronAPI.openAiPlanner(); }
  catch (error) { alert('Não foi possível abrir o AI Study Planner: ' + error.message); }
});
