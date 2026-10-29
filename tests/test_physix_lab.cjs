// Run: node --test tests/test_physix_lab.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const cp=require('node:child_process');
const html=fs.readFileSync(path.join(__dirname,'..','physix-lab.html'),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
test('actual ES module source parses',()=>{
 assert.ok(script,'missing module script');
 const p=cp.spawnSync(process.execPath,['--input-type=module','--check'],{input:script,encoding:'utf8'});
 assert.equal(p.status,0,p.stderr||p.error?.message);
});
const helpers=script.match(/\/\/ BEGIN TESTABLE PHYSICS HELPERS([\s\S]*?)\/\/ END TESTABLE PHYSICS HELPERS/)?.[1];
assert.ok(helpers,'missing shared math helpers');
const physics=vm.runInNewContext(helpers+'\n({dominoLayout,orbitVelocity,orbitForce,ORBIT_MU,ORBIT_CENTER})');
const near=(x,y,eps=1e-9)=>assert.ok(Math.abs(x-y)<eps,`expected ${x} ≈ ${y}`);
test('24 actual domino locations have minimum separation, without overlap',()=>{
 const pieces=physics.dominoLayout();assert.equal(pieces.length,24);
 for(let i=1;i<pieces.length;i++)assert.ok(Math.hypot(pieces[i].x-pieces[i-1].x,pieces[i].z-pieces[i-1].z)>.62,`adjacent dominoes too close at ${i}`);
 assert.equal(pieces[0].tilt,.28);
 assert.ok(pieces.slice(1).every(p=>p.tilt===0));
});
test('orbital velocity and force produce correct circular acceleration',()=>{
 for(const radius of [3,4.5,6]){const v=physics.orbitVelocity(radius,0);
  const f=physics.orbitForce({x:radius,y:2,z:0},2);
  near(v.x,0);near(v.z*v.z/radius,physics.ORBIT_MU/(radius*radius));
  near(f.x,-2*physics.ORBIT_MU/(radius*radius));near(f.y,0);near(f.z,0);
 }
});
test('orbital force remains finite at center',()=>{
 const f=physics.orbitForce({x:0,y:2,z:0},1);
 for(const value of Object.values(f))assert.ok(Number.isFinite(value));
});
test('FPS changes do not trigger the screen reader live region',()=>{
 assert.match(html,/<p id="status" class="status"><span id="runstate" aria-live="polite">/);
 assert.match(html,/id="fps">FPS: measuring/);
 assert.match(script,/frames\/elapsed/);
 assert.doesNotMatch(script,/function updateStatus\(fps=60\)/);
});
test('non-orbital presets restore Earth gravity',()=>{
 assert.match(script,/if\(type!=='orbit'\)\{world\.gravity\.set\(0,-9\.81,0\)/);
});
