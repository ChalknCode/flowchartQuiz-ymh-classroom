// ============================================================
//  student.js — 學生端邏輯
//  flowchartQuiz-ymh-classroom
// ============================================================

// ── 設定：部署後填入 Apps Script 網址 ──
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwQfpu_-jkffP2ZKkBzMmNxkoxYGK1aN2nRY499DutNvrb773P1dCDLGzeCXwNYU8Xk/exec';

// ── 佈局常數 ──
const COL_W       = 240;   // 每欄寬度（px）
const ROW_H       = 150;   // 每列高度（含箭頭空間）
const RECT_W      = 180;
const RECT_H      = 58;
const DIAMOND_S   = 90;    // 菱形旋轉前的正方形邊長

// ── 狀態 ──
let currentStudent  = null;
let currentQuestion = null;
let shuffledNodes   = [];   // 側欄顯示順序（打亂）
let dropValues      = {};   // zoneNodeId → droppedNodeId | null
let nodeThemes      = {};   // nodeId → 0~6（顏色主題）
let confirmed       = false;
let draggingNodeId  = null;

// ============================================================
//  Mock 資料（APPS_SCRIPT_URL 為空時使用）
// ============================================================
const MOCK_STUDENTS = {
  '101': { password: '1234', name: '王小明', class: '一年甲班' },
  '102': { password: 'abcd', name: '李小花', class: '一年甲班' },
};

const MOCK_QUESTIONS = {
  Q001: {
    question_id: 'Q001',
    title: '🍵 泡茶流程（線性）',
    nodes: [
      { id: 'n1', type: 'rect',    label: '燒開水'   },
      { id: 'n2', type: 'rect',    label: '放入茶葉' },
      { id: 'n3', type: 'rect',    label: '注入熱水' },
      { id: 'n4', type: 'rect',    label: '等待3分鐘'},
      { id: 'n5', type: 'rect',    label: '倒入茶杯' },
    ],
    connections: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
      { from: 'n3', to: 'n4' },
      { from: 'n4', to: 'n5' },
    ],
    layout: [
      { id: 'n1', row: 0, col: 0 },
      { id: 'n2', row: 1, col: 0 },
      { id: 'n3', row: 2, col: 0 },
      { id: 'n4', row: 3, col: 0 },
      { id: 'n5', row: 4, col: 0 },
    ],
  },
  Q002: {
    question_id: 'Q002',
    title: '📊 判斷成績（選擇結構）',
    nodes: [
      { id: 'n1', type: 'rect',    label: '輸入成績'   },
      { id: 'n2', type: 'diamond', label: '成績 ≥ 60?'  },
      { id: 'n3', type: 'rect',    label: '顯示及格'   },
      { id: 'n4', type: 'rect',    label: '顯示不及格' },
      { id: 'n5', type: 'rect',    label: '結束'       },
    ],
    connections: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3', label: 'Yes' },
      { from: 'n2', to: 'n4', label: 'No'  },
      { from: 'n3', to: 'n5' },
      { from: 'n4', to: 'n5' },
    ],
    layout: [
      { id: 'n1', row: 0, col: 1 },
      { id: 'n2', row: 1, col: 1 },
      { id: 'n3', row: 2, col: 0 },
      { id: 'n4', row: 2, col: 2 },
      { id: 'n5', row: 3, col: 1 },
    ],
  },
  Q003: {
    question_id: 'Q003',
    title: '🔁 猜數字遊戲（重複結構）',
    nodes: [
      { id: 'n1', type: 'rect',    label: '輸入猜測值'   },
      { id: 'n2', type: 'diamond', label: '猜對了?'      },
      { id: 'n3', type: 'rect',    label: '顯示提示訊息' },
      { id: 'n4', type: 'rect',    label: '顯示恭喜！'   },
    ],
    connections: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n4', label: 'Yes' },
      { from: 'n2', to: 'n3', label: 'No'  },
      { from: 'n3', to: 'n1' },
    ],
    layout: [
      { id: 'n1', row: 0, col: 1 },
      { id: 'n2', row: 1, col: 1 },
      { id: 'n3', row: 2, col: 0 },
      { id: 'n4', row: 2, col: 2 },
    ],
  },
};

