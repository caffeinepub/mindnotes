/* MindNotes — iOS Notes Mentalism PWA */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/pwa/service-worker.js').catch(() => {});
}

const noteEditor    = document.getElementById('note-editor');
const noteDate      = document.getElementById('note-date');
const btnMore       = document.getElementById('btn-more');
const wordOverlay   = document.getElementById('word-overlay');
const wordList      = document.getElementById('word-list');
const settingsPanel = document.getElementById('settings-panel');
const settingsBody  = document.getElementById('settings-body');
const settingsClose = document.getElementById('settings-close');
const btnCompose    = document.getElementById('btn-compose');

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
}

function uid() { return Math.random().toString(36).slice(2); }

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

function getActiveWords() {
  const cat = data.categories.find(c => c.id === data.activeCategory);
  return cat ? cat.words : [];
}

// Double-Tap Detection
let lastTapTime = 0;
document.addEventListener('pointerdown', handleGlobalPointer);

function handleGlobalPointer(e) {
  if (!settingsPanel.classList.contains('hidden')) return;
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
    li.textContent = w;
    if (i === selectedIndex) li.classList.add('active');
    wordList.appendChild(li);
  });
}

function updateHighlight() {
  wordList.querySelectorAll('li').forEach((li, i) => li.classList.toggle('active', i === selectedIndex));
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
  const chosen = words[selectedIndex];
  selectionMode = false;
  wordOverlay.classList.add('hidden');
  if (chosen) replaceQuoteContent(chosen);
}

// Quote Replacement — handles straight "" AND iOS smart/curly quotes \u201C\u201D
function replaceQuoteContent(word) {
  let text = noteEditor.textContent;
  // Opening quote: " or \u201C (left double quotation mark)
  // Closing quote: " or \u201D (right double quotation mark)
  const regex = /(["|\u201C])([^"\u201C\u201D]*)(["|\u201D])/;
  const match = regex.exec(text);
  if (match) {
    const before = text.slice(0, match.index);
    const after  = text.slice(match.index + match[0].length);
    text = before + match[1] + word + match[3] + after;
    noteEditor.textContent = text;
    localStorage.setItem('mindnotes-note', text);
  }
}

// Long Press on ••• for Settings
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
      const wordSpan = document.createElement('span'); wordSpan.className = 'word-text'; wordSpan.textContent = word;
      const editBtn = document.createElement('button'); editBtn.className = 'word-edit-btn'; editBtn.textContent = 'Edit';
      editBtn.setAttribute('data-ocid', `settings.word.edit_button.${wi+1}`);
      const delWordBtn = document.createElement('button'); delWordBtn.className = 'word-del-btn'; delWordBtn.textContent = '\u00D7';
      delWordBtn.setAttribute('data-ocid', `settings.word.delete_button.${wi+1}`);
      editBtn.addEventListener('click', () => {
        const input = document.createElement('input'); input.className = 'word-edit-input'; input.value = word;
        const saveBtn = document.createElement('button'); saveBtn.className = 'word-save-btn'; saveBtn.textContent = '\u2713';
        saveBtn.setAttribute('data-ocid', `settings.word.save_button.${wi+1}`);
        saveBtn.addEventListener('click', () => {
          if (input.value.trim()) { cat.words[wi] = input.value.trim(); saveData(); renderSettings(); }
        });
        row.innerHTML = ''; row.appendChild(input); row.appendChild(saveBtn);
      });
      delWordBtn.addEventListener('click', () => { cat.words.splice(wi, 1); saveData(); renderSettings(); });
      row.appendChild(wordSpan); row.appendChild(editBtn); row.appendChild(delWordBtn);
      wordSublist.appendChild(row);
    });

    const addWordRow = document.createElement('div'); addWordRow.className = 'add-word-row';
    const addWordInput = document.createElement('input'); addWordInput.className = 'add-word-input'; addWordInput.placeholder = 'Add word\u2026';
    addWordInput.setAttribute('data-ocid', `settings.word.input.${ci+1}`);
    const addWordBtn = document.createElement('button'); addWordBtn.className = 'add-word-btn'; addWordBtn.textContent = '+';
    addWordBtn.setAttribute('data-ocid', `settings.word.submit_button.${ci+1}`);
    addWordBtn.addEventListener('click', () => {
      const val = addWordInput.value.trim();
      if (val) { cat.words.push(val); addWordInput.value = ''; saveData(); renderSettings(); }
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

loadData();
loadNote();
