// ============================================================
//  student.js — 學生端邏輯 (更新為 3-Zone Layout + 新版型)
// ============================================================

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzqpx68O_39_O1MK2aXFLg1dP97r4RVyDzKG7ES9mmc6L79WgQ4KfmBxvw2JTGqSWNS/exec';

// ── 狀態 ──
let currentStudent  = null;
let currentQuestion = null;
let dropState       = {}; // zoneId -> { droppedNodeId, isCorrect }
let timerInterval   = null;
let totalSeconds    = 300;
let timeElapsed     = 0;
let scoreResult     = null;

// ── 初始化 ──
window.onload = () => {
  initLoginAnimation();
  const urlParams = new URLSearchParams(window.location.search);
  const qId = urlParams.get('q') || 'Q001';
  document.getElementById('tbQid').textContent = '📋 ' + qId;
};

// ── 登入畫面動畫 (來自 login_preview.html) ──
let shapeStates = [];
function initLoginAnimation() {
  const bg = document.getElementById('lpBg');
  if (!bg) return;
  // 建立模糊漸層圓
  for(let i=0; i<3; i++) {
    const b = document.createElement('div');
    b.style.position = 'absolute';
    b.style.width = '600px'; b.style.height = '600px';
    b.style.borderRadius = '50%'; b.style.filter = 'blur(100px)';
    b.style.opacity = '0.5'; b.style.zIndex = '0';
    if(i===0) { b.style.background = '#818cf8'; b.style.top = '-100px'; b.style.left = '-100px'; }
    if(i===1) { b.style.background = '#c084fc'; b.style.bottom = '-100px'; b.style.right = '-100px'; }
    if(i===2) { b.style.background = '#f472b6'; b.style.bottom = '-200px'; b.style.left = '30%'; }
    bg.appendChild(b);
  }
  
  // 建立漂浮圖形
  const types = ['oval','rect','para','diam'];
  const colors = [
    { bg:'linear-gradient(135deg,#eef2ff,#e0e7ff)', bd:'#6366f1', text:'#3730a3' },
    { bg:'linear-gradient(135deg,#f0f9ff,#e0f2fe)', bd:'#0ea5e9', text:'#0c4a6e' },
    { bg:'linear-gradient(135deg,#fffbeb,#fef3c7)', bd:'#f59e0b', text:'#78350f' },
    { bg:'linear-gradient(135deg,#fdf2f8,#fce7f3)', bd:'#ec4899', text:'#831843' }
  ];
  
  for(let i=0; i<8; i++) {
    const isMobile = window.innerWidth <= 768;
    const type = types[i%4];
    const col = colors[i%4];
    
    const el = document.createElement('div');
    el.className = 'lp-shape';
    
    // 生成圖形 HTML
    if(type === 'oval') {
      el.innerHTML = `<div style="height:34px;border-radius:99px;border:2.5px solid ${col.bd};background:${col.bg};display:flex;align-items:center;padding:0 12px;font-family:'M PLUS Rounded 1c',sans-serif;font-size:.76rem;font-weight:800;color:${col.text};white-space:nowrap;">開始</div>`;
    } else if(type === 'rect') {
      el.innerHTML = `<div style="height:34px;border-radius:6px;border:2.5px solid ${col.bd};background:${col.bg};display:flex;align-items:center;padding:0 12px;font-family:'M PLUS Rounded 1c',sans-serif;font-size:.76rem;font-weight:800;color:${col.text};white-space:nowrap;">設定變數</div>`;
    } else if(type === 'para') {
      el.innerHTML = `<div style="height:36px;position:relative;display:flex;align-items:center;padding:0 12px;"><div style="position:absolute;inset:0 4px;border:2.5px solid ${col.bd};border-radius:2px;transform:skewX(-16deg);background:${col.bg};"></div><span style="position:relative;z-index:1;font-family:'M PLUS Rounded 1c',sans-serif;font-size:.76rem;font-weight:800;color:${col.text};white-space:nowrap;">輸入資料</span></div>`;
    } else if(type === 'diam') {
      el.innerHTML = `<div style="height:58px;position:relative;display:flex;align-items:center;padding:0 12px;min-width:140px;justify-content:center;"><svg viewBox="0 0 128 58" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;"><polygon points="64,2 126,29 64,56 2,29" fill="${col.bg.replace(/linear-gradient.*?,(.*?),.*?\)/,'$1')}" stroke="${col.bd}" stroke-width="2.5"/></svg><span style="position:relative;z-index:1;font-family:'M PLUS Rounded 1c',sans-serif;font-size:.72rem;font-weight:800;color:${col.text};white-space:nowrap;">重複執行?</span></div>`;
    }
    
    bg.appendChild(el);
    
    shapeStates.push({
      el: el,
      axPx: window.innerWidth/2,
      ayPx: window.innerHeight/2,
      rx: (isMobile ? 120 : 250) + Math.random()*200,
      ry: (isMobile ? 150 : 250) + Math.random()*150,
      speed: (Math.random() * 0.4 + 0.72) * (Math.random()>0.5?1:-1),
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * 20 - 10
    });
  }
  
  // 開始動畫迴圈
  requestAnimationFrame(animLoop);
}

