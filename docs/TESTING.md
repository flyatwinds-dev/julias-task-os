# 驗證紀錄

驗證環境：Node.js 24.22.1、Python 3.12.14、系統 Chromium、Playwright 1.65.0。以 Python HTTP server 在 port 8000 啟動，未使用外部 API。

## 結果

- `npm test`：6 項測試全部通過，0 failed、0 skipped。涵蓋資料欄位、回傳副本、任務 CRUD、完成與取消完成時間、軟刪除、專案分類、無效輸入、逾期推導、複合查詢、三種排序及相似名稱。
- `NODE_PATH=/tmp/julia-browser/node_modules node tests/browser.cjs`：端到端流程通過。實際操作新增、編輯、完成、取消完成、完成後順序不變、軟刪除、搜尋、篩選、排序、建立專案並指派任務、重複名稱提醒且允許儲存、雙主題切換與重新整理後 Demo 重設。
- 1440 × 1080 桌面與 390 × 844 手機視窗均可操作；已檢視全頁截圖。手機沒有水平溢出，新增任務視窗在螢幕範圍內，底部導覽可使用。
- Demo Mode 與「尚未連接雲端同步」提示均顯示。
- Chromium 頁面 JavaScript 錯誤：0。
- HTTP 首頁請求、`node --check js/app.js`、`git diff --check`：通過。

- `tests/hierarchy-browser.cjs`：多層新增、上層選單排除自身與子孫、展開收合、收合後搜尋、上層完成不連動、直接子任務進度、更換上層／獨立、取消刪除、確認刪除後保留子任務、本地字型載入、Cozy 手機版無水平溢出全部通過。
- 資料層新增測試覆蓋缺失／已刪除上層、自循環與多層循環、拒絕未指定策略的刪除且資料不變、更換／解除隸屬、欄位保留、階層同層排序與完整上層路徑。

## 範圍限制

僅自動驗證 Chromium，未在真實 iOS / Android 或 Safari、Firefox 執行。沒有 Google 帳號、Apps Script、Sheets 或跨裝置同步測試，這些功能尚未實作。未連接 Google 或部署其他服務。GitHub API 與 Pages 網址在此環境回應 403，不能以本機測試宣稱遠端 Pages 已發布。

重現指令見 README；截圖是測試產物，存於 `/tmp`，不納入 Git。
