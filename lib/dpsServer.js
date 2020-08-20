const express = require('express');
const { createProxyMiddleware: proxy } = require('http-proxy-middleware');
const path = require('path');
const PortFinder = require('portfinder');

class Server {
  constructor (options) {
    this.options = options;
    this._expressServer = express();
    this._nativeServer = null;
  }

  async initialize () {
    this.options.server.port = this.options.server.port || await PortFinder.getPortPromise() || 13010;
    const server = this._expressServer;

    server.get('*.*', express.static(this.options.staticDir, {
      dotfiles: 'allow'
    }));

    if (this.options.server && this.options.server.proxy) {
      for (const proxyPath of Object.keys(this.options.server.proxy)) {
        const handler = this.options.server.proxy[proxyPath];
        server.use(proxyPath, typeof handler === 'function' ? handler : proxy(handler));
      }
    }

    server.get('*', (req, res) => {
      res.sendFile(this.options.indexPath ? this.options.indexPath : path.join(this.options.staticDir, 'index.html'));
    });

    return new Promise((resolve) => {
      this._nativeServer = server.listen(this.options.server.port, () => {
        resolve();
      });
    });
  }

  destroy () {
    this._nativeServer.close();
  }
}

module.exports = Server;
