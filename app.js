
// ========== UTIL & STATE ==========
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const storage = {
  get(k, fallback){ try{return JSON.parse(localStorage.getItem(k)) ?? fallback} catch{ return fallback }},
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); },
  del(k){ localStorage.removeItem(k); }
};

const state = {
  library: storage.get('bgh.library', []),
  tables: storage.get('bgh.tables', []),
  settings: storage.get('bgh.settings', { theme:'system', ai:{ endpoint:'', key:'', model:'gpt-4o-mini' } }),
  recentTables: storage.get('bgh.recent', []),
  turns: storage.get('bgh.turns', { order:[], currentIndex:-1 }),
  victoryNotes: storage.get('bgh.victory', ''),
  assistantNotes: storage.get('bgh.assistantNotes', {}),
};

function saveAll(){
  storage.set('bgh.library', state.library);
  storage.set('bgh.tables', state.tables);
  storage.set('bgh.settings', state.settings);
  storage.set('bgh.recent', state.recentTables);
  storage.set('bgh.turns', state.turns);
  storage.set('bgh.victory', state.victoryNotes);
  storage.set('bgh.assistantNotes', state.assistantNotes);
}

// ========== THEME & NAV ==========
function applyTheme(){
  document.documentElement.classList.remove('theme-light','theme-dim','theme-solar');
  const t = state.settings.theme || 'system';
  if(t==='light') document.documentElement.classList.add('theme-light');
  if(t==='dim') document.documentElement.classList.add('theme-dim');
  if(t==='solar') document.documentElement.classList.add('theme-solar');
}
applyTheme();

$('#year').textContent = new Date().getFullYear();

