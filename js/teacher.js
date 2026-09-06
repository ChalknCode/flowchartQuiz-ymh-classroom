const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyAunNjzFK6JYtvG5iEFbpJEblQNtyQgEWlXyNiW4h1yEpXJE3kWu5qUA0ZaHzG0HVj/exec';

// ── State ──
let allQuestions = [];
let allScores = [];
let currentQuestionId = null;

// ── Init ──
window.onload = () => {
  // If already logged in (sessionStorage), hide login
  if(sessionStorage.getItem('teacherLoggedIn')) {
    document.getElementById('viewLogin').style.display = 'none';
    initDashboard();
  }
};

// ── Login ──
function doTeacherLogin() {
  const pw = document.getElementById('loginPw').value;
  if(pw === 'teacher123') { // Simple password for now
    sessionStorage.setItem('teacherLoggedIn', 'true');
    document.getElementById('viewLogin').style.display = 'none';
    initDashboard();
  } else {
    document.getElementById('loginError').textContent = '密碼錯誤';
  }
}

function logout() {
  sessionStorage.removeItem('teacherLoggedIn');
  location.reload();
}

// ── Navigation ──
function switchSection(secId, btnEl) {
  document.querySelectorAll('.t-section').forEach(el => el.classList.remove('active'));
  document.getElementById(secId).classList.add('active');
  
  document.querySelectorAll('.t-nav-btn').forEach(el => el.classList.remove('active'));
  btnEl.classList.add('active');

  if(secId === 'secQuestions') loadQuestions();
  if(secId === 'secScores') loadScores();
  if(secId === 'secLeaderboard') {
    // Populate dropdown
    const lbDrop = document.getElementById('lbFilterQid');
    lbDrop.innerHTML = '<option value="">請選擇題目...</option>';
    allQuestions.forEach(q => {
      lbDrop.innerHTML += `<option value="${q.question_id}">${q.question_id} - ${q.title}</option>`;
    });
  }
}

function switchMode(modeId, btnEl) {
  document.querySelectorAll('.mode-panel').forEach(el => el.classList.remove('active'));
  document.getElementById(modeId).classList.add('active');
  
  document.querySelectorAll('.mode-tab').forEach(el => el.classList.remove('active'));
  btnEl.classList.add('active');
  
  if(modeId === 'modeJson') {
    document.getElementById('jsonEditor').value = JSON.stringify(exportBuilderToJson(), null, 2);
  }
  if(modeId === 'modeVisual') {
    try {
      const data = JSON.parse(document.getElementById('jsonEditor').value);
      importJsonToBuilder(data);
    } catch(e) {}
  }
}

async function initDashboard() {
  loadQuestions();
}

