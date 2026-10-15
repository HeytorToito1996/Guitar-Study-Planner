// C:\Users\Administrator\.gemini\antigravity\scratch\guitar-study-router\renderer.js

document.addEventListener('DOMContentLoaded', async () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // 0. Tema (Modo Claro / Modo Escuro)
  //    Aplicado de forma síncrona, antes de qualquer `await`, para que a
  //    primeira pintura da tela já use a paleta correta (sem "flash").
  // ─────────────────────────────────────────────────────────────────────────────
  const THEME_KEY = 'guitar-study-router:theme';
  const htmlEl = document.documentElement;
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const themeToggleIcon = document.getElementById('themeToggleIcon');
  const themeToggleLabel = document.getElementById('themeToggleLabel');

  /** Tema ativo; 'dark' enquanto não soubermos o preferido. */
  let currentTheme = 'dark';
  /** Enquanto o usuário não escolher manualmente, seguimos o sistema. */
  let themeChosenByUser = false;

  /** Aplica a paleta e sincroniza o botão de alternância. */
  function applyTheme(theme) {
    currentTheme = theme === 'light' ? 'light' : 'dark';
    htmlEl.setAttribute('data-theme', currentTheme);

    const isDark = currentTheme === 'dark';
    themeToggleIcon.textContent = isDark ? '🌙' : '☀️';
    themeToggleLabel.textContent = isDark ? 'Modo Escuro' : 'Modo Claro';

    const label = isDark ? 'Alternar para modo claro' : 'Alternar para modo escuro';
    btnThemeToggle.title = label;
    btnThemeToggle.setAttribute('aria-label', label);
  }

  /** Lê o tema salvo; se não houver, adota a preferência do sistema. */
  function initTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {
      saved = null; // localStorage bloqueado — segue a preferência do sistema
    }

    if (saved === 'light' || saved === 'dark') {
      themeChosenByUser = true;
      applyTheme(saved);
    } else {
      applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
  }

  initTheme();

  // Se o usuário ainda não escolheu, continua acompanhando o sistema.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!themeChosenByUser) applyTheme(e.matches ? 'dark' : 'light');
  });

  btnThemeToggle.addEventListener('click', async () => {
    themeChosenByUser = true;
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');

    try {
      localStorage.setItem(THEME_KEY, currentTheme);
    } catch {
      // Sem persistência: o tema ainda vale para a sessão atual.
    }

    // Mantém menus e diálogos nativos do sistema na mesma paleta.
    try {
      await window.electronAPI.setTheme(currentTheme);
    } catch (err) {
      console.warn('Não foi possível sincronizar o tema nativo:', err);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. State Management
  // ─────────────────────────────────────────────────────────────────────────────
  let schedule = {
    monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
  };
  let currentDay = 'monday';
  let editingBlockId = null;
  let focusState = null;
  let alphaTabApi = null;

  // O bloco em execução tem tablatura? `showMediaView` depende disso para não
  // revelar uma área de tablatura vazia.
  let blocoTemTab = false;
  
  const dayNameMapping = {
    monday: 'Segunda-feira',
    tuesday: 'Terça-feira',
    wednesday: 'Quarta-feira',
    thursday: 'Quinta-feira',
    friday: 'Sexta-feira',
    saturday: 'Sábado',
    sunday: 'Domingo'
  };

  const topicKeyMapping = {
    'Aquecimento': 'aquecimento',
    'Técnica': 'tecnica',
    'Improvisação': 'improvisacao',
    'Harmonia': 'harmonia',
    'Repertório': 'repertorio'
  };

  // Tópicos em que o bloco pode ter tablatura e áudio de referência.
  const TOPICS_COM_MIDIAS = ['Técnica', 'Repertório'];

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. Persistence & Initialization
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const loadedSchedule = await window.electronAPI.loadSchedule();
    if (loadedSchedule) {
      schedule = { ...schedule, ...loadedSchedule };
    }
  } catch (err) {
    console.error('Erro ao carregar o cronograma:', err);
  }

  // Detect current real weekday
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = new Date().getDay();
  currentDay = days[today];
  updateDaySelection();
  renderBlocks();

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Calendar Navigation
  // ─────────────────────────────────────────────────────────────────────────────
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      currentDay = e.target.dataset.day;
      updateDaySelection();
      renderBlocks();
    });
  });

  function updateDaySelection() {
    document.querySelectorAll('.day-btn').forEach(btn => {
      if (btn.dataset.day === currentDay) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    document.getElementById('dayTitle').textContent = dayNameMapping[currentDay];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Block Rendering & 4. Drag-to-Reorder
  // ─────────────────────────────────────────────────────────────────────────────
  function renderBlocks() {
    const blockList = document.getElementById('blockList');
    blockList.innerHTML = '';
    
    let blocks = schedule[currentDay] || [];
    blocks.sort((a, b) => (a.order || 0) - (b.order || 0));

    const template = document.getElementById('blockTemplate');
    
    blocks.forEach((block, index) => {
      block.order = index;

      const clone = template.content.cloneNode(true);
      const card = clone.querySelector('.block-card');
      card.dataset.id = block.id;

      card.addEventListener('dragstart', handleDragStart);
      card.addEventListener('dragover', handleDragOver);
      card.addEventListener('drop', handleDrop);
      card.addEventListener('dragend', handleDragEnd);

      const topicBadge = clone.querySelector('.block-topic-badge');
      topicBadge.textContent = block.topic;
      topicBadge.classList.add(`badge-${topicKeyMapping[block.topic]}`);

      // Subtópico é opcional: sem texto, o span não ocupa espaço no cabeçalho.
      const subtopicEl = clone.querySelector('.block-subtopic');
      const subtopic = (block.subtopic || '').trim();
      subtopicEl.textContent = subtopic;
      subtopicEl.title = subtopic;
      subtopicEl.classList.toggle('hidden', !subtopic);

      clone.querySelector('.block-duration').textContent = `${block.duration} min`;
      clone.querySelector('.block-rest').textContent = `☕ ${block.restTime} min`;

      const notesArea = clone.querySelector('.block-notes-area');
      const notesText = clone.querySelector('.block-notes-text');
      const metricsArea = clone.querySelector('.block-metrics');
      const tabPathArea = clone.querySelector('.block-tab-path');
      
      if (block.notes) {
        notesText.textContent = block.notes;
      }

      if (block.metrics && block.metrics.length > 0) {
        const lastMetrics = block.metrics.slice(-3);
        metricsArea.textContent = 'Métricas: ' + lastMetrics.map(m => `${m.date} (${m.bpm} BPM)`).join(', ');
      }

      if (block.tabFile) {
        tabPathArea.textContent = `Tab: ${block.tabFile}`;
      }

      clone.querySelector('.btn-start').addEventListener('click', () => startFocus(block));
      clone.querySelector('.btn-edit').addEventListener('click', () => editBlock(block));
      clone.querySelector('.btn-delete').addEventListener('click', () => deleteBlock(block.id));
      clone.querySelector('.btn-toggle-notes').addEventListener('click', () => {
        notesArea.classList.toggle('hidden');
      });

      blockList.appendChild(clone);
    });
  }

  let dragSrcEl = null;

  function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id);
    this.style.opacity = '0.4';
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    if (dragSrcEl !== this) {
      const draggedId = dragSrcEl.dataset.id;
      const targetId = this.dataset.id;
      
      let blocks = schedule[currentDay];
      const draggedIndex = blocks.findIndex(b => b.id === draggedId);
      const targetIndex = blocks.findIndex(b => b.id === targetId);

      const [draggedItem] = blocks.splice(draggedIndex, 1);
      blocks.splice(targetIndex, 0, draggedItem);
      
      blocks.forEach((b, idx) => b.order = idx);
      
      saveSchedule();
      renderBlocks();
    }
    return false;
  }

  function handleDragEnd(e) {
    this.style.opacity = '1.0';
    document.querySelectorAll('.block-card').forEach(col => col.style.opacity = '1.0');
  }

  async function saveSchedule() {
    await window.electronAPI.saveSchedule(schedule);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Block CRUD
  // ─────────────────────────────────────────────────────────────────────────────
  const blockModal = document.getElementById('blockModal');
  const blockForm = document.getElementById('blockForm');
  const fieldTopic = document.getElementById('fieldTopic');
  const tabFileGroup = document.getElementById('tabFileGroup');
  const fieldTabDisplay = document.getElementById('fieldTabDisplay');
  const audioFileGroup = document.getElementById('audioFileGroup');
  const fieldAudioDisplay = document.getElementById('fieldAudioDisplay');

  document.getElementById('btnAddBlock').addEventListener('click', () => {
    editingBlockId = null;
    document.getElementById('modalTitle').textContent = 'Novo Bloco';
    blockForm.reset();
    fieldTabDisplay.value = '';
    fieldAudioDisplay.value = '';
    toggleTabGroup();
    blockModal.classList.remove('hidden');
  });

  function editBlock(block) {
    editingBlockId = block.id;
    document.getElementById('modalTitle').textContent = 'Editar Bloco';
    document.getElementById('fieldTopic').value = block.topic;
    document.getElementById('fieldSubtopic').value = block.subtopic || '';
    document.getElementById('fieldDuration').value = block.duration;
    document.getElementById('fieldRest').value = block.restTime;
    document.getElementById('fieldNotes').value = block.notes || '';
    fieldTabDisplay.value = block.tabFile || '';
    fieldAudioDisplay.value = block.audioFile || '';
    toggleTabGroup();
    blockModal.classList.remove('hidden');
  }

  function deleteBlock(id) {
    if (confirm('Tem certeza que deseja excluir este bloco?')) {
      schedule[currentDay] = schedule[currentDay].filter(b => b.id !== id);
      saveSchedule().then(renderBlocks);
    }
  }

  fieldTopic.addEventListener('change', toggleTabGroup);

  function toggleTabGroup() {
    const topic = fieldTopic.value;
    if (TOPICS_COM_MIDIAS.includes(topic)) {
      tabFileGroup.style.display = 'block';
      audioFileGroup.style.display = 'block';
    } else {
      tabFileGroup.style.display = 'none';
      audioFileGroup.style.display = 'none';
      fieldTabDisplay.value = '';
      fieldAudioDisplay.value = '';
    }
  }

  document.getElementById('btnSelectTab').addEventListener('click', async () => {
    const filePath = await window.electronAPI.openGpFile();
    if (filePath) {
      fieldTabDisplay.value = filePath;
    }
  });

  document.getElementById('btnSelectAudio').addEventListener('click', async () => {
    const filePath = await window.electronAPI.openAudioFile();
    if (filePath) {
      fieldAudioDisplay.value = filePath;
    }
  });

  document.getElementById('btnModalCancel').addEventListener('click', () => {
    blockModal.classList.add('hidden');
  });

  document.getElementById('btnModalSave').addEventListener('click', () => {
    const topic = document.getElementById('fieldTopic').value;
    const subtopic = document.getElementById('fieldSubtopic').value.trim();
    const duration = parseInt(document.getElementById('fieldDuration').value);
    const restTime = parseInt(document.getElementById('fieldRest').value);
    const notes = document.getElementById('fieldNotes').value;
    const tabFile = fieldTabDisplay.value || null;
    const audioFile = fieldAudioDisplay.value || null;

    if (!topic || isNaN(duration) || isNaN(restTime)) {
      alert('Preencha os campos obrigatórios corretamente.');
      return;
    }

    if (editingBlockId) {
      const block = schedule[currentDay].find(b => b.id === editingBlockId);
      if (block) {
        block.topic = topic;
        block.subtopic = subtopic;
        block.duration = duration;
        block.restTime = restTime;
        block.notes = notes;
        block.tabFile = tabFile;
        block.audioFile = audioFile;
      }
    } else {
      const newBlock = {
        id: crypto.randomUUID(),
        topic,
        subtopic,
        duration,
        restTime,
        notes,
        metrics: [],
        tabFile,
        audioFile,
        order: schedule[currentDay].length
      };
      schedule[currentDay].push(newBlock);
    }

    saveSchedule().then(() => {
      blockModal.classList.add('hidden');
      renderBlocks();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Import/Export
  // ─────────────────────────────────────────────────────────────────────────────
  const importModal = document.getElementById('importModal');

  document.getElementById('btnExport').addEventListener('click', () => {
    window.electronAPI.exportJson(schedule);
  });

  document.getElementById('btnImport').addEventListener('click', () => {
    importModal.classList.remove('hidden');
  });

  document.getElementById('btnImportCancel').addEventListener('click', () => {
    importModal.classList.add('hidden');
  });

  document.getElementById('btnImportWeek').addEventListener('click', async () => {
    const imported = await window.electronAPI.importJson();
    if (imported) {
      schedule = imported;
      await saveSchedule();
      renderBlocks();
    }
    importModal.classList.add('hidden');
  });

  document.getElementById('btnImportDay').addEventListener('click', async () => {
    const imported = await window.electronAPI.importJson();
    if (imported && imported[currentDay]) {
      schedule[currentDay] = imported[currentDay];
      await saveSchedule();
      renderBlocks();
    }
    importModal.classList.add('hidden');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7 & 8. Focus Mode (Timer) & Training Closure
  // ─────────────────────────────────────────────────────────────────────────────
  const focusView = document.getElementById('focusView');
  const scheduleView = document.getElementById('scheduleView');
  const closureModal = document.getElementById('closureModal');
  const timerDisplay = document.getElementById('timerDisplay');
  const timerLabel = document.getElementById('timerLabel');
  const timerArea = document.getElementById('timerArea');
  const btnTimerPause = document.getElementById('btnTimerPause');

  function updateTimerPauseUi() {
    const paused = !!(focusState && focusState.paused);
    timerArea.classList.toggle('paused', paused);
    btnTimerPause.textContent = paused ? '▶ Retomar Timer' : '⏸ Pausar Timer';
    btnTimerPause.className = paused ? 'btn-primary' : 'btn-secondary';
    if (focusState) {
      const baseLabel = focusState.phase === 'rest' ? '☕ Descanso' : '⏱️ Treino';
      timerLabel.textContent = paused ? `${baseLabel} (Pausado)` : baseLabel;
    }
  }

  btnTimerPause.addEventListener('click', () => {
    if (!focusState) return;
    focusState.paused = !focusState.paused;
    updateTimerPauseUi();
  });

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  /** Fila da execução do dia: { blocks, index }. null = fora de uma execução. */
  let daySession = null;

  function startFocus(block) {
    // Começar um bloco isolado cancela qualquer execução do dia em andamento.
    daySession = null;
    beginBlock(block);
  }

  /** Executa todos os blocos do dia atual em sequência. */
  function startDaySession() {
    const blocks = (schedule[currentDay] || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (blocks.length === 0) {
      alert('Não há blocos neste dia. Adicione blocos antes de executar.');
      return;
    }

    daySession = { blocks, index: 0 };
    beginBlock(blocks[0]);
  }

  document.getElementById('btnRunDay').addEventListener('click', () => {
    startDaySession();
  });

  /** Monta a tela de foco para um bloco. Também usado para avançar no dia. */
  function beginBlock(block) {
    // Descarta o que ficou do bloco anterior.
    endFocusInterval();
    stopMetronome();
    destroyAlphaTab();
    destroyAudio();

    window.electronAPI.enterFocus();

    focusState = {
      block: block,
      phase: 'study',
      remaining: block.duration * 60,
      paused: false,
      intervalId: null
    };

    const focusTopic = document.getElementById('focusTopic');
    focusTopic.textContent = block.topic;
    focusTopic.className = `badge-${topicKeyMapping[block.topic]}`;

    document.getElementById('focusBlockInfo').textContent =
      `${block.duration} min treino / ${block.restTime} min descanso${progressSuffix()}`;

    renderFocusContext(block);

    scheduleView.classList.add('hidden');
    focusView.classList.remove('hidden');
    // O painel só pode ser medido/posicionado depois de ficar visível.
    restorePanelPosition();
    timerArea.classList.remove('rest-mode');
    timerDisplay.textContent = formatTime(focusState.remaining);
    updateTimerPauseUi();

    const temMidias = TOPICS_COM_MIDIAS.includes(block.topic);
    const hasTab = !!(block.tabFile && temMidias);
    const hasAudio = !!(block.audioFile && temMidias);
    blocoTemTab = hasTab;

    // A visão padrão é decidida ANTES de montar as mídias. O alphaTab mede o
    // container uma única vez, ao carregar a partitura: se ele for criado com a
    // área escondida (`display: none`) a tab sai em branco e não se recupera.
    btnToggleMedia.classList.toggle('hidden', !(hasTab && hasAudio));
    showMediaView(hasAudio ? 'audio' : 'tab');

    if (hasTab) initAlphaTab(block);
    else destroyAlphaTab();

    if (hasAudio) initAudio(block);
    else destroyAudio();

    focusState.intervalId = setInterval(focusTick, 1000);
  }

  /** " · Bloco 2 de 5" quando executando o dia inteiro. */
  function progressSuffix() {
    if (!daySession) return '';
    return ` · Bloco ${daySession.index + 1} de ${daySession.blocks.length}`;
  }

  /**
   * Contexto do bloco no Modo Foco: o subtópico em destaque e as anotações já
   * salvas para este bloco. Os dois são opcionais e têm estado vazio próprio.
   */
  function renderFocusContext(block) {
    document.getElementById('focusSubtopic').value = (block.subtopic || '').trim();

    const notesEl = document.getElementById('focusNotesText');
    const notas = (block.notes || '').trim();
    notesEl.textContent = notas || 'Nenhuma anotação salva para este bloco.';
    notesEl.classList.toggle('vazio', !notas);
  }

  // O subtópico é campo de texto livre também no Modo Foco: salva ao sair do
  // campo (ou com Enter) e espelha o valor no cartão do dia.
  const focusSubtopicInput = document.getElementById('focusSubtopic');

  focusSubtopicInput.addEventListener('change', () => {
    const block = focusState && focusState.block;
    if (!block) return;
    const valor = focusSubtopicInput.value.trim();
    if ((block.subtopic || '').trim() === valor) return;
    block.subtopic = valor;
    saveSchedule().then(renderBlocks);
  });

  focusSubtopicInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      focusSubtopicInput.blur();
    }
  });

  /** Avança para o próximo bloco do dia. Devolve false quando não há mais. */
  function advanceDaySession() {
    if (!daySession) return false;

    daySession.index++;
    if (daySession.index >= daySession.blocks.length) {
      daySession = null;
      return false;
    }

    beginBlock(daySession.blocks[daySession.index]);
    return true;
  }

  function focusTick() {
    if (!focusState || focusState.paused) return;
    
    focusState.remaining--;
    timerDisplay.textContent = formatTime(focusState.remaining);

    if (focusState.remaining <= 0) {
      if (focusState.phase === 'study') {
        if (focusState.block.restTime > 0) {
          focusState.phase = 'rest';
          focusState.remaining = focusState.block.restTime * 60;
          timerArea.classList.add('rest-mode');
          timerDisplay.textContent = formatTime(focusState.remaining);
          updateTimerPauseUi();
          
          stopMetronome();
          if (alphaTabApi) alphaTabApi.pause();

        } else {
          endFocusInterval();
          showClosureModal();
        }
      } else if (focusState.phase === 'rest') {
        endFocusInterval();
        showClosureModal();
      }
    }
  }

  function endFocusInterval() {
    if (focusState && focusState.intervalId) {
      clearInterval(focusState.intervalId);
      focusState.intervalId = null;
    }
  }

  function showClosureModal() {
    closureModal.classList.remove('hidden');
    document.getElementById('closureNotes').value = '';
    document.getElementById('closureBpm').value = '';
  }

  document.getElementById('btnExitFocus').addEventListener('click', () => {
    endFocusInterval();
    exitFocusMode();
  });

  document.getElementById('btnClosureSkip').addEventListener('click', () => {
    closureModal.classList.add('hidden');
    // Pular só descarta as anotações deste bloco; o restante do dia continua.
    if (!advanceDaySession()) exitFocusMode();
  });

  document.getElementById('btnClosureSave').addEventListener('click', () => {
    if (!focusState || !focusState.block) return;
    
    const block = focusState.block;
    const bpm = parseInt(document.getElementById('closureBpm').value);
    const notes = document.getElementById('closureNotes').value;

    if (!isNaN(bpm)) {
      if (!block.metrics) block.metrics = [];
      block.metrics.push({
        date: new Date().toISOString().slice(0, 10),
        bpm: bpm
      });
    }

    if (notes.trim()) {
      block.notes = block.notes ? block.notes + '\n' + notes : notes;
    }

    saveSchedule().then(() => {
      closureModal.classList.add('hidden');
      // Se ainda restam blocos do dia, segue; senão encerra o Modo Foco.
      if (!advanceDaySession()) exitFocusMode();
    });
  });

  function exitFocusMode() {
    window.electronAPI.exitFocus();
    stopMetronome();
    destroyAlphaTab();
    destroyAudio();
    blocoTemTab = false;
    focusState = null;
    daySession = null;

    focusView.classList.add('hidden');
    closureModal.classList.add('hidden');
    scheduleView.classList.remove('hidden');
    renderBlocks();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Metronome (Web Audio API)
  // ─────────────────────────────────────────────────────────────────────────────
  let metronomeState = {
    running: false,
    bpm: 120,
    beatsPerMeasure: 4,
    currentBeat: 0,
    audioCtx: null,
    nextNoteTime: 0,
    schedulerTimer: null,
    animationBeat: -1
  };

  const SCHEDULE_AHEAD_TIME = 0.1; 
  const SCHEDULER_INTERVAL = 25;   

  const inputBpm = document.getElementById('metronomeBpm');
  const sliderBpm = document.getElementById('metronomeBpmSlider');
  const selectTimeSig = document.getElementById('metronomeTimeSig');
  const btnToggleMetronome = document.getElementById('btnMetronomeToggle');
  const beatIndicators = document.getElementById('beatIndicators');

  // ─────────────────────────────────────────────────────────────────────────────
  // 9b. Painel do metrônomo: recolher e arrastar
  // ─────────────────────────────────────────────────────────────────────────────
  const PANEL_KEY = 'guitar-study-router:metronome-panel';
  const PANEL_MARGIN = 20;
  const PANEL_MIN_WIDTH = 200;

  const panel = document.getElementById('metronomePanel');
  const panelHandle = document.getElementById('metronomeHandle');
  const btnCollapse = document.getElementById('btnMetronomeCollapse');

  /** Mantém o painel dentro da janela visível. */
  function clampPanelPosition(left, top) {
    const rect = panel.getBoundingClientRect();
    const w = rect.width || PANEL_MIN_WIDTH;
    const maxLeft = Math.max(PANEL_MARGIN, window.innerWidth - w - PANEL_MARGIN);
    const maxTop = Math.max(0, window.innerHeight - (rect.height || 0) - PANEL_MARGIN);
    return {
      left: Math.min(Math.max(PANEL_MARGIN, left), maxLeft),
      top: Math.min(Math.max(0, top), maxTop)
    };
  }

  function setPanelPosition(left, top) {
    const pos = clampPanelPosition(left, top);
    // `right`/`bottom` precisam ser neutralizados para o top/left valer.
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = `${pos.left}px`;
    panel.style.top = `${pos.top}px`;
    return pos;
  }

  function readStoredPanel() {
    try {
      const raw = JSON.parse(localStorage.getItem(PANEL_KEY) || '{}');
      return {
        left: Number.isFinite(raw.left) ? raw.left : null,
        top: Number.isFinite(raw.top) ? raw.top : null,
        collapsed: raw.collapsed === true
      };
    } catch {
      return { left: null, top: null, collapsed: false };
    }
  }

  function savePanelState() {
    try {
      localStorage.setItem(PANEL_KEY, JSON.stringify({
        left: parseFloat(panel.style.left),
        top: parseFloat(panel.style.top),
        collapsed: panel.classList.contains('collapsed')
      }));
    } catch {
      // Sem persistência: vale apenas para a sessão atual.
    }
  }

  function setCollapsed(collapsed, persist = true) {
    panel.classList.toggle('collapsed', collapsed);
    btnCollapse.textContent = collapsed ? '▲' : '▼';
    btnCollapse.title = collapsed ? 'Expandir painel' : 'Recolher painel';
    btnCollapse.setAttribute('aria-label', btnCollapse.title);
    btnCollapse.setAttribute('aria-expanded', String(!collapsed));
    if (persist) savePanelState();
  }

  btnCollapse.addEventListener('click', () => {
    setCollapsed(!panel.classList.contains('collapsed'));
  });

  /** Posiciona o painel ao entrar no Modo Foco (aí ele já está visível e medível). */
  function restorePanelPosition() {
    const stored = readStoredPanel();
    if (stored.left === null || stored.top === null) {
      const rect = panel.getBoundingClientRect();
      setPanelPosition(
        PANEL_MARGIN,
        Math.max(0, window.innerHeight - rect.height - PANEL_MARGIN)
      );
    } else {
      setPanelPosition(stored.left, stored.top);
    }
    setCollapsed(stored.collapsed, false);
  }

  // ── Arrastar e soltar ──────────────────────────────────────────────────────
  let panelDrag = null;

  panelHandle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const rect = panel.getBoundingClientRect();
    // Guarda o deslocamento do ponteiro em relação ao canto do painel,
    // para o conteúdo não "pular" ao iniciar o arraste.
    panelDrag = { pointerId: e.pointerId, dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    panel.classList.add('dragging');
    try {
      // Captura o ponteiro para continuar o arraste mesmo saindo da alça.
      panelHandle.setPointerCapture(e.pointerId);
    } catch {
      // Sem captura o arraste ainda funciona enquanto o ponteiro estiver na alça.
    }
    e.preventDefault();
  });

  panelHandle.addEventListener('pointermove', (e) => {
    if (!panelDrag || e.pointerId !== panelDrag.pointerId) return;
    setPanelPosition(e.clientX - panelDrag.dx, e.clientY - panelDrag.dy);
  });

  function endPanelDrag(e) {
    if (!panelDrag || e.pointerId !== panelDrag.pointerId) return;
    try {
      panelHandle.releasePointerCapture(panelDrag.pointerId);
    } catch {
      // O ponteiro pode já ter sido liberado pelo navegador.
    }
    panelDrag = null;
    panel.classList.remove('dragging');
    savePanelState();
  }

  panelHandle.addEventListener('pointerup', endPanelDrag);
  panelHandle.addEventListener('pointercancel', endPanelDrag);

  // Alternativa por teclado: as setas movem o painel (Shift = passo maior).
  panelHandle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 60 : 20;
    const moves = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step]
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    setPanelPosition(rect.left + move[0], rect.top + move[1]);
    savePanelState();
  });

  // Redimensionar a janela (ou entrar/sair de tela cheia) pode deixar o painel
  // fora da área visível — reposiciona.
  window.addEventListener('resize', () => {
    const rect = panel.getBoundingClientRect();
    if (rect.width > 0) setPanelPosition(rect.left, rect.top);
  });

  function buildBeatIndicators() {
    beatIndicators.innerHTML = '';
    for (let i = 0; i < metronomeState.beatsPerMeasure; i++) {
      const dot = document.createElement('div');
      dot.className = 'beat-dot';
      if (i === 0) dot.classList.add('accent');
      beatIndicators.appendChild(dot);
    }
  }

  inputBpm.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
      sliderBpm.value = val;
      metronomeState.bpm = val;
    }
  });

  sliderBpm.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    inputBpm.value = val;
    metronomeState.bpm = val;
  });

  selectTimeSig.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === '4/4') metronomeState.beatsPerMeasure = 4;
    if (val === '3/4') metronomeState.beatsPerMeasure = 3;
    if (val === '6/8') metronomeState.beatsPerMeasure = 6;
    if (val === '2/4') metronomeState.beatsPerMeasure = 2;
    buildBeatIndicators();
  });

  /** Único ponto que reflete o estado do metrônomo no botão. */
  function setMetronomeUi(running) {
    btnToggleMetronome.classList.toggle('active', running);
    btnToggleMetronome.textContent = running ? '⏹ Parar' : '▶ Iniciar';
    btnToggleMetronome.title = running ? 'Parar o metrônomo' : 'Iniciar o metrônomo';
  }

  btnToggleMetronome.addEventListener('click', () => {
    if (metronomeState.running) {
      stopMetronome();
    } else {
      startMetronome();
    }
  });

  function startMetronome() {
    if (!metronomeState.audioCtx) metronomeState.audioCtx = new window.AudioContext();
    const ctx = metronomeState.audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    
    metronomeState.running = true;
    metronomeState.currentBeat = 0;
    metronomeState.nextNoteTime = ctx.currentTime;
    setMetronomeUi(true);
    buildBeatIndicators();
    metronomeState.schedulerTimer = setInterval(scheduler, SCHEDULER_INTERVAL);
  }

  function scheduler() {
    const ctx = metronomeState.audioCtx;
    while (metronomeState.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_TIME) {
      scheduleNote(metronomeState.nextNoteTime, metronomeState.currentBeat);
      const secondsPerBeat = 60.0 / metronomeState.bpm;
      metronomeState.nextNoteTime += secondsPerBeat;
      metronomeState.currentBeat = (metronomeState.currentBeat + 1) % metronomeState.beatsPerMeasure;
    }
  }

  function scheduleNote(time, beat) {
    const ctx = metronomeState.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.value = (beat === 0) ? 1000 : 800;
    osc.type = 'sine';
    
    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    
    osc.start(time);
    osc.stop(time + 0.06);
    
    const delay = (time - ctx.currentTime) * 1000;
    setTimeout(() => updateBeatVisual(beat), Math.max(0, delay));
  }

  function updateBeatVisual(beat) {
    if (!metronomeState.running) return;
    const dots = document.querySelectorAll('.beat-dot');
    dots.forEach(d => d.classList.remove('pulse'));
    if (dots[beat]) {
      dots[beat].classList.add('pulse');
      setTimeout(() => {
        if (dots[beat]) dots[beat].classList.remove('pulse');
      }, 100);
    }
  }

  function stopMetronome() {
    metronomeState.running = false;
    if (metronomeState.schedulerTimer) {
      clearInterval(metronomeState.schedulerTimer);
      metronomeState.schedulerTimer = null;
    }
    setMetronomeUi(false);
    document.querySelectorAll('.beat-dot').forEach(d => d.classList.remove('pulse'));
  }

  buildBeatIndicators();
  setMetronomeUi(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. AlphaTab Integration
  // ─────────────────────────────────────────────────────────────────────────────

  // AbortController para limpar event listeners ao destruir o alphaTab
  let alphaTabAbort = null;

  async function initAlphaTab(block) {
    // Só a instância: `beginBlock` já chamou `destroyAlphaTab()`. Esconder a área
    // aqui desfaria a visão que `showMediaView` acabou de definir.
    resetAlphaTab();

    // A visibilidade da área é de `showMediaView`; aqui só carregamos o arquivo.
    const container = document.getElementById('alphaTabContainer');

    const fileData = await window.electronAPI.readBinary(block.tabFile);
    if (!fileData) return;
    
    const settings = {
      core: {
        engine: 'html5',
        logLevel: 1,
        // O padrão é true, e aí o alphaTab só desenha os compassos que estão
        // entrando na tela (IntersectionObserver). Num bloco de estudo pequeno
        // isso só traz unpredictibilidade: a partitura apareceria em partes, e
        // nada apareceria enquanto a área estivesse fora de vista.
        enableLazyLoading: false
      },
      player: {
        enablePlayer: true,
        // Cursor de acompanhamento visual. O bundle do alphaTab cria e move os
        // elementos (.at-cursor-bar / .at-cursor-beat) mas não traz aparência
        // nenhuma para eles: sem o CSS em #alphaTabArea .at-cursor-* a barra
        // existe e caminha, só não é visível.
        enableCursor: true,
        enableAnimatedBeatCursor: true,
        enableElementHighlighting: true,
        enableUserInteraction: true,
        // Soundfont empacotado com o app (copiado por scripts/copy-alphatab.js).
        // Antes vinha de um CDN: o app instalado não tocaria sem internet.
        soundFont: 'lib/alphatab/soundfont/sonivox.sf2',
        scrollMode: 1 
      },
      display: {
        staveProfile: 1 
      }
    };
    
    alphaTabApi = new window.alphaTab.AlphaTabApi(container, settings);

    // Nada a silenciar aqui: o alphaTab não tem autoplay (1.3 não expõe a opção),
    // então uma API recém-criada nunca está tocando. Pausá-la só faria o synth
    // chamar `stop()` sem `start()` e lançar `InvalidStateError` no worker.
    // O silêncio de verdade é feito em `showMediaView`, quando o usuário troca
    // de visão com a tab em reprodução.

    // Desativamos o loop nativo direto do synth (`isLooping = false`) para que
    // o ciclo seja interceptado em `playerFinished`, forçando o Count-In em
    // todas as repetições antes de reiniciar o áudio no novo BPM.
    alphaTabApi.isLooping = false;
    alphaTabApi.countInVolume = 1;

    // Carregar arquivo binário
    alphaTabApi.load(new Uint8Array(fileData));

    // ── Elementos da interface do player ──────────────────────────────────────
    const btnPlayPause = document.getElementById('btnAtPlayPause');
    const btnStop = document.getElementById('btnAtStop');
    const btnCountIn = document.getElementById('btnAtCountIn');
    const timeReadout = document.getElementById('atTimeReadout');

    const tempoInfo = document.getElementById('tempoInfo');
    const bpmInput = document.getElementById('atBpmInput');
    const percentInput = document.getElementById('atPercentInput');
    const btnResetTempo = document.getElementById('btnResetTempo');

    const loopStatus = document.getElementById('loopStatus');
    const btnLoopOff = document.getElementById('btnLoopOff');
    const btnLoopAll = document.getElementById('btnLoopAll');
    const btnLoopAB = document.getElementById('btnLoopAB');
    const loopAbFields = document.getElementById('atLoopAbFields');
    const loopStartInput = document.getElementById('loopStart');
    const loopEndInput = document.getElementById('loopEnd');
    const btnClearLoop = document.getElementById('btnClearLoop');

    const speedReadout = document.getElementById('currentSpeed');
    const btnRampToggle = document.getElementById('btnRampToggle');
    const rampFields = document.getElementById('atRampFields');
    const rampStartElem = document.getElementById('rampStart');
    const rampStepElem = document.getElementById('rampStep');
    const rampTargetElem = document.getElementById('rampTarget');

    // ── Estado do Player, Loop e Ramping ──────────────────────────────────────
    let originalBpm = null;
    let isPlayerPlaying = false;
    let countInEnabled = true;
    let loopMode = 'all'; // 'off' | 'all' | 'ab'
    let loopRange = null; // { startTick, endTick }
    let internalRangeUpdate = false;

    const rampState = {
      enabled: false,
      currentSpeed: 1,
      ceiling: 1,
      loopCount: 0
    };

    /** Descobre o BPM original da tab. */
    function readOriginalBpm(score) {
      if (score && typeof score.tempo === 'number' && score.tempo > 0) {
        return score.tempo;
      }
      const bar = score && score.masterBars && score.masterBars[0];
      const automation = bar && bar.tempoAutomations && bar.tempoAutomations[0];
      if (automation && automation.tempo > 0) return automation.tempo;
      return null;
    }

    /** Descreve uma velocidade: "60% · 72 BPM" (BPM só quando conhecido). */
    function formatSpeed(speed) {
      const pct = Math.round(speed * 100);
      return originalBpm ? `${pct}% (${Math.round(originalBpm * speed)} BPM)` : `${pct}%`;
    }

    /** Configura o metrônomo pré-play (Count-In) no AlphaTab. */
    function prepareCountIn() {
      if (!alphaTabApi) return;
      alphaTabApi.countInVolume = countInEnabled ? 1 : 0;
      btnCountIn.classList.toggle('active', countInEnabled);
    }

    /** Atualiza os campos de BPM, % e o badge do Ramping conforme a velocidade ativa. */
    function syncTempoUi(speed, { skipBpmInput = false, skipPercentInput = false } = {}) {
      const pct = Math.round(speed * 100);
      if (!skipPercentInput) {
        percentInput.value = String(pct);
      }
      if (!skipBpmInput) {
        if (originalBpm) {
          bpmInput.value = String(Math.round(originalBpm * speed));
          bpmInput.disabled = false;
        } else {
          bpmInput.value = '';
          bpmInput.placeholder = '—';
          bpmInput.disabled = true;
        }
      }
      if (rampState.enabled) {
        speedReadout.textContent = `Volta ${rampState.loopCount + 1} · ${formatSpeed(speed)}`;
      } else {
        speedReadout.textContent = 'Desativado';
      }
    }

    /** Aplica a velocidade de reprodução no AlphaTab e sincroniza a UI. */
    function setSpeed(speed, options = {}) {
      const safeSpeed = Math.max(0.1, Math.min(3.0, Number(speed) || 1));
      const finalSpeed = rampState.enabled
        ? Math.min(safeSpeed, rampState.ceiling)
        : safeSpeed;

      rampState.currentSpeed = finalSpeed;
      if (alphaTabApi) {
        alphaTabApi.playbackSpeed = finalSpeed;
      }
      syncTempoUi(finalSpeed, options);
    }

    function updateTempoInfo() {
      const totalBars = alphaTabApi && alphaTabApi.score && alphaTabApi.score.masterBars
        ? alphaTabApi.score.masterBars.length
        : 0;
      tempoInfo.textContent = originalBpm
        ? `Orig: ${Math.round(originalBpm)} BPM`
        : 'Orig: — BPM';
      if (totalBars > 0) {
        loopStartInput.max = String(totalBars);
        loopEndInput.max = String(totalBars);
      }
    }

    // ── Funções do Ramping ────────────────────────────────────────────────────
    function resolveCeiling() {
      const pct = rampTargetElem ? parseFloat(rampTargetElem.value) : NaN;
      return (Number.isFinite(pct) && pct > 0 ? pct : 100) / 100;
    }

    function readRampStep() {
      const pct = rampStepElem ? parseFloat(rampStepElem.value) : NaN;
      return (Number.isFinite(pct) && pct > 0 ? pct : 5) / 100;
    }

    function resolveInitialSpeed() {
      rampState.ceiling = resolveCeiling();
      const pct = rampStartElem ? parseFloat(rampStartElem.value) : NaN;
      const start = (Number.isFinite(pct) && pct > 0 ? pct : 60) / 100;
      return Math.min(start, rampState.ceiling);
    }

    function resetRamp() {
      rampState.loopCount = 0;
      rampState.ceiling = resolveCeiling();
      if (rampState.enabled) {
        setSpeed(resolveInitialSpeed());
      } else {
        syncTempoUi(rampState.currentSpeed);
      }
    }

    function setRampEnabled(enabled) {
      rampState.enabled = enabled;
      btnRampToggle.classList.toggle('active', enabled);
      btnRampToggle.textContent = enabled ? '📈 Ramping Ativo' : '📈 Ativar Ramping';
      rampFields.classList.toggle('hidden', !enabled);

      if (enabled) {
        // Ramping exige repetição ativa; se estiver "Sem Loop", liga "Tab Inteira".
        if (loopMode === 'off') {
          setLoopMode('all');
        }
        resetRamp();
      } else {
        syncTempoUi(rampState.currentSpeed);
      }
    }

    function advanceRamp() {
      rampState.loopCount++;
      rampState.ceiling = resolveCeiling();
      const step = readRampStep();
      const nextSpeed = Math.min(rampState.ceiling, rampState.currentSpeed + step);
      setSpeed(nextSpeed);
    }

    // ── Funções de Loop (Sem Loop / Tab Inteira / Trecho A-B) ─────────────────
    function setLoopStatus(text, isError = false) {
      loopStatus.textContent = text;
      loopStatus.classList.toggle('error', isError);
    }

    function updateLoopButtonsUi() {
      btnLoopOff.classList.toggle('active', loopMode === 'off');
      btnLoopAll.classList.toggle('active', loopMode === 'all');
      btnLoopAB.classList.toggle('active', loopMode === 'ab');
      loopAbFields.classList.toggle('hidden', loopMode !== 'ab');
    }

    function applyPlaybackRange() {
      if (!alphaTabApi) return;
      alphaTabApi.isLooping = false;
      prepareCountIn();

      const activeRange = loopMode === 'ab' && loopRange
        ? { startTick: loopRange.startTick, endTick: loopRange.endTick }
        : null;

      internalRangeUpdate = true;
      alphaTabApi.playbackRange = activeRange;
      internalRangeUpdate = false;

      alphaTabApi.tickPosition = activeRange ? activeRange.startTick : 0;
    }

    function findBarsFromTicks(startTick, endTick) {
      const bars = alphaTabApi && alphaTabApi.score && alphaTabApi.score.masterBars;
      if (!bars || bars.length === 0) return null;
      let startBar = 1;
      let endBar = bars.length;
      for (let i = 0; i < bars.length; i++) {
        if (bars[i].start <= startTick) startBar = i + 1;
        if (bars[i].start < endTick) endBar = i + 1;
      }
      return { startBar, endBar };
    }

    function applyLoopFromInputs() {
      const score = alphaTabApi && alphaTabApi.score;
      const bars = score && score.masterBars;

      if (!bars || bars.length === 0) {
        setLoopStatus('Aguarde a tablatura carregar', true);
        return;
      }

      const startBar = parseInt(loopStartInput.value, 10);
      const endBar = parseInt(loopEndInput.value, 10);

      if (!Number.isFinite(startBar) || !Number.isFinite(endBar) || startBar < 1 || endBar < startBar) {
        setLoopStatus(`Informe compassos de 1 a ${bars.length}`, true);
        return;
      }
      if (startBar > bars.length) {
        setLoopStatus(`A tab tem ${bars.length} compassos`, true);
        return;
      }

      const lastBar = Math.min(endBar, bars.length);
      const tickStart = bars[startBar - 1].start;
      const tickEnd = lastBar < bars.length ? bars[lastBar].start : alphaTabApi.endTick;

      if (!(tickEnd > tickStart)) {
        setLoopStatus('Intervalo vazio', true);
        return;
      }

      loopRange = { startTick: tickStart, endTick: tickEnd };
      setLoopStatus(`Compassos ${startBar} a ${lastBar} (de ${bars.length})`);
      applyPlaybackRange();
    }

    function setLoopMode(mode) {
      loopMode = mode;
      updateLoopButtonsUi();

      const bars = alphaTabApi && alphaTabApi.score && alphaTabApi.score.masterBars;
      const totalBars = bars ? bars.length : 0;

      if (mode === 'off') {
        loopRange = null;
        setLoopStatus('Tocar 1 vez (sem repetição)');
        applyPlaybackRange();
      } else if (mode === 'all') {
        loopRange = null;
        setLoopStatus(totalBars ? `Tab inteira (${totalBars} compassos)` : 'Tab inteira');
        applyPlaybackRange();
      } else if (mode === 'ab') {
        if (!loopStartInput.value || !loopEndInput.value) {
          loopStartInput.value = '1';
          loopEndInput.value = String(totalBars ? Math.min(4, totalBars) : 4);
        }
        applyLoopFromInputs();
      }
    }

    // ── Controle de Reprodução e Fim de Ciclo ─────────────────────────────────
    function togglePlayPause() {
      if (!alphaTabApi) return;
      if (isPlayerPlaying) {
        alphaTabApi.pause();
      } else {
        prepareCountIn();
        if (loopMode === 'ab' && loopRange) {
          const currentTick = alphaTabApi.tickPosition;
          if (currentTick < loopRange.startTick || currentTick >= loopRange.endTick) {
            alphaTabApi.tickPosition = loopRange.startTick;
          }
        }
        alphaTabApi.play();
      }
    }

    function handleCycleFinished() {
      if (!alphaTabApi) return;
      if (loopMode === 'off') return;

      const hasRange = loopMode === 'ab' && loopRange && loopRange.endTick > loopRange.startTick;

      // Coloca o synth em estado Paused antes do novo ciclo para que
      // `alphaTabApi.play()` execute obrigatoriamente a contagem (Count-In).
      alphaTabApi.stop();

      if (rampState.enabled) {
        advanceRamp();
      }

      alphaTabApi.tickPosition = hasRange ? loopRange.startTick : 0;
      prepareCountIn();
      alphaTabApi.play();
    }

    // ── Eventos do AlphaTab ───────────────────────────────────────────────────
    function handleScoreLoaded(score) {
      originalBpm = readOriginalBpm(score);
      updateTempoInfo();
      setSpeed(rampState.currentSpeed);
      if (loopMode === 'all') {
        const totalBars = score && score.masterBars ? score.masterBars.length : 0;
        setLoopStatus(totalBars ? `Tab inteira (${totalBars} compassos)` : 'Tab inteira');
      } else if (loopMode === 'ab') {
        applyLoopFromInputs();
      }
    }

    alphaTabApi.scoreLoaded.on(handleScoreLoaded);
    if (alphaTabApi.score) handleScoreLoaded(alphaTabApi.score);

    alphaTabApi.soundFontLoaded.on(() => {
      prepareCountIn();
    });

    alphaTabApi.playerReady.on(() => {
      prepareCountIn();
      applyPlaybackRange();
      setSpeed(rampState.currentSpeed);
    });

    // Seleção A-B feita arrastando o mouse diretamente na partitura
    alphaTabApi.playbackRangeChanged.on((args) => {
      if (internalRangeUpdate) return;
      const range = args && args.playbackRange;
      if (range && range.endTick > range.startTick) {
        loopRange = { startTick: range.startTick, endTick: range.endTick };
        loopMode = 'ab';
        updateLoopButtonsUi();
        const barSpan = findBarsFromTicks(range.startTick, range.endTick);
        if (barSpan) {
          loopStartInput.value = String(barSpan.startBar);
          loopEndInput.value = String(barSpan.endBar);
          setLoopStatus(`Compassos ${barSpan.startBar} a ${barSpan.endBar} (seleção)`);
        } else {
          setLoopStatus('Trecho A–B selecionado');
        }
        alphaTabApi.tickPosition = loopRange.startTick;
      } else if (loopMode === 'ab') {
        setLoopMode('all');
      }
    });

    alphaTabApi.playerFinished.on(() => {
      handleCycleFinished();
    });

    function formatPosicao(args) {
      const mmss = (ms) => {
        const s = Math.max(0, Math.floor(ms / 1000));
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      };
      return `${mmss(args.currentTime)} / ${mmss(args.endTime)}`;
    }

    let ultimaPosicaoEm = 0;

    alphaTabApi.playerPositionChanged.on((args) => {
      const agora = Date.now();
      if (agora - ultimaPosicaoEm < 200) return;
      ultimaPosicaoEm = agora;
      timeReadout.textContent = formatPosicao(args);
    });

    alphaTabApi.playerStateChanged.on((args) => {
      isPlayerPlaying = args.state === 1;
      if (isPlayerPlaying && metronomeState.running) {
        stopMetronome();
      }
      btnPlayPause.textContent = isPlayerPlaying ? '⏸ Pause' : '▶ Play';
      btnPlayPause.classList.toggle('playing', isPlayerPlaying);
    });

    // ── Listeners de UI (limpos ao destruir o bloco) ──────────────────────────
    alphaTabAbort = new AbortController();
    const signal = alphaTabAbort.signal;

    btnPlayPause.addEventListener('click', () => {
      togglePlayPause();
    }, { signal });

    btnStop.addEventListener('click', () => {
      if (!alphaTabApi) return;
      alphaTabApi.stop();
      if (rampState.enabled) {
        resetRamp();
      }
    }, { signal });

    btnCountIn.addEventListener('click', () => {
      countInEnabled = !countInEnabled;
      prepareCountIn();
    }, { signal });

    // Digitar o BPM aplica imediatamente o novo andamento
    bpmInput.addEventListener('input', () => {
      const bpmVal = parseFloat(bpmInput.value);
      if (!originalBpm || !Number.isFinite(bpmVal) || bpmVal <= 0) return;
      setSpeed(bpmVal / originalBpm, { skipBpmInput: true });
    }, { signal });

    bpmInput.addEventListener('change', () => {
      syncTempoUi(rampState.currentSpeed);
    }, { signal });

    // Digitar a % aplica imediatamente o novo andamento
    percentInput.addEventListener('input', () => {
      const pctVal = parseFloat(percentInput.value);
      if (!Number.isFinite(pctVal) || pctVal <= 0) return;
      setSpeed(pctVal / 100, { skipPercentInput: true });
    }, { signal });

    percentInput.addEventListener('change', () => {
      syncTempoUi(rampState.currentSpeed);
    }, { signal });

    btnResetTempo.addEventListener('click', () => {
      if (rampState.enabled) {
        setRampEnabled(false);
      }
      setSpeed(1);
    }, { signal });

    // Botões de modo de Loop
    btnLoopOff.addEventListener('click', () => setLoopMode('off'), { signal });
    btnLoopAll.addEventListener('click', () => setLoopMode('all'), { signal });
    btnLoopAB.addEventListener('click', () => setLoopMode('ab'), { signal });

    loopStartInput.addEventListener('input', () => {
      if (loopMode !== 'ab') {
        loopMode = 'ab';
        updateLoopButtonsUi();
      }
      applyLoopFromInputs();
    }, { signal });

    loopEndInput.addEventListener('input', () => {
      if (loopMode !== 'ab') {
        loopMode = 'ab';
        updateLoopButtonsUi();
      }
      applyLoopFromInputs();
    }, { signal });

    btnClearLoop.addEventListener('click', () => {
      loopStartInput.value = '';
      loopEndInput.value = '';
      setLoopMode('all');
    }, { signal });

    // Controles de BPM Ramping
    btnRampToggle.addEventListener('click', () => {
      setRampEnabled(!rampState.enabled);
    }, { signal });

    rampStartElem.addEventListener('input', () => {
      if (rampState.enabled && !isPlayerPlaying && rampState.loopCount === 0) {
        resetRamp();
      }
    }, { signal });

    rampTargetElem.addEventListener('input', () => {
      rampState.ceiling = resolveCeiling();
      if (rampState.enabled && rampState.currentSpeed > rampState.ceiling) {
        setSpeed(rampState.ceiling);
      }
    }, { signal });
  }

  /** Destrói a instância do alphaTab sem mexer na visibilidade da área. */
  function resetAlphaTab() {
    // Abortar todos os event listeners registrados via signal
    if (alphaTabAbort) {
      alphaTabAbort.abort();
      alphaTabAbort = null;
    }
    if (alphaTabApi) {
      alphaTabApi.destroy();
      alphaTabApi = null;
    }
    document.getElementById('alphaTabContainer').innerHTML = '';
  }

  function destroyAlphaTab() {
    resetAlphaTab();
    const area = document.getElementById('alphaTabArea');
    area.classList.add('hidden');
    area.classList.remove('concealed');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. Player de Áudio (Técnica e Repertório): transposição, loop A-B e andamento
  //
  // Como os controles ficam independentes:
  //  · TRANSPOÇÃO — renderizada offline com WSOLA e entregue ao <audio> como WAV
  //    em memória. O tom muda e a duração continua a mesma, porque o WSOLA
  //    recompõe as amostras em vez de só reamostrar (reamostrar sozinho
  //    esticaria também o tempo, que é justamente o que não queremos aqui).
  //  · ANDAMENTO — usa `preservesPitch` do próprio Chromium, que estica o tempo
  //    por baixo dos panos sem alterar o tom. Por isso arrastar o slider de
  //    andamento não desfaz a transposição.
  //  · LOOP A-B — aplicado sobre `currentTime`, então o ponto de retorno é
  //    sempre o mesmo irrespective do andamento.
  // ─────────────────────────────────────────────────────────────────────────────

  const audioEl = document.getElementById('audioEl');
  const audioWave = document.getElementById('audioWave');
  const audioWaveWrap = document.getElementById('audioWaveWrap');
  const audioLoadInfo = document.getElementById('audioLoadInfo');
  const audioTimeLabel = document.getElementById('audioTime');
  const audioTranspose = document.getElementById('audioTranspose');
  const audioTransposeInfo = document.getElementById('audioTransposeInfo');
  const audioTempo = document.getElementById('audioTempo');
  const audioTempoInfo = document.getElementById('audioTempoInfo');
  const audioOriginalBpm = document.getElementById('audioOriginalBpm');
  const audioVolume = document.getElementById('audioVolume');
  const audioLoopInfo = document.getElementById('audioLoopInfo');
  const btnAudioPlayPause = document.getElementById('btnAudioPlayPause');
  const btnAudioStop = document.getElementById('btnAudioStop');
  const btnAudioLoop = document.getElementById('btnAudioLoop');
  const btnAudioClearLoop = document.getElementById('btnAudioClearLoop');
  const btnToggleMedia = document.getElementById('btnToggleMedia');

  const AUDIO_MIN_REGION = 0.08;   // trecho mais curto que vale marcar (s)
  const TRANSPOSE_DEBOUNCE = 350;  // ms de espera antes de reprocessar o tom

  const audioState = {
    blockId: null,
    buffer: null,       // AudioBuffer decodificado do arquivo original
    duration: 0,
    peaks: null,        // pico absoluto por coluna, para desenhar a forma de onda
    peakColumns: 900,
    loopStart: null,
    loopEnd: null,
    loopEnabled: false,
    transpose: 0,       // semitons realmente aplicados ao áudio em reprodução
    tempo: 100,         // %
    volume: 100,        // %
    originalBpm: null,
    renderToken: 0,     // invalida transposições assíncronas que ficaram obsoletas
    objectUrl: null,
    rafId: null,
    ctx: null,
    ready: false
  };

  function fmtClock(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function getDecodeContext() {
    if (!audioState.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioState.ctx = new Ctx();
    }
    return audioState.ctx;
  }

  /** O IPC devolve um Uint8Array; `decodeAudioData` exige um ArrayBuffer limpo. */
  function toArrayBuffer(data) {
    if (data instanceof ArrayBuffer) return data;
    const view = data instanceof Uint8Array ? data : new Uint8Array(data);
    return view.byteOffset === 0 && view.byteLength === view.buffer.byteLength
      ? view.buffer
      : view.slice().buffer;
  }

  // ── Forma de onda ──────────────────────────────────────────────────────────

  /** Reduz o áudio a `columns` picos (máximo absoluto por bucket). */
  function computePeaks(buffer, columns) {
    const peaks = new Float32Array(columns);
    const frames = buffer.length;
    const channels = Math.min(2, buffer.numberOfChannels);
    const data = [];
    for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));

    const step = frames / columns;
    for (let i = 0; i < columns; i++) {
      const from = Math.floor(i * step);
      const to = Math.min(frames, Math.floor((i + 1) * step));
      // Sampling interno limitado: um compasso longo não pode travar a interface.
      const inner = Math.max(1, Math.ceil((to - from) / 256));
      let peak = 0;
      for (let j = from; j < to; j += inner) {
        for (let c = 0; c < channels; c++) {
          const v = data[c][j] < 0 ? -data[c][j] : data[c][j];
          if (v > peak) peak = v;
        }
      }
      peaks[i] = peak;
    }
    return peaks;
  }

  function drawWave() {
    const rect = audioWave.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    audioWave.width = Math.round(rect.width * dpr);
    audioWave.height = Math.round(rect.height * dpr);

    const ctx = audioWave.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const mid = h / 2;
    ctx.clearRect(0, 0, w, h);

    const css = getComputedStyle(document.documentElement);
    const waveColor = css.getPropertyValue('--border').trim() || '#4a4a6a';
    const accent = css.getPropertyValue('--accent').trim() || '#e94560';

    const st = audioState;
    if (!st.peaks) return;
    const dur = st.duration || 1;

    if (st.loopStart !== null && st.loopEnd !== null && st.loopEnd > st.loopStart) {
      const x0 = (st.loopStart / dur) * w;
      const x1 = (st.loopEnd / dur) * w;
      ctx.fillStyle = accent;
      ctx.globalAlpha = st.loopEnabled ? 0.22 : 0.10;
      ctx.fillRect(x0, 0, x1 - x0, h);
      ctx.globalAlpha = 1;
      ctx.fillRect(x0, 0, 1.5, h);
      ctx.fillRect(x1 - 1.5, 0, 1.5, h);
    }

    ctx.fillStyle = waveColor;
    const bars = st.peaks.length;
    const barW = Math.max(1, w / bars);
    for (let i = 0; i < bars; i++) {
      const amp = st.peaks[i] * (mid - 2);
      if (amp <= 0) continue;
      ctx.fillRect(i * barW, mid - amp, Math.max(1, barW - 0.4), amp * 2);
    }

    const t = audioEl.currentTime;
    if (t > 0 && t <= dur) {
      ctx.fillStyle = accent;
      ctx.fillRect((t / dur) * w, 0, 2, h);
    }
  }

  function timeAtX(clientX) {
    const rect = audioWave.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * (audioState.duration || 0);
  }

  // ── Marcação do loop A-B ───────────────────────────────────────────────────

  function hasLoopRegion() {
    const st = audioState;
    return st.loopStart !== null && st.loopEnd !== null
      && st.loopEnd - st.loopStart >= AUDIO_MIN_REGION;
  }

  function setLoopEnabled(enabled) {
    audioState.loopEnabled = enabled && hasLoopRegion();
    btnAudioLoop.classList.toggle('on', audioState.loopEnabled);
    btnAudioLoop.textContent = audioState.loopEnabled ? '🔁 Loop A-B' : '🔇 Loop A-B';
    updateLoopUi();
    saveAudioPrefs();
  }

  function updateLoopUi() {
    const st = audioState;
    const info = audioLoopInfo;
    if (st.loopStart === null) {
      info.textContent = 'Arraste na forma de onda para marcar o trecho';
      info.classList.remove('error');
      return;
    }
    if (st.loopEnd === null) {
      info.textContent = `A ${fmtClock(st.loopStart)} — marque o ponto B`;
      info.classList.remove('error');
      return;
    }
    if (st.loopEnd - st.loopStart < AUDIO_MIN_REGION) {
      info.textContent = 'Trecho curto demais — arraste para marcá-lo';
      info.classList.add('error');
      return;
    }
    info.textContent = `A ${fmtClock(st.loopStart)} → B ${fmtClock(st.loopEnd)} · ${(st.loopEnd - st.loopStart).toFixed(1)}s`;
    info.classList.remove('error');
  }

  // Arrastar sempre (re)define o trecho; clicar simples segue o fluxo
  // "1º clique = início, 2º clique = fim" e, com o loop já marcado, só posiciona.
  let waveDrag = null;

  audioWave.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !audioState.ready) return;
    waveDrag = { pointerId: e.pointerId, x0: e.clientX, t0: timeAtX(e.clientX), moved: false };
    try { audioWave.setPointerCapture(e.pointerId); } catch { /* ponteiro já inativo */ }
  });

  audioWave.addEventListener('pointermove', (e) => {
    if (!waveDrag || e.pointerId !== waveDrag.pointerId) return;
    if (!waveDrag.moved) {
      // Só depois de passar da janela de tolerância o arrasto conta de fato;
      // a partir daí é preciso acompanhar o cursor até o fim.
      if (Math.abs(e.clientX - waveDrag.x0) < 3) return;
      waveDrag.moved = true;
    }
    const t = timeAtX(e.clientX);
    audioState.loopStart = Math.min(waveDrag.t0, t);
    audioState.loopEnd = Math.max(waveDrag.t0, t);
    updateLoopUi();
    drawWave();
  });

  function endWaveDrag(e) {
    if (!waveDrag || e.pointerId !== waveDrag.pointerId) return;
    const drag = waveDrag;
    waveDrag = null;
    try { audioWave.releasePointerCapture(e.pointerId); } catch { /* ponteiro já inativo */ }

    if (!drag.moved) {
      const t = drag.t0;
      if (audioState.loopStart === null) {
        audioState.loopStart = t;
        audioState.loopEnd = null;
      } else if (audioState.loopEnd === null) {
        if (t > audioState.loopStart + AUDIO_MIN_REGION) {
          audioState.loopEnd = t;
          setLoopEnabled(true);
          audioEl.currentTime = audioState.loopStart;
        } else {
          audioState.loopStart = t;
        }
      } else {
        audioEl.currentTime = t;
      }
    } else if (audioState.loopEnd - audioState.loopStart < AUDIO_MIN_REGION) {
      // Arrasto curto demais: mantém só o ponto A e espera o ponto B.
      audioState.loopEnd = null;
    } else {
      setLoopEnabled(true);
      audioEl.currentTime = audioState.loopStart;
    }

    updateLoopUi();
    drawWave();
  }

  audioWave.addEventListener('pointerup', endWaveDrag);
  audioWave.addEventListener('pointercancel', endWaveDrag);

  btnAudioLoop.addEventListener('click', () => {
    setLoopEnabled(!audioState.loopEnabled);
    if (audioState.loopEnabled) audioEl.currentTime = audioState.loopStart;
    drawWave();
  });

  btnAudioClearLoop.addEventListener('click', () => {
    audioState.loopStart = null;
    audioState.loopEnd = null;
    setLoopEnabled(false);
    updateLoopUi();
    drawWave();
  });

  // ── Reprodução ─────────────────────────────────────────────────────────────

  function startAudioTicker() {
    if (audioState.rafId !== null) return;
    const tick = () => {
      audioState.rafId = requestAnimationFrame(tick);
      if (audioState.loopEnabled && hasLoopRegion() && audioEl.currentTime >= audioState.loopEnd) {
        audioEl.currentTime = audioState.loopStart;
      }
      if (!audioEl.paused) {
        audioTimeLabel.textContent = `${fmtClock(audioEl.currentTime)} / ${fmtClock(audioState.duration)}`;
        drawWave();
      }
    };
    audioState.rafId = requestAnimationFrame(tick);
  }

  function stopAudioTicker() {
    if (audioState.rafId !== null) {
      cancelAnimationFrame(audioState.rafId);
      audioState.rafId = null;
    }
  }

  function updatePlayUi() {
    const playing = !audioEl.paused && !audioEl.ended;
    btnAudioPlayPause.textContent = playing ? '⏸ Pause' : '▶ Play';
    if (playing) startAudioTicker();
  }

  btnAudioPlayPause.addEventListener('click', () => {
    if (!audioState.ready) return;
    if (audioEl.paused) {
      audioEl.play().catch(() => { /* bloqueado pelo autoplay: só ao clicar mesmo */ });
    } else {
      audioEl.pause();
    }
    updatePlayUi();
  });

  btnAudioStop.addEventListener('click', () => {
    audioEl.pause();
    audioEl.currentTime = audioState.loopEnabled && hasLoopRegion() ? audioState.loopStart : 0;
    updatePlayUi();
    drawWave();
  });

  audioEl.addEventListener('play', updatePlayUi);
  audioEl.addEventListener('pause', updatePlayUi);
  audioEl.addEventListener('ended', () => {
    updatePlayUi();
    drawWave();
  });

  audioEl.addEventListener('error', () => {
    // `removeAttribute('src')` também dispara erro; só interessa com fonte definida.
    if (!audioEl.getAttribute('src')) return;
    audioLoadInfo.textContent = 'Não foi possível reproduzir este áudio';
    audioLoadInfo.classList.remove('hidden');
    audioLoadInfo.classList.add('error');
  });

  // ── Andamento e volume ─────────────────────────────────────────────────────

  function applyTempo() {
    // preservesPitch: o Chromium estica o tempo sem mexer no tom.
    audioEl.preservesPitch = true;
    audioEl.playbackRate = audioState.tempo / 100;
    updateTempoInfo();
  }

  function updateTempoInfo() {
    const pct = audioState.tempo;
    audioTempoInfo.textContent = audioState.originalBpm
      ? `${pct}% · ${Math.round(audioState.originalBpm * pct / 100)} BPM`
      : `${pct}%`;
  }

  audioTempo.addEventListener('input', () => {
    audioState.tempo = parseInt(audioTempo.value, 10);
    applyTempo();
  });
  audioTempo.addEventListener('change', saveAudioPrefs);

  audioVolume.addEventListener('input', () => {
    audioState.volume = parseInt(audioVolume.value, 10);
    audioEl.volume = audioState.volume / 100;
  });
  audioVolume.addEventListener('change', saveAudioPrefs);

  audioOriginalBpm.addEventListener('input', () => {
    const v = parseInt(audioOriginalBpm.value, 10);
    audioState.originalBpm = Number.isFinite(v) && v > 0 ? v : null;
    updateTempoInfo();
  });
  audioOriginalBpm.addEventListener('change', saveAudioPrefs);

  // ── Transposição (WSOLA) ───────────────────────────────────────────────────

  function updateTransposeInfo(semitones) {
    const n = semitones === undefined ? audioState.transpose : semitones;
    audioTransposeInfo.textContent = `${n > 0 ? '+' : ''}${n} semitons`;
  }

  /** Reamostragem linear: lê o sinal `ratio` vezes mais rápido (ratio > 1 = mais agudo). */
  function resampleLinear(input, ratio) {
    return window.GuitarStudyDsp.resampleLinear(input, ratio);
  }

  /**
   * Transpõe preservando a duração via WSOLA. O algoritmo mora em
   * lib/audio-dsp.js porque é a parte mais delicada do player e precisa ser
   * verificável sem passar pela interface.
   */
  function pitchShiftBuffer(buffer, ratio) {
    return window.GuitarStudyDsp.pitchShiftBuffer(buffer, ratio);
  }

  /** Serializa um AudioBuffer como WAV PCM 16 bits para tocar num <audio>. */
  function encodeWav(audioBuffer) {
    const channels = Math.min(2, audioBuffer.numberOfChannels);
    const frames = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const dataSize = frames * channels * 2;
    const view = new DataView(new ArrayBuffer(44 + dataSize));

    const tag = (offset, text) => {
      for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
    };

    tag(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    tag(8, 'WAVE');
    tag(12, 'fmt ');
    view.setUint32(16, 16, true);            // tamanho do bloco fmt
    view.setUint16(20, 1, true);             // PCM
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);  // bytes por quadro
    view.setUint16(34, 16, true);            // bits por amostra
    tag(36, 'data');
    view.setUint32(40, dataSize, true);

    const data = [];
    for (let c = 0; c < channels; c++) data.push(audioBuffer.getChannelData(c));

    let offset = 44;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        const sample = data[c][i];
        const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
        view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([view.buffer], { type: 'audio/wav' });
  }

  /** Aponta o <audio> para um buffer preservando posição e estado de reprodução. */
  function setSourceFromBuffer(buffer) {
    const wasPlaying = !audioEl.paused && !audioEl.ended;
    const resumeAt = audioEl.currentTime;

    if (audioState.objectUrl) URL.revokeObjectURL(audioState.objectUrl);
    audioState.objectUrl = URL.createObjectURL(encodeWav(buffer));
    audioEl.src = audioState.objectUrl;

    const onReady = () => {
      audioEl.removeEventListener('loadedmetadata', onReady);
      if (audioState.duration) audioState.duration = audioEl.duration || audioState.duration;
      if (isFinite(resumeAt) && resumeAt > 0) {
        audioEl.currentTime = Math.min(resumeAt, Math.max(0, audioEl.duration - 0.05));
      }
      applyTempo();
      audioEl.volume = audioState.volume / 100;
      audioLoadInfo.classList.add('hidden');
      audioLoadInfo.classList.remove('error');
      audioTimeLabel.textContent = `${fmtClock(audioEl.currentTime)} / ${fmtClock(audioState.duration)}`;
      if (wasPlaying) audioEl.play().catch(() => {});
      updatePlayUi();
      drawWave();
    };
    audioEl.addEventListener('loadedmetadata', onReady);
  }

  async function applyTranspose(semitones, { force = false } = {}) {
    const st = audioState;
    updateTransposeInfo(semitones);

    if (!st.buffer) return;

    const atOriginal = semitones === 0 && st.transpose === 0 && audioEl.getAttribute('src');
    if (atOriginal && !force) return;   // já está tocando o tom original

    const token = ++st.renderToken;

    if (semitones === 0) {
      // Voltar a 0 precisa reapontar para o arquivo original, senão o áudio
      // processado continuaria tocando.
      st.transpose = 0;
      setSourceFromBuffer(st.buffer);
      saveAudioPrefs();
      return;
    }

    audioLoadInfo.textContent = 'Processando transposição…';
    audioLoadInfo.classList.remove('hidden', 'error');
    // Cede o event loop para o aviso aparecer antes do trabalho pesado.
    await new Promise((resolve) => setTimeout(resolve, 30));
    if (token !== st.renderToken) return;

    try {
      const shifted = pitchShiftBuffer(st.buffer, Math.pow(2, semitones / 12));
      if (token !== st.renderToken) return;
      st.transpose = semitones;
      setSourceFromBuffer(shifted);
      saveAudioPrefs();
    } catch {
      if (token === st.renderToken) {
        audioLoadInfo.textContent = 'Falha ao processar a transposição';
        audioLoadInfo.classList.add('error');
      }
    }
  }

  let transposeTimer = null;

  audioTranspose.addEventListener('input', () => {
    updateTransposeInfo(parseInt(audioTranspose.value, 10));
    clearTimeout(transposeTimer);
    transposeTimer = setTimeout(() => applyTranspose(parseInt(audioTranspose.value, 10)), TRANSPOSE_DEBOUNCE);
  });

  audioTranspose.addEventListener('change', () => {
    clearTimeout(transposeTimer);
    applyTranspose(parseInt(audioTranspose.value, 10));
  });

  // ── Preferências por bloco ─────────────────────────────────────────────────

  const audioPrefsKey = (blockId) => `guitar-study-router:audio-state:${blockId}`;

  function loadAudioPrefs(blockId) {
    const defaults = {
      loopStart: null, loopEnd: null, loopEnabled: false,
      transpose: 0, tempo: 100, volume: 100, originalBpm: null
    };
    if (!blockId) return defaults;
    try {
      const raw = JSON.parse(localStorage.getItem(audioPrefsKey(blockId)) || 'null');
      return raw ? { ...defaults, ...raw } : defaults;
    } catch {
      return defaults;
    }
  }

  function saveAudioPrefs() {
    const st = audioState;
    if (!st.blockId) return;
    try {
      localStorage.setItem(audioPrefsKey(st.blockId), JSON.stringify({
        loopStart: st.loopStart,
        loopEnd: st.loopEnd,
        loopEnabled: st.loopEnabled,
        transpose: st.transpose,
        tempo: st.tempo,
        volume: st.volume,
        originalBpm: st.originalBpm
      }));
    } catch {
      // Sem persistência: vale apenas para a sessão atual.
    }
  }

  // ── Ciclo de vida ──────────────────────────────────────────────────────────

  async function initAudio(block) {
    // Só o estado: `beginBlock` já chamou `destroyAudio()` no início do bloco.
    // Esconder o painel aqui desfaria a visão que `showMediaView` acabou de definir.
    resetAudioState();

    const prefs = loadAudioPrefs(block.id);
    Object.assign(audioState, {
      blockId: block.id,
      loopStart: prefs.loopStart,
      loopEnd: prefs.loopEnd,
      loopEnabled: false,
      transpose: 0,
      tempo: prefs.tempo,
      volume: prefs.volume,
      originalBpm: prefs.originalBpm,
      ready: false
    });

    audioTranspose.value = String(prefs.transpose);
    audioTempo.value = String(prefs.tempo);
    audioVolume.value = String(prefs.volume);
    audioOriginalBpm.value = prefs.originalBpm ? String(prefs.originalBpm) : '';
    audioTimeLabel.textContent = '0:00 / 0:00';
    audioLoadInfo.textContent = 'Carregando áudio…';
    audioLoadInfo.classList.remove('hidden', 'error');
    updateLoopUi();
    updateTempoInfo();
    updateTransposeInfo(0);
    drawWave();

    const fileData = await window.electronAPI.readBinary(block.audioFile);
    if (audioState.blockId !== block.id) return;
    if (!fileData) {
      // Arquivo movido ou apagado: melhor avisar do que ficar carregando para sempre.
      audioLoadInfo.textContent = 'Arquivo de áudio não encontrado';
      audioLoadInfo.classList.add('error');
      return;
    }

    let buffer;
    try {
      buffer = await getDecodeContext().decodeAudioData(toArrayBuffer(fileData));
    } catch {
      if (audioState.blockId === block.id) {
        audioLoadInfo.textContent = 'Não foi possível ler este arquivo de áudio';
        audioLoadInfo.classList.add('error');
      }
      return;
    }
    if (audioState.blockId !== block.id) return;

    audioState.buffer = buffer;
    audioState.duration = buffer.duration;
    audioState.peaks = computePeaks(buffer, audioState.peakColumns);
    audioState.ready = true;

    // O loop salvo só vale se ainda couber na duração deste arquivo.
    if (audioState.loopStart !== null && (
      audioState.loopStart >= buffer.duration ||
      audioState.loopEnd === null ||
      audioState.loopEnd - audioState.loopStart < AUDIO_MIN_REGION
    )) {
      audioState.loopStart = null;
      audioState.loopEnd = null;
    }

    setLoopEnabled(prefs.loopEnabled && hasLoopRegion());
    audioTimeLabel.textContent = `0:00 / ${fmtClock(buffer.duration)}`;
    drawWave();

    await applyTranspose(prefs.transpose || 0, { force: true });
  }

  /** Zera o player de áudio sem mexer na visibilidade do painel. */
  function resetAudioState() {
    stopAudioTicker();
    audioState.renderToken++;
    clearTimeout(transposeTimer);

    try { audioEl.pause(); } catch { /* já parado */ }
    audioEl.removeAttribute('src');
    audioEl.load();

    if (audioState.objectUrl) {
      URL.revokeObjectURL(audioState.objectUrl);
      audioState.objectUrl = null;
    }

    Object.assign(audioState, {
      blockId: null, buffer: null, duration: 0, peaks: null, peakColumns: 900,
      loopStart: null, loopEnd: null, loopEnabled: false, transpose: 0,
      tempo: 100, volume: 100, originalBpm: null, ready: false
    });
  }

  function destroyAudio() {
    resetAudioState();
    document.getElementById('audioArea').classList.add('hidden');
    btnAudioPlayPause.textContent = '▶ Play';
    btnToggleMedia.classList.add('hidden');
    audioTimeLabel.textContent = '0:00 / 0:00';
    audioLoadInfo.classList.add('hidden');
    updateLoopUi();
  }

  // ── Alternância entre tablatura e áudio ────────────────────────────────────

  function showMediaView(view) {
    const showAudio = view === 'audio';
    const alphaTabArea = document.getElementById('alphaTabArea');

    document.getElementById('audioArea').classList.toggle('hidden', !showAudio);
    if (blocoTemTab) {
      // Nunca `display: none` aqui. O alphaTab lê a largura do container uma única
      // vez, quando a partitura termina de carregar; escondê-lo nesse instante faz
      // a renderização pular (`width=0`) e a tab fica branca para sempre. Tirar a
      // área do fluxo preserva a medida e não ocupa espaço na tela.
      alphaTabArea.classList.remove('hidden');
      alphaTabArea.classList.toggle('concealed', showAudio);
    } else {
      alphaTabArea.classList.add('hidden');
      alphaTabArea.classList.remove('concealed');
    }

    btnToggleMedia.textContent = showAudio ? 'Ver tablatura' : 'Ver áudio';
    // Só uma fonte de som toca por vez.
    if (showAudio) {
      if (alphaTabApi) alphaTabApi.pause();
    } else {
      audioEl.pause();
      updatePlayUi();
    }
  }

  btnToggleMedia.addEventListener('click', () => {
    showMediaView(document.getElementById('audioArea').classList.contains('hidden') ? 'audio' : 'tab');
  });

  // Mantém a forma de onda coerente com o tamanho da janela e com o tema.
  if (window.ResizeObserver) new ResizeObserver(() => drawWave()).observe(audioWaveWrap);
  window.addEventListener('resize', drawWave);
  new MutationObserver(() => drawWave()).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme']
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. Analytics — métricas do usuário
  //     "Onde estou" e "Evolução técnica" são derivados do que o app já guarda
  //     (blocos + block.metrics preenchidas no fechamento do treino). "Onde quero
  //     chegar" são metas do usuário, guardadas à parte do cronograma.
  // ─────────────────────────────────────────────────────────────────────────────
  const analyticsView = document.getElementById('analyticsView');
  const GOALS_KEY = 'guitar-study-router:goals';

  /** Metas: { id, texto, prazo: 'curto'|'longo', feito, criado }. */
  let goals = [];
  try {
    const salvo = JSON.parse(localStorage.getItem(GOALS_KEY) || '[]');
    if (Array.isArray(salvo)) goals = salvo;
  } catch {
    goals = []; // Sem persistência: as metas valem para a sessão atual.
  }

  function saveGoals() {
    try {
      localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    } catch {
      // idem: sem persistência o app segue funcionando
    }
  }

  /** Escapa texto do usuário antes de entrar em innerHTML. */
  function escaparHtml(texto) {
    return String(texto).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  /** Achata as métricas de todos os dias em sessões de treino ordenadas por data. */
  function coletarSessoes() {
    const sessoes = [];
    for (const dia of Object.keys(dayNameMapping)) {
      for (const b of (schedule[dia] || [])) {
        for (const m of (b.metrics || [])) {
          sessoes.push({
            data: m.date || '',
            bpm: Number(m.bpm) || 0,
            topic: b.topic,
            subtopic: (b.subtopic || '').trim(),
            minutos: Number(b.duration) || 0,
            blockId: b.id
          });
        }
      }
    }
    return sessoes.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  }

  /** Nível estimado pelo melhor BPM já registrado. */
  function nivelPorBpm(bpmMax) {
    if (!bpmMax) return { nome: '—', classe: '' };
    if (bpmMax >= 160) return { nome: 'Avançado', classe: 'nivel-avancado' };
    if (bpmMax >= 100) return { nome: 'Intermediário', classe: 'nivel-intermediario' };
    return { nome: 'Iniciante', classe: 'nivel-iniciante' };
  }

  /** Barras de BPM máximo por dia (até 12 dias). Altura em px para caber no card. */
  function montarChart(pontos) {
    const maxBpm = Math.max(...pontos.map((p) => p[1]));
    return pontos.map(([data, bpm]) => {
      const altura = Math.max(3, Math.round((bpm / maxBpm) * 90));
      return `<div class="an-barra-col" title="${escaparHtml(data)}: ${bpm} BPM">
        <span class="an-barra-valor">${bpm}</span>
        <div class="an-barra-v" style="height: ${altura}px"></div>
        <span class="an-barra-data">${escaparHtml(data.slice(5))}</span>
      </div>`;
    }).join('');
  }

  function renderGoals() {
    const titulos = { curto: 'Curto prazo', longo: 'Longo prazo' };
    for (const prazo of ['curto', 'longo']) {
      const alvo = document.getElementById(prazo === 'curto' ? 'anGoalsCurto' : 'anGoalsLongo');
      const daVez = goals.filter((g) => g.prazo === prazo);
      const itens = daVez.length
        ? daVez.map((g) => `<div class="an-goal${g.feito ? ' feito' : ''}" data-id="${escaparHtml(g.id)}">
            <input type="checkbox" data-acao="toggle"${g.feito ? ' checked' : ''} title="Marcar como concluída">
            <span>${escaparHtml(g.texto)}</span>
            <button data-acao="remover" title="Remover meta">🗑️</button>
          </div>`).join('')
        : '<span class="an-vazio">Nenhuma meta definida.</span>';
      alvo.innerHTML = `<div class="an-goal-grupo"><h4>${titulos[prazo]}</h4><div class="an-goals">${itens}</div></div>`;
    }
  }

  function renderAnalytics() {
    const sessoes = coletarSessoes();
    const comBpm = sessoes.filter((s) => s.bpm > 0);

    // ── Onde estou ──────────────────────────────────────────────────────────
    const horas = sessoes.reduce((t, s) => t + s.minutos, 0) / 60;
    const bpmMax = comBpm.length ? Math.max(...comBpm.map((s) => s.bpm)) : 0;
    const bpmMedio = comBpm.length
      ? Math.round(comBpm.reduce((t, s) => t + s.bpm, 0) / comBpm.length) : 0;
    const metasFeitas = goals.filter((g) => g.feito).length;

    const nivel = nivelPorBpm(bpmMax);
    const elNivel = document.getElementById('anNivel');
    elNivel.textContent = nivel.nome;
    elNivel.className = nivel.classe;

    document.getElementById('anHoras').textContent = horas.toFixed(1).replace('.', ',');
    document.getElementById('anSessoes').textContent = String(sessoes.length);
    document.getElementById('anBpmMax').textContent = bpmMax ? String(bpmMax) : '—';
    document.getElementById('anBpmMedio').textContent = bpmMedio ? String(bpmMedio) : '—';
    document.getElementById('anMetasOk').textContent = `${metasFeitas}/${goals.length}`;

    const recentes = sessoes.slice().reverse().slice(0, 8);
    document.getElementById('anHistorico').innerHTML = recentes.length
      ? recentes.map((s) => `<div class="an-item">
            <span>${escaparHtml(s.data)} · ${escaparHtml(s.subtopic || s.topic)}</span>
            <b>${s.bpm ? s.bpm + ' BPM' : '—'}</b>
          </div>`).join('')
      : '<span class="an-vazio">Nenhuma sessão registrada ainda.</span>';

    // ── Onde quero chegar ───────────────────────────────────────────────────
    renderGoals();

    // ── Evolução técnica ────────────────────────────────────────────────────
    const pctMetas = goals.length ? Math.round((metasFeitas / goals.length) * 100) : 0;
    document.getElementById('anPctMetas').textContent = `${pctMetas}%`;
    document.getElementById('anBarraMetas').style.width = `${pctMetas}%`;

    // Evolução = primeiro BPM registrado → melhor BPM. Sem dois pontos não há curva.
    const primeiroBpm = comBpm.length ? comBpm[0].bpm : 0;
    const pctEvolucao = primeiroBpm > 0 && comBpm.length > 1
      ? Math.round(((bpmMax - primeiroBpm) / primeiroBpm) * 100) : null;
    document.getElementById('anPctEvolucao').textContent = pctEvolucao === null
      ? '—' : `${pctEvolucao >= 0 ? '+' : ''}${pctEvolucao}%`;
    document.getElementById('anBarraEvolucao').style.width =
      `${pctEvolucao === null ? 0 : Math.max(0, Math.min(100, pctEvolucao))}%`;

    // Habilidade validada = bloco que já recebeu ao menos um registro de treino.
    const totalBlocos = Object.keys(dayNameMapping)
      .reduce((t, d) => t + (schedule[d] || []).length, 0);
    const validadas = new Set(sessoes.map((s) => s.blockId)).size;
    document.getElementById('anHabilidades').textContent = `${validadas}/${totalBlocos}`;
    document.getElementById('anBarraHabilidades').style.width =
      `${totalBlocos ? Math.round((validadas / totalBlocos) * 100) : 0}%`;

    const porData = new Map();
    for (const s of comBpm) porData.set(s.data, Math.max(porData.get(s.data) || 0, s.bpm));
    const pontos = [...porData.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-12);
    document.getElementById('anChart').innerHTML = montarChart(pontos);
    document.getElementById('anChartVazio').classList.toggle('hidden', pontos.length > 0);
  }

  document.getElementById('btnAnalytics').addEventListener('click', () => {
    renderAnalytics();
    analyticsView.classList.remove('hidden');
  });

  document.getElementById('btnAnalyticsBack').addEventListener('click', () => {
    analyticsView.classList.add('hidden');
  });

  document.getElementById('btnAddGoal').addEventListener('click', () => {
    const campo = document.getElementById('anGoalText');
    const texto = campo.value.trim();
    if (!texto) return;
    goals.push({
      id: crypto.randomUUID(),
      texto,
      prazo: document.getElementById('anGoalPrazo').value === 'longo' ? 'longo' : 'curto',
      feito: false,
      criado: new Date().toISOString().slice(0, 10)
    });
    campo.value = '';
    saveGoals();
    renderAnalytics();
  });

  document.getElementById('anGoalText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('btnAddGoal').click();
    }
  });

  /** Concluir/remover metas, delegado nos dois grupos. */
  function onGoalClick(e) {
    const linha = e.target.closest('.an-goal');
    if (!linha) return;
    const meta = goals.find((g) => g.id === linha.dataset.id);
    if (!meta) return;

    if (e.target.dataset.acao === 'toggle') meta.feito = e.target.checked;
    else if (e.target.dataset.acao === 'remover') goals = goals.filter((g) => g.id !== meta.id);
    else return;

    saveGoals();
    renderAnalytics();
  }

  document.getElementById('anGoalsCurto').addEventListener('click', onGoalClick);
  document.getElementById('anGoalsLongo').addEventListener('click', onGoalClick);

});
