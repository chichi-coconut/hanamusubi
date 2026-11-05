
/*
 * 花結び｜每日御神籤 — 無框架、無付費 API、無追蹤服務。
 * 抽籤與歷史資料只存於當前瀏覽器 localStorage。
 * 抽籤日界線固定為 Asia/Taipei，而非裝置所在地時區。
 */
(() => {
  'use strict';
  const FORTUNES = Array.isArray(window.HANA_FORTUNES) ? window.HANA_FORTUNES : [];
  const BY_ID = new Map(FORTUNES.map(f => [f.id, f]));
  const STORAGE_KEY = 'hanamusubi:fortune:v1';
  const SOUND_KEY = 'hanamusubi:sound:v1';
  const ZONE = 'Asia/Taipei';
  const GRADE_WEIGHTS = {'大吉': 10, '中吉': 20, '吉': 28, '小吉': 20, '半吉': 12, '末吉': 8, '凶': 2};
  const ASPECTS = [
    ['wishes', '願事', '願望'], ['love', '恋愛', '戀愛'],
    ['connections', '縁談', '緣分'], ['work', '仕事', '工作'],
    ['travel', '旅行', '旅行'], ['health', '健康', '健康'],
    ['study', '学業', '學業']
  ];
  const $ = id => document.getElementById(id);
  const els = {
    todayView: $('todayView'), historyView: $('historyView'),
    navToday: $('navToday'), navHistory: $('navHistory'), brand: $('brandHome'),
    sound: $('soundToggle'), soundLabel: $('soundLabel'), date: $('dateLabel'),
    draw: $('drawButton'), viewToday: $('viewTodayButton'), hint: $('drawHint'),
    art: $('artStage'), intro: $('sectionIntro'), todayResult: $('todayResult'),
    count: $('historyCount'), list: $('historyList'), overview: $('historyOverview'),
    historyDetail: $('historyDetail'), historyResult: $('historyResult'),
    back: $('backToHistory'), toast: $('toast')
  };
  let storageWorks = true;
  let todayKey = todayTaipei();
  let state = loadState();
  let currentView = 'today';
  let historyFilter = 'all';
  let selectedRecord = null;
  let isDrawing = false;
  let soundEnabled = readSetting(SOUND_KEY) === 'true';
  let toastTimer = 0;
  let audioContext = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
  }
  function todayTaipei(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date);
    const p = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  }
  function readableDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    // 以臺灣的中午構造日期，避免跨日邊界時的歧義。
    const instant = new Date(Date.UTC(y, m - 1, d, 4));
    return new Intl.DateTimeFormat('zh-TW', {timeZone: ZONE, year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'}).format(instant);
  }
  function emptyState() {return {version: 1, history: [], favorites: [], bag: FORTUNES.map(f => f.id)};}
  function loadState() {
    let raw;
    try {raw = localStorage.getItem(STORAGE_KEY);} catch (_) {storageWorks = false;return emptyState();}
    if (!raw) return emptyState();
    try {
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Array.isArray(data.history) || !Array.isArray(data.favorites) || !Array.isArray(data.bag)) return emptyState();
      const seenDates = new Set();
      const history = data.history.filter(rec => {
        if (!rec || typeof rec.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rec.date) || !BY_ID.has(rec.id) || seenDates.has(rec.date)) return false;
        seenDates.add(rec.date); return true;
      });
      return {
        version: 1, history,
        favorites: [...new Set(data.favorites.filter(id => BY_ID.has(id)))],
        bag: (() => {
          const validBag = [...new Set(data.bag.filter(id => BY_ID.has(id)))];
          const known = new Set([...validBag, ...history.map(x => x.id)]);
          // 資料庫新增籤詩時，舊使用者無需清除紀錄就能抽到新籤。
          const added = FORTUNES.map(f => f.id).filter(id => !known.has(id));
          return [...validBag, ...added];
        })()
      };
    } catch (_) {return emptyState();}
  }
  function persist() {
    try {localStorage.setItem(STORAGE_KEY, JSON.stringify(state));return true;}
    catch (_) {storageWorks = false;return false;}
  }
  function readSetting(key) {try {return localStorage.getItem(key);} catch (_) {return null;}}
  function saveSetting(key, val) {try {localStorage.setItem(key, val);} catch (_) {storageWorks = false;}}
  function recordForDate(date) {return state.history.find(item => item.date === date) || null;}
  function isFav(id) {return state.favorites.includes(id);}
  function kanjiNumber(n) {
    const one = ['','一','二','三','四','五','六','七','八','九'];
    if (n < 10) return one[n];
    const tens = Math.floor(n / 10), units = n % 10;
    return (tens === 1 ? '' : one[tens]) + '十' + one[units];
  }
  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3300);
  }
  function prefersReducedMotion() {return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;}
  function scrollToElement(el) {el.scrollIntoView({behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start'});}
  function showView(view) {
    currentView = view;
    const today = view === 'today';
    els.todayView.hidden = !today;
    els.historyView.hidden = today;
    els.navToday.classList.toggle('active', today);
    els.navHistory.classList.toggle('active', !today);
    if (today) {els.navToday.setAttribute('aria-current', 'page');els.navHistory.removeAttribute('aria-current');}
    else {els.navHistory.setAttribute('aria-current', 'page');els.navToday.removeAttribute('aria-current');renderHistory();}
    window.scrollTo({top: 0, behavior: 'auto'});
  }
  function refreshClock() {
    const nextDay = todayTaipei();
    if (nextDay !== todayKey) {
      todayKey = nextDay;
      if (!isDrawing) renderToday();
      if (currentView === 'history') renderHistory();
    }
    els.date.textContent = readableDate(todayKey);
  }
  function renderToday(animate = false) {
    const rec = recordForDate(todayKey);
    els.intro.hidden = !rec;
    els.todayResult.hidden = !rec;
    els.draw.hidden = !!rec;
    els.viewToday.hidden = !rec;
    els.draw.disabled = false;
    if (rec) {
      els.hint.textContent = '今天的籤已妥善收藏於此 · 明天零時可抽新籤';
      renderResult(els.todayResult, rec, animate);
    } else {
      els.todayResult.innerHTML = '';
      els.hint.textContent = storageWorks ? '每日限抽一張 · 以臺灣時間零時更新' : '此瀏覽器無法儲存紀錄，關閉後可能遺失抽籤結果';
    }
  }
  function chooseFortune() {
    if (state.bag.length === 0) state.bag = FORTUNES.map(f => f.id);
    // 先排除最近七次籤號。只有一個可用時，以完成本輪不重複為先。
    const lastSeven = new Set(state.history.slice(-7).map(x => x.id));
    let eligible = state.bag.filter(id => !lastSeven.has(id));
    if (!eligible.length) eligible = state.bag.slice();
    // 依吉凶級別加權；全部輪完前不重複，剩餘級別會自動重新正規化。
    const grades = Object.keys(GRADE_WEIGHTS).filter(g => eligible.some(id => BY_ID.get(id).grade === g));
    const total = grades.reduce((sum, g) => sum + GRADE_WEIGHTS[g], 0);
    let cursor = Math.random() * total;
    let grade = grades[grades.length - 1];
    for (const g of grades) {cursor -= GRADE_WEIGHTS[g];if (cursor < 0) {grade = g;break;}}
    const pool = eligible.filter(id => BY_ID.get(id).grade === grade);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function drawToday() {
    // 抽籤前讀取最新本機狀態，避免不同分頁持有過期的今日紀錄。
    if (storageWorks) state = loadState();
    refreshClock();
    if (recordForDate(todayKey)) {renderToday();scrollToElement(els.todayResult);return;}
    if (isDrawing || FORTUNES.length === 0) return;
    const id = chooseFortune();
    if (!id) {toast('籤詩資料暫時無法讀取。');return;}
    state.bag = state.bag.filter(x => x !== id);
    state.history.push({date: todayKey, id});
    const saved = persist();
    isDrawing = true;
    els.draw.disabled = true;
    els.draw.textContent = '願いを込めて…';    els.art.classList.add('is-shaking');
    playChime();
    const delay = prefersReducedMotion() ? 80 : 1900;
    setTimeout(() => {
      isDrawing = false;
      els.art.classList.remove('is-shaking');
      els.draw.innerHTML = '<span aria-hidden="true">✿</span> 抽取今日御神籤 <span class="button-arrow" aria-hidden="true">↗</span>';
      renderToday(true);
      scrollToElement(els.todayResult);
      if (!saved) toast('籤已抽出，但此瀏覽器無法永久儲存紀錄。');
    }, delay);
  }
  function renderResult(host, rec, animate = false) {
    const f = BY_ID.get(rec.id);
    if (!f) {host.textContent = '找不到這張籤詩。';return;}
    host.dataset.id = f.id;
    host.dataset.date = rec.date;
    host.classList.toggle('newly-drawn', !!animate);
    const lines = (a, cls) => `<div class="${cls}">${a.map(s => `<p>${escapeHtml(s)}</p>`).join('')}</div>`;
    const aspects = ASPECTS.map(([key, ja, zh]) => {
      const a = f.aspects[key];
      return `<article class="aspect-card${key === 'study' ? ' study' : ''}">
          <div class="aspect-tag" lang="ja">${ja}</div>
          <div><p class="aspect-name">${zh} <span lang="ja">· ${ja}</span></p>
            <p class="aspect-ja" lang="ja">${escapeHtml(a.ja)}</p>
            <p class="aspect-zh">${escapeHtml(a.zh)}</p></div></article>`;
    }).join('');
    const favored = isFav(f.id);
    host.innerHTML = `
      <div class="result-header"><span lang="ja">今日のしるべ · ${host === els.todayResult ? '本日の御神籤' : '思い出の御神籤'}</span><span class="result-date">${escapeHtml(readableDate(rec.date))}</span></div>
      <article class="fortune-paper" aria-label="第${kanjiNumber(f.number)}番 ${f.grade} ${escapeHtml(f.theme)}">
        <div class="paper-topline"><span class="fortune-number" lang="ja">第${kanjiNumber(f.number)}番</span><span class="fortune-grade grade-${f.grade}" lang="ja">${f.grade}</span></div>
        <div class="paper-mark" aria-hidden="true">✿</div>
        <h2 class="fortune-theme" lang="ja">${escapeHtml(f.theme)}</h2>
        <div class="poem-label">御籤詩 · 日本語</div>
        ${lines(f.poem.ja, 'poem-ja')}
        <div class="poem-divider" aria-hidden="true">✿</div>
        <div class="poem-label">花のことば · 繁體中文</div>
        ${lines(f.poem.zh, 'poem-zh')}
        <section class="aspect-section"><h3 class="aspect-heading" lang="ja">七つのしるべ</h3><p class="aspect-subheading">七項運勢 · 生活的溫柔指引</p><div class="aspects">${aspects}</div></section>
        <section class="daily-word"><h3 class="daily-word-title">今日の言葉｜今日寄語</h3><p class="daily-word-ja" lang="ja">${escapeHtml(f.message.ja)}</p><p class="daily-word-zh">${escapeHtml(f.message.zh)}</p></section>
        <div class="paper-bottom" lang="ja">花結び　✿　また明日</div>
      </article>
      <div class="result-actions">
        <button class="action-button${favored ? ' favorited' : ''}" data-fortune-action="favorite" data-id="${f.id}" aria-pressed="${favored}">${favored ? '♥ 已加入收藏' : '♡ 收藏這張籤'}</button>
        <button class="action-button" data-fortune-action="image">↓ 儲存籤詩圖片</button>
        <button class="action-button" data-fortune-action="share">↗ 分享御神籤</button>
      </div>
      <p class="paper-note">此籤是陪伴與提醒，而非未來的保證。你始終擁有自己的選擇。</p>`;
  }
  function renderHistory() {
    if (els.historyDetail.hidden === false) return;
    const items = state.history.slice().reverse().filter(rec => historyFilter === 'all' || isFav(rec.id));
    els.count.textContent = historyFilter === 'all' ? `已留下 ${state.history.length} 天的籤詩` : `收藏了 ${items.length} 張籤詩`;
    for (const button of document.querySelectorAll('[data-filter]')) {
      const active = button.dataset.filter === historyFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    if (!items.length) {
      els.list.innerHTML = `<div class="empty-state"><div class="empty-flower">✿</div><h3>${historyFilter === 'all' ? '故事從今天開始' : '還沒有收藏的籤詩'}</h3><p>${historyFilter === 'all' ? '抽取一張今日御神籤，留下第一份溫柔。' : '遇到喜歡的籤語時，按下收藏愛心就能留下它。'}</p><button type="button" class="action-button" data-history-action="today">回到今日御籤</button></div>`;
      return;
    }
    els.list.innerHTML = items.map(rec => {
      const f = BY_ID.get(rec.id), fav = isFav(f.id);
      return `<article class="history-item"><div class="history-item-head"><span>${escapeHtml(rec.date)}</span><span class="history-item-grade" lang="ja">${f.grade}</span></div>
        <h3 lang="ja">第${kanjiNumber(f.number)}番 · ${escapeHtml(f.theme)}</h3>
        <p class="history-item-poem" lang="ja">${escapeHtml(f.poem.ja[0])}</p>
        <div class="history-item-actions"><button class="history-open" data-history-action="open" data-date="${rec.date}">閱讀這張籤　↗</button>
        <button class="history-fav${fav ? ' is-fav' : ''}" data-history-action="favorite" data-id="${f.id}" title="${fav ? '取消收藏' : '加入收藏'}" aria-label="${fav ? '取消收藏' : '收藏'}${escapeHtml(f.theme)}" aria-pressed="${fav}">${fav ? '♥' : '♡'}</button></div></article>`;
    }).join('');
  }
  function showHistoryDetail(rec) {
    selectedRecord = rec;
    els.historyOverview.hidden = true;
    els.historyDetail.hidden = false;
    renderResult(els.historyResult, rec);
    scrollToElement(els.historyDetail);
  }
  function backToHistory() {
    selectedRecord = null;
    els.historyDetail.hidden = true;
    els.historyOverview.hidden = false;
    renderHistory();
    scrollToElement(els.historyOverview);
  }
  function toggleFavorite(id) {
    if (!BY_ID.has(id)) return;
    state.favorites = isFav(id) ? state.favorites.filter(x => x !== id) : [...state.favorites, id];
    const saved = persist();
    const favored = isFav(id);
    document.querySelectorAll(`[data-fortune-action="favorite"][data-id="${id}"]`).forEach(btn => {
      btn.setAttribute('aria-pressed', String(favored));
      btn.classList.toggle('favorited', favored);
      btn.textContent = favored ? '♥ 已加入收藏' : '♡ 收藏這張籤';
    });
    if (currentView === 'history' && els.historyDetail.hidden) renderHistory();
    toast(saved ? (favored ? '已收藏這張御神籤 ♡' : '已從收藏中移除') : '收藏狀態已更新，但瀏覽器無法永久儲存。');
  }

  // 完全用 Canvas 繪製，不使用跨來源圖片，離線時也能輸出 PNG。
  function makeImageCanvas(f, date) {
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1560;
    const ctx = c.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 1080, 1560);
    bg.addColorStop(0, '#fbf6ed');bg.addColorStop(.54, '#f4ede1');bg.addColorStop(1, '#eee2d0');
    ctx.fillStyle = bg;ctx.fillRect(0, 0, 1080, 1560);
    ctx.strokeStyle = '#c6ae85';ctx.lineWidth = 3;ctx.strokeRect(35, 35, 1010, 1490);
    ctx.strokeStyle = '#d8c7a8';ctx.lineWidth = 1;ctx.strokeRect(49, 49, 982, 1462);
    function text(s, x, y, size, color, family, align = 'center', maxWidth = 900) {
      ctx.fillStyle = color;ctx.textAlign = align;ctx.textBaseline = 'middle';
      ctx.font = `normal ${size}px ${family}`;
      ctx.fillText(s, x, y, maxWidth);
    }
    const jaFont = '"Yu Mincho", "Hiragino Mincho ProN", "Noto Serif JP", serif';
    const zhFont = '"Noto Serif TC", "Songti TC", "PMingLiU", serif';
    function flower(x, y, scale = 1, alpha = .55) {
      ctx.save();ctx.translate(x, y);ctx.scale(scale,scale);ctx.globalAlpha = alpha;
      ctx.fillStyle = '#d2a0a1';
      for (let i = 0; i < 5; i++) {ctx.save();ctx.rotate(i * Math.PI * 2 / 5);ctx.beginPath();ctx.ellipse(0, -21, 11, 22, 0, 0, Math.PI * 2);ctx.fill();ctx.restore();}
      ctx.globalAlpha = 1;ctx.fillStyle = '#d0ac73';ctx.beginPath();ctx.arc(0, 0, 7, 0, Math.PI * 2);ctx.fill();ctx.restore();
    }
    flower(930, 135, 1.5, .27);flower(128, 1160, .9, .24);flower(916, 1190, .65, .25);
    text('花結び', 110, 145, 51, '#504038', jaFont, 'left', 400);
    text('HANAMUSUBI · DAILY OMIKUJI', 113, 203, 19, '#957c5f', 'serif', 'left', 430);
    text(date, 955, 196, 22, '#8f7a60', zhFont, 'right', 390);
    ctx.strokeStyle = '#c1a982';ctx.lineWidth = 1.4;ctx.beginPath();ctx.moveTo(110, 250);ctx.lineTo(970, 250);ctx.stroke();
    text(`第${kanjiNumber(f.number)}番`, 540, 325, 32, '#71604f', jaFont);
    text(f.grade, 540, 395, 53, '#9e7458', jaFont);
    text('✿', 540, 451, 25, '#b99b82', jaFont);
    text(f.theme, 540, 507, 25, '#775f4d', jaFont);
    f.poem.ja.forEach((line, i) => text(line, 540, 605 + i * 73, 38, '#342e2c', jaFont, 'center', 890));
    ctx.strokeStyle = '#d6c6aa';ctx.beginPath();ctx.moveTo(360, 874);ctx.lineTo(720, 874);ctx.stroke();
    text('花のことば · 繁體中文', 540, 918, 21, '#937a60', zhFont);
    f.poem.zh.forEach((line, i) => text(line, 540, 979 + i * 50, 29, '#66584d', zhFont, 'center', 890));
    ctx.fillStyle = '#e8dfd2';ctx.fillRect(115, 1214, 850, 190);
    text('今日の言葉｜今日寄語', 540, 1254, 25, '#886e52', zhFont);
    text(f.message.ja, 540, 1312, 28, '#53473d', jaFont, 'center', 790);
    text(f.message.zh, 540, 1360, 23, '#716255', zhFont, 'center', 790);
    text('✿  今日のあなたに、やさしい言葉を。', 540, 1455, 21, '#8a775f', jaFont);
    text('原創娛樂與心靈鼓勵作品 · 非預言或成功保證', 540, 1492, 16, '#9d8e7b', zhFont);
    return c;
  }
  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('圖片無法產生')), 'image/png');
      else {
        try {const data = canvas.toDataURL('image/png');const bin = atob(data.split(',')[1]);const b = new Uint8Array(bin.length);for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);resolve(new Blob([b], {type: 'image/png'}));}
        catch (err) {reject(err);}
      }
    });
  }
  async function downloadImage(f, date) {
    const blob = await canvasBlob(makeImageCanvas(f, date));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;a.download = `花結び_第${kanjiNumber(f.number)}番_${date}.png`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('已產生籤詩圖片；請查看瀏覽器的下載項目。');
  }
  function shareText(f, date) {
    return `🌸 花結び｜每日御神籤\n${date} · 第${kanjiNumber(f.number)}番 · ${f.grade}\n\n${f.poem.ja.join('\n')}\n\n${f.poem.zh.join('\n')}\n\n${f.message.ja}\n${f.message.zh}\n\n原創娛樂與心靈鼓勵作品，並非未來預言。`;
  }
  async function copyText(s) {
    try {if (navigator.clipboard && window.isSecureContext) {await navigator.clipboard.writeText(s);return true;}} catch (_) {}
    const a = document.createElement('textarea');a.value = s;a.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(a);a.focus();a.select();
    let copied = false;try {copied = document.execCommand('copy');} catch (_) {} a.remove();return copied;
  }
  async function shareFortune(f, date) {
    const textBody = shareText(f, date);
    if (navigator.share) {
      // Android、iPhone 可使用原生分享表單；有檔案支援時分享完整圖片。
      try {
        if (typeof File !== 'undefined' && navigator.canShare) {
          const blob = await canvasBlob(makeImageCanvas(f, date));
          const file = new File([blob], `hanamusubi-${date}.png`, {type:'image/png'});
          if (navigator.canShare({files:[file]})) {await navigator.share({title:'花結び｜每日御神籤',text:`第${kanjiNumber(f.number)}番 · ${f.grade}`,files:[file]});return;}
        }
        await navigator.share({title:'花結び｜每日御神籤',text:textBody});return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    const copied = await copyText(textBody);
    toast(copied ? '籤詩文字已複製，可貼上分享。' : '無法開啟分享；請使用儲存籤詩圖片功能。');
  }
  async function handleResultAction(event) {
    const btn = event.target.closest('[data-fortune-action]');
    if (!btn || btn.disabled) return;
    const host = btn.closest('.result-host');
    const f = BY_ID.get(host && host.dataset.id);
    const date = host && host.dataset.date;
    if (!f || !date) return;
    if (btn.dataset.fortuneAction === 'favorite') {toggleFavorite(f.id);return;}
    btn.disabled = true;
    try {
      if (btn.dataset.fortuneAction === 'image') await downloadImage(f, date);
      if (btn.dataset.fortuneAction === 'share') await shareFortune(f, date);
    } catch (err) {console.warn('花結び分享失敗', err);toast('圖片或分享功能未成功，請改試其他瀏覽器。');}
    finally {btn.disabled = false;}
  }
  function playChime() {
    if (!soundEnabled) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioContext ||= new AC();
      if (audioContext.state === 'suspended') audioContext.resume();
      const now = audioContext.currentTime;
      // 原生合成短音，不使用外部音訊檔與自動播放。
      [784, 1046.5, 1318.5].forEach((hz, i) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';oscillator.frequency.setValueAtTime(hz, now + i * .17);
        gain.gain.setValueAtTime(.0001, now + i * .17);
        gain.gain.exponentialRampToValueAtTime(.045, now + i * .17 + .018);
        gain.gain.exponentialRampToValueAtTime(.0001, now + i * .17 + 1.15);
        oscillator.connect(gain);gain.connect(audioContext.destination);
        oscillator.start(now + i * .17);oscillator.stop(now + i * .17 + 1.18);
      });
    } catch (_) { /* 音效不可用時完全不影響抽籤 */ }
  }
  function refreshSound() {
    els.sound.setAttribute('aria-pressed', String(soundEnabled));
    els.sound.setAttribute('aria-label', soundEnabled ? '關閉風鈴音效' : '開啟風鈴音效');
    els.soundLabel.textContent = soundEnabled ? '音效開' : '音效關';
  }
  function bindEvents() {
    els.brand.addEventListener('click', () => showView('today'));
    els.navToday.addEventListener('click', () => showView('today'));
    els.navHistory.addEventListener('click', () => showView('history'));
    els.draw.addEventListener('click', drawToday);
    els.viewToday.addEventListener('click', () => scrollToElement(els.todayResult));
    els.sound.addEventListener('click', () => {soundEnabled = !soundEnabled;saveSetting(SOUND_KEY, String(soundEnabled));refreshSound();toast(soundEnabled ? '已開啟輕柔風鈴音效' : '已關閉音效');});
    els.todayResult.addEventListener('click', handleResultAction);
    els.historyResult.addEventListener('click', handleResultAction);
    els.back.addEventListener('click', backToHistory);
    document.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => {historyFilter = btn.dataset.filter;renderHistory();}));
    els.list.addEventListener('click', ev => {
      const btn = ev.target.closest('[data-history-action]');if (!btn) return;
      if (btn.dataset.historyAction === 'today') {showView('today');return;}
      if (btn.dataset.historyAction === 'favorite') {toggleFavorite(btn.dataset.id);return;}
      if (btn.dataset.historyAction === 'open') {
        const rec = recordForDate(btn.dataset.date);if (rec) showHistoryDetail(rec);
      }
    });
    document.addEventListener('visibilitychange', () => {if (!document.hidden) refreshClock();});
    window.addEventListener('focus', refreshClock);
    window.addEventListener('storage', event => {
      if (event.key === STORAGE_KEY) {state = loadState();if (!isDrawing) renderToday();if (currentView === 'history') {els.historyDetail.hidden = true;els.historyOverview.hidden = false;renderHistory();}}
      if (event.key === SOUND_KEY) {soundEnabled = readSetting(SOUND_KEY) === 'true';refreshSound();}
    });
    setInterval(refreshClock, 60 * 1000);
  }
  function start() {
    if (FORTUNES.length < 50 || !FORTUNES.every(f => ASPECTS.every(([key]) => f.aspects?.[key]?.ja && f.aspects?.[key]?.zh))) {
      els.draw.disabled = true;els.hint.textContent = '資料庫未正確載入，請確認 fortunes.js 與 index.html 位於同一資料夾。';return;
    }
    bindEvents();refreshSound();refreshClock();renderToday();
    if (!storageWorks) toast('本機儲存不可用，抽籤歷史可能不會保留。');
  }
  start();
  // 供純瀏覽器環境中的測試使用，不影響一般操作。
  window.HANA_TEST = Object.freeze({todayTaipei, kanjiNumber, gradeCounts: () => FORTUNES.reduce((acc, f) => ((acc[f.grade] = (acc[f.grade] || 0) + 1),acc), {})});
})();

