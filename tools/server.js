// Mini-Webserver für die lokale Vorschau: node tools/server.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
};

http.createServer((req, res) => {
  const pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let datei = path.normalize(path.join(WURZEL, pfad));
  if (!datei.startsWith(WURZEL)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(datei) && fs.statSync(datei).isDirectory()) datei = path.join(datei, 'index.html');
  fs.readFile(datei, (fehler, inhalt) => {
    if (fehler) { res.writeHead(404); res.end('Nicht gefunden'); return; }
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(inhalt);
  });
}).listen(PORT, () => console.log(`Vorschau: http://localhost:${PORT}`));
