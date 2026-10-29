# 職安練習

手機優先的離線練習網頁，使用《職安健常識問答比賽手冊 2025》的 1,585 道選擇題。智能抽題會優先選取曾答錯的題目，並根據每題的錯題率增加重練機會。亦可選擇主題、未做過的題目或只練錯題。

## 本機使用

不需安裝套件。在專案目錄啟動靜態伺服器：

```sh
python3 -m http.server 8000
```

在瀏覽器開啟 `http://localhost:8000/`。題庫載入後可離線練習；Safari 的「分享」→「加到主畫面」可將網站加入 iPhone 主畫面。iPhone 須先透過可連線的 HTTPS 網址開啟已部署的網站，單靠本機的 `localhost` 網址無法在手機上使用。

## 發佈到 iPhone

儲存庫已備有 GitHub Pages 工作流程。將程式碼推送到 `main` 後，工作流程會嘗試啟用及部署 Pages；如儲存庫權限不允許自動啟用，請在 GitHub 儲存庫的 **Settings → Pages** 將來源設為 **GitHub Actions**。首次部署成功後，可用 `https://screamingcloud.github.io/safety-quiz/` 在 iPhone Safari 開啟。離線練習須先連線載入一次完整題庫；若日後更新網站，請再連線開啟以取得新版。

## 內容和紀錄

- `data/questions.json` 是由使用者提供的 2025 手冊 PDF 生成的題庫，包含題號、主題、PDF 頁碼、題目、選項和答案。網頁直接載入同時生成的 `questions.mjs`，不需另行擷取 JSON。
- `scripts/extract_questions.py` 可從 `pdftotext -layout` 的輸出重新產生題庫；產生過程核對 1,585 道題目及每題三個選項和一個答案。
- 作答紀錄存於瀏覽器的 `localStorage`。沒有帳戶或自動同步；可在「資料」頁下載及匯入備份。
- 手冊內容為 2025 年版本。涉及安全或法例的實務判斷，請以最新官方資料為準。

## 檢查

```sh
node --test tests/*.test.mjs
```

如要從原 PDF 重建題庫：

```sh
pdftotext -layout /path/to/SQ_2025_Handbook.pdf /tmp/sq_handbook.txt
python3 scripts/extract_questions.py /tmp/sq_handbook.txt data/questions.json questions.mjs
```