// ── 題庫管理 (Questions) ──
async function loadQuestions() {
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=getAllQuestions`);
    const json = await res.json();
    if(json.ok) {
      allQuestions = json.questions;
      renderQuestionTable();
    }
  } catch(e) {
    console.error(e);
  }
}

function renderQuestionTable() {
  const tbody = document.getElementById('questionTbody');
  tbody.innerHTML = '';
  allQuestions.forEach(q => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${q.question_id}</td>
      <td>${q.title}</td>
      <td>
        <label class="switch">
          <input type="checkbox" ${q.is_active ? 'checked' : ''} onchange="toggleActive('${q.question_id}', this.checked)">
          <span class="slider"></span>
        </label>
      </td>
      <td>
        <button class="tool-btn" style="background:#eef2ff;color:#4f46e5;" onclick="copyLink('${q.question_id}')">🔗 複製學生連結</button>
      </td>
      <td>
        <button class="tool-btn" style="background:#f3f4f6;color:#374151;display:inline-flex;" onclick="editQuestion('${q.question_id}')">✏️ 編輯</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function toggleActive(qid, active) {
  await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'toggleActive', questionId: qid, active: active })
  });
}

function copyLink(qid) {
  // Use current origin, assume student app is index.html in same folder
  let url = window.location.href.replace('teacher.html', 'index.html');
  if(!url.includes('index.html')) url += 'index.html';
  url += `?q=${qid}`;
  navigator.clipboard.writeText(url).then(() => alert('學生連結已複製！'));
}

// ── 編輯/新增題目 ──
function editQuestion(qid) {
  const q = allQuestions.find(x => x.question_id === qid);
  if(q) {
    document.getElementById('eqId').value = q.question_id;
    document.getElementById('eqTitle').value = q.title;
    document.getElementById('eqId').readOnly = true; // existing cannot change ID
    document.getElementById('editorTitle').innerHTML = '✏️ 編輯題目';
    
    let timeLimit = 300;
    if(q.data && q.data.time_limit) timeLimit = q.data.time_limit;
    document.getElementById('eqTime').value = timeLimit;
    
    if(q.data) {
      importJsonToBuilder(q.data);
      document.getElementById('jsonEditor').value = JSON.stringify(q.data, null, 2);
    }
  }
  switchSection('secAddQuestion', document.querySelectorAll('.t-nav-btn')[1]);
}

async function saveQuestion() {
  const qid = document.getElementById('eqId').value.trim();
  const title = document.getElementById('eqTitle').value.trim();
  const timeLimit = parseInt(document.getElementById('eqTime').value) || 300;
  
  if(!qid || !title) return alert('請填寫題目 ID 與標題');
  
  // Use JSON editor if active, otherwise build from visual
  let dataObj = {};
  if(document.getElementById('modeJson').classList.contains('active')) {
    try {
      dataObj = JSON.parse(document.getElementById('jsonEditor').value);
    } catch(e) { return alert('JSON 格式錯誤'); }
  } else {
    dataObj = exportBuilderToJson();
  }
  
  dataObj.time_limit = timeLimit;
  dataObj.question_id = qid;
  dataObj.title = title;

  dataObj.time_limit = timeLimit;
  
  const isExisting = allQuestions.some(q => q.question_id === qid);
  
  const payload = {
    action: isExisting ? 'updateQuestion' : 'saveQuestion',
    data: {
      question_id: qid,
      title: title,
      nodes: dataObj.nodes,
      connections: dataObj.connections,
      layout: dataObj.layout,
      time_limit: dataObj.time_limit
    }
  };
  
  try {
    const res = await fetch(APPS_SCRIPT_URL, { method:'POST', body:JSON.stringify(payload) });
    const json = await res.json();
    if(json.ok) {
      alert('儲存成功！');
      loadQuestions();
      switchSection('secQuestions', document.querySelectorAll('.t-nav-btn')[0]);
    } else {
      alert('儲存失敗：' + json.error);
    }
  } catch(e) { alert('網路錯誤'); }
}


// ── 視覺化編輯器 (Builder) ──
let bNodes = []; // { id, type, label, el, x, y }
let bConns = []; // { from, to, label }
let nodeCounter = 0;

let isConnecting = false;
let connectSource = null;

function toggleConnectMode() {
  isConnecting = !isConnecting;
  const btn = document.getElementById('btnConnect');
  if(isConnecting) {
    btn.classList.add('active');
    document.getElementById('builderWrap').style.cursor = 'crosshair';
  } else {
    btn.classList.remove('active');
    document.getElementById('builderWrap').style.cursor = 'default';
    connectSource = null;
    clearConnectingStyles();
  }
}

function clearCanvas() {
  document.getElementById('canvasNodes').innerHTML = '';
  document.getElementById('canvasLines').innerHTML = '';
  bNodes = [];
  bConns = [];
}

function addNode(type, x=100, y=50, label='文字', id=null) {
  if(!id) {
    nodeCounter++;
    id = 'n' + nodeCounter;
  }
  
  const el = document.createElement('div');
  el.className = 'node';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  
  let shapeHtml = '';
  if (type === 'oval') {
    shapeHtml = `<div class="node-shape ns-o"><input type="text" class="node-input" style="color:#3730a3;" value="${label}"></div>`;
  } else if (type === 'rect') {
    shapeHtml = `<div class="node-shape ns-r"><input type="text" class="node-input" style="color:#0c4a6e;" value="${label}"></div>`;
  } else if (type === 'parallelogram') {
    shapeHtml = `<div class="node-shape ns-p"><div class="ns-p-bg"></div><input type="text" class="node-input" style="color:#78350f;" value="${label}"></div>`;
  } else if (type === 'diamond') {
    shapeHtml = `
      <div class="node-shape ns-d">
        <svg viewBox="0 0 160 66" preserveAspectRatio="none"><polygon points="80,2 158,33 80,64 2,33" fill="#fdf2f8" stroke="#ec4899" stroke-width="2.5"/></svg>
        <input type="text" class="node-input" style="color:#831843;" value="${label}">
      </div>`;
  }

  el.innerHTML = `
    <div class="node-del" onclick="deleteNode('${id}')">×</div>
    ${shapeHtml}
    <div class="node-id">${id}</div>
  `;
  
  el.onmousedown = (e) => handleNodeMouseDown(e, id);
  
  document.getElementById('canvasNodes').appendChild(el);
  
  bNodes.push({ id, type, el, x, y });
}

function deleteNode(id) {
  const nIdx = bNodes.findIndex(n => n.id === id);
  if(nIdx > -1) {
    bNodes[nIdx].el.remove();
    bNodes.splice(nIdx, 1);
  }
  bConns = bConns.filter(c => c.from !== id && c.to !== id);
  renderLines();
}

// Drag & Connect Logic
let isDragging = false;
let dragNode = null;
let dragOffX = 0, dragOffY = 0;

function handleNodeMouseDown(e, id) {
  if (e.target.tagName.toLowerCase() === 'input' || e.target.className === 'node-del') return;
  
  const node = bNodes.find(n => n.id === id);
  if (!node) return;

  if (isConnecting) {
    if (!connectSource) {
      connectSource = node;
      node.el.classList.add('connecting');
    } else {
      if (connectSource.id !== node.id) {
        // Create connection
        let lbl = '';
        if(connectSource.type === 'diamond') lbl = prompt('請輸入分支標籤 (例如: Yes / No) \n(非菱形請直接按確定留空)', '');
        bConns.push({ from: connectSource.id, to: node.id, label: lbl||'' });
        renderLines();
      }
      clearConnectingStyles();
      connectSource = null;
    }
    return;
  }

  // Normal Drag
  isDragging = true;
  dragNode = node;
  const wrapRect = document.getElementById('builderWrap').getBoundingClientRect();
  const nodeRect = node.el.getBoundingClientRect();
  dragOffX = e.clientX - nodeRect.left;
  dragOffY = e.clientY - nodeRect.top;
}

document.addEventListener('mousemove', e => {
  if (!isDragging || !dragNode) return;
  const wrapRect = document.getElementById('builderWrap').getBoundingClientRect();
  let nx = e.clientX - wrapRect.left - dragOffX;
  let ny = e.clientY - wrapRect.top - dragOffY;
  
  // 磁吸對齊：自動與其他積木的「中心點」對齊
  const myWidth = dragNode.el.offsetWidth;
  const myCenterX = nx + myWidth / 2;
  
  for (let n of bNodes) {
    if (n.id !== dragNode.id) {
      const otherWidth = n.el.offsetWidth;
      const otherCenterX = n.x + otherWidth / 2;
      // 如果中心點距離小於 15px，自動吸附
      if (Math.abs(myCenterX - otherCenterX) < 15) {
        nx = otherCenterX - myWidth / 2;
        break; // 吸附到第一個找到的積木
      }
    }
  }
  
  dragNode.x = nx; dragNode.y = ny;
  dragNode.el.style.left = nx + 'px';
  dragNode.el.style.top = ny + 'px';
  renderLines(); // update arrows
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  dragNode = null;
});

function clearConnectingStyles() {
  bNodes.forEach(n => n.el.classList.remove('connecting'));
}

function renderLines() {
  const svg = document.getElementById('canvasLines');
  svg.innerHTML = `
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#a78bfa" />
      </marker>
    </defs>
  `;
  
  const canvasRect = document.getElementById('builderWrap').getBoundingClientRect();
  
  bConns.forEach(c => {
    const src = bNodes.find(n => n.id === c.from);
    const dst = bNodes.find(n => n.id === c.to);
    if(!src || !dst) return;
    
    // 取得實際形狀的 DOM，不要算到外框或標籤
    const srcShape = src.el.querySelector('.node-shape');
    const dstShape = dst.el.querySelector('.node-shape');
    if(!srcShape || !dstShape) return;
    
    const sR = srcShape.getBoundingClientRect();
    const dR = dstShape.getBoundingClientRect();
    
    // 計算相對於畫布的座標
    let x1 = (sR.left - canvasRect.left) + (sR.width / 2);
    let y1 = (sR.bottom - canvasRect.top);
    
    let x2 = (dR.left - canvasRect.left) + (dR.width / 2);
    let y2 = (dR.top - canvasRect.top);
    
    let pathD = '';
    
    if (y2 < y1) {
      // 迴圈往回指：從起點右側拉出，往上走，再連到終點右側
      const startX = sR.right - canvasRect.left;
      const startY = (sR.top - canvasRect.top) + (sR.height / 2);
      const endX = dR.right - canvasRect.left;
      const endY = (dR.top - canvasRect.top) + (dR.height / 2);
      const outX = Math.max(startX, endX) + 40; // 往右拉出 40px
      
      pathD = `M ${startX} ${startY} L ${outX} ${startY} L ${outX} ${endY} L ${endX} ${endY}`;
      x1 = startX; x2 = endX; y1 = startY; y2 = endY; // 為了文字定位
    }
    else if (src.type === 'diamond') {
      // 菱形從左右兩側出發
      if (x2 > x1) {
        // 目標在右邊，從右端點出發
        x1 = (sR.right - canvasRect.left);
        y1 = (sR.top - canvasRect.top) + (sR.height / 2);
      } else {
        // 目標在左/正下方，從左端點出發
        x1 = (sR.left - canvasRect.left);
        y1 = (sR.top - canvasRect.top) + (sR.height / 2);
      }
      // 畫 90 度折線：先水平走到 x2，再垂直往下走到 y2
      pathD = `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
    } else {
      // 其他形狀從正下方出發
      if (Math.abs(x1 - x2) > 10) {
        // 如果有左右偏移，畫 S 型折線
        const midY = (y1 + y2) / 2;
        pathD = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
      } else {
        // 垂直對齊，畫直線
        pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
      }
    }
    
    svg.innerHTML += `<path d="${pathD}" fill="none" stroke="#a78bfa" stroke-width="3" marker-end="url(#arrow)" pointer-events="auto" style="cursor:pointer;" onclick="editConnectionLabel('${c.from}', '${c.to}')" />`;
    
    if(c.label) {
      let mx, my;
      if (y2 < y1) {
        mx = Math.max(x1, x2) + 40;
        my = (y1 + y2) / 2;
      } else if (src.type === 'diamond') {
        mx = (x1 + x2) / 2;
        my = y1;
      } else {
        mx = (x1 + x2) / 2;
        my = (y1 + y2) / 2;
      }
      
      // 幫文字加上白色半透明底色，並使其可點擊
      svg.innerHTML += `
        <g pointer-events="auto" style="cursor:pointer;" onclick="editConnectionLabel('${c.from}', '${c.to}')">
          <rect x="${mx-20}" y="${my-10}" width="40" height="20" fill="rgba(255,255,255,0.9)" rx="4"/>
          <text x="${mx}" y="${my+4}" fill="#6366f1" font-size="12" font-weight="900" text-anchor="middle">${c.label}</text>
        </g>
      `;
    }
  });
}

