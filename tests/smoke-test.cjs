// 花結び基本資料完整性測試：node tests/smoke-test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'fortunes.json'),'utf8'));
const aspects=['wishes','love','connections','work','travel','health','study'];
const grades=['大吉','中吉','吉','小吉','半吉','末吉','凶'];
assert.ok(Array.isArray(data)&&data.length>=50,'資料至少 50 張');
assert.equal(new Set(data.map(x=>x.id)).size,data.length,'ID 不重複');
assert.equal(new Set(data.map(x=>x.number)).size,data.length,'籤號不重複');
for(const x of data){
 assert.ok(grades.includes(x.grade),'籤運等級');
 assert.equal(x.poem.ja.length,4);
 assert.equal(x.poem.zh.length,4);
 assert.ok([...x.poem.ja,...x.poem.zh].every(Boolean),'四句詩不得空白');
 for(const k of aspects){assert.ok(x.aspects[k].ja&&x.aspects[k].zh,k+' 需有日中雙語')}
 assert.ok(x.message.ja&&x.message.zh,'今日寄語完整');
}
assert.equal(new Set(data.map(x=>x.grade)).size,7,'涵蓋七種籤運');
console.log('PASS: '+data.length+' 張籤詩，七種籤運，雙語詩文與七項運勢完整。');
