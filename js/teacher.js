// ============================================================
//  teacher.js — 老師端邏輯
//  flowchartQuiz-ymh-classroom
// ============================================================

const APPS_SCRIPT_URL  = '';        // 部署後填入
const TEACHER_PASSWORD = 'teacher123';

// ── 狀態 ──
let allQuestions = [];
let pendingAIData = null;  // AI 辨識結果暫存

// ── Builder 狀態 ──
let builderNodes   = [];  // {id, type, label, x, y}
let builderConns   = [];  // {from, to, label}
let nodeCounter    = 0;
let connectMode    = false;
let connectFrom    = null;
let dragNode       = null;
let dragOffX       = 0, dragOffY = 0;

// ── Mock 資料 ──
const MOCK_QUESTIONS_TEACHER = [
  {
    question_id: 'Q001', title: '🍵 泡茶流程（線性）',
    node_count: 5, is_active: true, created_at: '2026-09-06',
    data: {
      nodes: [
        {id:'n1',type:'rect',label:'燒開水'}, {id:'n2',type:'rect',label:'放入茶葉'},
        {id:'n3',type:'rect',label:'注入熱水'}, {id:'n4',type:'rect',label:'等待3分鐘'},
        {id:'n5',type:'rect',label:'倒入茶杯'},
      ],
      connections: [{from:'n1',to:'n2'},{from:'n2',to:'n3'},{from:'n3',to:'n4'},{from:'n4',to:'n5'}],
      layout: [{id:'n1',row:0,col:0},{id:'n2',row:1,col:0},{id:'n3',row:2,col:0},{id:'n4',row:3,col:0},{id:'n5',row:4,col:0}],
    }
  },
  {
    question_id: 'Q002', title: '📊 判斷成績（選擇結構）',
    node_count: 5, is_active: false, created_at: '2026-09-06',
    data: {
      nodes: [
        {id:'n1',type:'rect',label:'輸入成績'}, {id:'n2',type:'diamond',label:'成績≥60?'},
        {id:'n3',type:'rect',label:'顯示及格'}, {id:'n4',type:'rect',label:'顯示不及格'},
        {id:'n5',type:'rect',label:'結束'},
      ],
      connections: [{from:'n1',to:'n2'},{from:'n2',to:'n3',label:'Yes'},{from:'n2',to:'n4',label:'No'},{from:'n3',to:'n5'},{from:'n4',to:'n5'}],
      layout: [{id:'n1',row:0,col:1},{id:'n2',row:1,col:1},{id:'n3',row:2,col:0},{id:'n4',row:2,col:2},{id:'n5',row:3,col:1}],
    }
  },
];

const MOCK_SCORES = [
  { timestamp:'2026-09-06 09:30:00', student_id:'101', student_name:'王小明', question_id:'Q001', score:5, total:5, detail:'[true,true,true,true,true]' },
  { timestamp:'2026-09-06 09:35:00', student_id:'102', student_name:'李小花', question_id:'Q001', score:3, total:5, detail:'[true,false,true,false,true]' },
];

// ============================================================
//  初始化
// ============================================================
(function init() {
  document.getElementById('teacherPw').addEventListener('keydown', e => {
    if (e.key === 'Enter') doTeacherLogin();
  });

  // 拖放上傳
  const ua = document.getElementById('uploadArea');
  if (ua) {
    ua.addEventListener('dragover', e => { e.preventDefault(); ua.classList.add('drag-over'); });
    ua.addEventListener('dragleave', () => ua.classList.remove('drag-over'));
    ua.addEventListener('drop', e => {
      e.preventDefault(); ua.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) processImageFile(file);
    });
  }
})();

// ============================================================
//  登入 / 登出
// ============================================================
function doTeacherLogin() {
  const pw = document.getElementById('teacherPw').value;
  if (pw === TEACHER_PASSWORD) {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('mainLayout').classList.remove('hidden');
    document.getElementById('mainLayout').style.display = 'flex';
    loadQuestions();
  } else {
    const el = document.getElementById('loginError');
    el.style.display = 'block';
    el.textContent   = '密碼錯誤，請再試一次';
  }
}

