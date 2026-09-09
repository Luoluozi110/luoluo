import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.webp':'image/webp'};
export function createLocalServer() {
 return createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   let file=resolve(root,'.'+decodeURIComponent(url.pathname));
   if(file!==resolve(root)&&!file.startsWith(resolve(root)+sep)){res.writeHead(403).end();return;}
   if((await stat(file)).isDirectory())file=resolve(file,'index.html');
   const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);
  }catch{res.writeHead(404).end('Not found');}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const port=Number(process.env.PORT)||8811;createLocalServer().listen(port,'127.0.0.1',()=>console.log(`文心棋：http://127.0.0.1:${port}/；编辑器：/feihua-editors/`));
}
