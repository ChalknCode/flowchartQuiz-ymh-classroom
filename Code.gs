// ============================================================
//  flowchartQuiz-ymh-classroom — Google Apps Script (Code.gs)
//  複製此檔案全部內容，貼入你的 Google Apps Script 編輯器
// ============================================================

// ── 設定你的 Google Sheets ID（從試算表網址複製）──
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';

// ── Gemini API Key（從 Google AI Studio 取得）──
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';

// ============================================================
//  路由入口
// ============================================================
function doGet(e) {
  const action = e.parameter.action || '';
  let result;
  try {
    switch (action) {
      case 'getQuestion':    result = getQuestion(e.parameter.id);      break;
      case 'getAllQuestions':result = getAllQuestions();                  break;
      case 'getScores':      result = getScores(e.parameter.questionId, e.parameter.studentId); break;
      case 'verifyStudent':  result = verifyStudent(e.parameter.studentId, e.parameter.password); break;
      default:               result = { ok: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let body, result;
  try {
    body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case 'submitScore':   result = submitScore(body.data);            break;
      case 'saveQuestion':  result = saveQuestion(body.data);           break;
      case 'updateQuestion':result = updateQuestion(body.data);         break;
      case 'deleteQuestion':result = deleteQuestion(body.questionId);   break;
      case 'toggleActive':  result = toggleActive(body.questionId, body.active); break;
      case 'analyzeImage':  result = analyzeImage(body.imageBase64, body.mimeType); break;
      case 'verifyStudent': result = verifyStudent(body.studentId, body.password); break;
      default:              result = { ok: false, error: 'Unknown action: ' + body.action };
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  學生驗證
// ============================================================
function verifyStudent(studentId, password) {
  const sheet = getSheet('students');
  const data  = sheet.getDataRange().getValues();
  // 第一行為標題：student_id | password | name | class
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(studentId) &&
        String(data[i][1]) === String(password)) {
      return { ok: true, name: data[i][2], class: data[i][3] };
    }
  }
  return { ok: false, error: '座號或密碼錯誤' };
}

// ============================================================
//  題目相關
// ============================================================
function getQuestion(questionId) {
  const sheet = getSheet('questions');
  const data  = sheet.getDataRange().getValues();
  // 標題：question_id | title | data | is_active | created_at
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(questionId)) {
      const isActive = data[i][3];
      if (!isActive) return { ok: false, error: '此題目尚未開放' };
      let qData;
      try { qData = JSON.parse(data[i][2]); } catch (e) { return { ok: false, error: '題目資料格式錯誤' }; }
      return { ok: true, question: { question_id: data[i][0], title: data[i][1], ...qData } };
    }
  }
  return { ok: false, error: '找不到題目：' + questionId };
}

function getAllQuestions() {
  const sheet = getSheet('questions');
  const data  = sheet.getDataRange().getValues();
  const questions = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    questions.push({
      question_id: data[i][0],
      title:       data[i][1],
      is_active:   data[i][3],
      created_at:  data[i][4] ? Utilities.formatDate(new Date(data[i][4]), 'Asia/Taipei', 'yyyy-MM-dd') : ''
    });
  }
  return { ok: true, questions };
}

function saveQuestion(data) {
  const sheet = getSheet('questions');
  // 產生新 ID
  const allData = sheet.getDataRange().getValues();
  const maxId = allData.slice(1)
    .map(r => parseInt(String(r[0]).replace('Q','')) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  const newId = 'Q' + String(maxId + 1).padStart(3, '0');
  const jsonStr = JSON.stringify({
    nodes:       data.nodes,
    connections: data.connections,
    layout:      data.layout
  });
  sheet.appendRow([newId, data.title, jsonStr, true, new Date()]);
  return { ok: true, question_id: newId };
}

function updateQuestion(data) {
  const sheet = getSheet('questions');
  const allData = sheet.getDataRange().getValues();
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][0]) === String(data.question_id)) {
      const jsonStr = JSON.stringify({
        nodes:       data.nodes,
        connections: data.connections,
        layout:      data.layout
      });
      sheet.getRange(i + 1, 2).setValue(data.title);
      sheet.getRange(i + 1, 3).setValue(jsonStr);
      return { ok: true };
    }
  }
  return { ok: false, error: '找不到題目' };
}

