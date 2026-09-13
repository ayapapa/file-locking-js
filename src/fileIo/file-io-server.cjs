'use strict';

const net = require('node:net');
const fsp = require('node:fs/promises');
const path = require('node:path');

const SOCKET_PATH =
  process.platform === 'win32'
    ? '\\\\.\\pipe\\file-io-service'
    : path.join('/tmp', 'file-io-service.sock');

class FileIoServer {
  constructor(options = {}) {
    this.socketPath = options.socketPath || SOCKET_PATH;
    this.server = null;
    this.queues = new Map();
    this.isShuttingDown = false;
  }

  async start() {
    if (process.platform !== 'win32') {
      await this.cleanupStaleSocket();
    }

    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    this.server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error('another server is already running');
        process.exit(0);
      }
      console.error(err);
    });

    await new Promise((resolve, reject) => {
      const onError = (err) => {
        this.server.off('error', onError);
        reject(err);
      };

      this.server.once('error', onError);
      this.server.listen(this.socketPath, () => {
        this.server.off('error', onError);
        resolve();
      });
    });

    this.installSignals();
    return this;
  }

  async cleanupStaleSocket() {
    try {
      await fsp.unlink(this.socketPath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  installSignals() {
    const shutdown = async () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      await new Promise((resolve) => {
        this.server.close(() => resolve());
      });

      if (process.platform !== 'win32') {
        try {
          await fsp.unlink(this.socketPath);
        } catch (err) {
          if (err.code !== 'ENOENT') {
            console.error(err);
          }
        }
      }

      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  handleConnection(socket) {
    let buffer = '';
    socket.setEncoding('utf8');

    socket.on('data', async (chunk) => {
      buffer += chunk;

      while (true) {
        const idx = buffer.indexOf('\n');
        if (idx === -1) break;

        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);

        if (!line.trim()) continue;

        let req;
        try {
          req = JSON.parse(line);
        } catch {
          this.send(socket, {
            id: null,
            ok: false,
            error: 'invalid json'
          });
          continue;
        }

        try {
          const res = await this.handleRequest(req);
          this.send(socket, res);
        } catch (err) {
          this.send(socket, {
            id: req.id ?? null,
            ok: false,
            error: err.message
          });
        }
      }
    });
  }

  send(socket, payload) {
    socket.write(JSON.stringify(payload) + '\n');
  }

  enqueue(key, task) {
    const prev = this.queues.get(key) || Promise.resolve();

    const next = prev
      .catch(() => {})
      .then(task)
      .finally(() => {
        if (this.queues.get(key) === next) {
          this.queues.delete(key);
        }
      });

    this.queues.set(key, next);
    return next;
  }

  relatedKeys(targetPath) {
    const full = path.resolve(targetPath);
    return [
      full,
      `dir:${path.dirname(full)}`
    ];
  }

  enqueueMany(keys, task) {
    const sorted = [...new Set(keys)].sort();

    const run = (index) => {
      if (index >= sorted.length) {
        return task();
      }
      return this.enqueue(sorted[index], () => run(index + 1));
    };

    return run(0);
  }

  async handleRequest(req) {
    const { id, type } = req;

    if (!id) throw new Error('id is required');
    if (!type) throw new Error('type is required');

    if (type === 'ping') {
      return { id, ok: true, data: 'pong' };
    }

    if (type === 'read') {
      const filePath = this.requirePath(req.filePath, 'filePath');
      return this.enqueue(path.resolve(filePath), async () => {
        const text = await fsp.readFile(filePath, {
          encoding: req.encoding || 'utf8'
        });
        return { id, ok: true, data: text };
      });
    }

    if (type === 'write') {
      const filePath = this.requirePath(req.filePath, 'filePath');
      return this.enqueueMany(this.relatedKeys(filePath), async () => {
        await this.atomicWrite(filePath, req.data ?? '', req.encoding || 'utf8');
        return { id, ok: true, data: null };
      });
    }

    if (type === 'append') {
      const filePath = this.requirePath(req.filePath, 'filePath');
      return this.enqueueMany(this.relatedKeys(filePath), async () => {
        await this.ensureParentDir(filePath);
        await fsp.appendFile(filePath, req.data ?? '', {
          encoding: req.encoding || 'utf8'
        });
        return { id, ok: true, data: null };
      });
    }

    if (type === 'mkdir') {
      const dirPath = this.requirePath(req.dirPath, 'dirPath');
      return this.enqueue(`dir:${path.resolve(dirPath)}`, async () => {
        const created = await fsp.mkdir(dirPath, {
          recursive: req.recursive !== false
        });
        return { id, ok: true, data: created ?? null };
      });
    }

    if (type === 'rm') {
      const targetPath = this.requirePath(req.targetPath, 'targetPath');
      return this.enqueueMany(this.relatedKeys(targetPath), async () => {
        await fsp.rm(targetPath, {
          recursive: !!req.recursive,
          force: !!req.force,
          maxRetries: req.maxRetries ?? 3,
          retryDelay: req.retryDelay ?? 100
        });
        return { id, ok: true, data: null };
      });
    }

    if (type === 'rename') {
      const oldPath = this.requirePath(req.oldPath, 'oldPath');
      const newPath = this.requirePath(req.newPath, 'newPath');

      const keys = [
        ...this.relatedKeys(oldPath),
        ...this.relatedKeys(newPath)
      ];

      return this.enqueueMany(keys, async () => {
        await this.ensureParentDir(newPath);
        await fsp.rename(oldPath, newPath);
        return { id, ok: true, data: null };
      });
    }

    throw new Error(`unknown type: ${type}`);
  }

  requirePath(value, name) {
    if (!value || typeof value !== 'string') {
      throw new Error(`${name} is required`);
    }
    return value;
  }

  async ensureParentDir(filePath) {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
  }

  async atomicWrite(filePath, data, encoding) {
    await this.ensureParentDir(filePath);
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await fsp.writeFile(tmpPath, data, { encoding });
    await fsp.rename(tmpPath, filePath);
  }
}

module.exports = { FileIoServer, SOCKET_PATH };

if (require.main === module) {
  new FileIoServer()
    .start()
    .then(() => {
      console.log(`file-io-server listening: ${SOCKET_PATH}`);
    })
    .catch((err) => {
      if (err.code === 'EADDRINUSE') {
        process.exit(0);
      }
      console.error(err);
      process.exit(1);
    });
}
