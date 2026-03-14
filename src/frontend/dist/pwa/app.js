/* MindNotes — iOS Notes Mentalism PWA */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/pwa/service-worker.js').catch(() => {});
}

const noteEditor       = document.getElementById('note-editor');
const noteDate         = document.getElementById('note-date');
const btnMore          = document.getElementById('btn-more');
const wordOverlay      = document.getElementById('word-overlay');
const wordList         = document.getElementById('word-list');
const wordDrawPreview  = document.getElementById('word-draw-preview');
const wordDrawImg      = document.getElementById('word-draw-img');
const settingsPanel    = document.getElementById('settings-panel');
const settingsBody     = document.getElementById('settings-body');
const settingsClose    = document.getElementById('settings-close');
const btnCompose       = document.getElementById('btn-compose');
const btnMarkup        = document.getElementById('btn-markup');
const noteDrawingArea  = document.getElementById('note-drawing-area');
const noteDrawingImg   = document.getElementById('note-drawing-img');
const noteDrawingEdit  = document.getElementById('note-drawing-edit');
const noteDrawingDel   = document.getElementById('note-drawing-delete');

let data = { categories: [], activeCategory: null };
let selectionMode = false;
let selectedIndex = 0;
let autoSelectTimer = null;

function saveData() { localStorage.setItem('mindnotes', JSON.stringify(data)); }

function loadData() {
  const raw = localStorage.getItem('mindnotes');
  if (raw) { try { data = JSON.parse(raw); } catch(e) {} }
  if (!data.categories || data.categories.length === 0) {
    data.categories = [
      { id: uid(), name: 'Animals',   words: ['Tiger','Elephant','Lion','Horse','Dog','Cat'] },
      { id: uid(), name: 'Countries', words: ['France','Japan','Brazil','Australia','Canada','Egypt'] },
      { id: uid(), name: 'Colors',    words: ['Red','Blue','Green','Purple','Orange','Yellow'] },
      { id: uid(), name: 'Names',     words: ['Alice','Bob','Charlie','Diana','Edward','Fiona'] }
    ];
    data.activeCategory = data.categories[0].id;
    saveData();
  }
  if (!data.activeCategory && data.categories.length > 0) data.activeCategory = data.categories[0].id;
  // Migrate string words to objects
  data.categories.forEach(cat => {
    cat.words = cat.words.map(w => typeof w === 'string' ? { text: w, drawing: null } : w);
  });
}

function uid() { return Math.random().toString(36).slice(2); }
function getWordText(w) { return typeof w === 'string' ? w : (w.text || ''); }
function getWordDrawing(w) { return (w && typeof w === 'object') ? (w.drawing || null) : null; }

function updateDate() {
  const now = new Date();
  const datePart = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const timePart = now.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  noteDate.textContent = `${datePart} at ${timePart}`;
}
setInterval(updateDate, 10000);
updateDate();

function loadNote() {
  const saved = localStorage.getItem('mindnotes-note');
  if (saved !== null) noteEditor.textContent = saved;
}
noteEditor.addEventListener('input', () => { localStorage.setItem('mindnotes-note', noteEditor.textContent); });

function loadNoteDrawing() {
  const drawing = localStorage.getItem('mindnotes-note-drawing');
  if (drawing) {
    noteDrawingImg.src = drawing;
    noteDrawingArea.classList.remove('hidden');
  } else {
    noteDrawingArea.classList.add('hidden');
  }
}

noteDrawingEdit.addEventListener('click', e => {
  e.stopPropagation();
  openNoteDrawing();
});

noteDrawingDel.addEventListener('click', e => {
  e.stopPropagation();
  localStorage.removeItem('mindnotes-note-drawing');
  loadNoteDrawing();
});

function getActiveWords() {
  const cat = data.categories.find(c => c.id === data.activeCategory);
  return cat ? cat.words : [];
}

// ═══════════════════════════════════════════
// DOUBLE-TAP SELECTION MODE
// ═══════════════════════════════════════════
let lastTapTime = 0;
document.addEventListener('pointerdown', handleGlobalPointer);

function handleGlobalPointer(e) {
  if (!settingsPanel.classList.contains('hidden')) return;
  if (!drawingOverlay.classList.contains('hidden')) return;
  if (!wordDrawingOverlay.classList.contains('hidden')) return;
  if (selectionMode) { handleSelectionTap(e); return; }
  const now = Date.now();
  if (now - lastTapTime < 350) {
    lastTapTime = 0;
    activateSelectionMode();
  } else {
    lastTapTime = now;
  }
}

