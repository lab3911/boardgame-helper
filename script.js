// Pro script: working dice (with speech), seating/score system, and BGG collection loader.

const STORAGE = "bg_helper_pro_v2";

function loadState(){
  try{ const s = localStorage.getItem(STORAGE); return s? JSON.parse(s) : null; } catch(e){ return null; }
}
function saveState(state){
  try{ localStorage.setItem(STORAGE, JSON.stringify(state)); } catch(e){}
}

// Initialize state
let state = loadState() || {
  players: [{name:"Player 1",score:0},{name:"Player 2",score:0},{name:"Player 3",score:0},{name:"Player 4",score:0}],
  seating: [],
  rollHistory: []
};

// --- DICE ---
const diceBtns = document.querySelectorAll(".die-btn");
const diceBig = document.getElementById("diceBig");
const rollHistory = document.getElementById("rollHistory");
const speakToggle = document.getElementById("speakToggle");
const clearHistoryBtn = document.getElementById("clearHistory");

function speak(text){
  try{
    if(!speakToggle.checked) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch(e){ console.warn("Speech not available", e); }
}

function addRollToHistory(sides, val){
  const ts = new Date().toLocaleTimeString();
  const txt = `${ts} — d${sides}: ${val}`;
  state.rollHistory.unshift(txt);
  // limit to 80
  if(state.rollHistory.length>80) state.rollHistory.length = 80;
  saveState(state);
  renderRollHistory();
}

function renderRollHistory(){
  rollHistory.innerHTML = "";
  state.rollHistory.forEach(r => {
    const li = document.createElement("li");
    li.textContent = r;
    rollHistory.appendChild(li);
  });
}

function animateDiceShow(sides, value){
  diceBig.classList.add("animate");
  diceBig.textContent = `d${sides}: ${value}`;
  // small pulse
  setTimeout(()=> diceBig.classList.remove("animate"), 700);
}

function rollDie(sides){
  // playful animation before result
  diceBig.textContent = "Rolling…";
  // quick "dice rolling" animation visualized by dots
  let dots = 0;
  const intv = setInterval(()=>{
    diceBig.textContent = "Rolling" + ".".repeat(dots%4);
    dots++;
  }, 90);
  setTimeout(()=>{
    clearInterval(intv);
    const val = Math.floor(Math.random()*sides) + 1;
    animateDiceShow(sides, val);
    addRollToHistory(sides, val);
    speak(`Rolled a d ${sides}: ${val}`);
  }, 650);
}

diceBtns.forEach(b=> b.addEventListener("click", ()=> rollDie(Number(b.dataset.die))));
clearHistoryBtn.addEventListener("click", ()=>{ state.rollHistory = []; saveState(state); renderRollHistory(); diceBig.textContent = "—"; });

// --- Seating & Scores ---
const numPlayersInput = document.getElementById("numPlayers");
const nameInputs = document.getElementById("nameInputs");
const manualPositions = document.getElementById("manualPositions");
const seatingList = document.getElementById("seatingList");
const addPlayerBtn = document.getElementById("addPlayer");
const resetPlayersBtn = document.getElementById("resetPlayers");
const randomizeBtn = document.getElementById("randomize");
const applyManualBtn = document.getElementById("applyManual");
const copyOrderBtn = document.getElementById("copyOrder");
const resetScoresBtn = document.getElementById("resetScores");

function ensurePlayers(n){
  if(n < 2) n = 2;
  if(n > 7) n = 7;
  while(state.players.length < n) state.players.push({name:`Player ${state.players.length+1}`, score:0});
  if(state.players.length > n) state.players = state.players.slice(0,n);
  saveState(state);
}

function renderNameInputs(){
  nameInputs.innerHTML = "";
  for(let i=0;i<state.players.length;i++){
    const p = state.players[i];
    const div = document.createElement("div");
    const input = document.createElement("input");
    input.value = p.name;
    input.addEventListener("input", ()=>{ state.players[i].name = input.value || `Player ${i+1}`; saveState(state); renderSeating(); renderManualPositions(); });
    div.appendChild(input);
    nameInputs.appendChild(div);
  }
  numPlayersInput.value = state.players.length;
}

function renderManualPositions(){
  manualPositions.innerHTML = "";
  for(let pos=1; pos<=7; pos++){
    const selWrap = document.createElement("div");
    const label = document.createElement("label");
    label.textContent = `#${pos}`;
    const sel = document.createElement("select");
    const noneOpt = document.createElement("option");
    noneOpt.value = ""; noneOpt.textContent = "(empty)";
    sel.appendChild(noneOpt);
    state.players.forEach((p, idx)=>{
      const o = document.createElement("option");
      o.value = idx;
      o.textContent = p.name;
      sel.appendChild(o);
    });
    selWrap.appendChild(label);
    selWrap.appendChild(sel);
    manualPositions.appendChild(selWrap);
  }
}

function renderSeating(){
  seatingList.innerHTML = "";
  // if seating not set, default to players order
  if(!state.seating || state.seating.length !== state.players.length){
    state.seating = state.players.map((_,i)=>i);
  }
  state.seating.forEach((pidx, seat)=>{
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.index = seat;
    const posDiv = document.createElement("div"); posDiv.className = "seat-pos"; posDiv.textContent = `${seat+1}`;
    const nameDiv = document.createElement("div"); nameDiv.className = "player-name"; nameDiv.contentEditable = false;
    nameDiv.textContent = state.players[pidx].name;
    const scoreBox = document.createElement("div"); scoreBox.className = "score-box";
    const minus = document.createElement("button"); minus.textContent = "−";
    const scoreVal = document.createElement("div"); scoreVal.className = "score-value"; scoreVal.textContent = state.players[pidx].score;
    const plus = document.createElement("button"); plus.textContent = "+";
    const setInp = document.createElement("input"); setInp.type="number"; setInp.value = state.players[pidx].score; setInp.style.width="70px";
    minus.addEventListener("click", ()=>{ state.players[pidx].score = Number(state.players[pidx].score||0) - 1; saveState(state); renderSeating(); });
    plus.addEventListener("click", ()=>{ state.players[pidx].score = Number(state.players[pidx].score||0) + 1; saveState(state); renderSeating(); });
    setInp.addEventListener("change", ()=>{ state.players[pidx].score = Number(setInp.value||0); saveState(state); renderSeating(); });
    scoreBox.appendChild(minus); scoreBox.appendChild(scoreVal); scoreBox.appendChild(plus); scoreBox.appendChild(setInp);

    // edit name inline
    nameDiv.addEventListener("dblclick", ()=>{
      const newName = prompt("Edit player name", nameDiv.textContent);
      if(newName !== null){ state.players[pidx].name = newName || `Player ${pidx+1}`; saveState(state); renderNameInputs(); renderManualPositions(); renderSeating(); }
    });

    // remove (if more than 2 players)
    const rem = document.createElement("button"); rem.textContent = "Remove";
    rem.addEventListener("click", ()=>{
      if(state.players.length <= 2) { alert("At least 2 players required."); return; }
      // remove player and adjust seating indices
      state.players.splice(pidx,1);
      state.seating = state.seating.map(i=> i === pidx ? null : (i>pidx? i-1 : i)).filter(i=> i!==null);
      saveState(state); renderAll();
    });

    li.appendChild(posDiv); li.appendChild(nameDiv); li.appendChild(scoreBox); li.appendChild(rem);

    // drag events
    li.addEventListener("dragstart", (e)=>{ e.dataTransfer.setData("text/plain", li.dataset.index); li.classList.add("dragging"); });
    li.addEventListener("dragend", ()=> li.classList.remove("dragging"));
    li.addEventListener("dragover", (e)=>{ e.preventDefault(); li.classList.add("drag-over"); });
    li.addEventListener("dragleave", ()=> li.classList.remove("drag-over"));
    li.addEventListener("drop", (e)=>{
      e.preventDefault(); const from = Number(e.dataTransfer.getData("text/plain")); const to = Number(li.dataset.index);
      if(from === to) return;
      // reorder seating array
      const arr = state.seating.slice();
      const [m] = arr.splice(from,1);
      arr.splice(to,0,m);
      state.seating = arr;
      saveState(state); renderSeating();
    });

    seatingList.appendChild(li);
  });
}

function renderAll(){
  ensurePlayers(Number(numPlayersInput.value || state.players.length));
  renderNameInputs();
  renderManualPositions();
  renderSeating();
  renderRollHistory();
}

numPlayersInput.addEventListener("change", ()=>{
  let n = Number(numPlayersInput.value);
  if(isNaN(n) || n<2) n = 2;
  if(n>7) n = 7;
  numPlayersInput.value = n;
  ensurePlayers(n);
  state.seating = state.players.map((_,i)=>i);
  saveState(state);
  renderAll();
});
addPlayerBtn.addEventListener("click", ()=>{
  if(state.players.length >= 7) return;
  state.players.push({name:`Player ${state.players.length+1}`, score:0});
  numPlayersInput.value = state.players.length;
  state.seating = state.players.map((_,i)=>i);
  saveState(state); renderAll();
});
resetPlayersBtn.addEventListener("click", ()=>{
  if(confirm("Reset players and scores to default 4 players?")) {
    state.players = [{name:"Player 1",score:0},{name:"Player 2",score:0},{name:"Player 3",score:0},{name:"Player 4",score:0}];
    state.seating = state.players.map((_,i)=>i);
    saveState(state); renderAll();
  }
});
randomizeBtn.addEventListener("click", ()=>{
  // shuffle seating indices
  const arr = state.players.map((_,i)=>i);
  for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
  state.seating = arr; saveState(state); renderSeating();
});
applyManualBtn.addEventListener("click", ()=>{
  // read select elements in manualPositions and build seating
  const selects = manualPositions.querySelectorAll("select");
  const chosen = [];
  selects.forEach(s=>{ if(s.value !== "") chosen.push(Number(s.value)); });
  // remove duplicates and ensure we include rest of players in original order
  const unique = [...new Set(chosen)];
  const remaining = state.players.map((_,i)=>i).filter(i=> !unique.includes(i));
  state.seating = unique.concat(remaining).slice(0, state.players.length);
  saveState(state); renderSeating();
});
copyOrderBtn.addEventListener("click", async ()=>{
  const lines = state.seating.map((pidx, i)=> `${i+1}. ${state.players[pidx].name} — ${state.players[pidx].score}`);
  const text = lines.join("\n");
  try{ await navigator.clipboard.writeText(text); copyOrderBtn.textContent = "Copied!"; setTimeout(()=>copyOrderBtn.textContent="Copy order + scores",1200); }
  catch(e){ alert(text); }
});
resetScoresBtn.addEventListener("click", ()=>{
  if(confirm("Set all scores to 0?")){ state.players.forEach(p=>p.score=0); saveState(state); renderSeating(); }
});

// --- BGG Collection Loader ---
const PROXY = "https://api.allorigins.win/raw?url=";
const bggUserInput = document.getElementById("bggUser");
const loadCollectionBtn = document.getElementById("loadCollection");
const collectionResults = document.getElementById("collectionResults");
const retryCollectionBtn = document.getElementById("retryCollection");
const pasteXmlBtn = document.getElementById("pasteXmlBtn");
const xmlPaste = document.getElementById("xmlPaste");
const submitXmlBtn = document.getElementById("submitXml");

async function fetchXML(url){
  const res = await fetch(PROXY + encodeURIComponent(url));
  if(!res.ok) throw new Error("Network error");
  const text = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "text/xml");
  return xml;
}

