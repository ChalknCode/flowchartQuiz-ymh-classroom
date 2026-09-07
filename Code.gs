// ============================================================
//  flowchartQuiz-ymh-classroom — Google Apps Script (Code.gs)
//  複製此檔案全部內容，貼入你的 Google Apps Script 編輯器
// ============================================================

// ── 設定你的 Google Sheets ID（從試算表網址複製）──
const SPREADSHEET_ID = '1TSKaYAxUGXN1Dfvw6NAvt_btJLiziNW9VQam8LUF8LY';

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
  const sheet = getSheet('學生驗證資料');
  const data  = sheet.getDataRange().getValues();
  // 欄位：A=帳號[0] | B=班級[1] | C=座號[2] | D=姓名[3] | E=密碼[4]
  for (let i = 1; i < data.length; i++) {
    // 使用「帳號(A)」欄位作為登入帳號
    if (String(data[i][0]) === String(studentId) &&
        String(data[i][4]) === String(password)) {
      return { ok: true, name: data[i][3], class: data[i][1] };
    }
  }
  return { ok: false, error: '帳號或密碼錯誤' };
}

// ============================================================
//  題目相關
// ============================================================
function getQuestion(questionId) {
  const sheet = getSheet('questions');
  const data  = sheet.getDataRange().getValues();
  // 欄位：A=Question_id[0] | B=title[1] | C=is_active[2] | D=data[3]
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(questionId)) {
      const isActive = data[i][2]; // C欄
      if (!isActive) return { ok: false, error: '此題目尚未開放' };
      let qData;
      try { qData = JSON.parse(data[i][3]); } catch (e) { return { ok: false, error: '題目資料格式錯誤' }; }
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
      is_active:   data[i][2], // C欄
      created_at:  ''
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
    layout:      data.layout,
    time_limit:  data.time_limit || 300,
    description: data.description || ''
  });
  // A=id, B=title, C=active, D=data
  sheet.appendRow([newId, data.title, true, jsonStr]);
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
        layout:      data.layout,
        time_limit:  data.time_limit || 300,
        description: data.description || ''
      });
      sheet.getRange(i + 1, 2).setValue(data.title); // B欄
      sheet.getRange(i + 1, 4).setValue(jsonStr);    // D欄
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
      sheet.getRange(i + 1, 3).setValue(active); // C欄
      return { ok: true };
    }
  }
  return { ok: false, error: '找不到題目' };
}

// ============================================================
//  成績相關
// ============================================================
function submitScore(data) {
  const sheet = getSheet('分數');
  
  // 查表取得班級、座號、姓名
  const studentSheet = getSheet('學生驗證資料');
  const studentData = studentSheet.getDataRange().getValues();
  let sClass = '', sSeat = '', sName = '';
  for(let i=1; i<studentData.length; i++) {
    // A=帳號[0] | B=班級[1] | C=座號[2] | D=姓名[3]
    if(String(studentData[i][0]) === String(data.student_id)) {
      sClass = studentData[i][1];
      sSeat  = studentData[i][2];
      sName  = studentData[i][3];
      break;
    }
  }

  // 欄位：A=送出時間 | B=學生帳號 | C=班級 | D=座號 | E=姓名 | F=Question_id | G=分數 | H=Details
  sheet.appendRow([
    new Date(),
    data.student_id,
    sClass,
    sSeat,
    sName,
    data.question_id,
    data.score,
    JSON.stringify(data.detail)
  ]);
  return { ok: true };
}