function activateSelectionMode() {
  const words = getActiveWords();
  if (words.length === 0) return;
  selectionMode = true;
  selectedIndex = 0;
  renderWordList(words);
  wordOverlay.classList.remove('hidden');
  resetAutoSelectTimer();
}

function renderWordList(words) {
  wordList.innerHTML = '';
  words.forEach((w, i) => {
    const li = document.createElement('li');
    li.textContent = getWordText(w);
    if (i === selectedIndex) li.classList.add('active');
    wordList.appendChild(li);
  });
  updateWordDrawPreview(words);
}

function updateWordDrawPreview(words) {
  const w = words[selectedIndex];
  const drawing = getWordDrawing(w);
  if (drawing) {
    wordDrawImg.src = drawing;
    wordDrawPreview.classList.add('visible');
  } else {
    wordDrawPreview.classList.remove('visible');
    wordDrawImg.src = '';
  }
}

function updateHighlight() {
  const words = getActiveWords();
  wordList.querySelectorAll('li').forEach((li, i) => li.classList.toggle('active', i === selectedIndex));
  updateWordDrawPreview(words);
}

let tapDebounce = false;
function handleSelectionTap(e) {
  e.preventDefault();
  if (tapDebounce) return;
  tapDebounce = true;
  setTimeout(() => { tapDebounce = false; }, 250);
  const words = getActiveWords();
  selectedIndex = (selectedIndex + 1) % words.length;
  updateHighlight();
  resetAutoSelectTimer();
}

function resetAutoSelectTimer() {
  clearTimeout(autoSelectTimer);
  autoSelectTimer = setTimeout(finalizeSelection, 3000);
}

function finalizeSelection() {
  const words = getActiveWords();
  const chosen = getWordText(words[selectedIndex]);
  selectionMode = false;
  wordOverlay.classList.add('hidden');
  if (chosen) replaceQuoteContent(chosen);
}