function doLogout() {
  document.getElementById('mainLayout').style.display = 'none';
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('teacherPw').value = '';
}

// ============================================================
//  導覽
// ============================================================
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.t-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  document.getElementById(`nav-${name}`).classList.add('active');
  if (name === 'scores') loadScores();
}

// ============================================================
//  題目管理
// ============================================================
async function loadQuestions() {
  try {
    if (!APPS_SCRIPT_URL) {
      allQuestions = MOCK_QUESTIONS_TEACHER.map(q => ({
        question_id: q.question_id,
        title: q.title,
        node_count: q.data.nodes.length,
        is_active: q.is_active,
        created_at: q.created_at,
      }));
    } else {
      const res  = await fetch(`${APPS_SCRIPT_URL}?action=getAllQuestions`);
      const data = await res.json();
      if (!data.ok) { showToast('載入題目失敗'); return; }
      allQuestions = data.questions;
    }
  } catch (e) {
    showToast('連線失敗'); return;
  }

  renderQuestionTable();
  // 更新成績篩選下拉
  const sel = document.getElementById('scoreFilterQ');
  sel.innerHTML = '<option value="">全部題目</option>';
  allQuestions.forEach(q => {
    const opt = document.createElement('option');
    opt.value       = q.question_id;
    opt.textContent = `${q.question_id} — ${q.title}`;
    sel.appendChild(opt);
  });
}

function renderQuestionTable() {
  const loading = document.getElementById('questionListLoading');
  const empty   = document.getElementById('questionListEmpty');
  const table   = document.getElementById('questionTable');
  const tbody   = document.getElementById('questionTableBody');

  loading.style.display = 'none';

  if (allQuestions.length === 0) {
    empty.style.display = 'block';
    table.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  table.style.display = 'table';
  tbody.innerHTML = '';

  allQuestions.forEach(q => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge badge-gray">${q.question_id}</span></td>
      <td style="font-weight:600;">${q.title}</td>
      <td style="text-align:center;">${q.node_count || '—'}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" ${q.is_active ? 'checked' : ''} onchange="toggleActive('${q.question_id}', this.checked)" />
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="copyStudentLink('${q.question_id}')">🔗 複製連結</button>
      </td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editQuestion('${q.question_id}')" style="margin-right:4px;">✏️ 編輯</button>
        <button class="btn btn-sm" onclick="deleteQuestion('${q.question_id}')" style="background:#fee2e2;color:#991b1b;">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function toggleActive(questionId, active) {
  try {
    if (!APPS_SCRIPT_URL) {
      const q = MOCK_QUESTIONS_TEACHER.find(q => q.question_id === questionId);
      if (q) q.is_active = active;
    } else {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'toggleActive', questionId, active })
      });
    }
    showToast(active ? `✅ ${questionId} 已開放` : `🔒 ${questionId} 已關閉`);
  } catch (e) { showToast('更新失敗'); }
}

function copyStudentLink(questionId) {
  const base = window.location.href.replace('teacher.html','index.html');
  const url  = `${base}?q=${questionId}`;
  navigator.clipboard.writeText(url).then(() => showToast('✅ 連結已複製！'));
}

async function deleteQuestion(questionId) {
  if (!confirm(`確定要刪除 ${questionId}？此操作無法復原。`)) return;
  try {
    if (!APPS_SCRIPT_URL) {
      const idx = MOCK_QUESTIONS_TEACHER.findIndex(q => q.question_id === questionId);
      if (idx !== -1) MOCK_QUESTIONS_TEACHER.splice(idx, 1);
    } else {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteQuestion', questionId })
      });
    }
    showToast('🗑️ 已刪除');
    loadQuestions();
  } catch (e) { showToast('刪除失敗'); }
}

function editQuestion(questionId) {
  const q = MOCK_QUESTIONS_TEACHER.find(q => q.question_id === questionId);
  if (!q) return;
  showSection('addQuestion');
  document.getElementById('newTitle').value = q.title;
  switchMode('json');
  document.getElementById('jsonEditor').value = JSON.stringify(q.data, null, 2);
}