function animLoop(t) {
  const ts = t / 1000; // 秒
  shapeStates.forEach(st => {
    const dx = Math.cos(ts * st.speed + st.phase) * st.rx;
    const dy = Math.sin(ts * st.speed + st.phase) * st.ry;
    const px = st.axPx + dx;
    const py = st.ayPx + dy;
    st.el.style.transform = `translate(${px}px, ${py}px) rotate(${st.rot}deg)`;
  });
  requestAnimationFrame(animLoop);
}


// ── 登入邏輯 ──
async function doLogin() {
  const sId = document.getElementById('loginId').value.trim();
  const pw  = document.getElementById('loginPw').value.trim();
  const err = document.getElementById('loginError');
  const btn = document.getElementById('btnLogin');
  
  if(!sId || !pw) {
    err.textContent = '請輸入座號與密碼';
    return;
  }
  
  btn.innerHTML = '<span class="loading-dots">登入中</span>';
  err.textContent = '';
  
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'verifyStudent', studentId: sId, password: pw })
    });
    const json = await res.json();
    
    if (json.ok) {
      currentStudent = { id: sId, name: json.name, class: json.class };
      document.getElementById('tbUser').textContent = `${json.name}（${sId}）`;
      
      // 隱藏登入，顯示主畫面
      document.getElementById('viewLogin').style.display = 'none';
      document.getElementById('viewQuiz').style.display = 'flex';
      
      // 載入題目
      const qId = new URLSearchParams(window.location.search).get('q') || 'Q001';
      loadQuestion(qId);
      
      // 開始計時
      startTimer();
    } else {
      err.textContent = json.error || '登入失敗';
      btn.textContent = '開始作答';
    }
  } catch (e) {
    err.textContent = '網路錯誤，請稍後再試';
    btn.textContent = '開始作答';
  }
}

// ── 計時器 ──
function startTimer() {
  totalSeconds = currentQuestion.time_limit ? parseInt(currentQuestion.time_limit) : 300;
  timeElapsed = 0;
  const timerEl = document.getElementById('tbTimer');
  
  timerInterval = setInterval(() => {
    totalSeconds--;
    timeElapsed++;
    
    if (totalSeconds <= 0) {
      clearInterval(timerInterval);
      timerEl.textContent = '⏱ 00:00';
      timerEl.style.background = 'rgba(239,68,68,.4)'; // 紅色
      // 時間到自動確認答案
      confirmAnswer();
      return;
    }
    
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    timerEl.textContent = `⏱ ${m}:${s}`;
    
    if (totalSeconds <= 60) {
      timerEl.style.background = 'rgba(239,68,68,.35)';
    }
  }, 1000);
}