// Quote Replacement
function replaceQuoteContent(word) {
  let text = noteEditor.textContent;
  const regex = /(["\u201C])([^"\u201C\u201D]*)(["|\u201D])/;
  const match = regex.exec(text);
  if (match) {
    const before = text.slice(0, match.index);
    const after  = text.slice(match.index + match[0].length);
    text = before + match[1] + word + match[3] + after;
    noteEditor.textContent = text;
    localStorage.setItem('mindnotes-note', text);
  }
}

// ═══════════════════════════════════════════
// LONG PRESS ON ••• FOR SETTINGS
// ═══════════════════════════════════════════
let longPressTimer = null;
btnMore.addEventListener('pointerdown', e => {
  e.stopPropagation();
  longPressTimer = setTimeout(() => { openSettings(); }, 1500);
});
btnMore.addEventListener('pointerup',     e => { e.stopPropagation(); clearTimeout(longPressTimer); });
btnMore.addEventListener('pointercancel', e => { e.stopPropagation(); clearTimeout(longPressTimer); });

function openSettings()  { renderSettings(); settingsPanel.classList.remove('hidden'); }
function closeSettings() { settingsPanel.classList.add('hidden'); }
settingsClose.addEventListener('click', closeSettings);
settingsPanel.addEventListener('pointerdown', e => { if (e.target === settingsPanel) closeSettings(); });

function renderSettings() {
  settingsBody.innerHTML = '';
  data.categories.forEach((cat, ci) => {
    const section = document.createElement('div');
    section.className = 'settings-section';

    const catRow = document.createElement('div');
    catRow.className = 'category-row' + (cat.id === data.activeCategory ? ' active-cat' : '');
    catRow.setAttribute('data-ocid', `settings.category.row.${ci+1}`);

    const radio = document.createElement('div');
    radio.className = 'cat-radio' + (cat.id === data.activeCategory ? ' checked' : '');
    radio.addEventListener('click', () => { data.activeCategory = cat.id; saveData(); renderSettings(); });

    const nameEl = document.createElement('span');
    nameEl.className = 'cat-name';
    nameEl.textContent = cat.name;
    nameEl.addEventListener('click', () => { data.activeCategory = cat.id; saveData(); renderSettings(); });

    const expandBtn = document.createElement('button');
    expandBtn.className = 'cat-expand';
    expandBtn.textContent = 'Words \u25BE';
    expandBtn.setAttribute('data-ocid', `settings.category.toggle.${ci+1}`);

    const delBtn = document.createElement('button');
    delBtn.className = 'cat-delete-btn';
    delBtn.textContent = '\u2212';
    delBtn.setAttribute('data-ocid', `settings.category.delete_button.${ci+1}`);
    delBtn.addEventListener('click', () => {
      data.categories.splice(ci, 1);
      if (data.activeCategory === cat.id) data.activeCategory = data.categories[0]?.id || null;
      saveData(); renderSettings();
    });

    catRow.appendChild(radio); catRow.appendChild(nameEl); catRow.appendChild(expandBtn); catRow.appendChild(delBtn);
    section.appendChild(catRow);

    const wordSublist = document.createElement('div');
    wordSublist.className = 'word-sublist hidden';
    expandBtn.addEventListener('click', () => {
      wordSublist.classList.toggle('hidden');
      expandBtn.textContent = wordSublist.classList.contains('hidden') ? 'Words \u25BE' : 'Words \u25B4';
    });

    cat.words.forEach((word, wi) => {
      const row = document.createElement('div');
      row.className = 'word-row';
      row.setAttribute('data-ocid', `settings.word.row.${wi+1}`);

      const wordSpan = document.createElement('span');
      wordSpan.className = 'word-text';
      wordSpan.textContent = getWordText(word);

      // Drawing thumbnail
      const drawThumb = document.createElement('div');
      drawThumb.className = 'word-draw-thumb';
      const drawing = getWordDrawing(word);
      if (drawing) {
        const thumbImg = document.createElement('img');
        thumbImg.src = drawing;
        thumbImg.className = 'word-thumb-img';
        drawThumb.appendChild(thumbImg);
      }

      const drawBtn = document.createElement('button');
      drawBtn.className = 'word-draw-btn' + (drawing ? ' has-drawing' : '');
      drawBtn.title = drawing ? 'Edit drawing' : 'Add drawing';
      drawBtn.setAttribute('data-ocid', `settings.word.edit_button.${wi+1}`);
      drawBtn.innerHTML = drawing
        ? '<svg width="14" height="14" viewBox="0 0 22 22" fill="none"><path d="M3 18c2-1 4-3 5-5l9-9a2 2 0 00-3-3L5 10c-2 1-3 3-3 5l1 3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 4l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 22 22" fill="none"><path d="M3 18c2-1 4-3 5-5l9-9a2 2 0 00-3-3L5 10c-2 1-3 3-3 5l1 3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 4l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="11" y1="11" x2="11" y2="11" stroke="currentColor" stroke-width="1.5"/></svg>';

      drawBtn.addEventListener('click', e => {
        e.stopPropagation();
        openWordDrawing(cat.id, wi, getWordText(word));
      });

      const editBtn = document.createElement('button'); editBtn.className = 'word-edit-btn'; editBtn.textContent = 'Edit';
      const delWordBtn = document.createElement('button'); delWordBtn.className = 'word-del-btn'; delWordBtn.textContent = '\u00D7';
      delWordBtn.setAttribute('data-ocid', `settings.word.delete_button.${wi+1}`);

      editBtn.addEventListener('click', () => {
        const input = document.createElement('input'); input.className = 'word-edit-input'; input.value = getWordText(word);
        const saveBtn = document.createElement('button'); saveBtn.className = 'word-save-btn'; saveBtn.textContent = '\u2713';
        saveBtn.setAttribute('data-ocid', `settings.word.save_button.${wi+1}`);
        saveBtn.addEventListener('click', () => {
          if (input.value.trim()) {
            const existing = cat.words[wi];
            cat.words[wi] = { text: input.value.trim(), drawing: getWordDrawing(existing) };
            saveData(); renderSettings();
          }
        });
        row.innerHTML = ''; row.appendChild(input); row.appendChild(saveBtn);
      });

      delWordBtn.addEventListener('click', () => { cat.words.splice(wi, 1); saveData(); renderSettings(); });

      row.appendChild(wordSpan);
      row.appendChild(drawThumb);
      row.appendChild(drawBtn);
      row.appendChild(editBtn);
      row.appendChild(delWordBtn);
      wordSublist.appendChild(row);
    });

    const addWordRow = document.createElement('div'); addWordRow.className = 'add-word-row';
    const addWordInput = document.createElement('input'); addWordInput.className = 'add-word-input'; addWordInput.placeholder = 'Add word\u2026';
    addWordInput.setAttribute('data-ocid', `settings.word.input.${ci+1}`);
    const addWordBtn = document.createElement('button'); addWordBtn.className = 'add-word-btn'; addWordBtn.textContent = '+';
    addWordBtn.setAttribute('data-ocid', `settings.word.submit_button.${ci+1}`);
    addWordBtn.addEventListener('click', () => {
      const val = addWordInput.value.trim();
      if (val) { cat.words.push({ text: val, drawing: null }); addWordInput.value = ''; saveData(); renderSettings(); }
    });
    addWordRow.appendChild(addWordInput); addWordRow.appendChild(addWordBtn);
    wordSublist.appendChild(addWordRow);
    section.appendChild(wordSublist);
    settingsBody.appendChild(section);
  });

  const addCatRow = document.createElement('div'); addCatRow.className = 'add-category-row';
  const addCatInput = document.createElement('input'); addCatInput.className = 'add-category-input'; addCatInput.placeholder = 'New category\u2026';
  addCatInput.setAttribute('data-ocid', 'settings.category.input');
  const addCatBtn = document.createElement('button'); addCatBtn.className = 'add-category-btn'; addCatBtn.textContent = 'Add';
  addCatBtn.setAttribute('data-ocid', 'settings.category.submit_button');
  addCatBtn.addEventListener('click', () => {
    const name = addCatInput.value.trim();
    if (name) { data.categories.push({ id: uid(), name, words: [] }); addCatInput.value = ''; saveData(); renderSettings(); }
  });
  addCatRow.appendChild(addCatInput); addCatRow.appendChild(addCatBtn);
  settingsBody.appendChild(addCatRow);
}

btnCompose.addEventListener('click', e => {
  e.stopPropagation();
  noteEditor.textContent = '';
  localStorage.setItem('mindnotes-note', '');
  noteEditor.focus();
});

document.getElementById('btn-back').addEventListener('click', e => { e.stopPropagation(); });

// ═══════════════════════════════════════════
// NOTE DRAWING MODULE
// ═══════════════════════════════════════════
const drawingOverlay  = document.getElementById('drawing-overlay');
const drawingCanvas   = document.getElementById('drawing-canvas');
const drawCtx         = drawingCanvas.getContext('2d');
const drawClearBtn    = document.getElementById('draw-clear');
const drawDoneBtn     = document.getElementById('drawing-done');
const drawCancelBtn   = document.getElementById('drawing-cancel');
const drawEraserBtn   = document.getElementById('draw-eraser');
const colorBtns       = document.querySelectorAll('.color-btn');
const sizeBtns        = document.querySelectorAll('.size-btn');

let noteIsDrawing = false;
let noteLastX = 0, noteLastY = 0;
let noteCurrentColor = '#ffffff';
let noteUseEraser = false;
let noteLineWidth = 2;

function initNoteCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  drawingCanvas.style.width  = w + 'px';
  drawingCanvas.style.height = h + 'px';
  drawingCanvas.width  = Math.round(w * dpr);
  drawingCanvas.height = Math.round(h * dpr);
  drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCtx.lineCap  = 'round';
  drawCtx.lineJoin = 'round';
}

function openNoteDrawing() {
  initNoteCanvas();
  drawCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  const existing = localStorage.getItem('mindnotes-note-drawing');
  if (existing) {
    const img = new Image();
    img.onload = () => { drawCtx.drawImage(img, 0, 0, window.innerWidth, window.innerHeight); };
    img.src = existing;
  }
  noteCurrentColor = '#ffffff';
  noteUseEraser = false;
  noteLineWidth = 2;
  setNoteColor('#ffffff');
  setNoteSize(2);
  drawEraserBtn.classList.remove('active');
  drawingOverlay.classList.remove('hidden');
}

btnMarkup.addEventListener('click', e => {
  e.stopPropagation();
  openNoteDrawing();
});

function setNoteColor(c) {
  noteCurrentColor = c;
  noteUseEraser = false;
  colorBtns.forEach(b => b.classList.toggle('active', b.dataset.color === c));
  drawEraserBtn.classList.remove('active');
}

function setNoteSize(s) {
  noteLineWidth = s;
  sizeBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.size) === s));
}

