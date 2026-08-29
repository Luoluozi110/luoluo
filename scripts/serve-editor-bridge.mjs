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
// 读取仓库中的现有工程会返回数百 KB 的 Base64 内容；在普通网络下可能接近 20 秒。
// 留出足够余量，避免发布前版本校验被误判为网络故障；仍可通过环境变量收紧或放宽。
const ghTimeoutMs = Math.max(20_000, Number(process.env.EDITOR_GH_TIMEOUT_MS) || 60_000);
const publicEditorOrigin = 'https://luoluozi110.github.io';
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

function runGh(args, input, stage = 'GitHub API') {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn('gh', args, { env: ghEnvironment(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      rejectRun(new Error(`gh 请求超时（${Math.ceil(ghTimeoutMs / 1000)} 秒，阶段：${stage}）；请检查网络或执行 gh auth status`));
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
  if (!origin || origin === publicEditorOrigin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:'
      && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
      && Number(parsed.port || 80) === port;
  } catch (_) { return false; }
}

function applyApiCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || !requestOriginAllowed(req)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin, Access-Control-Request-Headers, Access-Control-Request-Private-Network');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Chromium 从公网页面访问回环地址时会发 Private Network Access 预检。
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
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
  if (!Number.isInteger(Number(project._version)) || Number(project._version) < 1) throw new Error('工程配置缺少有效 _version，拒绝发布');
  return JSON.stringify(project, null, 2);
}
function projectVersion(project) { return Math.max(1, Number(project && project._version) || 1); }
function rejectOlderProject(incoming, current) {
  if (current && current._type === 'feihua-content' && projectVersion(current) >= projectVersion(incoming)) {
    throw new Error(`当前编辑器工程版本 ${projectVersion(incoming)} 不高于云端版本 ${projectVersion(current)}，已阻止覆盖；请重新读取云端后再发布`);
  }
}
function contentHash(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function publishRepo(payload, content, incomingProject) {
  const { owner, repo } = payload;
  const branch = typeof payload.branch === 'string' && payload.branch.trim() ? payload.branch.trim() : 'main';
  const path = typeof payload.path === 'string' && payload.path.trim() ? payload.path.trim() : 'feihua-content.json';
  if (!validRepoPart(owner) || !validRepoPart(repo)) throw new Error('仓库必须是合法的 owner/repo');
  if (!validPath(path)) throw new Error('发布路径无效');
  const permission = await runGh(['api', `repos/${owner}/${repo}`, '--jq', '.permissions.push'], '', '检查仓库推送权限');
  if (permission !== 'true') throw new Error(`本机 gh 账号没有 ${owner}/${repo} 的推送权限`);
  const endpoint = contentEndpoint(owner, repo, path);
  let sha;
  try {
    const current = await runGh(['api', `${endpoint}?ref=${encodeURIComponent(branch)}`], '', '读取现有云端工程');
    const currentBody = JSON.parse(current);
    sha = currentBody.sha;
    const currentProject = currentBody.content
      ? JSON.parse(Buffer.from(currentBody.content.replace(/\n/g, ''), 'base64').toString('utf8'))
      : null;
    rejectOlderProject(incomingProject, currentProject);
  } catch (error) {
    if (!/404|Not Found/i.test(error.message)) throw new Error(`读取现有文件失败：${error.message}`);
  }
  const body = {
    message: 'feihua: 更新自定义配置（本机 gh 发布桥接）',
    content: Buffer.from(content, 'utf8').toString('base64'), branch
  };
  if (sha) body.sha = sha;
  const output = JSON.parse(await runGh(['api', '--method', 'PUT', endpoint, '--input', '-'], JSON.stringify(body), '写入云端工程'));
  const revision = output.commit && output.commit.sha;
  const rawPath = [owner, repo, branch, ...path.split('/')].map(encodeURIComponent).join('/');
  const verifyPath = [owner, repo, revision || branch, ...path.split('/')].map(encodeURIComponent).join('/');
  return {
    url: (output.content && output.content.download_url) || `https://raw.githubusercontent.com/${rawPath}`,
    verifyUrl: `https://raw.githubusercontent.com/${verifyPath}`,
    revision: revision || '', contentHash: contentHash(content)
  };
}

async function publishGist(payload, content, incomingProject) {
  const gistId = typeof payload.gistId === 'string' ? payload.gistId.trim() : '';
  if (gistId) {
    const current = JSON.parse(await runGh(['api', `gists/${encodeURIComponent(gistId)}`], '', '读取现有 Gist 工程'));
    const currentFile = current.files && current.files['feihua-content.json'];
    if (currentFile && currentFile.content) {
      rejectOlderProject(incomingProject, JSON.parse(currentFile.content));
    }
  }
  const body = gistId
    ? { files: { 'feihua-content.json': { content } } }
    : { description: '文心棋自定义配置（本机 gh 发布桥接）', public: true, files: { 'feihua-content.json': { content } } };
  const output = await runGh(gistId
    ? ['api', '--method', 'PATCH', `gists/${encodeURIComponent(gistId)}`, '--input', '-']
    : ['api', '--method', 'POST', 'gists', '--input', '-'], JSON.stringify(body), '写入 Gist 工程');
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
      const login = await runGh(['api', 'user', '--jq', '.login'], '', '检查 gh 登录状态');
      return json(res, 200, { ok: true, login, bridgeVersion: 2 });
    }
    if (req.method === 'POST' && pathname === '/api/github/publish') {
      const payload = await readJson(req);
      const content = projectText(payload.project);
      const result = payload.mode === 'gist'
        ? await publishGist(payload, content)
        : payload.mode === 'repo' ? await publishRepo(payload, content, payload.project) : null;
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

const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url || '/', `http://${host}`).pathname);
  if (pathname.startsWith('/api/github/')) {
    if (!requestOriginAllowed(req)) return json(res, 403, { ok: false, error: '只允许正式编辑器或本机编辑器调用发布桥接' });
    applyApiCors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      return res.end();
    }
    await handleApi(req, res, pathname);
  } else await serveStatic(req, res, pathname);
});

server.on('error', error => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`端口 ${port} 已被占用：桥接可能已在运行。请先关闭旧桥接窗口，或直接刷新编辑器检查连接状态。`);
  } else {
    console.error(`编辑器桥接启动失败：${error && error.message ? error.message : error}`);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`编辑器 gh 发布桥接：http://${host}:${port}/feihua-editors/`);
  console.log('仅监听 localhost；GitHub 凭据由本机 gh 管理。');
});