// ── 載入題目 ──
async function loadQuestion(qId) {
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=getQuestion&id=${qId}`);
    const json = await res.json();
    
    if (json.ok) {
      currentQuestion = json.question;
      document.getElementById('qTitle').textContent = currentQuestion.title || '無標題';
      document.getElementById('tbQid').textContent = '📋 ' + currentQuestion.question_id;
      renderQuiz();
    } else {
      alert('載入題目失敗: ' + json.error);
    }
  } catch(e) {
    alert('網路錯誤，無法載入題目');
  }
}

// ── 渲染測驗畫面 ──
function renderQuiz() {
  dropState = {}; // reset
  
  // 1. 建立左側積木 (打亂順序)
  let nodes = [...currentQuestion.nodes];
  // 簡單洗牌
  nodes.sort(() => Math.random() - 0.5);
  
  const blockList = document.getElementById('blockList');
  blockList.innerHTML = '';
  
  nodes.forEach(n => {
    // 外層 wrapper
    const wrap = document.createElement('div');
    wrap.className = 'blk-shape';
    wrap.draggable = true;
    wrap.id = 'drag-' + n.id;
    wrap.dataset.nodeId = n.id;
    wrap.dataset.nodeType = n.type;
    wrap.dataset.nodeLabel = n.label;
    
    // 內層形狀
    wrap.innerHTML = getShapeHTML(n.type, n.label, false);
    
    // 綁定拖曳事件
    wrap.addEventListener('dragstart', handleDragStart);
    wrap.addEventListener('dragend', handleDragEnd);
    
    blockList.appendChild(wrap);
  });
  
  // 2. 建立右側流程圖格子
  // 簡化: 照 row 排序依序往下畫
  const layout = [...currentQuestion.layout].sort((a,b) => a.row - b.row);
  const flowCol = document.getElementById('flowCol');
  flowCol.innerHTML = '';
  
  document.getElementById('tbScoreTotal').textContent = layout.length;
  document.getElementById('tbScoreNum').textContent = '0';
  
  layout.forEach((pos, idx) => {
    const nodeDef = currentQuestion.nodes.find(n => n.id === pos.id);
    if (!nodeDef) return;
    
    // Drop zone container
    const dzWrap = document.createElement('div');
    dzWrap.className = 'dz-wrap';
    dzWrap.style.position = 'relative';
    dzWrap.style.marginBottom = '12px'; // space for arrow
    
    // Drop zone
    const dz = document.createElement('div');
    dz.className = getDropZoneClass(nodeDef.type);
    dz.id = 'dz-' + pos.id;
    dz.dataset.zoneId = pos.id;
    dz.dataset.expectedType = nodeDef.type;
    
    dz.innerHTML = getDropZoneInnerHTML(nodeDef.type);
    
    // 綁定放置事件
    dz.addEventListener('dragover', handleDragOver);
    dz.addEventListener('dragleave', handleDragLeave);
    dz.addEventListener('drop', handleDrop);
    
    dzWrap.appendChild(dz);
    
    // 箭頭 (除了最後一個)
    if (idx < layout.length - 1) {
      const arr = document.createElement('div');
      arr.className = 'arr';
      dzWrap.appendChild(arr);
    }
    
    flowCol.appendChild(dzWrap);
  });
}

// ── 形狀 HTML 產生器 ──
function getShapeHTML(type, label, isFinishedState) {
  if (type === 'oval') {
    return `<div class="${isFinishedState ? 'fn-o' : 'bs-oval'}">${label}</div>`;
  } else if (type === 'rect') {
    return `<div class="${isFinishedState ? 'fn-r' : 'bs-rect'}">${label}</div>`;
  } else if (type === 'parallelogram') {
    return `
      <div class="${isFinishedState ? 'fn-p' : 'bs-para-wrap'}">
        <div class="${isFinishedState ? 'fn-p-bg' : 'bs-para-bg'}"></div>
        <span class="${isFinishedState ? 'fn-p-txt' : 'bs-para-txt'}">${label}</span>
      </div>
    `;
  } else if (type === 'diamond') {
    // Diamond SVG needs different colors for sidebar vs finished
    const svgInner = isFinishedState 
      ? `<polygon points="83,3 163,33 83,63 3,33" fill="#fff0f8" stroke="#ec4899" stroke-width="2.5"/>`
      : `<polygon points="64,2 126,29 64,56 2,29" fill="url(#dg)" stroke="#ec4899" stroke-width="2.5"/>
         <defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fdf2f8"/><stop offset="100%" stop-color="#fce7f3"/></linearGradient></defs>`;
    const svgBox = isFinishedState ? `viewBox="0 0 166 66"` : `viewBox="0 0 128 58" preserveAspectRatio="none"`;
    return `
      <div class="${isFinishedState ? 'fn-d' : 'bs-diam-wrap'}">
        <svg ${svgBox}>${svgInner}</svg>
        <span class="${isFinishedState ? 'fn-d-txt' : 'bs-diam-txt'}">${label}</span>
      </div>
    `;
  }
  return `<div>${label}</div>`;
}