// ============================================================
//  初始化
// ============================================================
(function init() {
  const params     = new URLSearchParams(window.location.search);
  window._qId      = params.get('q') || 'Q001';
  document.getElementById('loginId').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('loginPw').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
})();

// ============================================================
//  登入
// ============================================================
async function doLogin() {
  const id = document.getElementById('loginId').value.trim();
  const pw = document.getElementById('loginPw').value.trim();
  if (!id || !pw) { showLoginError('請輸入座號與密碼'); return; }

  document.getElementById('btnLogin').disabled = true;
  document.getElementById('btnLogin').textContent = '驗證中…';

  let result;
  try {
    if (!APPS_SCRIPT_URL) {
      const s = MOCK_STUDENTS[id];
      result = (s && s.password === pw)
        ? { ok: true, name: s.name, class: s.class }
        : { ok: false, error: '座號或密碼錯誤' };
    } else {
      const res = await fetch(
        `${APPS_SCRIPT_URL}?action=verifyStudent&studentId=${encodeURIComponent(id)}&password=${encodeURIComponent(pw)}`
      );
      result = await res.json();
    }
  } catch (e) {
    result = { ok: false, error: '連線失敗，請稍後再試' };
  }

  document.getElementById('btnLogin').disabled = false;
  document.getElementById('btnLogin').textContent = '開始作答';

  if (result.ok) {
    currentStudent = { id, name: result.name, class: result.class };
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('mainLayout').classList.remove('hidden');
    document.getElementById('mainLayout').style.display = 'flex';
    document.getElementById('studentBadge').textContent = `${result.name}（${id}）`;
    await loadQuestion(window._qId);
  } else {
    showLoginError(result.error || '座號或密碼錯誤');
  }
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
}

// ============================================================
//  載入題目
// ============================================================
async function loadQuestion(questionId) {
  let question;
  try {
    if (!APPS_SCRIPT_URL) {
      question = MOCK_QUESTIONS[questionId] || MOCK_QUESTIONS['Q001'];
      question = JSON.parse(JSON.stringify(question)); // deep copy
    } else {
      const res  = await fetch(`${APPS_SCRIPT_URL}?action=getQuestion&id=${encodeURIComponent(questionId)}`);
      const data = await res.json();
      if (!data.ok) { showToast(data.error || '載入題目失敗'); return; }
      question = data.question;
    }
  } catch (e) {
    showToast('載入題目失敗，請重新整理頁面');
    return;
  }

  currentQuestion = question;
  confirmed       = false;
  dropValues      = {};
  question.nodes.forEach(n => { dropValues[n.id] = null; });

  // 指定顏色主題（隨機）
  const pool = [0,1,2,3,4,5,6].sort(() => Math.random() - .5);
  nodeThemes = {};
  question.nodes.forEach((n, i) => { nodeThemes[n.id] = pool[i % 7]; });

  // 打亂側欄順序
  shuffledNodes = [...question.nodes].sort(() => Math.random() - .5);

  document.getElementById('questionTitle').textContent = question.title;
  document.getElementById('flowStart').classList.remove('hidden');
  document.getElementById('flowEnd').classList.remove('hidden');

  // 重置按鈕
  document.getElementById('btnConfirm').disabled = true;
  document.getElementById('btnSubmit').classList.add('hidden');
  document.getElementById('scoreBanner').classList.add('hidden');
  document.getElementById('wrongHints').classList.add('hidden');
  document.getElementById('successMsg').classList.add('hidden');

  renderSidebar();
  renderFlowchart();
}