// ============================================================
//  新增題目 — 模式切換
// ============================================================
function switchMode(mode) {
  document.querySelectorAll('.mode-tab').forEach((t, i) => {
    t.classList.toggle('active', ['image','builder','json'][i] === mode);
  });
  document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`mode-${mode}`).classList.add('active');
}

// ============================================================
//  Mode A: 圖片上傳 + AI 辨識
// ============================================================
function handleImageSelect(event) {
  const file = event.target.files[0];
  if (file) processImageFile(file);
}

function processImageFile(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    document.getElementById('imgPreview').src = dataUrl;
    document.getElementById('imgPreview').style.display = 'block';
    document.getElementById('aiResult').style.display   = 'none';

    const base64 = dataUrl.split(',')[1];
    const mime   = file.type;
    await analyzeImage(base64, mime);
  };
  reader.readAsDataURL(file);
}

async function analyzeImage(base64, mime) {
  document.getElementById('aiLoadingMsg').style.display = 'block';
  document.getElementById('aiResult').style.display     = 'none';

  let result;
  try {
    if (!APPS_SCRIPT_URL) {
      // Mock AI result
      await new Promise(r => setTimeout(r, 1500));
      result = {
        ok: true,
        data: {
          title: 'AI 辨識結果（預覽模式）',
          nodes: [
            {id:'n1',type:'rect',label:'步驟一'}, {id:'n2',type:'diamond',label:'條件?'},
            {id:'n3',type:'rect',label:'步驟二'}, {id:'n4',type:'rect',label:'步驟三'},
          ],
          connections: [{from:'n1',to:'n2'},{from:'n2',to:'n3',label:'Yes'},{from:'n2',to:'n4',label:'No'}],
          layout: [{id:'n1',row:0,col:1},{id:'n2',row:1,col:1},{id:'n3',row:2,col:0},{id:'n4',row:2,col:2}],
        }
      };
    } else {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'analyzeImage', imageBase64: base64, mimeType: mime })
      });
      result = await res.json();
    }
  } catch (e) {
    result = { ok: false, error: '連線失敗' };
  }

  document.getElementById('aiLoadingMsg').style.display = 'none';

  if (result.ok) {
    pendingAIData = result.data;
    // 若有辨識到標題，填入
    if (result.data.title && !document.getElementById('newTitle').value) {
      document.getElementById('newTitle').value = result.data.title;
    }

    // 顯示辨識結果摘要
    const preview = document.getElementById('aiResultPreview');
    preview.innerHTML = `
      <p style="font-size:.85rem;color:#374151;margin-bottom:6px;">
        辨識到 <strong>${result.data.nodes.length}</strong> 個節點、
        <strong>${result.data.connections.length}</strong> 條連線
      </p>
      <ul style="font-size:.82rem;color:#6b7280;list-style:none;padding:0;">
        ${result.data.nodes.map(n =>
          `<li>• ${n.type === 'diamond' ? '◇' : '▭'} ${n.label}</li>`
        ).join('')}
      </ul>
    `;
    document.getElementById('aiResult').style.display = 'block';
  } else {
    showToast(`AI 辨識失敗：${result.error}`);
  }
}

async function saveFromAI() {
  if (!pendingAIData) return;
  const title = document.getElementById('newTitle').value.trim() || pendingAIData.title || '未命名題目';
  await saveQuestion({ title, ...pendingAIData });
}

// ============================================================
//  Mode B: 視覺介面建立
// ============================================================
function builderAddNode(type) {
  nodeCounter++;
  const id    = `n${nodeCounter}`;
  const label = type === 'rect' ? `步驟${nodeCounter}` : `條件${nodeCounter}?`;
  const x     = 80 + Math.random() * 200;
  const y     = 60 + Math.random() * 250;
  builderNodes.push({ id, type, label, x, y });
  renderBuilder();
}

