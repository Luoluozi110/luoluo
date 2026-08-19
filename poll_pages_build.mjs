// Pages 构建状态轮询
import https from 'https';
import { readFileSync } from 'fs';
const TOKEN = readFileSync(process.env.HOME + '/.workbuddy/gh_token_pages','utf8').trim();
function req(path){return new Promise((res,rej)=>{const r=https.request({hostname:'api.github.com',path,headers:{Authorization:'token '+TOKEN,'User-Agent':'w'}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>{let j=null;try{j=JSON.parse(d)}catch{};res(j);});});r.on('error',rej);r.end();});}
const j = await req('/repos/Luoluozi110/luoluo/pages/builds/latest');
console.log(j && j.status ? j.status : JSON.stringify(j));
