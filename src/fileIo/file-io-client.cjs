'use strict';

const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { SOCKET_PATH } = require('./file-io-server');

const SERVER_ENTRY = path.join(__dirname, 'file-io-server.js');

class FileIoClient {
  constructor(options = {}) {
    this.socketPath = options.socketPath || SOCKET_PATH;
    this.serverEntry = options.serverEntry || SERVER_ENTRY;
    this.startupTimeoutMs = options.startupTimeoutMs || 5000;
    this.requestTimeoutMs = options.requestTimeoutMs || 10000;
    this._nextId = 1;
    this._ensurePromise = null;
  }

  async ensureServer() {
    if (this._ensurePromise) return this._ensurePromise;

    this._ensurePromise = this._ensureServerInner();

    try {
      await this._ensurePromise;
    } finally {
      this._ensurePromise = null;
    }
  }

  async _ensureServerInner() {
    const alive = await this.ping().catch(() => false);
    if (alive) return;

    await this.tryStartServer();
    await this.waitUntilReady();
  }

  async tryStartServer() {
    const child = spawn(process.execPath, [this.serverEntry], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });

    child.unref();
  }

  async waitUntilReady() {
    const startedAt = Date.now();

    while (Date.now() - startedAt < this.startupTimeoutMs) {
      const ok = await this.ping().catch(() => false);
      if (ok) return;
      await sleep(150);
    }

    throw new Error('server startup timeout');
  }

  async ping() {
    const res = await this._requestRaw({ type: 'ping' }, 1000).catch(() => null);
    return !!(res && res.ok && res.data === 'pong');
  }

  async read(filePath, encoding = 'utf8') {
    return this.request({
      type: 'read',
      filePath,
      encoding
    });
  }

  async write(filePath, data, encoding = 'utf8') {
    await this.request({
      type: 'write',
      filePath,
      data,
      encoding
    });
  }

  async append(filePath, data, encoding = 'utf8') {
    await this.request({
      type: 'append',
      filePath,
      data,
      encoding
    });
  }

  async mkdir(dirPath, options = {}) {
    return this.request({
      type: 'mkdir',
      dirPath,
      recursive: options.recursive !== false
    });
  }

  async rm(targetPath, options = {}) {
    await this.request({
      type: 'rm',
      targetPath,
      recursive: !!options.recursive,
      force: !!options.force,
      maxRetries: options.maxRetries,
      retryDelay: options.retryDelay
    });
  }

  async rename(oldPath, newPath) {
    await this.request({
      type: 'rename',
      oldPath,
      newPath
    });
  }

  async request(message) {
    await this.ensureServer();

    const res = await this._requestRaw(message, this.requestTimeoutMs);

    if (!res.ok) {
      throw new Error(res.error || 'request failed');
    }

    return res.data;
  }

  _requestRaw(message, timeoutMs) {
    const id = String(this._nextId++);
    const payload = { ...message, id };

    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.socketPath);
      let buffer = '';
      let settled = false;

      const timer = setTimeout(() => {
        settled = true;
        socket.destroy();
        reject(new Error('request timeout'));
      }, timeoutMs);

      socket.setEncoding('utf8');

      socket.on('connect', () => {
        socket.write(JSON.stringify(payload) + '\n');
      });

      socket.on('data', (chunk) => {
        buffer += chunk;

        while (true) {
          const idx = buffer.indexOf('\n');
          if (idx === -1) break;

          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);

          if (!line.trim()) continue;

          let msg;
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }

          if (msg.id !== id) continue;

          clearTimeout(timer);
          settled = true;
          socket.end();
          resolve(msg);
          return;
        }
      });

      socket.on('error', (err) => {
        if (settled) return;
        clearTimeout(timer);
        reject(err);
      });

      socket.on('close', () => {
        if (settled) return;
        clearTimeout(timer);
        reject(new Error('socket closed before response'));
      });
    });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { FileIoClient };