window.editConnectionLabel = function(from, to) {
  const conn = bConns.find(c => c.from === from && c.to === to);
  if(conn) {
    const newLbl = prompt('編輯連線上的文字 (留空白代表清除)：', conn.label);
    if(newLbl !== null) {
      conn.label = newLbl;
      renderLines();
    }
  }
};

// Import / Export JSON
function exportBuilderToJson() {
  // Extract inputs
  const exportNodes = bNodes.map(n => {
    const input = n.el.querySelector('input');
    return { id: n.id, type: n.type, label: input ? input.value : '' };
  });
  
  let layout = bNodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
  
  return {
    nodes: exportNodes,
    connections: bConns,
    layout: layout
  };
}

function importJsonToBuilder(data) {
  clearCanvas();
  if(!data.nodes) return;
  
  data.nodes.forEach((n, i) => {
    // Try to find layout data
    const lInfo = (data.layout || []).find(l => l.id === n.id);
    let nx = 200;
    let ny = 20 + i * 100;
    if (lInfo) {
      if (lInfo.x !== undefined) nx = lInfo.x;
      if (lInfo.y !== undefined) ny = lInfo.y;
      // Fallback for old row-based layout
      if (lInfo.row !== undefined && lInfo.y === undefined) ny = 20 + lInfo.row * 100;
    }
    addNode(n.type, nx, ny, n.label, n.id);
  });
  
  // Update nodeCounter to avoid ID collision
  let maxId = 0;
  data.nodes.forEach(n => {
    if(n.id.startsWith('n')) {
      const num = parseInt(n.id.replace('n',''));
      if(!isNaN(num) && num > maxId) maxId = num;
    }
  });
  nodeCounter = maxId;
  
  if(data.connections) {
    bConns = [...data.connections];
  }
  
  setTimeout(renderLines, 100);
}