colorBtns.forEach(b => b.addEventListener('click', e => {
  e.stopPropagation();
  setNoteColor(b.dataset.color);
}));

sizeBtns.forEach(b => b.addEventListener('click', e => {
  e.stopPropagation();
  setNoteSize(parseInt(b.dataset.size));
}));

drawEraserBtn.addEventListener('click', e => {
  e.stopPropagation();
  noteUseEraser = !noteUseEraser;
  drawEraserBtn.classList.toggle('active', noteUseEraser);
  colorBtns.forEach(b => b.classList.toggle('active', !noteUseEraser && b.dataset.color === noteCurrentColor));
});

drawClearBtn.addEventListener('click', e => {
  e.stopPropagation();
  drawCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
});

drawDoneBtn.addEventListener('click', e => {
  e.stopPropagation();
  const dataURL = drawingCanvas.toDataURL('image/png');
  localStorage.setItem('mindnotes-note-drawing', dataURL);
  drawingOverlay.classList.add('hidden');
  loadNoteDrawing();
});

drawCancelBtn.addEventListener('click', e => {
  e.stopPropagation();
  drawingOverlay.classList.add('hidden');
});

drawingCanvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  noteIsDrawing = true;
  const rect = drawingCanvas.getBoundingClientRect();
  noteLastX = e.clientX - rect.left;
  noteLastY = e.clientY - rect.top;
  drawCtx.beginPath();
  if (noteUseEraser) {
    drawCtx.save();
    drawCtx.globalCompositeOperation = 'destination-out';
    drawCtx.arc(noteLastX, noteLastY, noteLineWidth * 5, 0, Math.PI * 2);
    drawCtx.fillStyle = 'rgba(0,0,0,1)';
    drawCtx.fill();
    drawCtx.restore();
  } else {
    drawCtx.arc(noteLastX, noteLastY, noteLineWidth / 2, 0, Math.PI * 2);
    drawCtx.fillStyle = noteCurrentColor;
    drawCtx.fill();
  }
});

