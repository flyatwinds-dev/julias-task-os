# Julia's Task OS

溫柔、可愛的個人任務管理前端。原生 HTML / CSS / JavaScript，無執行期套件、外部字型請求、付費 API、資料庫或登入服務。

## 預覽

需要 Python 3，從現有 checkout 啟動（不用建立 worktree）：

```sh
cd /workspace/julias-task-os
python3 -m http.server 8000 --bind 0.0.0.0
```

一般本機瀏覽器開啟 `http://localhost:8000`；雲端開發介面若提供連接埠預覽，選擇 port 8000。這是開發預覽，不是正式部署。支援現代 Chrome、Safari、Firefox 的 ES Modules、dialog、structuredClone 與 crypto.randomUUID；請以 HTTP 服務開啟，不要直接點開 file://。

## 已實作

- Dashboard：每日鼓勵、Open / Doing / Completed / Overdue 計數、Today’s Focus（本地今天的計畫日期，最多三筆）、Quick Add。
- 任務新增、完整欄位編輯、勾選完成與取消完成、確認後軟刪除。完成文字劃線並保留清單位置；重新整理或主動更換搜尋、篩選、排序後重新查詢。取消完成預設回到 Open。
- 搜尋名稱與描述；依狀態、專案、優先級篩選；依 Workspace 導覽；建立時間降序、截止時間升序（未設定置末）、優先級排序。
- 相似名稱提醒（文字正規化、包含比對與雙字元相似度），不阻擋儲存。Quick Add 發現相似項目時開啟表單，顯示提醒再讓使用者儲存。
- Work / Personal / Side Projects，基本專案建立與任務分類，允許暫不分類。
- Pastel Dream / Cozy Studio；桌面側欄、手機底部分頁。主題偏好可保存在此瀏覽器 localStorage。
- 逾期由截止時間與未完成狀態即時計算，每分鐘更新指標，不是獨立任務狀態。日期輸入與 Today’s Focus 使用瀏覽器本地時區，截止時間轉為 ISO 字串儲存。

## 字型與任務階層

中文使用 jf open 粉圓 2.1，英文與數字使用 Montserrat。字型隨網站本地提供，不向 Google 或其他字型服務發送請求；保留 Noto Sans TC、Microsoft JhengHei 與 sans-serif 備用字體。來源與完整授權見 [assets/fonts/README.md](assets/fonts/README.md)。

每個任務有 `parent_task_id`，無上層時為 `null`。新增子任務或編輯上層選單可指定、更換上層，也可改為獨立；資料層拒絕自己、子孫或不存在／已刪除的上層。階層不限制 Workspace 或專案，子任務保有自己的分類、狀態、日期與優先級。完成上層不會連動子任務。

清單依階層展開／收合，顯示完整上層路徑與直接子任務完成數；同層保留所選排序。搜尋與篩選期間自動顯示所有符合項目，未符合的上層不加入結果；清除條件後恢復原有收合狀態。計數為符合條件的任務總數，包含收合項目。

刪除有子任務的上層時會先確認：直接子任務改為獨立，其下任務及欄位全部保留。資料層呼叫 `deleteTask(id, { children: "detach" })` 才允許此操作；未明確指定策略則拒絕且不修改資料。

## Demo Mode 與資料界線

**所有任務及專案只在本頁記憶體。重新整理會重設為 Demo Data，關閉頁面即消失。沒有雲端同步，也不會向 Google 傳送資料。** 不建議輸入需要保存的真實工作資料。只有主題偏好可跨重新整理保存。

`js/data.js` 是獨立非同步資料層，提供 `listTasks`、`createTask`、`updateTask`、`completeTask`、`deleteTask`、`listProjects`、`createProject`。UI 不直接操作資料陣列。`deleted_at` 標記軟刪除，清單不回傳已刪除記錄。所有回傳值為副本，避免 UI 修改內部狀態。

## 檢查與測試

Node.js 22+，不需安裝套件：

```sh
npm test
node --check js/app.js
git diff --check
```

瀏覽器端到端測試使用**測試專用** Playwright，網站本身不依賴它。先啟動 port 8000，再執行：

```sh
npm install --prefix /tmp/julia-browser --cache /tmp/julia-npm-cache --no-package-lock --no-audit --no-fund playwright@1.65.0
NODE_PATH=/tmp/julia-browser/node_modules node tests/browser.cjs
NODE_PATH=/tmp/julia-browser/node_modules node tests/hierarchy-browser.cjs
```

需系統 Chromium（預設 `/usr/bin/chromium`）；可用 `CHROMIUM_PATH` 指定路徑，`BASE_URL` 指定測試網址。截圖預設寫入 `/tmp/julia-desktop.png`、`/tmp/julia-mobile.png`。測試會操作暫時 Demo 資料，不改寫儲存庫或外部服務。

完整結果見 [docs/TESTING.md](docs/TESTING.md)。

## Google Apps Script / Sheets 下一步（本次未實作）

1. 建立專屬試算表，以 Tasks、Projects、Workspaces 分頁對應目前欄位，保留 ID、ISO 時間及軟刪除欄位。
2. 在 Apps Script 伺服器實作相同方法與資料驗證，使用 LockService 保護並行寫入；統一時區與錯誤回傳。不要讓前端自行提供的帳號或角色決定權限。
3. 建立 `GoogleAppsScriptAdapter`，以 Promise 包裝 `google.script.run.withSuccessHandler/withFailureHandler`，在資料層入口替換 Demo Adapter。UI 保持相同非同步方法合約。
4. HTML Service 不直接使用這裡的相對 ES module 網址。部署時將 JS 模組打包為單一腳本，CSS 與 JS 轉成 Apps Script HTML partial，由 `doGet` template include，檢查 sandbox、載入錯誤及資源路徑。本版是可遷移的結構，尚未生成 GAS 部署包。
5. 設定 Google 帳號存取限制及伺服器端允許名單，在測試部署驗證未授權存取、資料讀寫與兩台裝置同步，再考慮正式部署。

## Roadmap（未實作）

Google 登入、雲端同步、Google Sheets / Apps Script 部署、Idea Dump、Kanban 拖曳、Calendar、重複任務、附件、XP / Level、Achievements、Review、自動備份與 AI API。維持現有 GitHub Pages，由 `dev/task-os-foundation` 分支更新，不部署其他服務。