function renderBuilder() {
  const container = document.getElementById('builderNodes');
  container.innerHTML = '';

  builderNodes.forEach(node => {
    const div = document.createElement('div');
    div.dataset.nodeId = node.id;
    div.style.left = node.x + 'px';
    div.style.top  = node.y + 'px';
    div.style.position = 'absolute';

    if (node.type === 'rect') {
      div.className = 'builder-node rect';
      div.textContent = node.label;
    } else {
      div.className = 'builder-node diamond-wrap';
      div.innerHTML = `<div class="builder-node diamond-inner"><span>${node.label}</span></div>`;
    }

    // 刪除按鈕
    const delBtn = document.createElement('button');
    delBtn.className = 'del-node';
    delBtn.textContent = '✕';
    delBtn.onclick = (e) => { e.stopPropagation(); builderDeleteNode(node.id); };
    div.appendChild(delBtn);

    // 雙擊編輯
    div.addEventListener('dblclick', e => {
      e.stopPropagation();
      const newLabel = prompt('輸入節點文字：', node.label);
      if (newLabel !== null) { node.label = newLabel; renderBuilder(); }
    });

    // 拖曳移動
    div.addEventListener('mousedown', e => {
      if (connectMode) { handleConnectClick(node.id); return; }
      if (e.target.classList.contains('del-node')) return;
      dragNode   = node;
      dragOffX   = e.clientX - node.x;
      dragOffY   = e.clientY - node.y;
      e.preventDefault();
    });

    // 點選（連線模式）
    div.addEventListener('click', e => {
      if (connectMode) handleConnectClick(node.id);
    });

    container.appendChild(div);
  });

  renderBuilderSVG();
  document.getElementById('builderHint').style.display = builderNodes.length ? 'none' : 'block';
}

document.addEventListener('mousemove', e => {
  if (!dragNode) return;
  const canvas = document.getElementById('builderCanvas');
  const rect   = canvas.getBoundingClientRect();
  dragNode.x   = Math.max(0, Math.min(e.clientX - dragOffX, rect.width  - 140));
  dragNode.y   = Math.max(0, Math.min(e.clientY - dragOffY, rect.height - 60));
  renderBuilder();
});
document.addEventListener('mouseup', () => { dragNode = null; });

function builderDeleteNode(id) {
  builderNodes = builderNodes.filter(n => n.id !== id);
  builderConns = builderConns.filter(c => c.from !== id && c.to !== id);
  renderBuilder();
}

function renderBuilderSVG() {
  const svg = document.getElementById('builderSvg');
  // 清除舊連線
  Array.from(svg.querySelectorAll('line,path,text,rect')).forEach(el => el.remove());

  builderConns.forEach(conn => {
    const src  = builderNodes.find(n => n.id === conn.from);
    const dst  = builderNodes.find(n => n.id === conn.to);
    if (!src || !dst) return;

    const sx = src.x + (src.type === 'rect' ? 60 : 45);
    const sy = src.y + (src.type === 'rect' ? 44 : 45);
    const dx = dst.x + (dst.type === 'rect' ? 60 : 45);
    const dy = dst.y;

    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',sx); line.setAttribute('y1',sy);
    line.setAttribute('x2',dx); line.setAttribute('y2',dy);
    line.setAttribute('stroke','#6366f1'); line.setAttribute('stroke-width','2');
    line.setAttribute('marker-end','url(#barrow)');
    svg.appendChild(line);

    if (conn.label) {
      const mx = (sx + dx) / 2, my = (sy + dy) / 2;
      const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
      bg.setAttribute('x',mx-16); bg.setAttribute('y',my-10);
      bg.setAttribute('width',32); bg.setAttribute('height',14);
      bg.setAttribute('rx',4); bg.setAttribute('fill','white');
      const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
      txt.setAttribute('x',mx); txt.setAttribute('y',my+1);
      txt.setAttribute('text-anchor','middle'); txt.setAttribute('font-size','10');
      txt.setAttribute('font-weight','700'); txt.setAttribute('fill','#7c3aed');
      txt.setAttribute('font-family','Segoe UI, sans-serif');
      txt.textContent = conn.label;
      svg.appendChild(bg); svg.appendChild(txt);
    }
  });
}