drawingCanvas.addEventListener('pointermove', e => {
  if (!noteIsDrawing) return;
  e.preventDefault();
  const rect = drawingCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  drawCtx.beginPath();
  drawCtx.moveTo(noteLastX, noteLastY);
  drawCtx.lineTo(x, y);
  if (noteUseEraser) {
    drawCtx.save();
    drawCtx.globalCompositeOperation = 'destination-out';
    drawCtx.lineWidth = noteLineWidth * 10;
    drawCtx.strokeStyle = 'rgba(0,0,0,1)';
    drawCtx.stroke();
    drawCtx.restore();
  } else {
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    drawCtx.lineWidth = noteLineWidth + pressure * 1.5;
    drawCtx.strokeStyle = noteCurrentColor;
    drawCtx.stroke();
  }
  noteLastX = x;
  noteLastY = y;
});

drawingCanvas.addEventListener('pointerup',     () => { noteIsDrawing = false; });
drawingCanvas.addEventListener('pointercancel', () => { noteIsDrawing = false; });

// ═══════════════════════════════════════════
// WORD DRAWING MODULE (for category words)
// ═══════════════════════════════════════════
const wordDrawingOverlay  = document.getElementById('word-drawing-overlay');
const wordDrawingCanvas   = document.getElementById('word-drawing-canvas');
const wdCtx               = wordDrawingCanvas.getContext('2d');
const wdDoneBtn           = document.getElementById('word-drawing-done');
const wdCancelBtn         = document.getElementById('word-drawing-cancel');
const wdClearBtn          = document.getElementById('word-draw-clear');
const wdEraserBtn         = document.getElementById('word-draw-eraser');
const wdColorBtns         = document.querySelectorAll('.wcolor-btn');
const wordDrawLabel       = document.getElementById('word-drawing-label');

let wdCatId = null;
let wdWordIdx = -1;
let wdIsDrawing = false;
let wdLastX = 0, wdLastY = 0;
let wdColor = '#ffffff';
let wdEraser = false;
let wdSize = 3;

function initWordCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  wordDrawingCanvas.style.width  = w + 'px';
  wordDrawingCanvas.style.height = h + 'px';
  wordDrawingCanvas.width  = Math.round(w * dpr);
  wordDrawingCanvas.height = Math.round(h * dpr);
  wdCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wdCtx.lineCap  = 'round';
  wdCtx.lineJoin = 'round';
}