$$('.tab').forEach(btn => btn.addEventListener('click', ()=>{
  $$('.tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const id = btn.dataset.tab;
  $$('.view').forEach(v=>v.classList.remove('active'));
  $('#'+id).classList.add('active');
}));

$('#go-scorekeeper')?.addEventListener('click', ()=>{
  $('[data-tab="scorekeeper"]').click();
});

// ========== DASHBOARD POPULATE ==========
function refreshDashboard(){
  const sel = $('#dashboardGameSelect');
  sel.innerHTML = state.library.map(g=>`<option value="${g.id}">${g.name}</option>`).join('') || '<option value="">No games yet</option>';
  const recentUl = $('#recentTables');
  recentUl.innerHTML = state.recentTables.slice(-5).reverse().map(t=>`<li>${t.name} — ${new Date(t.date).toLocaleString()}</li>`).join('') || '<li>No recent tables</li>';
}
refreshDashboard();

$('#open-game-notes')?.addEventListener('click', ()=>{
  const id = $('#dashboardGameSelect').value;
  if(!id) return alert('No game selected');
  $('[data-tab="library"]').click();
  const card = document.querySelector(`[data-game-id="${id}"]`);
  if(card){ card.scrollIntoView({behavior:'smooth', block:'center'}); card.classList.add('pulse'); setTimeout(()=>card.classList.remove('pulse'), 1200); }
});

$('#ask-game-ai')?.addEventListener('click', ()=>{
  $('[data-tab="assistant"]').click();
  $('#assistantGame').value = $('#dashboardGameSelect').value || '';
});

// ========== SCOREKEEPER ==========
const defaultTable = () => ({ id: crypto.randomUUID(), name:'New Table', created: Date.now(), rows: [], rounds: [], history: [] });

let currentTable = state.tables[0] || defaultTable();
if(state.tables.length === 0){ state.tables.push(currentTable); saveAll(); }

function renderScoreTable(){
  $('#tableName').value = currentTable.name;
  const grid = $('#scoreGrid');
  const headers = ['Player/Team', ...currentTable.rounds.map((r,i)=>`R${i+1}`), 'Total', 'Actions'];
  const rows = currentTable.rows;
  const table = document.createElement('table');
  table.className='score-table';
  table.innerHTML = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody></tbody>`;
  const tbody = table.querySelector('tbody');
  rows.forEach((row, idx)=>{
    const total = row.scores.reduce((a,b)=>a+(b||0),0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input data-row="${idx}" class="name" value="${row.name}"></td>
      ${currentTable.rounds.map((_,i)=>`<td><input data-row="${idx}" data-col="${i}" class="score" type="number" value="${row.scores[i] ?? ''}"></td>`).join('')}
      <td class="total">${total}</td>
      <td>
        <button class="btn" data-act="add" data-idx="${idx}">+ Round</button>
        <button class="btn" data-act="del" data-idx="${idx}">Remove</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  grid.innerHTML = '';
  grid.appendChild(table);

  // wire inputs
  $$('.name', grid).forEach(inp=> inp.addEventListener('input', e=>{
    const r = +e.target.dataset.row;
    currentTable.rows[r].name = e.target.value;
    pushHistory(`Rename row ${r+1} to "${e.target.value}"`);
    saveAll();
  }));

  $$('.score', grid).forEach(inp=> inp.addEventListener('input', e=>{
    const r = +e.target.dataset.row, c = +e.target.dataset.col;
    currentTable.rows[r].scores[c] = parseInt(e.target.value || 0, 10);
    pushHistory(`Set R${c+1} — ${currentTable.rows[r].name}: ${e.target.value}`);
    saveAll();
    renderScoreTable();
  }));

  $$('button[data-act="add"]', grid).forEach(b=> b.addEventListener('click', e=>{
    const idx = +e.target.dataset.idx;
    ensureRounds(currentTable.rounds.length+1);
    currentTable.rows[idx].scores.push(0);
    pushHistory(`Add round for ${currentTable.rows[idx].name}`);
    saveAll();
    renderScoreTable();
  }));

  $$('button[data-act="del"]', grid).forEach(b=> b.addEventListener('click', e=>{
    const idx = +e.target.dataset.idx;
    pushHistory(`Remove row ${currentTable.rows[idx].name}`);
    currentTable.rows.splice(idx,1);
    saveAll();
    renderScoreTable();
  }));

  $('#historyLog').textContent = currentTable.history.slice(-100).join('\n');
}

function pushHistory(line){
  currentTable.history.push(`[${new Date().toLocaleTimeString()}] ${line}`);
}

function ensureRounds(n){
  while(currentTable.rounds.length < n){ currentTable.rounds.push({}); }
  currentTable.rows.forEach(r=>{
    while(r.scores.length < currentTable.rounds.length) r.scores.push(0);
  });
}

$('#tableName').addEventListener('input', e=>{
  currentTable.name = e.target.value;
  saveAll();
});

$('#addPlayer').addEventListener('click', ()=>{
  currentTable.rows.push({ name:`Player ${currentTable.rows.length+1}`, scores: Array(currentTable.rounds.length).fill(0) });
  pushHistory('Add player');
  saveAll();
  renderScoreTable();
});
$('#addTeam').addEventListener('click', ()=>{
  currentTable.rows.push({ name:`Team ${currentTable.rows.length+1}`, scores: Array(currentTable.rounds.length).fill(0) });
  pushHistory('Add team');
  saveAll();
  renderScoreTable();
});
$('#newRound').addEventListener('click', ()=>{
  ensureRounds(currentTable.rounds.length+1);
  pushHistory('New round added');
  saveAll();
  renderScoreTable();
});
$('#undo').addEventListener('click', ()=>{
  // very simple undo: pop last history and revert last change snapshot if any
  // keep snapshots lightweight
  alert('Tip: Export often. Undo is limited in this version.');
});
$('#exportTable').addEventListener('click', ()=>{
  const data = JSON.stringify(currentTable, null, 2);
  download('table.json', data);
  state.recentTables.push({name: currentTable.name, date: Date.now()});
  saveAll();
  refreshDashboard();
});
$('#importTable').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  try{
    const obj = JSON.parse(text);
    currentTable = obj;
    const idx = state.tables.findIndex(t=>t.id===obj.id);
    if(idx>-1) state.tables[idx]=obj; else state.tables.push(obj);
    saveAll();
    renderScoreTable();
  } catch(err){ alert('Invalid table file'); }
});

renderScoreTable();

// ========== TURNS & TIMER ==========
function renderTurnList(){
  const ol = $('#turnOrder');
  ol.innerHTML = state.turns.order.map(n=>`<li>${n}</li>`).join('') || '<li class="muted">Add players to begin</li>';
  $('#currentTurn').textContent = state.turns.order[state.turns.currentIndex] ?? 'No players yet';
}
$('#addTurnPlayer').addEventListener('click', ()=>{
  const name = $('#turnPlayerName').value.trim();
  if(!name) return;
  state.turns.order.push(name);
  if(state.turns.currentIndex===-1) state.turns.currentIndex = 0;
  $('#turnPlayerName').value='';
  saveAll(); renderTurnList();
});
$('#clearTurnOrder').addEventListener('click', ()=>{
  state.turns.order = []; state.turns.currentIndex=-1; saveAll(); renderTurnList();
});
$('#nextTurn').addEventListener('click', ()=>{
  if(state.turns.order.length===0) return;
  state.turns.currentIndex = (state.turns.currentIndex+1) % state.turns.order.length;
  saveAll(); renderTurnList();
});
renderTurnList();

let timerInterval=null, remaining=120, isRunning=false;
function updateTimeDisplay(){
  const m = String(Math.floor(remaining/60)).padStart(2,'0');
  const s = String(remaining%60).padStart(2,'0');
  $('#timeDisplay').textContent = `${m}:${s}`;
}
function setFromInputs(){
  remaining = (parseInt($('#timerMinutes').value||0)*60) + parseInt($('#timerSeconds').value||0);
  updateTimeDisplay();
}
setFromInputs();
$('#timerMinutes').addEventListener('input', setFromInputs);
$('#timerSeconds').addEventListener('input', setFromInputs);
$('#startTimer').addEventListener('click', ()=>{
  if(isRunning) return;
  isRunning=true;
  timerInterval=setInterval(()=>{
    remaining--;
    if(remaining<=0){ remaining=0; clearInterval(timerInterval); isRunning=false; if($('#soundToggle').checked){ $('#beep').play(); } }
    updateTimeDisplay();
  },1000);
});
$('#pauseTimer').addEventListener('click', ()=>{ clearInterval(timerInterval); isRunning=false; });
$('#resetTimer').addEventListener('click', ()=>{ clearInterval(timerInterval); isRunning=false; setFromInputs(); });

$('#saveVictoryNotes').addEventListener('click', ()=>{
  state.victoryNotes = $('#victoryNotes').value;
  saveAll();
  alert('Saved.');
});
$('#victoryNotes').value = state.victoryNotes || '';

// ========== TOOLS ==========
$('#rollDice').addEventListener('click', ()=>{
  const sides = Math.max(2, parseInt($('#diceSides').value||6));
  const count = Math.max(1, parseInt($('#diceCount').value||1));
  const rolls = Array.from({length:count}, ()=> 1 + Math.floor(Math.random()*sides));
  $('#diceResults').textContent = `Rolls: ${rolls.join(', ')}  |  Sum: ${rolls.reduce((a,b)=>a+b,0)}`;
});
$('#flipCoin').addEventListener('click', ()=>{
  $('#coinResult').textContent = Math.random()<0.5 ? 'Heads' : 'Tails';
});
let deck=[], discards=[];
function makeDeck(){
  const suits = ['♠','♥','♦','♣'], ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  deck = [];
  suits.forEach(s=> ranks.forEach(r=> deck.push(`${r}${s}`)));
  discards=[];
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }
$('#newDeck').addEventListener('click', ()=>{ makeDeck(); $('#cardResult').textContent='New deck ready.'; });
$('#shuffleDeck').addEventListener('click', ()=>{ shuffle(deck); $('#cardResult').textContent='Shuffled.'; });
$('#drawCard').addEventListener('click', ()=>{
  if(deck.length===0) return $('#cardResult').textContent='Deck empty.';
  const c = deck.pop(); discards.push(c); $('#cardResult').textContent = c + ` (${deck.length} left)`;
});
makeDeck();

// ========== LIBRARY ==========
function renderLibrary(list=state.library){
  const q = $('#librarySearch').value?.toLowerCase().trim();
  const filtered = list.filter(g=> !q || g.name.toLowerCase().includes(q) || (g.tags||'').toLowerCase().includes(q));
  const wrap = $('#gameList');
  wrap.innerHTML = filtered.map(g=>`
    <article class="card game" data-game-id="${g.id}">
      <header style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <h3>${g.name}</h3>
        <div class="actions">
          <button class="btn" data-edit="${g.id}">Edit</button>
          <button class="btn" data-del="${g.id}">Delete</button>
        </div>
      </header>
      <p class="muted">${g.minPlayers}-${g.maxPlayers} players • ~${g.playtime} min • ${g.tags || 'no tags'}</p>
      ${g.link ? `<p><a href="${g.link}" target="_blank" rel="noopener">Rules</a></p>` : ''}
      ${g.notes ? `<details><summary>Notes</summary><p>${escapeHtml(g.notes)}</p></details>` : ''}
      <div class="actions">
        <button class="btn" data-use="${g.id}">Use in Scorekeeper</button>
        <button class="btn" data-ai="${g.id}">Ask AI about ${g.name}</button>
      </div>
    </article>
  `).join('') || '<p class="muted">No games yet.</p>';

  // wire buttons
  $$('[data-edit]').forEach(b=> b.addEventListener('click', ()=> openGameDialog(b.dataset.edit)));
  $$('[data-del]').forEach(b=> b.addEventListener('click', ()=> {
    const id=b.dataset.del;
    if(confirm('Delete this game?')){
      const i=state.library.findIndex(x=>x.id===id);
      if(i>-1) state.library.splice(i,1);
      saveAll(); renderLibrary(); refreshDashboard(); refreshAssistantGameSelect();
    }
  }));
  $$('[data-use]').forEach(b=> b.addEventListener('click', ()=>{
    currentTable = defaultTable();
    currentTable.name = state.library.find(x=>x.id===b.dataset.use)?.name + ' — New Table';
    state.tables.push(currentTable); saveAll(); renderScoreTable();
    $('[data-tab="scorekeeper"]').click();
  }));
  $$('[data-ai]').forEach(b=> b.addEventListener('click', ()=>{
    $('#assistantGame').value = b.dataset.ai;
    $('[data-tab="assistant"]').click();
  }));
}
function escapeHtml(str){ return str.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])); }

function openGameDialog(id){
  const dlg = $('#gameDialog');
  const form = $('#gameForm');
  form.reset();
  const isEdit = !!id;
  if(isEdit){
    const g = state.library.find(x=>x.id===id);
    form.name.value = g.name;
    form.minPlayers.value = g.minPlayers;
    form.maxPlayers.value = g.maxPlayers;
    form.playtime.value = g.playtime;
    form.tags.value = g.tags || '';
    form.link.value = g.link || '';
    form.notes.value = g.notes || '';
  }
  dlg.showModal();
  form.onsubmit = (e)=>{
    e.preventDefault();
    const g = {
      id: isEdit ? id : crypto.randomUUID(),
      name: form.name.value.trim(),
      minPlayers: parseInt(form.minPlayers.value||1),
      maxPlayers: parseInt(form.maxPlayers.value||4),
      playtime: parseInt(form.playtime.value||60),
      tags: form.tags.value.trim(),
      link: form.link.value.trim(),
      notes: form.notes.value.trim(),
    };
    if(isEdit){
      const i=state.library.findIndex(x=>x.id===id);
      state.library[i]=g;
    } else {
      state.library.push(g);
    }
    saveAll(); dlg.close(); renderLibrary(); refreshDashboard(); refreshAssistantGameSelect();
  };
}

$('#addGame').addEventListener('click', ()=> openGameDialog(null));
$('#exportLibrary').addEventListener('click', ()=> download('library.json', JSON.stringify(state.library, null, 2)));
$('#importLibrary').addEventListener('change', async (e)=>{
  const f=e.target.files[0]; if(!f) return;
  try{ const arr = JSON.parse(await f.text()); state.library = arr; saveAll(); renderLibrary(); refreshDashboard(); refreshAssistantGameSelect(); }
  catch{ alert('Invalid library file'); }
});
$('#librarySearch').addEventListener('input', ()=> renderLibrary());
renderLibrary();

// ========== ASSISTANT ==========
function refreshAssistantGameSelect(){
  const sel = $('#assistantGame');
  sel.innerHTML = '<option value="">(no game)</option>' + state.library.map(g=>`<option value="${g.id}">${g.name}</option>`).join('');
}
refreshAssistantGameSelect();

function appendChat(role, content){
  const box = $('#chatBox');
  const div = document.createElement('div');
  div.className = 'bubble ' + role;
  div.innerHTML = `<div class="role">${role==='user'?'You':'Assistant'}</div><div class="content">${escapeHtml(content)}</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

$('#sendChat').addEventListener('click', async ()=>{
  const q = $('#chatInput').value.trim();
  if(!q) return;
  const gameId = $('#assistantGame').value;
  $('#chatInput').value='';
  appendChat('user', q);

  const notes = state.assistantNotes[gameId] || '';
  const game = state.library.find(x=>x.id===gameId);
  const gameName = game?.name || 'this game';

  const endpoint = state.settings.ai?.endpoint;
  const key = state.settings.ai?.key;
  const model = state.settings.ai?.model || 'gpt-4o-mini';

  if(endpoint && key){
    try{
      const res = await fetch(endpoint, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages:[
            { role:'system', content:`You are a helpful board game rules and strategy assistant. If a rules link is provided, use it. Keep answers concise and cite rule sections if available.`},
            { role:'user', content:`Game: ${gameName}\nNotes:\n${notes}\nQuestion: ${q}` }
          ]
        })
      });
      if(!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const answer = data.choices?.[0]?.message?.content || 'No response';
      appendChat('assistant', answer);
    }catch(err){
      appendChat('assistant', 'Proxy/API error: '+ String(err));
    }
  } else {
    // Local lightweight answer using notes and fuzzy search
    const hint = notes ? summarizeNotesFor(q, notes) : `No notes saved for ${gameName}. Add notes on the right.`;
    appendChat('assistant', hint);
  }
});

