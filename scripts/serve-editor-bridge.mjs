#!/usr/bin/env node
/**
 * 本地编辑器 + GitHub 发布桥接。
 * 只监听 127.0.0.1；浏览器永远不接触 GitHub Token，由本机 gh 负责认证。
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.EDITOR_BRIDGE_PORT) || 8787;
const host = '127.0.0.1';
const maxBodyBytes = 5 * 1024 * 1024;
const ghTimeoutMs = 20_000;
const allowedStaticRoots = ['/feihua-editors/', '/feihuaqi-playable/'];
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2'
};

function ghEnvironment() {
  const env = { ...process.env };
  for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) delete env[name];
  return env;
}

function runGh(args, input) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn('gh', args, { env: ghEnvironment(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      rejectRun(new Error('gh 请求超时，请检查网络或执行 gh auth status'));
    }, ghTimeoutMs);
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.once('error', error => { clearTimeout(timer); rejectRun(new Error(`无法启动 gh：${error.message}`)); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0) resolveRun(stdout.trim());
      else rejectRun(new Error((stderr || stdout || `gh 退出码 ${code}`).trim()));
    });
    child.stdin.end(input || '');
  });
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function requestOriginAllowed(req) {
  const origin = req.headers.origin;
  return !origin || origin === `http://${host}:${port}` || origin === `http://localhost:${port}`;
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error('发布内容超过 5 MB 上限');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('请求不是合法 JSON'); }
}

function validRepoPart(value) { return typeof value === 'string' && /^[A-Za-z0-9_.-]+$/.test(value); }
function validPath(value) {
  return typeof value === 'string' && value.length > 0 && !value.startsWith('/') && !value.split('/').includes('..');
}
function contentEndpoint(owner, repo, path) {
  return `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
}
function projectText(project) {
  if (!project || project._type !== 'feihua-content') throw new Error('工程配置无效，拒绝发布');
  return JSON.stringify(project, null, 2);
}
function contentHash(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function publishRepo(payload, content) {
  const { owner, repo } = payload;
  const branch = typeof payload.branch === 'string' && payload.branch.trim() ? payload.branch.trim() : 'main';
  const path = typeof payload.path === 'string' && payload.path.trim() ? payload.path.trim() : 'feihua-content.json';
  if (!validRepoPart(owner) || !validRepoPart(repo)) throw new Error('仓库必须是合法的 owner/repo');
  if (!validPath(path)) throw new Error('发布路径无效');
  const permission = await runGh(['api', `repos/${owner}/${repo}`, '--jq', '.permissions.push']);
  if (permission !== 'true') throw new Error(`本机 gh 账号没有 ${owner}/${repo} 的推送权限`);
  const endpoint = contentEndpoint(owner, repo, path);
  let sha;
  try {
    const current = await runGh(['api', `${endpoint}?ref=${encodeURIComponent(branch)}`]);
    sha = JSON.parse(current).sha;
  } catch (error) {
    if (!/404|Not Found/i.test(error.message)) throw new Error(`读取现有文件失败：${error.message}`);
  }
  const body = {
    message: 'feihua: 更新自定义配置（本机 gh 发布桥接）',
    content: Buffer.from(content, 'utf8').toString('base64'), branch
  };
  if (sha) body.sha = sha;
  const output = JSON.parse(await runGh(['api', '--method', 'PUT', endpoint, '--input', '-'], JSON.stringify(body)));
  const revision = output.commit && output.commit.sha;
  const rawPath = [owner, repo, branch, ...path.split('/')].map(encodeURIComponent).join('/');
  const verifyPath = [owner, repo, revision || branch, ...path.split('/')].map(encodeURIComponent).join('/');
  return {
    url: (output.content && output.content.download_url) || `https://raw.githubusercontent.com/${rawPath}`,
    verifyUrl: `https://raw.githubusercontent.com/${verifyPath}`,
    revision: revision || '', contentHash: contentHash(content)
  };
}

async function publishGist(payload, content) {
  const gistId = typeof payload.gistId === 'string' ? payload.gistId.trim() : '';
  const body = gistId
    ? { files: { 'feihua-content.json': { content } } }
    : { description: '文心棋自定义配置（本机 gh 发布桥接）', public: true, files: { 'feihua-content.json': { content } } };
  const output = await runGh(gistId
    ? ['api', '--method', 'PATCH', `gists/${encodeURIComponent(gistId)}`, '--input', '-']
    : ['api', '--method', 'POST', 'gists', '--input', '-'], JSON.stringify(body));
  const gist = JSON.parse(output);
  const id = gist.id || gistId;
  if (!id) throw new Error('GitHub 未返回 Gist ID');
  const owner = gist.owner && gist.owner.login ? gist.owner.login : '';
  const rawUrl = gist.files && gist.files['feihua-content.json'] && gist.files['feihua-content.json'].raw_url;
  const ownerPart = owner ? `${encodeURIComponent(owner)}/` : '';
  return {
    url: `https://gist.githubusercontent.com/${ownerPart}${encodeURIComponent(id)}/raw/feihua-content.json`,
    verifyUrl: rawUrl || `https://gist.githubusercontent.com/${ownerPart}${encodeURIComponent(id)}/raw/feihua-content.json`,
    gistId: id, gistOwner: owner, revision: gist.history && gist.history[0] ? gist.history[0].version : '',
    contentHash: contentHash(content)
  };
}

async function handleApi(req, res, pathname) {
  if (!requestOriginAllowed(req)) return json(res, 403, { ok: false, error: '只允许本机编辑器页面调用发布桥接' });
  try {
    if (req.method === 'GET' && pathname === '/api/github/status') {
      const login = await runGh(['api', 'user', '--jq', '.login']);
      return json(res, 200, { ok: true, login });
    }
    if (req.method === 'POST' && pathname === '/api/github/publish') {
      const payload = await readJson(req);
      const content = projectText(payload.project);
      const result = payload.mode === 'gist'
        ? await publishGist(payload, content)
        : payload.mode === 'repo' ? await publishRepo(payload, content) : null;
      if (!result) throw new Error('不支持的发布方式');
      return json(res, 200, { ok: true, ...result });
    }
    return json(res, 404, { ok: false, error: '未知桥接接口' });
  } catch (error) {
    return json(res, 400, { ok: false, error: error.message || '发布桥接失败' });
  }
}

async function serveStatic(req, res, pathname) {
  try {
    const targetPath = pathname === '/' ? '/feihua-editors/' : pathname;
    if (!allowedStaticRoots.some(prefix => targetPath.startsWith(prefix))) return res.writeHead(404).end('Not Found');
    let file = resolve(workspaceRoot, '.' + targetPath);
    if (file !== workspaceRoot && !file.startsWith(workspaceRoot + sep)) return res.writeHead(403).end('Forbidden');
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch (error) {
    res.writeHead(error && error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error && error.code === 'ENOENT' ? 'Not Found' : 'Internal Server Error');
  }
}

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url || '/', `http://${host}`).pathname);
  if (pathname.startsWith('/api/github/')) await handleApi(req, res, pathname);
  else await serveStatic(req, res, pathname);
}).listen(port, host, () => {
  console.log(`编辑器 gh 发布桥接：http://${host}:${port}/feihua-editors/`);
  console.log('仅监听 localhost；GitHub 凭据由本机 gh 管理。');
});