function getDropZoneClass(type) {
  if (type === 'oval') return 'dz-o';
  if (type === 'rect') return 'dz-r';
  if (type === 'parallelogram') return 'dz-p';
  if (type === 'diamond') return 'dz-d';
  return 'dz-r';
}

function getDropZoneInnerHTML(type) {
  if (type === 'parallelogram') {
    return `<div class="dz-p-bg"></div><span class="dz-p-txt">拖放至此</span>`;
  } else if (type === 'diamond') {
    return `
      <svg viewBox="0 0 166 66">
        <polygon points="83,3 163,33 83,63 3,33" fill="#fff0f8" stroke="#ec4899" stroke-width="2.5" stroke-dasharray="5,3"/>
      </svg>
      <span class="dz-d-txt">拖放至此</span>
    `;
  }
  return `拖放至此`;
}

// ── 拖曳事件 ──
let draggedNodeData = null;

function handleDragStart(e) {
  this.classList.add('dragging');
  draggedNodeData = {
    id: this.dataset.nodeId,
    type: this.dataset.nodeType,
    label: this.dataset.nodeLabel
  };
  e.dataTransfer.effectAllowed = 'move';
  // 必須 set data 不然有些瀏覽器不給拖
  e.dataTransfer.setData('text/plain', this.dataset.nodeId);
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  draggedNodeData = null;
}

function handleDragOver(e) {
  e.preventDefault(); // 允許放下
  // 如果已經填了，不准放
  if (this.classList.contains('filled')) return;
  this.classList.add('dz-dragover');
}

function handleDragLeave(e) {
  this.classList.remove('dz-dragover');
}

function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('dz-dragover');
  
  if (!draggedNodeData) return;
  if (this.classList.contains('filled')) return;
  
  const zoneId = this.dataset.zoneId;
  const expectedType = this.dataset.expectedType;
  
  // 視覺更新：把格子變成 "已填" 狀態
  this.classList.add('filled');
  this.innerHTML = getShapeHTML(draggedNodeData.type, draggedNodeData.label, true);
  
  // 加入移除按鈕
  const rmBtn = document.createElement('div');
  rmBtn.className = 'btn-remove';
  rmBtn.innerHTML = '×';
  rmBtn.title = '移除';
  rmBtn.onclick = (ev) => {
    ev.stopPropagation();
    removeBlock(zoneId, draggedNodeData.id, expectedType, this);
  };
  this.appendChild(rmBtn);
  
  // 紀錄資料
  dropState[zoneId] = {
    droppedNodeId: draggedNodeData.id,
    droppedType: draggedNodeData.type,
    droppedLabel: draggedNodeData.label
  };
  
  // 將左邊對應積木設為已使用
  document.getElementById('drag-' + draggedNodeData.id).classList.add('used');
  
  checkAllFilled();
}

function removeBlock(zoneId, nodeId, expectedType, dzEl) {
  // 清除資料
  delete dropState[zoneId];
  
  // 恢復格子外觀
  dzEl.classList.remove('filled');
  dzEl.innerHTML = getDropZoneInnerHTML(expectedType);
  // 清除可能殘留的驗證 class
  dzEl.classList.remove('sc', 'sw', 'sf');
  
  // 恢復左邊積木
  document.getElementById('drag-' + nodeId).classList.remove('used');
  
  checkAllFilled();
}