function toggleConnectMode() {
  connectMode = !connectMode;
  connectFrom = null;
  const btn = document.getElementById('connectBtn');
  btn.style.background = connectMode ? '#4f46e5' : '#fef3c7';
  btn.style.color      = connectMode ? 'white'    : '#92400e';
  btn.textContent = connectMode ? '✅ 連線模式（點選節點）' : '🔗 連線模式';
  document.getElementById('connLabel').style.display = 'none';
}

function handleConnectClick(nodeId) {
  if (!connectFrom) {
    connectFrom = nodeId;
    showToast('請點選目標節點');
  } else if (connectFrom !== nodeId) {
    // 顯示標籤輸入
    document.getElementById('connLabel').style.display = 'block';
    document.getElementById('connLabelInput').value = '';
    window._pendingConn = { from: connectFrom, to: nodeId };
    connectFrom = null;
  }
}

function confirmConnect() {
  if (!window._pendingConn) return;
  const label = document.getElementById('connLabelInput').value.trim();
  builderConns.push({ ...window._pendingConn, label });
  window._pendingConn = null;
  document.getElementById('connLabel').style.display = 'none';
  toggleConnectMode();
  renderBuilderSVG();
}

function cancelConnect() {
  window._pendingConn = null;
  document.getElementById('connLabel').style.display = 'none';
  if (connectMode) toggleConnectMode();
}

function builderClear() {
  if (!confirm('確定要清除所有節點和連線嗎？')) return;
  builderNodes = []; builderConns = []; nodeCounter = 0;
  renderBuilder();
}

async function saveFromBuilder() {
  if (builderNodes.length === 0) { showToast('請先新增節點'); return; }
  const title = document.getElementById('newTitle').value.trim() || '未命名題目';

  // 根據節點位置自動計算 layout（以 y 為 row，x 為 col）
  const sortedByY = [...builderNodes].sort((a,b) => a.y - b.y);
  const rowH = 80; // 相近 y 值算同一 row
  let currentRow = -1, lastY = -9999;
  const rowMap = {};
  sortedByY.forEach(n => {
    if (n.y - lastY > rowH) { currentRow++; lastY = n.y; }
    rowMap[n.id] = currentRow;
  });

  const colMap = {};
  const byRow = {};
  sortedByY.forEach(n => {
    const r = rowMap[n.id];
    if (!byRow[r]) byRow[r] = [];
    byRow[r].push(n);
  });
  Object.values(byRow).forEach(rowNodes => {
    rowNodes.sort((a,b) => a.x - b.x);
    rowNodes.forEach((n,i) => colMap[n.id] = i);
  });

  const data = {
    nodes:       builderNodes.map(n => ({ id:n.id, type:n.type, label:n.label })),
    connections: builderConns.map(c => ({ from:c.from, to:c.to, label:c.label||'' })),
    layout:      builderNodes.map(n => ({ id:n.id, row:rowMap[n.id], col:colMap[n.id] })),
  };

  await saveQuestion({ title, ...data });
}

// ============================================================
//  Mode C: JSON 編輯
// ============================================================
function validateJSON() {
  const errEl = document.getElementById('jsonError');
  const okEl  = document.getElementById('jsonOk');
  errEl.style.display = 'none'; okEl.style.display = 'none';
  try {
    const data = JSON.parse(document.getElementById('jsonEditor').value);
    if (!data.nodes || !data.connections || !data.layout) throw new Error('缺少必要欄位（nodes/connections/layout）');
    okEl.style.display = 'block';
  } catch (e) {
    errEl.textContent   = `❌ 格式錯誤：${e.message}`;
    errEl.style.display = 'block';
  }
}

async function saveFromJSON() {
  const errEl = document.getElementById('jsonError');
  errEl.style.display = 'none';
  let data;
  try {
    data = JSON.parse(document.getElementById('jsonEditor').value);
  } catch (e) {
    errEl.textContent = '❌ JSON 格式錯誤：' + e.message;
    errEl.style.display = 'block'; return;
  }
  const title = document.getElementById('newTitle').value.trim() || '未命名題目';
  await saveQuestion({ title, ...data });
}

