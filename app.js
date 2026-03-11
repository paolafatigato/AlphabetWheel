/* =====================================================
   FIREBASE — INIT
   ===================================================== */
const firebaseConfig = {
  apiKey:            "AIzaSyCFGBlCaIrk5XuP41k99w3phmB1xC6IwGg",
  authDomain:        "wheel-relative.firebaseapp.com",
  projectId:         "wheel-relative",
  storageBucket:     "wheel-relative.firebasestorage.app",
  messagingSenderId: "907561339886",
  appId:             "1:907561339886:web:a466245969bd585af9dcff"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

let currentUser = null;

/* =====================================================
   AUTH — STATE OBSERVER
   ===================================================== */
auth.onAuthStateChanged(user => {
  currentUser = user;
  updateAuthUI();
  updateEditorGate();
  if (user) {
    showLibraryGate(false);
    // Reload library if that tab is currently active
    if (document.getElementById('panel-library').classList.contains('active')) {
      loadLibrary();
    }
  } else {
    showLibraryGate(true);
  }
});

/* =====================================================
   AUTH — LOGIN / LOGOUT
   ===================================================== */
function authLogin() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    showToast('⚠ Login failed: ' + err.message, true);
  });
}

function authLogout() {
  auth.signOut().then(() => {
    showToast('👋 Signed out successfully.');
  });
}

/* =====================================================
   AUTH — UPDATE UI
   ===================================================== */
function updateAuthUI() {
  const out = document.getElementById('authLoggedOut');
  const inn = document.getElementById('authLoggedIn');
  if (currentUser) {
    out.style.display = 'none';
    inn.style.display = 'flex';
    document.getElementById('authAvatar').src =
      currentUser.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="%231a3a4a"/><text x="12" y="16" text-anchor="middle" fill="%234ecdc4" font-size="12" font-family="sans-serif">?</text></svg>';
    document.getElementById('authName').textContent =
      currentUser.displayName || currentUser.email || 'User';
  } else {
    out.style.display = 'flex';
    inn.style.display = 'none';
  }
}

/* =====================================================
   AUTH — EDITOR GATE
   ===================================================== */
function updateEditorGate() {
  const gate = document.getElementById('loginGate');
  const body = document.getElementById('editorBody');
  if (currentUser) {
    gate.style.display = 'none';
    body.style.display = 'block';
    // Build editor table if not yet populated
    if (!document.getElementById('editorTbody').children.length) {
      buildEditorTable();
    }
  } else {
    gate.style.display = 'flex';
    body.style.display = 'none';
  }
}

/* =====================================================
   LIBRARY GATE
   ===================================================== */
function showLibraryGate(show) {
  document.getElementById('libraryLoginGate').style.display = show ? 'flex' : 'none';
  document.getElementById('libraryContent').style.display   = show ? 'none' : 'block';
}

/* =====================================================
   FIRESTORE — SAVE WHEEL
   ===================================================== */
function collectEditorData() {
  return DEFAULT_CLUES.map((_, i) => ({
    word: (document.getElementById('ei-word-' + i) || {}).value?.trim() || '',
    def:  (document.getElementById('ei-def-'  + i) || {}).value?.trim() || '',
  }));
}

