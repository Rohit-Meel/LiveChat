const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT) || 8000;
const HOST = '0.0.0.0';
const PUBLIC_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    const requestPath = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;

    if (requestPath === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }

    let filePath = requestPath === '/' ? '/index.html' : requestPath;
    filePath = path.normalize(filePath).replace(/^([.][.][/\\])+/, '');
    const absolutePath = path.resolve(PUBLIC_DIR, `.${filePath}`);

    if (!absolutePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(absolutePath, (error, data) => {
        if (error) {
            res.writeHead(error.code === 'ENOENT' ? 404 : 500, {
                'Content-Type': 'text/plain; charset=utf-8'
            });
            res.end(error.code === 'ENOENT' ? 'Not Found' : 'Server Error');
            return;
        }

        const extension = path.extname(absolutePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
            'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=86400'
        });
        res.end(data);
    });
});

const io = new Server(server, {
    cors: {
        origin: true,
        credentials: false
    },
    maxHttpBufferSize: 1e6
});

const users = Object.create(null);

io.on('connection', (socket) => {
    socket.on('new-user-joined', (name) => {
        const safeName = String(name || 'Anonymous').trim().slice(0, 30) || 'Anonymous';
        users[socket.id] = safeName;
        socket.broadcast.emit('user-joined', safeName);
        console.log(`New user joined: ${safeName}`);
    });

    socket.on('send', (message) => {
        const safeMessage = String(message || '').trim().slice(0, 500);
        if (!safeMessage) return;

        socket.broadcast.emit('receive', {
            message: safeMessage,
            name: users[socket.id] || 'Anonymous'
        });
    });

    socket.on('disconnect', () => {
        const name = users[socket.id];
        if (name) socket.broadcast.emit('leave', name);
        delete users[socket.id];
    });
});

server.listen(PORT, HOST, () => {
    console.log(`iChat server running on port ${PORT}`);
});