// ============================================================
//  渲染側欄卡片
// ============================================================
function renderSidebar() {
  const list = document.getElementById('optionList');
  list.innerHTML = '';
  shuffledNodes.forEach(node => {
    const t = nodeThemes[node.id];
    const div = document.createElement('div');
    div.className = `option-card theme-${t}`;
    div.id        = `card-${node.id}`;
    div.draggable = true;
    div.dataset.nodeId = node.id;

    // 形狀示意
    const shapeDiv = document.createElement('div');
    shapeDiv.className = `card-shape ${node.type}`;
    if (node.type === 'diamond') {
      const inner = document.createElement('span');
      inner.textContent = '◇';
      inner.style.cssText = 'font-size:1.1rem;';
      shapeDiv.appendChild(inner);
    } else {
      shapeDiv.textContent = '▭';
      shapeDiv.style.fontSize = '1rem';
    }

    const grip  = document.createElement('span');
    grip.className = 'card-grip';
    grip.textContent = '⠿';

    const label = document.createElement('span');
    label.className   = 'card-label';
    label.textContent = node.label;

    div.appendChild(grip);
    div.appendChild(shapeDiv);
    div.appendChild(label);

    div.addEventListener('dragstart', onCardDragStart);
    div.addEventListener('dragend',   onCardDragEnd);
    list.appendChild(div);
  });
}