async function saveWheelToCloud() {
  if (!currentUser) { showToast('⚠ Please sign in first', true); return; }
  const name = document.getElementById('wheelNameInput').value.trim();
  if (!name) {
    document.getElementById('wheelNameInput').focus();
    showToast('⚠ Please enter a name for this wheel', true);
    return;
  }
  const data = collectEditorData();
  const hasContent = data.some(r => r.word || r.def);
  if (!hasContent) {
    showToast('⚠ The wheel has no custom entries yet', true);
    return;
  }
  try {
    await db.collection('users').doc(currentUser.uid)
            .collection('wheels').add({
              name,
              data,
              palette: activePaletteId,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
    showToast('☁ "' + name + '" saved to your library!');
    closeSaveModal();
    // Refresh library if tab is open
    if (document.getElementById('panel-library').classList.contains('active')) {
      loadLibrary();
    }
  } catch (e) {
    showToast('⚠ Save failed: ' + e.message, true);
  }
}

/* =====================================================
   FIRESTORE — LOAD LIBRARY
   ===================================================== */
async function loadLibrary() {
  if (!currentUser) return;
  showLibraryGate(false);

  const grid  = document.getElementById('wheelsGrid');
  const empty = document.getElementById('libraryEmpty');
  const count = document.getElementById('libraryCount');

  grid.innerHTML = '<div class="library-loading">Loading your wheels…</div>';
  empty.style.display = 'none';

  try {
    const snap = await db.collection('users').doc(currentUser.uid)
                         .collection('wheels')
                         .orderBy('createdAt', 'desc')
                         .get();

    grid.innerHTML = '';

    if (snap.empty) {
      empty.style.display = 'block';
      count.textContent = '0 wheels saved';
    } else {
      empty.style.display = 'none';
      count.textContent = snap.size + ' wheel' + (snap.size !== 1 ? 's' : '') + ' saved';
      snap.forEach(doc => {
        grid.appendChild(buildWheelCard(doc.id, doc.data()));
      });
    }
  } catch (e) {
    grid.innerHTML = `<div style="color:var(--red);font-family:'JetBrains Mono',monospace;font-size:12px;padding:20px">
      ⚠ Error loading library: ${escapeHtml(e.message)}
    </div>`;
  }
}

/* =====================================================
   FIRESTORE — BUILD WHEEL CARD
   ===================================================== */
function buildWheelCard(id, data) {
  const card = document.createElement('div');
  card.className = 'wheel-card';

  const date     = data.createdAt?.toDate?.();
  const dateStr  = date
    ? date.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
    : '—';
  const custom   = data.data ? data.data.filter(r => r.word || r.def).length : 0;

  const palColor = PALETTES.find(p => p.id === (data.palette || 'teal'))?.main || '#4ecdc4';

  card.innerHTML = `
    <div class="wc-name">${escapeHtml(data.name)}</div>
    <div class="wc-meta">
      <span style="display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${palColor};flex-shrink:0"></span>
        ${custom} custom entr${custom === 1 ? 'y' : 'ies'}
      </span>
      <span>${dateStr}</span>
    </div>
    <div class="wc-actions">
      <button class="wc-btn wc-load"   onclick="loadWheelFromCloud('${id}')">▶ Load &amp; Play</button>
      <button class="wc-btn wc-delete" onclick="deleteWheelFromCloud('${id}', this)" title="Delete wheel">🗑</button>
    </div>
  `;
  return card;
}

/* =====================================================
   FIRESTORE — LOAD A WHEEL INTO EDITOR
   ===================================================== */
async function loadWheelFromCloud(id) {
  if (!currentUser) return;
  try {
    const doc = await db.collection('users').doc(currentUser.uid)
                        .collection('wheels').doc(id).get();
    if (!doc.exists) { showToast('⚠ Wheel not found', true); return; }

    const { name, data, palette } = doc.data();

    // Ensure editor table exists
    if (!document.getElementById('editorTbody').children.length) {
      buildEditorTable();
    }

    data.forEach((row, i) => {
      const wEl = document.getElementById('ei-word-' + i);
      const dEl = document.getElementById('ei-def-'  + i);
      if (wEl) wEl.value = row.word || '';
      if (dEl) {
        dEl.value = row.def || '';
        const preview = document.getElementById('ei-preview-' + i);
        if (preview) {
          if (row.def) {
            preview.innerHTML = highlightRelativePronouns(row.def);
            preview.style.display = 'block';
          } else {
            preview.style.display = 'none';
          }
        }
      }
      updateRowStatus(i);
    });

    generateCustomWheel();
    if (palette) applyPalette(palette);
    showToast('✓ Loaded "' + name + '" — switching to Play!');
    setTimeout(() => switchTab('game'), 1000);

  } catch (e) {
    showToast('⚠ Load failed: ' + e.message, true);
  }
}

/* =====================================================
   FIRESTORE — DELETE A WHEEL
   ===================================================== */
async function deleteWheelFromCloud(id, btn) {
  if (!currentUser) return;
  if (!confirm('Delete this wheel? This action cannot be undone.')) return;
  try {
    btn.disabled = true;
    await db.collection('users').doc(currentUser.uid)
            .collection('wheels').doc(id).delete();
    showToast('🗑 Wheel deleted.');
    loadLibrary();
  } catch (e) {
    showToast('⚠ Delete failed: ' + e.message, true);
    btn.disabled = false;
  }
}

/* =====================================================
   SAVE MODAL
   ===================================================== */
function openSaveModal() {
  if (!currentUser) {
    showToast('⚠ Please sign in to save wheels', true);
    return;
  }
  document.getElementById('wheelNameInput').value = '';
  document.getElementById('saveModal').classList.add('show');
  setTimeout(() => document.getElementById('wheelNameInput').focus(), 150);
}

function closeSaveModal() {
  document.getElementById('saveModal').classList.remove('show');
}

function handleModalOverlayClick(e) {
  if (e.target === document.getElementById('saveModal')) closeSaveModal();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSaveModal();
});

/* =====================================================
   UTILITY
   ===================================================== */
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* =====================================================
   COLOR PALETTES
   Each palette: { id, name, main, dim, glow, light, center }
   ===================================================== */
const PALETTES = [
  { id:'teal',     name:'Teal',      main:'#4ecdc4', dim:'#2a8a85', glow:'rgba(78,205,196,0.18)',   light:'#7dffc0', center:'radial-gradient(circle at 40% 35%, #152d3a, #08141e)', border:'#1a4050' },
  { id:'violet',   name:'Violet',    main:'#9b6dff', dim:'#5a3db0', glow:'rgba(155,109,255,0.18)',  light:'#c9b0ff', center:'radial-gradient(circle at 40% 35%, #1c1535, #080e1e)', border:'#2a1a50' },
  { id:'gold',     name:'Amber',     main:'#f0b84e', dim:'#a07820', glow:'rgba(240,184,78,0.18)',   light:'#ffe09a', center:'radial-gradient(circle at 40% 35%, #2a1e08, #0e0a02)', border:'#40300a' },
  { id:'coral',    name:'Coral',     main:'#ff6b6b', dim:'#b03030', glow:'rgba(255,107,107,0.18)',  light:'#ffb0b0', center:'radial-gradient(circle at 40% 35%, #301010, #0f0505)', border:'#501020' },
  { id:'sky',      name:'Sky',       main:'#5bc4f5', dim:'#2a80b0', glow:'rgba(91,196,245,0.18)',   light:'#aae4ff', center:'radial-gradient(circle at 40% 35%, #0e2535, #040f1a)', border:'#153550' },
  { id:'emerald',  name:'Emerald',   main:'#2ecc7a', dim:'#1a7a45', glow:'rgba(46,204,122,0.18)',   light:'#85ffbe', center:'radial-gradient(circle at 40% 35%, #0c2518, #040e08)', border:'#0e3520' },
  { id:'rose',     name:'Rose',      main:'#ff7eb3', dim:'#b03070', glow:'rgba(255,126,179,0.18)',  light:'#ffc0e0', center:'radial-gradient(circle at 40% 35%, #301020, #100510)', border:'#501030' },
  { id:'orange',   name:'Orange',    main:'#ff8c42', dim:'#b05010', glow:'rgba(255,140,66,0.18)',   light:'#ffc090', center:'radial-gradient(circle at 40% 35%, #2a1408, #0e0702)', border:'#401808' },
  { id:'lavender', name:'Lavender',  main:'#b8a4e8', dim:'#705ab0', glow:'rgba(184,164,232,0.18)', light:'#ddd0ff', center:'radial-gradient(circle at 40% 35%, #1a1530, #080510)', border:'#302055' },
  { id:'lime',     name:'Lime',      main:'#aadd55', dim:'#607a20', glow:'rgba(170,221,85,0.18)',   light:'#d4ff90', center:'radial-gradient(circle at 40% 35%, #182208, #070e02)', border:'#253510' },
];

let activePaletteId = 'teal';

function applyPalette(id) {
  const p = PALETTES.find(x => x.id === id) || PALETTES[0];
  activePaletteId = p.id;
  const r = document.documentElement;
  r.style.setProperty('--teal',      p.main);
  r.style.setProperty('--teal-dim',  p.dim);
  r.style.setProperty('--teal-glow', p.glow);
  r.style.setProperty('--rp-color',  p.main);
  r.style.setProperty('--rp-bg',     p.glow.replace('0.18', '0.15'));

  // Wheel center gradient
  const wc = document.getElementById('wheelCenter');
  if (wc) {
    wc.style.background  = p.center;
    wc.style.borderColor = p.border;
  }

  // Solution reveal colour
  r.style.setProperty('--solution-color', p.light);
  const sr = document.getElementById('solutionReveal');
  if (sr) sr.style.color = p.light;

  // Update active swatch highlight
  document.querySelectorAll('.color-swatch').forEach(s => {
    const on = s.dataset.palette === id;
    s.classList.toggle('active', on);
    s.style.setProperty('--swatch-glow', s.dataset.glow);
  });

  // Update selected-name label in editor
  const label = document.getElementById('paletteSelectedName');
  if (label) label.textContent = '● ' + p.name;
}

function buildColorStrip() {
  const strip = document.getElementById('colorStrip');
  strip.innerHTML = '';
  PALETTES.forEach(p => {
    const sw = document.createElement('button');
    sw.className       = 'color-swatch' + (p.id === activePaletteId ? ' active' : '');
    sw.title           = p.name;
    sw.dataset.palette = p.id;
    sw.dataset.glow    = p.glow;
    sw.style.background = p.main;
    sw.style.setProperty('--swatch-glow', p.glow);
    sw.setAttribute('aria-label', p.name + ' colour');
    sw.addEventListener('click', () => {
      applyPalette(p.id);
      // Rebuild wheel with new colour immediately
      buildWheel();
    });
    strip.appendChild(sw);
  });
  // Set initial label
  const label = document.getElementById('paletteSelectedName');
  if (label) {
    const active = PALETTES.find(x => x.id === activePaletteId);
    if (active) label.textContent = '● ' + active.name;
  }
}

/* =====================================================
   TEXT IMPORT
   ===================================================== */
function importFromText() {
  const raw = document.getElementById('importTextarea').value;
  if (!raw.trim()) { showToast('⚠ Paste some text first', true); return; }

  // Split into tokens by newline, comma, semicolon
  const tokens = raw
    .split(/[\n,;]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (!tokens.length) { showToast('⚠ No entries found', true); return; }

  // Parse each token: word[:=]definition  OR  just word
  const parsed = tokens.map(t => {
    const sep = t.search(/[:=]/);
    if (sep > 0) {
      return {
        word: t.slice(0, sep).trim(),
        def:  t.slice(sep + 1).trim(),
      };
    }
    return { word: t.trim(), def: '' };
  }).filter(e => e.word);

  if (!parsed.length) { showToast('⚠ Could not parse any entries', true); return; }

  // Make sure editor table is built
  if (!document.getElementById('editorTbody').children.length) buildEditorTable();

  let filled = 0;
  const limit = Math.min(parsed.length, DEFAULT_CLUES.length);

  for (let i = 0; i < limit; i++) {
    const wEl = document.getElementById('ei-word-' + i);
    const dEl = document.getElementById('ei-def-'  + i);
    if (!wEl) continue;
    if (parsed[i].word) { wEl.value = parsed[i].word; }
    if (parsed[i].def)  {
      dEl.value = parsed[i].def;
      const preview = document.getElementById('ei-preview-' + i);
      if (preview) {
        preview.innerHTML = highlightRelativePronouns(parsed[i].def);
        preview.style.display = 'block';
      }
    }
    updateRowStatus(i);
    filled++;
  }

  // Preview feedback
  const previewEl = document.getElementById('importPreview');
  const lines = parsed.slice(0, limit).map((e, i) =>
    `${DEFAULT_CLUES[i].letter}  →  ${e.word}${e.def ? '  :  ' + e.def.substring(0, 50) + (e.def.length > 50 ? '…' : '') : ''}`
  );
  previewEl.innerHTML = `<strong style="color:#7dffc0">✓ ${filled} entr${filled===1?'y':'ies'} imported:</strong>\n` + lines.join('\n');
  previewEl.style.display = 'block';
  previewEl.style.whiteSpace = 'pre';

  // Close the details
  document.getElementById('importPanel').open = false;

  showToast(`✓ ${filled} entr${filled===1?'y':'ies'} imported into the table!`);
}

/* =====================================================
   1. DEFAULT DATASET
   ===================================================== */
const DEFAULT_CLUES = [
  { letter:'A', word:'Ambitious',  clue:'Somebody who always aims at the best and wants to succeed' },
  { letter:'B', word:'Bottle',     clue:'An object that contains liquids and has a narrow neck' },
  { letter:'C', word:'Cathedral',  clue:'A place where religious people pray and artistic people admire the architecture' },
  { letter:'D', word:'Doctor',     clue:'A person who helps sick people get better and works in a hospital' },
  { letter:'E', word:'Elephant',   clue:'An animal that has a long trunk, big ears and never forgets' },
  { letter:'F', word:'Fountain',   clue:'A structure that sends water upward, often found in public squares' },
  { letter:'G', word:'Guitar',     clue:'An instrument that musicians play with their fingers or a pick, using strings' },
  { letter:'H', word:'Hospital',   clue:'A place where doctors and nurses work and sick people are treated' },
  { letter:'I', word:'Island',     clue:'A place that is completely surrounded by water on all sides' },
  { letter:'J', word:'Judge',      clue:'A person who sits in a court and decides if someone is guilty or innocent' },
  { letter:'K', word:'Kitchen',    clue:'A room where people cook and prepare food, usually with an oven' },
  { letter:'L', word:'Library',    clue:'A place where you can borrow books and study in silence' },
  { letter:'M', word:'Mountain',   clue:'A natural structure that rises very high above the surrounding land' },
  { letter:'N', word:'Newspaper',  clue:'An object that contains daily news and articles, printed on paper' },
  { letter:'O', word:'Ocean',      clue:"A very large body of water that covers most of the Earth's surface" },
  { letter:'P', word:'Passport',   clue:'A document that allows you to travel to other countries legally' },
  { letter:'Q', word:'Queen',      clue:'A woman who rules a kingdom, often wearing a crown' },
  { letter:'R', word:'Rainbow',    clue:'A colourful arc that appears in the sky after rain and sunlight combine' },
  { letter:'S', word:'Submarine',  clue:'A vehicle that travels completely underwater, used by the navy' },
  { letter:'T', word:'Telescope',  clue:'An instrument that scientists use to observe distant stars and planets' },
  { letter:'U', word:'Umbrella',   clue:'An object that protects you from rain when you open it above your head' },
  { letter:'V', word:'Volcano',    clue:'A mountain that can erupt and release hot lava and ash' },
  { letter:'W', word:'Wallet',     clue:'An object where you keep your money, cards and ID documents' },
  { letter:'X', word:'Xylophone',  clue:'An instrument that you play by hitting coloured wooden bars with small mallets' },
  { letter:'Y', word:'Yacht',      clue:'A vehicle that sails on the sea, often owned by wealthy people' },
  { letter:'Z', word:'Zoo',        clue:'A place where you can see animals from all over the world in enclosures' },
];

// Active CLUES array — replaced when a custom wheel is generated
let CLUES = DEFAULT_CLUES.map(c => ({ ...c }));

/* =====================================================
   2. UTILITY — HIGHLIGHT RELATIVE PRONOUNS
   ===================================================== */
function highlightRelativePronouns(text) {
  if (!text) return text;
  return text.replace(/\b(who|that|which|where|whose|whom)\b/gi, '<em class="relative-pronoun">$1</em>');
}

/* =====================================================
   3. WHEEL CONSTANTS & STATE
   ===================================================== */
const TOTAL_SECS = 22;
const ARC_FULL   = 2 * Math.PI * 88; // r=88 from SVG

let gIdx      = 0;
let gTimer    = null;
let gSecsLeft = TOTAL_SECS;
let gRunning  = false;
let gCorrect  = 0;
let gSkip     = 0;
let gRevealed = false;

/* =====================================================
   4. BUILD WHEEL
   ===================================================== */
function buildWheel() {
  const ring = document.getElementById('wheelRing');
  ring.querySelectorAll('.letter-dot').forEach(d => d.remove());
  const size = ring.offsetWidth || 500;
  const cx   = size / 2;
  const r    = size * 0.42;

  CLUES.forEach((item, i) => {
    const angle = (2 * Math.PI / CLUES.length) * i - Math.PI / 2;
    const x     = cx + r * Math.cos(angle);
    const y     = cx + r * Math.sin(angle);

    const dot       = document.createElement('div');
    dot.className   = 'letter-dot';
    dot.id          = 'dot-' + i;
    dot.textContent = item.letter;
    dot.style.left  = x + 'px';
    dot.style.top   = y + 'px';
    dot.dataset.result = '';

    dot.addEventListener('click', () => {
      if (gRunning && i === gIdx) gameReveal();
    });
    ring.appendChild(dot);
  });
  applyPalette(activePaletteId); // recolour center after DOM rebuild
}

function updateDots() {
  CLUES.forEach((_, i) => {
    const d = document.getElementById('dot-' + i);
    if (!d) return;
    d.className = 'letter-dot';
    if (i === gIdx && gRunning)              d.classList.add('active');
    else if (d.dataset.result === 'correct') d.classList.add('done-correct');
    else if (d.dataset.result === 'skip')    d.classList.add('done-skip');
  });
}

/* =====================================================
   5. TIMER
   ===================================================== */
function startTimer() {
  stopTimer();
  gSecsLeft = TOTAL_SECS;
  updateTimerUI(gSecsLeft);
  gTimer = setInterval(() => {
    gSecsLeft--;
    updateTimerUI(gSecsLeft);
    if (gSecsLeft <= 0) { stopTimer(); onTimerEnd(); }
  }, 1000);
}

function stopTimer() {
  clearInterval(gTimer);
  gTimer = null;
}

function updateTimerUI(secs) {
  const num    = document.getElementById('timerNum');
  const arc    = document.getElementById('timerArc');
  num.textContent = secs;
  arc.style.strokeDashoffset = ARC_FULL * (1 - secs / TOTAL_SECS);

  if (secs <= 5) {
    arc.className = 'timer-arc danger';
    num.className = 'timer-number danger';
  } else if (secs <= 10) {
    arc.className = 'timer-arc warn';
    num.className = 'timer-number warn';
  } else {
    arc.className = 'timer-arc';
    num.className = 'timer-number';
  }
}

function onTimerEnd() {
  gRevealed = true;
  document.getElementById('timeoutMsg').style.display    = 'block';
  document.getElementById('solutionReveal').textContent  = CLUES[gIdx].word.toUpperCase();
  document.getElementById('solutionReveal').style.display = 'block';
  document.getElementById('dot-' + gIdx).dataset.result  = 'skip';
  document.getElementById('btnNext').disabled   = false;
  document.getElementById('btnReveal').disabled = true;
  gSkip++;
  document.getElementById('gScoreSkip').textContent = gSkip;
  updateDots();
}

/* =====================================================
   6. GAME FLOW
   ===================================================== */
function showCurrentClue() {
  if (gIdx >= CLUES.length) { gameEnd(); return; }
  const c = CLUES[gIdx];
  document.getElementById('centerLetter').textContent = c.letter;
  document.getElementById('clueText').innerHTML = highlightRelativePronouns(c.clue);
  document.getElementById('solutionReveal').style.display = 'none';
  document.getElementById('timeoutMsg').style.display     = 'none';
  document.getElementById('btnNext').disabled    = true;
  document.getElementById('gScoreIdx').textContent = gIdx + 1;
  gRevealed = false;
  updateDots();
}

function gameStart() {
  if (gRunning) return;
  gRunning = true;
  gIdx = 0; gCorrect = 0; gSkip = 0; gRevealed = false;
  CLUES.forEach((_, i) => {
    const d = document.getElementById('dot-' + i);
    if (d) { d.dataset.result = ''; d.className = 'letter-dot'; }
  });
  document.getElementById('btnStart').disabled  = true;
  document.getElementById('btnReveal').disabled = false;
  showCurrentClue();
  startTimer();
}

function gameReveal() {
  if (!gRunning || gRevealed) return;
  gRevealed = true;
  stopTimer();
  document.getElementById('solutionReveal').textContent  = CLUES[gIdx].word.toUpperCase();
  document.getElementById('solutionReveal').style.display = 'block';
  document.getElementById('btnReveal').disabled = true;
  document.getElementById('btnNext').disabled   = false;
  document.getElementById('dot-' + gIdx).dataset.result = 'correct';
  gCorrect++;
  document.getElementById('gScoreCorrect').textContent = gCorrect;
  updateDots();
}

function gameNext() {
  if (!gRevealed) return;
  gIdx++;
  document.getElementById('btnReveal').disabled = false;
  showCurrentClue();
  if (gIdx < CLUES.length) startTimer();
}

function gameRestart() {
  stopTimer();
  gIdx = 0; gCorrect = 0; gSkip = 0;
  gRunning = false; gRevealed = false;

  CLUES.forEach((_, i) => {
    const d = document.getElementById('dot-' + i);
    if (d) { d.dataset.result = ''; d.className = 'letter-dot'; }
  });

  document.getElementById('clueText').innerHTML = 'Press <strong style="color:var(--teal)">START</strong> to begin the game!';
  document.getElementById('solutionReveal').style.display  = 'none';
  document.getElementById('timeoutMsg').style.display      = 'none';
  document.getElementById('centerLetter').textContent      = 'A–Z';
  document.getElementById('timerNum').textContent          = '22';
  document.getElementById('timerArc').style.strokeDashoffset = '0';
  document.getElementById('timerArc').className = 'timer-arc';
  document.getElementById('timerNum').className = 'timer-number';
  document.getElementById('gScoreCorrect').textContent = '0';
  document.getElementById('gScoreSkip').textContent    = '0';
  document.getElementById('gScoreIdx').textContent     = '—';
  document.getElementById('btnStart').disabled   = false;
  document.getElementById('btnReveal').disabled  = true;
  document.getElementById('btnNext').disabled    = true;
  updateDots();
}

function gameEnd() {
  gRunning = false;
  document.getElementById('clueText').innerHTML =
    '🎉 <strong style="color:var(--teal)">Game complete!</strong><br>' +
    `<span style="font-size:14px;color:rgba(255,255,255,.7)">Words guessed: <strong style="color:#7dffc0">${gCorrect}</strong> / 26</span>`;
  document.getElementById('centerLetter').textContent = '✓';
  document.getElementById('btnReveal').disabled = true;
  document.getElementById('btnNext').disabled   = true;
  updateDots();
}

/* =====================================================
   7. EDITOR — BUILD TABLE
   ===================================================== */
function buildEditorTable() {
  const tbody = document.getElementById('editorTbody');
  tbody.innerHTML = '';

  DEFAULT_CLUES.forEach((def, i) => {
    const tr = document.createElement('tr');
    tr.id = 'erow-' + i;

    // Letter
    const tdL = document.createElement('td');
    tdL.className   = 'letter-cell';
    tdL.textContent = def.letter;
    tr.appendChild(tdL);

    // Word input
    const tdW   = document.createElement('td');
    const wInp  = document.createElement('input');
    wInp.type        = 'text';
    wInp.className   = 'editor-input';
    wInp.id          = 'ei-word-' + i;
    wInp.placeholder = def.word + ' (default)';
    wInp.maxLength   = 40;
    wInp.addEventListener('input', () => updateRowStatus(i));
    tdW.appendChild(wInp);
    tr.appendChild(tdW);

    // Definition input + preview
    const tdD   = document.createElement('td');
    tdD.className   = 'def-cell';
    const wrap  = document.createElement('div');
    wrap.className  = 'def-input-wrap';
    const dInp  = document.createElement('input');
    dInp.type        = 'text';
    dInp.className   = 'editor-input';
    dInp.id          = 'ei-def-' + i;
    dInp.placeholder = def.clue.substring(0, 55) + '…';
    dInp.maxLength   = 200;
    const preview = document.createElement('div');
    preview.className = 'def-preview';
    preview.id        = 'ei-preview-' + i;

    dInp.addEventListener('input', () => {
      updateRowStatus(i);
      const val = dInp.value.trim();
      if (val) { preview.innerHTML = highlightRelativePronouns(val); preview.style.display = 'block'; }
      else       { preview.style.display = 'none'; }
    });

    wrap.appendChild(dInp);
    wrap.appendChild(preview);
    tdD.appendChild(wrap);
    tr.appendChild(tdD);

    // Status badge
    const tdS   = document.createElement('td');
    tdS.className   = 'status-cell';
    const badge = document.createElement('span');
    badge.className = 'status-badge default';
    badge.id        = 'ei-status-' + i;
    badge.textContent = 'default';
    tdS.appendChild(badge);
    tr.appendChild(tdS);

    tbody.appendChild(tr);
  });
}

function updateRowStatus(i) {
  const wVal  = document.getElementById('ei-word-' + i).value.trim();
  const dVal  = document.getElementById('ei-def-'  + i).value.trim();
  const badge = document.getElementById('ei-status-' + i);
  if (wVal || dVal) {
    badge.className   = 'status-badge custom';
    badge.textContent = 'custom ✓';
  } else {
    badge.className   = 'status-badge default';
    badge.textContent = 'default';
  }
}

/* =====================================================
   8. GENERATE CUSTOM WHEEL
   ===================================================== */
function generateCustomWheel() {
  CLUES = DEFAULT_CLUES.map((def, i) => {
    const wVal = document.getElementById('ei-word-' + i)?.value.trim();
    const dVal = document.getElementById('ei-def-'  + i)?.value.trim();
    return { letter: def.letter, word: wVal || def.word, clue: dVal || def.clue };
  });
  buildWheel();
  gameRestart();
  showToast('✓ Custom wheel generated! Head to Play Game to start.');
}

/* =====================================================
   9. CLEAR CUSTOM WHEEL
   ===================================================== */
function clearCustomWheel() {
  DEFAULT_CLUES.forEach((_, i) => {
    document.getElementById('ei-word-' + i).value = '';
    document.getElementById('ei-def-'  + i).value = '';
    const preview = document.getElementById('ei-preview-' + i);
    if (preview) preview.style.display = 'none';
    updateRowStatus(i);
  });
  CLUES = DEFAULT_CLUES.map(c => ({ ...c }));
  applyPalette('teal');
  buildWheel();
  gameRestart();
  showToast('↺ Restored to default wheel.');
}

/* =====================================================
   10. TAB SWITCHING
   ===================================================== */
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
  if (name === 'library' && currentUser) loadLibrary();
}

/* =====================================================
   11. TOAST
   ===================================================== */
let toastTimer = null;
function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast' + (isError ? ' error' : '');
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
}

/* =====================================================
   12. INIT
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  buildColorStrip();
  applyPalette('teal');
  buildWheel();
  updateDots();
  updateEditorGate();
});

// Rebuild dots on resize
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(buildWheel, 150);
});