function getScores(questionId, studentId) {
  const sheet = getSheet('分數');
  const data  = sheet.getDataRange().getValues();
  let scores = data.slice(1).filter(r => !!r[0]);
  
  // 欄位：A[0]=時間, B[1]=帳號, C[2]=班級, D[3]=座號, E[4]=姓名, F[5]=Qid, G[6]=分數, H[7]=Details
  if (questionId) scores = scores.filter(r => String(r[5]) === String(questionId));
  if (studentId)  scores = scores.filter(r => String(r[1]) === String(studentId));
  
  const result = scores.map(r => {
    let detail = {};
    try { detail = JSON.parse(r[7] || '{}'); } catch(e) {}
    
    return {
      timestamp: Utilities.formatDate(new Date(r[0]), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'),
      student_class: r[2],
      student_id: String(r[1]),
      student_name: r[4],
      question_id: r[5],
      score: r[6],
      detail: detail
    };
  });
  return { ok: true, scores: result };
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
    {"id": "n1", "type": "oval", "label": "開始"},
    {"id": "n2", "type": "rect", "label": "處理步驟"},
    {"id": "n3", "type": "parallelogram", "label": "輸入/輸出"},
    {"id": "n4", "type": "diamond", "label": "判斷條件"}
  ],
  "connections": [
    {"from": "n1", "to": "n2"},
    {"from": "n4", "to": "n2", "label": "Yes"},
    {"from": "n4", "to": "n1", "label": "No"}
  ],
  "layout": [
    {"id": "n1", "row": 0, "col": 1},
    {"id": "n2", "row": 1, "col": 1}
  ]
}
規則：
- 橢圓形/圓角/膠囊形 (oval)：代表開始或結束
- 矩形 (rect)：代表一般處理、動作或步驟
- 平行四邊形 (parallelogram)：代表資料輸入或輸出
- 菱形 (diamond)：代表判斷或條件
- connections 的 label 只在有分支判斷時填寫（例如 Yes/No）
- layout 中的 row 代表上下順序 (越上層 row 越小)，這對渲染很重要
- 只回傳 JSON，不要有其他 markdown 文字，不要包裝在 \`\`\`json 內`;

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

  if (json.error) {
    return { ok: false, error: 'Gemini API 錯誤: ' + json.error.message };
  }

  try {
    if (!json.candidates || json.candidates.length === 0) {
      return { ok: false, error: 'AI 沒有回傳結果，可能被安全機制攔截。' };
    }
    const text = json.candidates[0].content.parts[0].text;
    // 擷取 JSON 部分
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, error: 'AI 無法辨識此圖片為流程圖，或未回傳有效 JSON' };
    const parsed = JSON.parse(match[0]);
    return { ok: true, data: parsed };
  } catch (e) {
    return { ok: false, error: 'AI 回應解析失敗：' + e.message + ' (原始回應: ' + JSON.stringify(json).substring(0, 100) + '...)' };
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
    // 自動建立標題列 (針對剛建立的空白表)
    if (name === '學生驗證資料') {
      sheet.appendRow(['班級', '座號', '姓名', '帳號', '密碼']);
      sheet.appendRow(['一年甲班', '101', '王小明', 'test1', '1234']);
    } else if (name === 'questions') {
      sheet.appendRow(['Question_id', 'title', 'is_active', 'data']);
    } else if (name === '分數') {
      sheet.appendRow(['送出時間', '學生帳號', 'Question_id', '分數', 'Details']);
    }
  }
  return sheet;
}

// ============================================================
//  自動建立所有班級與動態查詢面板 (一次性執行)
// ============================================================
function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. 建立 801~813 班級工作表
  const classes = ['801','802','803','804','805','806','807','808','809','810','811','812','813'];
  for (let c of classes) {
    let sheetName = c + '班成績';
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    // 在 A1 寫入 QUERY 函數，自動把分數表裡 C 欄 = 班級 的資料抓過來
    sheet.getRange("A1").setFormula(`=QUERY('分數'!A:H, "SELECT * WHERE C = '${c}'")`);
  }
  
  // 2. 建立動態查詢面板
  let dashSheet = ss.getSheetByName('動態查詢面板');
  if (!dashSheet) {
    dashSheet = ss.insertSheet('動態查詢面板');
  }
  
  // 設定下拉選單和欄位標題
  dashSheet.getRange("A1").setValue("請選擇班級：");
  dashSheet.getRange("A2").setValue("請選擇題目：");
  dashSheet.getRange("B1").clearContent(); 
  dashSheet.getRange("B2").clearContent(); 
  
  // 建立班級下拉選單 (B1)
  let ruleClass = SpreadsheetApp.newDataValidation().requireValueInList(classes, true).setAllowInvalid(true).build();
  dashSheet.getRange("B1").setDataValidation(ruleClass);
  
  // B2 題目選單 (這裡填入常見的題目 ID 供選，也可手動輸入)
  let ruleQ = SpreadsheetApp.newDataValidation().requireValueInList(['Q001','Q002','Q003','Q004','Q005'], true).setAllowInvalid(true).build();
  dashSheet.getRange("B2").setDataValidation(ruleQ);
  
  // 寫入超強動態 QUERY 語法到 A4
  // 這樣如果 B1 空白就不限制班級，B2 空白就不限制題目
  dashSheet.getRange("A4").setFormula(`=QUERY('分數'!A:H, "SELECT * WHERE 1=1 " & IF(B1="","", " AND C = '" & B1 & "' ") & IF(B2="","", " AND F = '" & B2 & "' "))`);
  
  // 上色美化
  dashSheet.getRange("A1:A2").setBackground("#d9ead3").setFontWeight("bold");
  dashSheet.getRange("B1:B2").setBackground("#fff2cc").setFontWeight("bold");
  
  // 自動調整欄寬
  dashSheet.setColumnWidth(1, 150);
  dashSheet.setColumnWidth(2, 150);
  
  return "建立完成！";
}