// ============================================================
//  渲染流程圖（絕對定位 + SVG 箭頭）
// ============================================================
function renderFlowchart() {
  const q      = currentQuestion;
  const layout = q.layout;
  const nodes  = q.nodes;
  const conns  = q.connections;

  const maxRow = Math.max(...layout.map(l => l.row));
  const maxCol = Math.max(...layout.map(l => l.col));
  const numCols = maxCol + 1;

  // 容器尺寸
  const totalW = numCols * COL_W;
  const totalH = (maxRow + 1) * ROW_H + 60; // +60 for arrow to END

  const wrapper = document.getElementById('flowWrapper');
  wrapper.innerHTML = '';
  wrapper.style.width  = totalW + 'px';
  wrapper.style.height = totalH + 'px';

  // 節點中心座標
  const centers = {}; // nodeId → {cx, cy}
  const layoutById = {};
  layout.forEach(l => { layoutById[l.id] = l; });
  const nodeById = {};
  nodes.forEach(n => { nodeById[n.id] = n; });

  layout.forEach(l => {
    const node = nodeById[l.id];
    const cx   = l.col * COL_W + COL_W / 2;
    const cy   = l.row * ROW_H + ROW_H / 2;
    centers[l.id] = { cx, cy };
  });

  // ── START/END 連線調整 ──
  // START badge 位於 wrapper 上方，END badge 位於下方
  // 在 flowStart/END 與第一個/最後一個節點間加箭頭（由 SVG 處理）

  // ── 建立 SVG 箭頭層 ──
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', totalW);
  svg.setAttribute('height', totalH);
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;';

  // 箭頭定義
  const defs   = document.createElementNS('http://www.w3.org/2000/svg','defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg','marker');
  marker.setAttribute('id','arrow');
  marker.setAttribute('viewBox','0 0 10 10');
  marker.setAttribute('refX','9');
  marker.setAttribute('refY','5');
  marker.setAttribute('markerWidth','7');
  marker.setAttribute('markerHeight','7');
  marker.setAttribute('orient','auto');
  const markerPath = document.createElementNS('http://www.w3.org/2000/svg','path');
  markerPath.setAttribute('d','M0,0 L10,5 L0,10 z');
  markerPath.setAttribute('fill','#6366f1');
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  // 畫連線
  conns.forEach(conn => {
    const srcLayout = layoutById[conn.from];
    const dstLayout = layoutById[conn.to];
    if (!srcLayout || !dstLayout) return;

    const srcNode = nodeById[conn.from];
    const dstNode = nodeById[conn.to];

    const { cx: sx, cy: sy } = centers[conn.from];
    const { cx: dx, cy: dy } = centers[conn.to];

    // 確定出發點和到達點
    let x1 = sx, y1, x2 = dx, y2;
    const srcH = srcNode.type === 'diamond' ? DIAMOND_S : RECT_H;
    const dstH = dstNode.type === 'diamond' ? DIAMOND_S : RECT_H;

    // 判斷方向
    if (dstLayout.row > srcLayout.row && dstLayout.col === srcLayout.col) {
      // 直下
      y1 = sy + srcH / 2;
      y2 = dy - dstH / 2;
    } else if (dstLayout.row > srcLayout.row && dstLayout.col < srcLayout.col) {
      // 向左下
      y1 = sy + srcH / 2;
      y2 = dy - dstH / 2;
    } else if (dstLayout.row > srcLayout.row && dstLayout.col > srcLayout.col) {
      // 向右下
      y1 = sy + srcH / 2;
      y2 = dy - dstH / 2;
    } else if (dstLayout.row < srcLayout.row) {
      // 向上（重複結構）
      y1 = sy - srcH / 2;
      y2 = dy + dstH / 2;
      // 使用側邊路徑
      x1 = sx - (srcNode.type === 'diamond' ? DIAMOND_S / 2 : RECT_W / 2);
      x2 = dx - (dstNode.type === 'diamond' ? DIAMOND_S / 2 : RECT_W / 2);
    } else {
      y1 = sy; y2 = dy;
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    let d;

    if (x1 === x2) {
      // 垂直直線
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else if (dstLayout.row < srcLayout.row) {
      // 重複回溯：L形路徑（左側繞回）
      const leftX = Math.min(x1, x2) - 40;
      d = `M ${x1} ${y1} L ${leftX} ${y1} L ${leftX} ${y2} L ${x2} ${y2}`;
    } else {
      // 貝茲曲線（分支）
      const midY = (y1 + y2) / 2;
      d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    }

    path.setAttribute('d', d);
    path.setAttribute('stroke', '#6366f1');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('marker-end', 'url(#arrow)');
    svg.appendChild(path);

    // Yes/No 標籤
    if (conn.label) {
      const midX = (x1 + x2) / 2;
      const midY2 = (y1 + y2) / 2;
      const text = document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('x', midX + 6);
      text.setAttribute('y', midY2 - 6);
      text.setAttribute('fill', '#7c3aed');
      text.setAttribute('font-size', '11');
      text.setAttribute('font-weight', '700');
      text.setAttribute('font-family', 'Segoe UI, Microsoft JhengHei, sans-serif');
      text.textContent = conn.label;

      // 白色背景
      const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
      const tw = conn.label.length * 7 + 8;
      bg.setAttribute('x', midX + 2);
      bg.setAttribute('y', midY2 - 20);
      bg.setAttribute('width', tw);
      bg.setAttribute('height', 16);
      bg.setAttribute('rx', '4');
      bg.setAttribute('fill', 'white');
      bg.setAttribute('opacity', '0.9');
      svg.appendChild(bg);
      svg.appendChild(text);
    }
  });

  // ── 建立放置區節點 ──
  layout.forEach(l => {
    const node = nodeById[l.id];
    const { cx, cy } = centers[l.id];
    const t = nodeThemes[node.id];

    const zoneDiv = document.createElement('div');
    zoneDiv.id            = `zone-${node.id}`;
    zoneDiv.dataset.nodeId = node.id;
    zoneDiv.dataset.type   = node.type;
    zoneDiv.style.position = 'absolute';

    if (node.type === 'rect') {
      zoneDiv.className = 'drop-zone rect-zone empty';
      zoneDiv.style.width  = RECT_W + 'px';
      zoneDiv.style.minHeight = RECT_H + 'px';
      zoneDiv.style.left   = (cx - RECT_W / 2) + 'px';
      zoneDiv.style.top    = (cy - RECT_H / 2) + 'px';

      // 序號
      const numBadge = document.createElement('div');
      numBadge.className = 'zone-num';
      numBadge.textContent = layout.indexOf(l) + 1;
      zoneDiv.appendChild(numBadge);

      const placeholder = document.createElement('span');
      placeholder.textContent = '拖放至此';
      placeholder.className   = 'zone-placeholder';
      zoneDiv.appendChild(placeholder);
    } else {
      // diamond
      zoneDiv.className = 'drop-zone diamond-zone empty';
      zoneDiv.style.width  = DIAMOND_S + 'px';
      zoneDiv.style.height = DIAMOND_S + 'px';
      zoneDiv.style.left   = (cx - DIAMOND_S / 2) + 'px';
      zoneDiv.style.top    = (cy - DIAMOND_S / 2) + 'px';

      const inner = document.createElement('div');
      inner.className = 'zone-inner';
      inner.innerHTML = '<span style="font-size:.75rem;color:#a78bfa;">拖放</span>';
      zoneDiv.appendChild(inner);

      const numBadge = document.createElement('div');
      numBadge.className = 'zone-num';
      numBadge.textContent = layout.indexOf(l) + 1;
      zoneDiv.appendChild(numBadge);
    }

    zoneDiv.addEventListener('dragover',  onZoneDragOver);
    zoneDiv.addEventListener('dragleave', onZoneDragLeave);
    zoneDiv.addEventListener('drop',      onZoneDrop);

    wrapper.appendChild(zoneDiv);
  });

  // START 連線到第一個節點
  const firstL = layout.find(l => l.row === 0);
  if (firstL) {
    const { cx, cy } = centers[firstL.id];
    const firstNode  = nodeById[firstL.id];
    const nodeTopY   = cy - (firstNode.type === 'diamond' ? DIAMOND_S / 2 : RECT_H / 2);
    // START badge 在 wrapper 上方，偏移約 -40px
    const startArrow = document.createElementNS('http://www.w3.org/2000/svg','line');
    startArrow.setAttribute('x1', cx); startArrow.setAttribute('y1', -2);
    startArrow.setAttribute('x2', cx); startArrow.setAttribute('y2', nodeTopY);
    startArrow.setAttribute('stroke','#6366f1'); startArrow.setAttribute('stroke-width','2.5');
    startArrow.setAttribute('marker-end','url(#arrow)');
    svg.appendChild(startArrow);
  }

  // 最後一個節點連線到 END
  const lastL = layout.find(l => l.row === maxRow);
  if (lastL) {
    const { cx, cy } = centers[lastL.id];
    const lastNode  = nodeById[lastL.id];
    const nodeBottomY = cy + (lastNode.type === 'diamond' ? DIAMOND_S / 2 : RECT_H / 2);
    const endArrow = document.createElementNS('http://www.w3.org/2000/svg','line');
    endArrow.setAttribute('x1', cx); endArrow.setAttribute('y1', nodeBottomY);
    endArrow.setAttribute('x2', cx); endArrow.setAttribute('y2', totalH - 2);
    endArrow.setAttribute('stroke','#6366f1'); endArrow.setAttribute('stroke-width','2.5');
    endArrow.setAttribute('marker-end','url(#arrow)');
    svg.appendChild(endArrow);
  }

  wrapper.appendChild(svg);

  // 調整 START / END 位置置中
  const startBadge = document.getElementById('flowStart');
  const endBadge   = document.getElementById('flowEnd');
  startBadge.style.marginBottom = '4px';
  endBadge.style.marginTop      = '4px';
}

// ============================================================
//  拖曳事件
// ============================================================
function onCardDragStart(e) {
  draggingNodeId = e.currentTarget.dataset.nodeId;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onCardDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
}

function onZoneDragOver(e) {
  e.preventDefault();
  if (confirmed) return;
  e.currentTarget.classList.add('drag-over');
}
function onZoneDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function onZoneDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (confirmed || !draggingNodeId) return;
  const zoneNodeId = e.currentTarget.dataset.nodeId;
  placeCard(zoneNodeId, draggingNodeId);
}

// ============================================================
//  放置卡片
// ============================================================
function placeCard(zoneNodeId, droppingNodeId) {
  // 如果目標區已有卡片，先釋放舊卡片
  const prev = dropValues[zoneNodeId];
  if (prev !== null) releaseCard(prev);

  // 如果拖曳的卡片原本在某個區域，先清空那個區域
  const prevZone = Object.keys(dropValues).find(k => dropValues[k] === droppingNodeId);
  if (prevZone) {
    dropValues[prevZone] = null;
    renderZoneEmpty(prevZone);
  }

  // 放入
  dropValues[zoneNodeId] = droppingNodeId;
  document.getElementById(`card-${droppingNodeId}`)?.classList.add('used');
  renderZoneFilled(zoneNodeId, droppingNodeId);
  checkConfirmBtn();
}

function releaseCard(nodeId) {
  document.getElementById(`card-${nodeId}`)?.classList.remove('used');
}

function removeFromZone(zoneNodeId) {
  if (confirmed) return;
  const droppedId = dropValues[zoneNodeId];
  if (droppedId !== null) {
    releaseCard(droppedId);
    dropValues[zoneNodeId] = null;
    renderZoneEmpty(zoneNodeId);
    checkConfirmBtn();
  }
}

// ============================================================
//  渲染放置區狀態
// ============================================================
function renderZoneEmpty(zoneNodeId) {
  const zone = document.getElementById(`zone-${zoneNodeId}`);
  if (!zone) return;
  const node = currentQuestion.nodes.find(n => n.id === zoneNodeId);
  const idx  = currentQuestion.layout.findIndex(l => l.id === zoneNodeId);

  zone.innerHTML = '';
  if (node.type === 'rect') {
    zone.className = 'drop-zone rect-zone empty';
    const nb = document.createElement('div'); nb.className='zone-num'; nb.textContent = idx + 1;
    const ph = document.createElement('span'); ph.textContent='拖放至此'; ph.className='zone-placeholder';
    zone.appendChild(nb); zone.appendChild(ph);
  } else {
    zone.className = 'drop-zone diamond-zone empty';
    const inner = document.createElement('div'); inner.className='zone-inner';
    inner.innerHTML='<span style="font-size:.75rem;color:#a78bfa;">拖放</span>';
    zone.appendChild(inner);
    const nb = document.createElement('div'); nb.className='zone-num'; nb.textContent = idx + 1;
    zone.appendChild(nb);
  }
  attachZoneEvents(zone);
}

function renderZoneFilled(zoneNodeId, droppedNodeId) {
  const zone      = document.getElementById(`zone-${zoneNodeId}`);
  if (!zone) return;
  const zoneNode  = currentQuestion.nodes.find(n => n.id === zoneNodeId);
  const cardNode  = currentQuestion.nodes.find(n => n.id === droppedNodeId);
  const t         = nodeThemes[droppedNodeId];
  const idx       = currentQuestion.layout.findIndex(l => l.id === zoneNodeId);

  zone.innerHTML = '';

  if (zoneNode.type === 'rect') {
    zone.className = `drop-zone rect-zone filled theme-${t}`;
    const nb = document.createElement('div'); nb.className='zone-num'; nb.textContent = idx + 1;

    const content = document.createElement('div');
    content.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;padding:0 10px;';

    const shapeEl = document.createElement('div');
    shapeEl.style.cssText = 'font-size:.9rem;flex-shrink:0;';
    shapeEl.textContent = cardNode.type === 'diamond' ? '◇' : '▭';

    const lbl = document.createElement('span');
    lbl.className = 'card-label'; lbl.textContent = cardNode.label;

    const rmBtn = document.createElement('button');
    rmBtn.innerHTML = '✕';
    rmBtn.style.cssText = 'margin-left:auto;background:none;border:none;color:#9ca3af;cursor:pointer;font-size:.9rem;padding:2px 4px;border-radius:4px;';
    rmBtn.onclick = () => removeFromZone(zoneNodeId);

    content.appendChild(shapeEl);
    content.appendChild(lbl);
    content.appendChild(rmBtn);
    zone.appendChild(nb);
    zone.appendChild(content);
  } else {
    zone.className = `drop-zone diamond-zone filled theme-${t}`;
    const inner = document.createElement('div'); inner.className='zone-inner';

    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:.72rem;font-weight:700;text-align:center;padding:4px;';
    lbl.textContent = cardNode.label;

    const rmBtn = document.createElement('button');
    rmBtn.innerHTML = '✕';
    rmBtn.style.cssText = 'background:none;border:none;color:#9ca3af;cursor:pointer;font-size:.75rem;margin-top:2px;';
    rmBtn.onclick = () => removeFromZone(zoneNodeId);

    inner.appendChild(lbl); inner.appendChild(rmBtn);
    zone.appendChild(inner);

    const nb = document.createElement('div'); nb.className='zone-num'; nb.textContent = idx + 1;
    zone.appendChild(nb);
  }
  attachZoneEvents(zone);
}

function attachZoneEvents(zone) {
  zone.addEventListener('dragover',  onZoneDragOver);
  zone.addEventListener('dragleave', onZoneDragLeave);
  zone.addEventListener('drop',      onZoneDrop);
}

// ============================================================
//  確認答案按鈕
// ============================================================
function checkConfirmBtn() {
  const allFilled = Object.values(dropValues).every(v => v !== null);
  document.getElementById('btnConfirm').disabled = !allFilled;
}

// ============================================================
//  確認答案
// ============================================================
function confirmAnswer() {
  confirmed = true;
  document.getElementById('btnConfirm').disabled = true;

  let correctCount = 0;
  const wrongHintLines = [];

  currentQuestion.nodes.forEach(node => {
    const zone       = document.getElementById(`zone-${node.id}`);
    const droppedId  = dropValues[node.id];
    const isCorrect  = droppedId === node.id;

    if (isCorrect) {
      correctCount++;
      zone.classList.remove('filled');
      zone.classList.add('correct');
      // 加勾
      const tick = document.createElement('span');
      tick.textContent = ' ✅';
      tick.style.cssText = 'position:absolute;top:4px;right:6px;font-size:1rem;';
      zone.appendChild(tick);
    } else {
      zone.classList.remove('filled');
      zone.classList.add('incorrect');
      const cross = document.createElement('span');
      cross.textContent = ' ❌';
      cross.style.cssText = 'position:absolute;top:4px;right:6px;font-size:1rem;';
      zone.appendChild(cross);
      wrongHintLines.push(`位置 ${currentQuestion.layout.findIndex(l => l.id === node.id) + 1} 正確答案：${node.label}`);
    }
  });

  const total = currentQuestion.nodes.length;
  document.getElementById('scoreNum').textContent  = `${correctCount} / ${total}`;
  document.getElementById('scoreBanner').classList.remove('hidden');

  if (wrongHintLines.length) {
    const el = document.getElementById('wrongHints');
    el.innerHTML = wrongHintLines.join('<br>');
    el.classList.remove('hidden');
  }

  document.getElementById('btnSubmit').classList.remove('hidden');
}

// ============================================================
//  提交成績
// ============================================================
async function submitScore() {
  const btn = document.getElementById('btnSubmit');
  btn.disabled    = true;
  btn.textContent = '送出中…';

  const total   = currentQuestion.nodes.length;
  const correct = currentQuestion.nodes.filter(n => dropValues[n.id] === n.id).length;
  const detail  = currentQuestion.nodes.map(n => dropValues[n.id] === n.id);

  try {
    if (APPS_SCRIPT_URL) {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action:       'submitScore',
          data: {
            student_id:   currentStudent.id,
            student_name: currentStudent.name,
            question_id:  currentQuestion.question_id,
            score:        correct,
            total,
            detail,
          }
        })
      });
    } else {
      // Mock: 模擬延遲
      await new Promise(r => setTimeout(r, 800));
    }
  } catch (e) { /* 忽略錯誤，仍顯示成功 */ }

  btn.classList.add('hidden');
  document.getElementById('successMsg').classList.remove('hidden');
}

// ============================================================
//  工具函式
// ============================================================
function showToast(msg, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}