function checkAllFilled() {
  const total = currentQuestion.layout.length;
  const filled = Object.keys(dropState).length;
  const btnOk = document.getElementById('btnConfirm');
  
  if (filled === total) {
    btnOk.disabled = false;
  } else {
    btnOk.disabled = true;
  }
}

// ── 確認答案 ──
function confirmAnswer() {
  let correctCount = 0;
  const total = currentQuestion.layout.length;
  
  // 暫停計時器
  if (timerInterval) clearInterval(timerInterval);
  
  // 驗證每一個格子
  currentQuestion.layout.forEach(pos => {
    const zoneId = pos.id;
    const dzEl = document.getElementById('dz-' + zoneId);
    const dropInfo = dropState[zoneId];
    
    // 找出正確解答應該是什麼
    const expectedNode = currentQuestion.nodes.find(n => n.id === zoneId);
    
    // 清除移除按鈕
    const rmBtn = dzEl.querySelector('.btn-remove');
    if (rmBtn) rmBtn.remove();
    
    dzEl.classList.add('sf'); // solid border
    
    if (dropInfo && dropInfo.droppedType === expectedNode.type && dropInfo.droppedLabel === expectedNode.label) {
      // 正確
      correctCount++;
      dzEl.classList.add('sc');
      // 改掉裡面的文字加勾勾
      const txtEl = dzEl.querySelector('div, span.fn-p-txt, span.fn-d-txt');
      if(txtEl && !txtEl.classList.contains('fn-p-bg')) {
        txtEl.innerHTML += ' ✅';
      }
    } else {
      // 錯誤
      dzEl.classList.add('sw');
      const txtEl = dzEl.querySelector('div, span.fn-p-txt, span.fn-d-txt');
      if(txtEl && !txtEl.classList.contains('fn-p-bg')) {
        txtEl.innerHTML += ' ❌';
      }
    }
  });
  
  document.getElementById('tbScoreNum').textContent = correctCount;
  
  // 隱藏確認按鈕，顯示提交按鈕
  document.getElementById('btnConfirm').style.display = 'none';
  document.getElementById('btnSubmit').style.display = 'block';
  
  // 儲存結果以供提交
  scoreResult = {
    score: Math.round((correctCount / total) * 100),
    correct: correctCount,
    total: total
  };
}

// ── 提交成績 ──
async function submitScore() {
  if (!scoreResult || !currentStudent || !currentQuestion) return;
  
  // 加上「再次確認」的防呆提示
  const isConfirmed = confirm("確定要提交這份成績嗎？\n提交後就無法修改囉！");
  if (!isConfirmed) return;
  
  const btn = document.getElementById('btnSubmit');
  btn.innerHTML = '<span class="loading-dots">提交中</span>';
  btn.disabled = true;
  
  const payload = {
    action: 'submitScore',
    data: {
      student_id: currentStudent.id,
      question_id: currentQuestion.question_id,
      score: scoreResult.score,
      detail: {
        correct: scoreResult.correct,
        total: scoreResult.total,
        time_seconds: timeElapsed
      }
    }
  };
  
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    
    if (json.ok) {
      showSuccessModal();
    } else {
      alert('提交失敗：' + json.error);
      btn.innerHTML = '📤 重新提交';
      btn.disabled = false;
    }
  } catch(e) {
    alert('網路錯誤，無法提交');
    btn.innerHTML = '📤 重新提交';
    btn.disabled = false;
  }
}

function showSuccessModal() {
  const mod = document.getElementById('submitModal');
  document.getElementById('modName').textContent = currentStudent.name;
  
  const m = String(Math.floor(timeElapsed / 60)).padStart(2, '0');
  const s = String(timeElapsed % 60).padStart(2, '0');
  document.getElementById('modTime').textContent = `${m}:${s}`;
  
  document.getElementById('modScore').textContent = `${scoreResult.correct}/${scoreResult.total}`;
  
  mod.style.display = 'flex';
}
