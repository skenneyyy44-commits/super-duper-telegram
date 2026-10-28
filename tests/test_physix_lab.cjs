// Run: node --test tests/test_physix_lab.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const html=fs.readFileSync(path.join(__dirname,'..','physix-lab.html'),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
test('HTML contains an ES module and its JavaScript parses',()=>{
 assert.ok(script,'missing module script');
 const p=cp.spawnSync(process.execPath,['--input-type=module','--check'],{input:script,encoding:'utf8'});
 assert.equal(p.status,0,p.stderr||p.error?.message);
});
test('zero gravity orbital preset applies inverse square attraction before stepping',()=>{
 assert.match(script,/const mu=22/);
 assert.match(script,/speed=Math\.sqrt\(mu\/r\)/);
 assert.match(script,/b\.mass\*mu\/distanceSquared/);
 assert.match(script,/applyOrbitGravity\(\);world\.step/);
});
test('dominoes use thin bodies and increasing arc spacing',()=>{
 assert.match(script,/new THREE\.BoxGeometry\(\.26,1\.25,\.65\)/);
 assert.match(script,/a\+=\.68\/radius/);
 for(let i=0,a=0,prior=null;i<24;i++){const radius=2+i*.085;const p=[Math.cos(a)*radius,Math.sin(a)*radius];if(prior)assert.ok(Math.hypot(p[0]-prior[0],p[1]-prior[1])>.62,'overlapping domino centers');prior=p;a+=.68/radius}
});
test('status distinguishes measured FPS, with updates outside the live region',()=>{
 assert.match(html,/id="fps">FPS: measuring/);
 assert.match(script,/frames\/elapsed/);
 assert.doesNotMatch(script,/function updateStatus\(fps=60\)/);
});
test('other presets restore Earth gravity after zero gravity',()=>{
 assert.match(script,/if\(type!=='orbit'\)\{world\.gravity\.set\(0,-9\.81,0\)/);
});