// ============================================================
//  儲存題目（共用）
// ============================================================
async function saveQuestion(data) {
  try {
    if (!APPS_SCRIPT_URL) {
      const id = `Q${String(MOCK_QUESTIONS_TEACHER.length + 1).padStart(3,'0')}`;
      MOCK_QUESTIONS_TEACHER.push({
        question_id: id,
        title: data.title,
        node_count: data.nodes.length,
        is_active: true,
        created_at: new Date().toISOString().slice(0,10),
        data,
      });
      showToast(`✅ 題目已儲存（${id}）`);
    } else {
      const res  = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'saveQuestion', data })
      });
      const result = await res.json();
      if (!result.ok) { showToast(`儲存失敗：${result.error}`); return; }
      showToast(`✅ 題目已儲存（${result.question_id}）`);
    }
    // 重置表單
    document.getElementById('newTitle').value = '';
    document.getElementById('jsonEditor').value = '';
    builderNodes = []; builderConns = []; nodeCounter = 0;
    renderBuilder();
    await loadQuestions();
    showSection('questions');
  } catch (e) {
    showToast('儲存失敗，請檢查連線');
  }
}

// ============================================================
//  成績查看
// ============================================================
async function loadScores() {
  const qFilter = document.getElementById('scoreFilterQ').value;
  const sFilter = document.getElementById('scoreFilterS').value.trim();

  document.getElementById('scoreLoading').style.display = 'block';
  document.getElementById('scoreEmpty').style.display   = 'none';
  document.getElementById('scoreTable').style.display   = 'none';

  let scores;
  try {
    if (!APPS_SCRIPT_URL) {
      scores = MOCK_SCORES.filter(s =>
        (!qFilter || s.question_id === qFilter) &&
        (!sFilter || String(s.student_id) === sFilter)
      );
    } else {
      let url = `${APPS_SCRIPT_URL}?action=getScores`;
      if (qFilter) url += `&questionId=${encodeURIComponent(qFilter)}`;
      if (sFilter) url += `&studentId=${encodeURIComponent(sFilter)}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!data.ok) { showToast('載入成績失敗'); return; }
      scores = data.scores;
    }
  } catch (e) {
    showToast('連線失敗'); return;
  }

  document.getElementById('scoreLoading').style.display = 'none';

  if (scores.length === 0) {
    document.getElementById('scoreEmpty').style.display = 'block';
    return;
  }

  const table = document.getElementById('scoreTable');
  const tbody = document.getElementById('scoreTableBody');
  table.style.display = 'table';
  tbody.innerHTML = '';

  scores.forEach(s => {
    let detail = '';
    try {
      const arr = JSON.parse(s.detail);
      detail = arr.map(v => v ? '✅' : '❌').join(' ');
    } catch(e) { detail = s.detail; }

    const pct   = Math.round(s.score / s.total * 100);
    const color = pct >= 80 ? '#059669' : pct >= 60 ? '#d97706' : '#dc2626';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-size:.8rem;color:#9ca3af;">${s.timestamp}</td>
      <td>${s.student_id}</td>
      <td style="font-weight:600;">${s.student_name}</td>
      <td><span class="badge badge-gray">${s.question_id}</span></td>
      <td><strong style="color:${color};">${s.score}/${s.total}</strong> <span style="font-size:.75rem;color:#9ca3af;">(${pct}%)</span></td>
      <td style="font-size:.9rem;letter-spacing:2px;">${detail}</td>
    `;
    tbody.appendChild(tr);
  });

  window._currentScores = scores;
}

function exportCSV() {
  const scores = window._currentScores;
  if (!scores || scores.length === 0) { showToast('沒有可匯出的資料'); return; }
  const header = '時間,座號,姓名,題目,得分,總分,明細';
  const rows   = scores.map(s =>
    `"${s.timestamp}","${s.student_id}","${s.student_name}","${s.question_id}",${s.score},${s.total},"${s.detail}"`
  );
  const csv = '\uFEFF' + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `scores_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  showToast('✅ CSV 已下載');
}

// ============================================================
//  工具
// ============================================================
function showToast(msg, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}