// ── AI Image ──
async function uploadAiImage() {
  const fileInput = document.getElementById('aiImage');
  const status = document.getElementById('aiStatus');
  if(!fileInput.files[0]) return alert('請先選擇圖片檔案');
  
  status.textContent = '處理中，這可能需要幾十秒，請稍候...';
  
  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64 = e.target.result.split(',')[1];
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'analyzeImage', imageBase64: base64, mimeType: fileInput.files[0].type })
      });
      const json = await res.json();
      if(json.ok && json.data) {
        status.textContent = '解析成功！請切換至「視覺化編輯器」或「JSON 編輯」查看結果並微調。';
        importJsonToBuilder(json.data);
        document.getElementById('jsonEditor').value = JSON.stringify(json.data, null, 2);
      } else {
        status.textContent = '解析失敗：' + (json.error || '未回傳資料');
      }
    } catch(err) {
      status.textContent = '網路錯誤';
    }
  };
  reader.readAsDataURL(fileInput.files[0]);
}

// ── 總成績 (Scores) ──
async function loadScores() {
  try {
    // 取得所有成績 (不帶 questionId)
    const res = await fetch(`${APPS_SCRIPT_URL}?action=getScores`);
    const json = await res.json();
    if(json.ok) {
      allScores = json.scores;
      
      // 更新班級下拉選單 (蒐集所有不重複的班級)
      const classes = [...new Set(allScores.map(s => s.student_class).filter(c => c))].sort();
      
      // 處理成績頁的班級選單
      const sfClass = document.getElementById('scoreFilterClass');
      const curSfClass = sfClass.value;
      sfClass.innerHTML = '<option value="">所有班級</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
      sfClass.value = curSfClass;
      
      // 處理排行榜的班級選單
      const lbClass = document.getElementById('lbFilterClass');
      const curLbClass = lbClass.value;
      lbClass.innerHTML = '<option value="">所有班級</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
      lbClass.value = curLbClass;

      renderScores();
    }
  } catch(e) {}
}