function summarizeNotesFor(q, notes){
  // Very naive: find sentences containing any keywords
  const kws = q.toLowerCase().split(/\W+/).filter(Boolean);
  const sentences = notes.split(/\.(\s|$)/).map(s=>s.trim()).filter(Boolean);
  const hits = sentences.filter(s=> kws.some(k=> s.toLowerCase().includes(k)) ).slice(0,4);
  if(hits.length)
    return hits.join('. ') + '.';
  return 'I could not find anything in your notes. Try adding rules excerpts or configure an AI proxy in Settings.';
}

$('#saveAssistantNotes').addEventListener('click', ()=>{
  const id = $('#assistantGame').value || '_global';
  state.assistantNotes[id] = $('#assistantNotes').value;
  saveAll();
  alert('Notes saved.');
});
$('#assistantGame').addEventListener('change', ()=>{
  const id = $('#assistantGame').value || '_global';
  $('#assistantNotes').value = state.assistantNotes[id] || '';
});

// ========== SETTINGS & BACKUP ==========
$('#themeSelect').value = state.settings.theme || 'system';
$('#themeSelect').addEventListener('change', e=>{
  state.settings.theme = e.target.value; saveAll(); applyTheme();
});

$('#aiEndpoint').value = state.settings.ai?.endpoint || '';
$('#aiKey').value = state.settings.ai?.key || '';
$('#aiModel').value = state.settings.ai?.model || 'gpt-4o-mini';
$('#saveAI').addEventListener('click', ()=>{
  state.settings.ai = {
    endpoint: $('#aiEndpoint').value.trim(),
    key: $('#aiKey').value.trim(),
    model: $('#aiModel').value.trim()
  };
  saveAll(); alert('AI settings saved (locally).');
});
$('#testAI').addEventListener('click', async ()=>{
  if(!state.settings.ai?.endpoint || !state.settings.ai?.key) return alert('Set endpoint & key first.');
  $('#chatInput').value = 'Test: hello!';
  $('#sendChat').click();
});

