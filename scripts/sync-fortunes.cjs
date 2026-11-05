/* 修改 fortunes.json 後，執行：node scripts/sync-fortunes.cjs */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const f = JSON.parse(fs.readFileSync(path.join(root, 'fortunes.json'),'utf8'));
const aspects = ['wishes','love','connections','work','travel','health','study'];
const grades = new Set(['大吉','中吉','吉','小吉','半吉','末吉','凶']);
if (!Array.isArray(f) || f.length < 50) throw Error('資料庫必須包含至少 50 張籤詩');
if (new Set(f.map(x=>x.id)).size !== f.length) throw Error('籤詩 ID 不可重複');
if (new Set(f.map(x=>x.number)).size !== f.length) throw Error('籤號不可重複');
f.forEach((x,i) => {
  if (!x.id || !Number.isInteger(x.number) || !grades.has(x.grade) || !x.theme || !x.message?.ja || !x.message?.zh) throw Error(`第 ${i+1} 筆：基本資料錯誤`);
  if (x.poem?.ja?.length !== 4 || x.poem?.zh?.length !== 4 || [...x.poem.ja,...x.poem.zh].some(y=>!y)) throw Error(`第 ${i+1} 筆：四句詩不完整`);
  aspects.forEach(a=>{if(!x.aspects?.[a]?.ja || !x.aspects?.[a]?.zh) throw Error(`第 ${i+1} 筆：${a} 翻譯不完整`)});
});
fs.writeFileSync(path.join(root,'fortunes.js'), '// 花結び 原創雙語御神籤資料庫\nwindow.HANA_FORTUNES = '+JSON.stringify(f,null,2)+';\n', 'utf8');
console.log(`已更新 fortunes.js：${f.length} 張籤詩。`);
