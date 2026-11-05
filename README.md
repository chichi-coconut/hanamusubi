# 花結び｜每日御神籤 🌸

> 今日のあなたに、やさしい言葉を。  
> 為今天的你，送上一句溫柔的話。

可直接部署的 **Mobile First 日式御神籤網站**。使用原生 HTML、CSS、JavaScript，完全免費、免帳號、免後端、免 AI API。

## 第一版功能

- 50 張**個別撰寫**的原創雙語籤詩；每張有四句日文、四句繁體中文、七項日中雙語運勢、今日寄語。
- 七個籤運等級：大吉 5、中吉 10、吉 14、小吉 10、半吉 6、末吉 4、凶 1。抽取機制以籤運分級加權；完成一輪時每張籤恰好出現一次。
- 使用 `Asia/Taipei` 日期作為每天零時的切換基準；當日僅抽一次，重新整理及重開仍顯示同一籤。
- 不輪完全部籤詩不重複；開啟新輪後優先避開最近七張。
- 「我的籤詩」檢視日期、籤運及詳細內容；可加入收藏及篩選。
- Canvas 產生完整的 PNG 籤詩分享圖（含日期、籤號、籤運、四句原文與翻譯、今日寄語）。
- 分享按鈕：支援時使用原生分享圖片；否則分享文字，最後退回複製文字。
- 輕柔搖籤、籤紙抽出、展開動畫及飄落花瓣；尊重「減少動態效果」。風鈴音效預設**關閉**。
- 完全不載入任何第三方 API、字體服務、圖片或音樂。

## 檔案結構

```text
hanamusubi-site/
├── index.html               網頁架構
├── style.css                深色和紙風格、RWD、動畫
├── app.js                   抽籤、localStorage、收藏、分享與音效
├── fortunes.js              瀏覽器實際載入的 50 張籤詩
├── fortunes.json            方便新增、修改內容的資料來源
├── favicon.svg              網站圖示
├── README.md                本說明
├── scripts/
│   └── sync-fortunes.cjs    修改 JSON 後同步生成 fortunes.js
└── tests/
    └── smoke-test.cjs      不依賴 npm 的核心功能邏輯測試
```

另外附有 `index.html`（單檔版），將 CSS、JavaScript、籤詩資料全部放入同一檔案，適合直接試玩。

## 在電腦上開啟

**快速試玩**：用瀏覽器開啟 `index.html`（單檔版），不用安裝套件。

**建議做法**：若要測試原始多檔專案，先在 `hanamusubi-site` 資料夾執行：

```bash
python -m http.server 8000
```

接著在瀏覽器前往 `http://localhost:8000/`。Windows 也可嘗試 `py -m http.server 8000`。

也可以直接雙擊 `index.html`，但部分瀏覽器在 `file://` 下限制 `localStorage`、分享 API 或下載，因此建議使用本機伺服器或 HTTPS 網站測試完整功能。

## 免費部署到 GitHub Pages

1. 登入 GitHub，建立一個公開 Repository，例如 `hanamusubi`。
2. 將 `hanamusubi-site` 資料夾**裡面的內容**（包含根目錄 `index.html`）上傳到 Repository 的根目錄；不必上傳單檔試玩版本。
3. 進入 Repository 的 **Settings → Pages**。
4. 在 **Build and deployment** 選 **Deploy from a branch**，分支選 `version1`、資料夾選 `/ (root)`，儲存。
5. 部署網址通常是 `https://你的使用者名稱.github.io/hanamusubi/`。使用手機開啟該網址即可操作。

無需設定環境變數、Server、資料庫或 API 金鑰。`index.html` 必須與 `app.js`、`style.css`、`fortunes.js` 放在同一根目錄。

## 修改或擴充籤詩資料庫

建議以 `fortunes.json` 作為原始資料。每筆結構如下（示意欄位名稱，實際 50 筆均已填妥）：

```json
{
  "id": "hana-001",
  "number": 1,
  "grade": "末吉",
  "theme": "冬土の蕾",
  "poem": {
    "ja": ["日文第1句", "日文第2句", "日文第3句", "日文第4句"],
    "zh": ["中文第1句", "中文第2句", "中文第3句", "中文第4句"]
  },
  "aspects": {
    "wishes": {"ja": "日文", "zh": "中文"},
    "love": {"ja": "日文", "zh": "中文"},
    "connections": {"ja": "日文", "zh": "中文"},
    "work": {"ja": "日文", "zh": "中文"},
    "travel": {"ja": "日文", "zh": "中文"},
    "health": {"ja": "日文", "zh": "中文"},
    "study": {"ja": "日文", "zh": "中文"}
  },
  "message": {"ja": "日文寄語", "zh": "中文寄語"}
}
```

新增至 100、300 張時，確保 `id` 與 `number` 唯一、四句詩完整、七個欄位日中雙語都有內容，接著執行：

```bash
node scripts/sync-fortunes.cjs
```

即可將 JSON 更新到 `fortunes.js`。已有使用紀錄者會把新加入的籤號補進未抽籤池。若沒有 Node.js，也能手動直接修改 `fortunes.js` 中的 `window.HANA_FORTUNES` 陣列。

## 核心測試

可使用 Node.js 直接執行：

```bash
node tests/smoke-test.cjs
```

檢查資料、七種籤運、台灣時間切換、每日鎖定、刷新後保留、跨 50 天不重複、收藏及圖片分享分支。這是 **模擬 DOM 與瀏覽器 API 的邏輯測試**，不等於實際 Android、iPhone、Safari 渲染與權限驗證。

## 資料與功能限制

- `localStorage` 是**每個瀏覽器、每台裝置各自儲存**，不會在手機與電腦同步；清除網站資料、無痕模式或更換瀏覽器可能清除歷史、收藏及每日鎖定紀錄。
- 使用者自行修改裝置時間、清除儲存資料或透過開發者工具修改紀錄，無後端的網站無法絕對防止重抽。
- 原生分享與剪貼簿 API 依瀏覽器而異，通常 HTTPS 支援最好；無法使用時會嘗試分享文字或複製。圖片下載在部分 iPhone 瀏覽器上可能需要開啟圖片後再存入相簿。
- 音效由 Web Audio API 合成，需使用者手動開啟；不依賴外部音效檔。
- 所有「運勢」屬於原創娛樂與日常鼓勵，不代表真實神社的神諭，也不預言或保證任何未來事件。

**花開有時，你的腳步也有自己的節奏。**