$('#exportAll').addEventListener('click', ()=>{
  const data = JSON.stringify(state, null, 2);
  download('boardgame-helper-backup.json', data);
});
$('#importAll').addEventListener('change', async (e)=>{
  const f=e.target.files[0]; if(!f) return;
  try{ const obj = JSON.parse(await f.text()); Object.assign(state, obj); saveAll(); location.reload(); }
  catch{ alert('Invalid backup file'); }
});
$('#wipeAll').addEventListener('click', ()=>{
  if(confirm('This clears local data (library, tables, notes). Continue?')){
    localStorage.clear(); location.reload();
  }
});

// ========== HELPERS ==========
function download(filename, text) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

// seed demo data if empty
if(state.library.length===0){
  state.library = [
    { id: crypto.randomUUID(), name:'Terraforming Mars', minPlayers:1, maxPlayers:5, playtime:120, tags:'engine-building, drafting', link:'', notes:'Corporations draft. Tile placement adjacency bonuses. Milestones and Awards scoring.'},
    { id: crypto.randomUUID(), name:'Wingspan', minPlayers:1, maxPlayers:5, playtime:60, tags:'engine-building, card-drafting', link:'', notes:'Bonus cards matter. Food economy early; eggs later. End-of-round goals can swing 5-8 points.'},
  ];
  saveAll(); renderLibrary(); refreshDashboard(); refreshAssistantGameSelect();
}

// accessibility helpers
document.addEventListener('keydown', (e)=>{
  if(e.key==='/' && document.activeElement.tagName!=='INPUT' && document.activeElement.tagName!=='TEXTAREA'){
    e.preventDefault(); $('#librarySearch').focus();
  }
});

// ========== END APP ==========