function openWordDrawing(catId, wordIdx, wordText) {
  wdCatId = catId;
  wdWordIdx = wordIdx;
  wordDrawLabel.textContent = wordText;
  initWordCanvas();
  wdCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // Draw a faint guide label
  wdCtx.save();
  wdCtx.font = 'bold 18px -apple-system, sans-serif';
  wdCtx.fillStyle = 'rgba(255,255,255,0.12)';
  wdCtx.textAlign = 'center';
  wdCtx.fillText('Draw "' + wordText + '" here', window.innerWidth / 2, window.innerHeight / 2 - 10);
  wdCtx.font = '14px -apple-system, sans-serif';
  wdCtx.fillText('Your drawing will appear in the word list', window.innerWidth / 2, window.innerHeight / 2 + 16);
  wdCtx.restore();

  // Load existing drawing
  const cat = data.categories.find(c => c.id === catId);
  if (cat) {
    const word = cat.words[wordIdx];
    const existingDrawing = getWordDrawing(word);
    if (existingDrawing) {
      const img = new Image();
      img.onload = () => {
        wdCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        wdCtx.drawImage(img, 0, 0, window.innerWidth, window.innerHeight);
      };
      img.src = existingDrawing;
    }
  }

  wdColor = '#ffffff';
  wdEraser = false;
  wdSize = 3;
  wdColorBtns.forEach(b => b.classList.toggle('active', b.dataset.color === '#ffffff'));
  wdEraserBtn.classList.remove('active');
  wordDrawingOverlay.classList.remove('hidden');
}

wdDoneBtn.addEventListener('click', e => {
  e.stopPropagation();
  // Save drawing to word
  const dataURL = wordDrawingCanvas.toDataURL('image/png');
  const cat = data.categories.find(c => c.id === wdCatId);
  if (cat && wdWordIdx >= 0) {
    const word = cat.words[wdWordIdx];
    if (typeof word === 'string') {
      cat.words[wdWordIdx] = { text: word, drawing: dataURL };
    } else {
      word.drawing = dataURL;
    }
    saveData();
    renderSettings();
  }
  wordDrawingOverlay.classList.add('hidden');
});

wdCancelBtn.addEventListener('click', e => {
  e.stopPropagation();
  wordDrawingOverlay.classList.add('hidden');
});

wdClearBtn.addEventListener('click', e => {
  e.stopPropagation();
  wdCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
});

wdEraserBtn.addEventListener('click', e => {
  e.stopPropagation();
  wdEraser = !wdEraser;
  wdEraserBtn.classList.toggle('active', wdEraser);
  wdColorBtns.forEach(b => b.classList.toggle('active', !wdEraser && b.dataset.color === wdColor));
});

wdColorBtns.forEach(b => b.addEventListener('click', e => {
  e.stopPropagation();
  wdColor = b.dataset.color;
  wdEraser = false;
  wdColorBtns.forEach(bb => bb.classList.toggle('active', bb === b));
  wdEraserBtn.classList.remove('active');
}));

wordDrawingCanvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  wdIsDrawing = true;
  const rect = wordDrawingCanvas.getBoundingClientRect();
  wdLastX = e.clientX - rect.left;
  wdLastY = e.clientY - rect.top;
  wdCtx.beginPath();
  if (wdEraser) {
    wdCtx.save();
    wdCtx.globalCompositeOperation = 'destination-out';
    wdCtx.arc(wdLastX, wdLastY, wdSize * 5, 0, Math.PI * 2);
    wdCtx.fillStyle = 'rgba(0,0,0,1)';
    wdCtx.fill();
    wdCtx.restore();
  } else {
    wdCtx.arc(wdLastX, wdLastY, wdSize / 2, 0, Math.PI * 2);
    wdCtx.fillStyle = wdColor;
    wdCtx.fill();
  }
});

wordDrawingCanvas.addEventListener('pointermove', e => {
  if (!wdIsDrawing) return;
  e.preventDefault();
  const rect = wordDrawingCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  wdCtx.beginPath();
  wdCtx.moveTo(wdLastX, wdLastY);
  wdCtx.lineTo(x, y);
  if (wdEraser) {
    wdCtx.save();
    wdCtx.globalCompositeOperation = 'destination-out';
    wdCtx.lineWidth = wdSize * 10;
    wdCtx.strokeStyle = 'rgba(0,0,0,1)';
    wdCtx.stroke();
    wdCtx.restore();
  } else {
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    wdCtx.lineWidth = wdSize + pressure * 2;
    wdCtx.strokeStyle = wdColor;
    wdCtx.stroke();
  }
  wdLastX = x;
  wdLastY = y;
});

wordDrawingCanvas.addEventListener('pointerup',     () => { wdIsDrawing = false; });
wordDrawingCanvas.addEventListener('pointercancel', () => { wdIsDrawing = false; });

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
loadData();
loadNote();
loadNoteDrawing();
