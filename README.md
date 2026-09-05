# 📊 流程圖配對練習 | flowchartQuiz-ymh-classroom

**網站網址：** https://ChalknCode.github.io/flowchartQuiz-ymh-classroom

---

## 🚀 快速開始

### 第一步：建立 Google 試算表

1. 開啟 [Google 試算表](https://sheets.google.com)，新增一個空白試算表
2. 記下網址中的 **Spreadsheet ID**（網址格式：`docs.google.com/spreadsheets/d/【這裡就是ID】/edit`）

### 第二步：設定 Google Apps Script

1. 在試算表上方選單：**擴充功能 → Apps Script**
2. 把 `Code.gs` 的全部內容複製貼入編輯器（取代原本的 `function myFunction() {}`）
3. 修改第 6 行的 `SPREADSHEET_ID`，填入你的試算表 ID
4. 如果要使用 AI 圖片辨識功能，填入第 9 行的 `GEMINI_API_KEY`
   - 從 [Google AI Studio](https://aistudio.google.com) 免費取得

### 第三步：部署 Apps Script

1. 點選右上角「**部署**」→「**新增部署作業**」
2. 類型選「**網路應用程式**」
3. 設定：
   - 說明：`flowchartQuiz API`
   - 執行身分：「**我**」
   - 誰可以存取：「**所有人**」
4. 點「部署」→ 複製產生的「**網路應用程式網址**」

### 第四步：填入網址

打開 `js/student.js` 和 `js/teacher.js`，把第一行的：
```js
const APPS_SCRIPT_URL = '';
```
改成：
```js
const APPS_SCRIPT_URL = '你剛才複製的網址';
```

### 第五步：推送到 GitHub Pages（由 Antigravity 協助完成）

---

## 📋 使用說明

### 老師端 (`teacher.html`)

| 功能 | 說明 |
|------|------|
| 預設密碼 | `teacher123`（可在 `teacher.js` 第一行修改） |
| 新增題目 | 三種方式：上傳圖片 / 視覺介面 / JSON 編輯 |
| 開放題目 | 在題目列表切換開關 |
| 學生連結 | 點「複製連結」，傳給學生 |
| 查看成績 | 可依題目或學生篩選 |

### 學生端 (`index.html?q=Q001`)

1. 輸入座號和密碼登入
2. 從左側拖曳圖形到右側流程圖
3. 按「確認答案」查看對錯
4. 按「提交成績」送出（才會寫入試算表）

---

## 📊 Google Sheets 結構

試算表會自動建立三個工作表：

| 工作表 | 說明 |
|--------|------|
| `students` | 學生帳號密碼，老師自行新增 |
| `questions` | 題目庫，由程式管理 |
| `scores` | 成績紀錄，自動寫入 |

### 新增學生帳號
在 `students` 工作表填入：

| student_id | password | name | class |
|------------|----------|------|-------|
| 101 | 1234 | 王小明 | 一年甲班 |

---

## 🔧 進階：JSON 格式說明

每道題目的資料結構：

```json
{
  "nodes": [
    { "id": "n1", "type": "rect",    "label": "開始" },
    { "id": "n2", "type": "diamond", "label": "條件?" },
    { "id": "n3", "type": "rect",    "label": "步驟A" },
    { "id": "n4", "type": "rect",    "label": "步驟B" }
  ],
  "connections": [
    { "from": "n1", "to": "n2" },
    { "from": "n2", "to": "n3", "label": "Yes" },
    { "from": "n2", "to": "n4", "label": "No"  }
  ],
  "layout": [
    { "id": "n1", "row": 0, "col": 1 },
    { "id": "n2", "row": 1, "col": 1 },
    { "id": "n3", "row": 2, "col": 0 },
    { "id": "n4", "row": 2, "col": 2 }
  ]
}
```

- `type`: `rect`（矩形）或 `diamond`（菱形）
- `layout.col`: 分支時用不同欄位（0=左, 1=中, 2=右）

---

## 📁 專案結構

```
flowchartQuiz-ymh-classroom/
├── index.html          ← 學生端
├── teacher.html        ← 老師端
├── css/
│   └── style.css       ← 共用樣式
├── js/
│   ├── student.js      ← 學生端邏輯
│   └── teacher.js      ← 老師端邏輯
├── Code.gs             ← Google Apps Script（貼入 GAS 編輯器）
└── README.md
```
