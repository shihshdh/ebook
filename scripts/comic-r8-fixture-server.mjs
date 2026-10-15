// Local, deterministic acceptance pages; only used by a test-account Komga fixture.
import http from 'node:http';
import sharp from 'sharp';
const cache = new Map();
http.createServer(async (req, res) => {
  const n = Number(new URL(req.url, 'http://localhost').searchParams.get('page') || 1);
  if (!cache.has(n)) cache.set(n, sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1020"><rect width="720" height="1020" fill="#eee7d8"/><text x="40" y="65" font-family="serif" font-size="26" fill="#39372f">THE QUIET OBSERVATORY · ${n}</text><rect x="35" y="95" width="650" height="450" fill="#273844"/><circle cx="520" cy="220" r="70" fill="#e9dcb5"/><path d="M35 520L180 290L350 480L460 370L685 540" fill="#101c25"/><rect x="35" y="570" width="310" height="360" fill="#b5b3a2"/><rect x="370" y="570" width="315" height="360" fill="#d0bba0"/><path d="M440 910V700h170v210M425 700l100-90 100 90" fill="#4d5350"/><text x="70" y="760" font-family="serif" font-size="27" fill="#273844">A quiet journey.</text><text x="40" y="980" font-family="sans-serif" font-size="20" fill="#39372f">LOCAL ACCEPTANCE FIXTURE / PAGE ${n}</text></svg>`)).jpeg({ quality: 80 }).toBuffer());
  try { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(await cache.get(n)); }
  catch { res.writeHead(500); res.end(); }
}).listen(5199, '127.0.0.1', () => console.log('Comic fixture images on 127.0.0.1:5199'));