async function bggCollection(username){
  // Handles "processing" by polling a few times
  const url = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1`;
  for(let i=0;i<10;i++){
    try{
      const xml = await fetchXML(url);
      const message = xml.querySelector("message")?.textContent || "";
      if(message.toLowerCase().includes("processing")){ await new Promise(r=>setTimeout(r, 1500)); continue; }
      const items = Array.from(xml.querySelectorAll("item"));
      // Map to ids
      return items.map(it=> ({ id: it.getAttribute("objectid"), name: it.querySelector("name")?.textContent || "Unknown", thumb: it.querySelector("thumbnail")?.textContent || "" }));
    }catch(e){
      // wait then retry
      await new Promise(r=>setTimeout(r, 1200));
    }
  }
  throw new Error("Collection not ready or blocked. Try again, try another browser, or use Paste XML.");
}

async function loadCollectionFromUsername(){
  const u = bggUserInput.value.trim();
  if(!u){ alert("Enter your BGG username"); return; }
  collectionResults.innerHTML = `<div class="muted">Loading collection for ${u}…</div>`;
  try{
    const items = await bggCollection(u);
    if(items.length === 0) { collectionResults.innerHTML = `<div class="muted">No owned items found.</div>`; return; }
    // Fetch details for top 36 items
    const details = await Promise.all(items.slice(0,36).map(it => fetchXML(`https://boardgamegeek.com/xmlapi2/thing?id=${it.id}&stats=1`).then(x=>x).catch(()=>null)));
    const parsed = details.map((xml, idx) => {
      if(!xml) return null;
      const thing = xml.querySelector("item[type='boardgame']");
      if(!thing) return null;
      return {
        id: items[idx].id,
        name: thing.querySelector("name[type='primary']")?.getAttribute("value") || items[idx].name,
        image: thing.querySelector("image")?.textContent || items[idx].thumb,
      };
    }).filter(Boolean);
    renderCollection(parsed);
  }catch(e){
    collectionResults.innerHTML = `<div class="muted">Could not load collection: ${e.message}</div>`;
    retryCollectionBtn.style.display = "inline-block";
  }
}

