// 로컬 시험용: worker.js를 Node 내장 http로 띄웁니다. 설치할 것이 없습니다(Node 18 이상).
//   node worker/dev-server.mjs            → http://localhost:8787 (목 응답)
// 환경변수는 그대로 worker의 env로 넘어갑니다. 예: DEVICE_DAILY_LIMIT=3 node worker/dev-server.mjs
import http from 'node:http';
import worker from './worker.js';

const port = Number(process.env.PORT || 8787);
http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = new Headers(/** @type {any} */ (req.headers));
  if (!headers.has('cf-connecting-ip')) headers.set('cf-connecting-ip', req.socket.remoteAddress || 'unknown');
  const hasBody = !['GET', 'HEAD'].includes(req.method || 'GET');
  const request = new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined });
  const response = await worker.fetch(request, { ...process.env });
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`proxy (worker.js) listening on http://localhost:${port}`));