function deleteQuestion(questionId) {
  const sheet = getSheet('questions');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(questionId)) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: '找不到題目' };
}

function toggleActive(questionId, active) {
  const sheet = getSheet('questions');
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(questionId)) {
      sheet.getRange(i + 1, 4).setValue(active);
      return { ok: true };
    }
  }
  return { ok: false, error: '找不到題目' };
}

// ============================================================
//  成績相關
// ============================================================
function submitScore(data) {
  const sheet = getSheet('scores');
  sheet.appendRow([
    new Date(),
    data.student_id,
    data.student_name,
    data.question_id,
    data.score,
    data.total,
    JSON.stringify(data.detail)
  ]);
  return { ok: true };
}

function getScores(questionId, studentId) {
  const sheet = getSheet('scores');
  const data  = sheet.getDataRange().getValues();
  // 標題：timestamp | student_id | student_name | question_id | score | total | detail
  let scores = data.slice(1).filter(r => !!r[0]);
  if (questionId) scores = scores.filter(r => String(r[3]) === String(questionId));
  if (studentId)  scores = scores.filter(r => String(r[1]) === String(studentId));
  return {
    ok: true,
    scores: scores.map(r => ({
      timestamp:    Utilities.formatDate(new Date(r[0]), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'),
      student_id:   r[1],
      student_name: r[2],
      question_id:  r[3],
      score:        r[4],
      total:        r[5],
      detail:       r[6]
    }))
  };
}

// ============================================================
//  Gemini AI 圖片辨識
// ============================================================
function analyzeImage(imageBase64, mimeType) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    return { ok: false, error: '請先設定 GEMINI_API_KEY' };
  }

  const prompt = `你是一個流程圖辨識專家。請分析這張流程圖圖片，並以 JSON 格式回傳以下資訊：
{
  "title": "流程圖的標題（如果圖中沒有標題，請根據內容猜測）",
  "nodes": [
    {"id": "n1", "type": "rect", "label": "節點文字"},
    {"id": "n2", "type": "diamond", "label": "判斷條件文字"},
    ...
  ],
  "connections": [
    {"from": "n1", "to": "n2"},
    {"from": "n2", "to": "n3", "label": "Yes"},
    {"from": "n2", "to": "n4", "label": "No"},
    ...
  ],
  "layout": [
    {"id": "n1", "row": 0, "col": 1},
    ...
  ]
}
規則：
- 矩形 (rect) 代表一般步驟或動作
- 菱形 (diamond) 代表判斷或條件
- 橢圓形/圓角矩形也算 rect
- connections 的 label 只在分支時填寫（Yes/No 或其他文字）
- layout 中 col 從 0 開始，讓分支節點在不同欄
- 只回傳 JSON，不要有其他文字`;

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } }
      ]
    }]
  };

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY;
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  try {
    const text = json.candidates[0].content.parts[0].text;
    // 擷取 JSON 部分
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, error: 'AI 無法辨識此圖片' };
    const parsed = JSON.parse(match[0]);
    return { ok: true, data: parsed };
  } catch (e) {
    return { ok: false, error: 'AI 回應解析失敗：' + e.message };
  }
}

// ============================================================
//  工具函式
// ============================================================
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // 自動建立標題列
    if (name === 'students') {
      sheet.appendRow(['student_id', 'password', 'name', 'class']);
      // 預設測試帳號
      sheet.appendRow(['101', '1234', '王小明', '一年甲班']);
      sheet.appendRow(['102', 'abcd', '李小花', '一年甲班']);
    } else if (name === 'questions') {
      sheet.appendRow(['question_id', 'title', 'data', 'is_active', 'created_at']);
    } else if (name === 'scores') {
      sheet.appendRow(['timestamp', 'student_id', 'student_name', 'question_id', 'score', 'total', 'detail']);
    }
  }
  return sheet;
}
