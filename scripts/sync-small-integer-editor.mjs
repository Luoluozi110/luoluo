// Regenerate editor seeds and browser module cache map from current validated release.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')), '..');
process.chdir(root);
const content=JSON.parse(fs.readFileSync('feihua-content.json','utf8'));
if(content.numericVersion!==3)throw new Error('Expected numericVersion 3');
const revision='20260909numeric3';
const seed=(file,entries)=>fs.writeFileSync('feihua-editors/assets/js/'+file,'// 自动生成：小整数 v2.1，与云端工程同源。\n'+entries.map(([name,value])=>`window.${name} = ${JSON.stringify(value,null,2)};`).join('\n')+'\n');
for(const [key,global] of Object.entries({questions:'QUESTIONS',events:'EVENTS',talents:'TALENTS','talent-upgrade':'TALENT_UPGRADE',npcs:'NPCS',affinity:'AFFINITY',synergies:'SYNERGIES',board:'BOARD',sky:'SKY',album:'ALBUM'}))seed('seed-'+key+'.js', [['GAME_'+global,content[key]]]);
seed('seed-copy.js',[['GAME_SCHOOLS',content.schools],['GAME_GRADES',content.grades],['GAME_NARRATIVE',content.narrative]]);
seed('seed-sidequests.js',[['GAME_SIDEQUEST_NPCS',content['sidequest-npcs']],['GAME_SIDEQUESTS',content.sidequests],['GAME_SIDEQUEST_TALENTS',content['sidequest-talents'].talents],['GAME_SIDEQUEST_TALENT_UPGRADE',content['sidequest-talents'].upgrades],['GAME_SIDEQUEST_TALENT_OFFERS',content['sidequest-talents'].offers]]);
fs.copyFileSync('js/engine/config-contract.js','feihua-editors/assets/js/feihua-contract.js');
let editor=fs.readFileSync('feihua-editors/index.html','utf8');
editor=editor.replace(/GAME_CONTENT_VERSION = \d+/,`GAME_CONTENT_VERSION = ${content._version}`).replace(/(assets\/js\/[\w-]+\.js)(?:\?v=[^"']+)?/g,`$1?v=${revision}`);
fs.writeFileSync('feihua-editors/index.html',editor);
// An import map forces all old and unversioned module imports onto one new URL per file.
// This preserves module singleton identity without altering the Node test imports.
const imports={};
const files=fs.readdirSync('js',{recursive:true}).filter(f=>f.endsWith('.js')).map(f=>'js/'+f.replaceAll('\\','/'));
for(const file of files){
 imports['./'+file]='./'+file+'?v='+revision;
 const src=fs.readFileSync(file,'utf8');
 for(const m of src.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+\.js(?:\?[^"']*)?)["']/g)){
  if(!m[1].startsWith('.'))continue;
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),m[1]));
  imports['./'+target]='./'+target.split('?')[0]+'?v='+revision;
 }
}
let html=fs.readFileSync('index.html','utf8').replace(/\s*<script type="importmap" id="numeric-module-map">[\s\S]*?<\/script>/,'');
html=html.replace('</head>',`  <script type="importmap" id="numeric-module-map">${JSON.stringify({imports})}</script>\n</head>`).replace(/(src="js\/ui\/app\.js)\?v=[^"]+/,`$1?v=${revision}`);
fs.writeFileSync('index.html',html);
console.log(`Synced ${content.talents.length + content['sidequest-talents'].talents.length} talents, ${content.synergies.length} synergies; editor content ${content._version}.`);