function renderCollection(games){
  collectionResults.innerHTML = "";
  games.forEach(g => {
    const div = document.createElement("div");
    div.className = "collection-item";
    div.innerHTML = `<img src="${g.image}" alt="${g.name}" onerror="this.style.display='none'"/><div><strong>${g.name}</strong></div><div class="row"><a target="_blank" rel="noopener" href="https://boardgamegeek.com/boardgame/${g.id}">BGG page</a><a target="_blank" rel="noopener" href="https://boardgamegeek.com/boardgame/${g.id}/ratings">Reviews</a><a target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${encodeURIComponent(g.name + ' how to play')}">Videos</a></div>`;
    collectionResults.appendChild(div);
  });
}

// Paste XML option
pasteXmlBtn.addEventListener("click", ()=>{ xmlPaste.style.display = xmlPaste.style.display === "none" ? "inline-block" : "none"; submitXmlBtn.style.display = submitXmlBtn.style.display === "none" ? "inline-block" : "none"; });
submitXmlBtn.addEventListener("click", ()=>{
  const raw = xmlPaste.value.trim();
  if(!raw) return alert("Paste XML into the box.");
  try{
    const parser = new DOMParser();
    const xml = parser.parseFromString(raw, "text/xml");
    const items = Array.from(xml.querySelectorAll("item")).map(it=> ({ id: it.getAttribute("objectid"), name: it.querySelector("name")?.textContent || "Unknown", thumb: it.querySelector("thumbnail")?.textContent || "" }) );
    renderCollection(items.slice(0,36));
  }catch(e){ alert("Could not parse XML. Make sure you pasted the raw XML from BGG."); }
});

loadCollectionBtn.addEventListener("click", loadCollectionFromUsername);
retryCollectionBtn.addEventListener("click", ()=>{ retryCollectionBtn.style.display = "none"; loadCollectionFromUsername(); });

// Initial render
renderAll();