function renderScores() {
  const qid = document.getElementById('scoreFilterQid').value;
  const cls = document.getElementById('scoreFilterClass').value;
  
  let filtered = allScores;
  if (qid) filtered = filtered.filter(s => String(s.question_id) === String(qid));
  if (cls) filtered = filtered.filter(s => String(s.student_class) === String(cls));

  const tbody = document.getElementById('scoreTbody');
  tbody.innerHTML = '';
  
  if(filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8">尚無符合條件的成績資料</td></tr>';
    return;
  }
  
  filtered.forEach(s => {
    let detail = s.detail || {};
    
    let timeStr = '-';
    if(detail.time_seconds) {
      const m = String(Math.floor(detail.time_seconds/60)).padStart(2,'0');
      const sec = String(detail.time_seconds%60).padStart(2,'0');
      timeStr = `${m}:${sec}`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.timestamp}</td>
      <td>${s.student_class || ''}</td>
      <td>${s.student_id}</td>
      <td>${s.student_name || ''}</td>
      <td>${s.question_id}</td>
      <td style="color:${s.score===100?'#10b981':'#1f2937'}; font-weight:bold;">${s.score}</td>
      <td>${detail.correct||0} / ${detail.total||0}</td>
      <td>${timeStr}</td>
    `;
    tbody.appendChild(tr);
  });
}

window.loadLeaderboard = renderLeaderboard; // map the HTML onchange call

// ── 競賽排行榜 (Leaderboard) ──
async function renderLeaderboard() {
  const qid = document.getElementById('lbFilterQid').value;
  const cls = document.getElementById('lbFilterClass').value;
  const tbody = document.getElementById('lbTbody');
  
  if(!qid) {
    tbody.innerHTML = '<tr><td colspan="5">請先在上方選擇一個題目來進行競賽</td></tr>';
    return;
  }
  
  // 如果 allScores 尚未載入，就先載入 (確保資料存在)
  if (!allScores || allScores.length === 0) {
    await loadScores();
  }
  
  let filtered = allScores.filter(s => String(s.question_id) === String(qid) && Number(s.score) === 100);
  if (cls) filtered = filtered.filter(s => String(s.student_class) === String(cls));
  
  if(filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">此範圍內尚無滿分的學生</td></tr>';
    return;
  }
  
  // 依據花費時間由小到大排序 (時間相同的依據送出時間)
  filtered.sort((a, b) => {
    const ta = (a.detail && a.detail.time_seconds) ? a.detail.time_seconds : 9999;
    const tb = (b.detail && b.detail.time_seconds) ? b.detail.time_seconds : 9999;
    if(ta !== tb) return ta - tb;
    return new Date(a.timestamp) - new Date(b.timestamp);
  });
  
  tbody.innerHTML = '';
  filtered.forEach((s, idx) => {
    let detail = s.detail || {};
    let timeStr = '-';
    if(detail.time_seconds) {
      const m = String(Math.floor(detail.time_seconds/60)).padStart(2,'0');
      const sec = String(detail.time_seconds%60).padStart(2,'0');
      timeStr = `${m}分${sec}秒`;
    }
    
    // 前三名加上獎牌
    let rank = idx + 1;
    if(rank === 1) rank = '🥇 1';
    if(rank === 2) rank = '🥈 2';
    if(rank === 3) rank = '🥉 3';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-weight:900; color:#db2777; font-size:1.1rem;">${rank}</td>
      <td>${s.student_class || ''}</td>
      <td><span style="font-weight:bold;">${s.student_name || ''}</span> (${s.student_id})</td>
      <td style="font-weight:700; color:#4f46e5;">${timeStr}</td>
      <td style="font-size:0.85rem; color:#6b7280;">${s.timestamp}</td>
    `;
    tbody.appendChild(tr);
  });
}
