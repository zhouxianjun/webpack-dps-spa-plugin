const PluginName = 'AutoDpsPlugin';
const cheerio = require('cheerio');
const promiseLimit = require('promise-limit');
const fs = require('fs');
const DpsServer = require('./dpsServer');
const { copyFiles, deleteFileSync } = require('./util');
const path = require('path');
const DrawPageStructure = require('draw-page-structure');
const ppteer = require('./pp');
const getAutoRouting = require('./getAutoRouting');
const { baseUrl } = require('./util');
const { log, error, chalk } = require('@vue/cli-shared-utils');
const { cloneDeep } = require('lodash');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const start = async function () {
  const pageUrl = this.url;
  log();
  log(`  🚀  开始渲染骨架屏 ==> ${pageUrl}`);

  const page = await this.pp.openPage(pageUrl, this.extraHTTPHeaders);

  const { await: awaitTime } = this.plugin.options;
  if (awaitTime) {
    log();
    log(`  延迟等待中...(${awaitTime}ms)`);
    await sleep(awaitTime);
  }

  const html = await this.generateSkeletonHTML(page);

  if (typeof this.writePageStructure !== 'function') {
    throw Error('配置错误: writePageStructure');
  }

  await this.writePageStructure(html);

  if (this.config.headless) {
    await page.close();
  }
  log();
  log(`  ${chalk.green('✔')} 完成骨架屏渲染 ==> ${pageUrl}`);
};

const writePageStructure = function (html) {
  const $ = cheerio.load(html);
  $('style').remove();
  const skeleton = this.plugin.skeletons.find(s => s.id === this.route.skeletonId);
  if (skeleton) {
    skeleton.html = $('body').html();
  }
};

class AutoDpsPlugin {
  /**
   * 自动渲染骨架屏插件
   * @param options 插件配置
   * @param options.server 渲染骨架屏本地服务配置
   * @param options.server.port 本地服务端口，默认从8000开始寻找
   * @param options.server.proxy 本地服务反向代理配置与devServer.proxy一致，如果为value为函数则为中间件，否则为http-proxy-middleware
   * @param options.insertEl 骨架屏元素插入到html的父标签，默认 #skeleton
   * @param options.routeMode 路由模式，默认 history
   * @param options.limit 同时渲染骨架屏路由数量，默认 5
   * @param options.await 等待时间（ms）
   * @param options.staticDir 打包输出目录（index.html输出目录），默认 项目根目录下的dist目录
   * @param options.enableAutoSkeletonRoutes 是否采用自动配置路由，必须使用 auto-routing 插件
   * @param options.skeletonRoutes 需要渲染的骨架屏路由配置，enableAutoSkeletonRoutes 为 false 可用
   */
  constructor (options) {
    this.options = options;
    this.options.server = options.server || {};
    this.skeletons = [];
    this.options.insertEl = this.options.insertEl || '#skeleton';
    this.options.routeMode = this.options.routeMode || 'history';
    this.options.limit = this.options.limit || 5;
    this.options.await = this.options.await || 0;
    this.limit = promiseLimit(this.options.limit);
  }

  setStaticDir (compilation) {
    if (!this.options.staticDir) {
      this.options.staticDir = path.resolve(compilation.options.context, 'dist');
    }
  }

  apply (compiler) {
    compiler.hooks.afterEmit.tapAsync(PluginName, async (compilation, done) => {
      this.setStaticDir(compilation);
      const routing = this.getRouting(compilation);
      if (!routing || routing.length <= 0) {
        log();
        log(chalk.gray('没有需要渲染骨架屏的路由.'));
        done();
        return;
      }
      let dest = `${this.options.staticDir}${baseUrl}`;
      dest = dest.endsWith('/') ? dest.substring(0, dest.length - 1) : dest;
      await copyFiles(this.options.staticDir, dest, name => name !== dest);
      const server = new DpsServer(this.options);
      try {
        await server.initialize();
        log();
        log(`  ✨  渲染骨架屏... on ${server.options.server.port}`);
        await this.render(compilation, routing.map(r => ({
          ...r,
          url: `http://localhost:${server.options.server.port}${r.pathname}`
        })
        ));
      } catch (e) {
        error(e);
        process.exit(0);
      } finally {
        server.destroy();
      }
      await deleteFileSync(dest);
      this.write();
      log();
      log(`  ${chalk.green('✔')} 骨架屏渲染完毕.`);
      done();
    });
  }

  getRouting (compilation) {
    if (this.options.enableAutoSkeletonRoutes !== false) {
      const routingFile = path.resolve(compilation.options.context, 'node_modules/vue-auto-routing/index.js');
      if (!fs.existsSync(routingFile)) {
        setTimeout(() => process.exit(0));
        throw new Error('没有使用vue-auto-routing');
      }
      return getAutoRouting(routingFile);
    }
    return this.options.skeletonRoutes || [];
  }

  async render (compilation, routes) {
    const config = this.getDPSConfig(compilation);
    if (typeof config.headless === 'undefined') {
      config.headless = true;
    }
    if (!config.launch) {
      config.launch = {};
    }
    config.launch.headless = config.headless;
    const pp = await ppteer({
      device: config.device,
      inject: typeof config.inject === 'undefined' ? true : config.inject,
      injectProperty: config.injectProperty,
      launch: config.launch
    });
    await Promise.all(routes
      .map(r => this.createDps(pp, config, compilation, r))
      .map(dps => this.limit(start.bind(dps)))
    );
    if (config.headless) {
      await pp.browser.close();
    }
  }

  write () {
    const script = this.generateScript();
    const htmlFilePath = path.resolve(this.options.staticDir, 'index.html');
    const content = fs.readFileSync(htmlFilePath);
    const $ = cheerio.load(content);
    this.skeletons.forEach(s => {
      $(this.options.insertEl).append(`<div id="${s.id}" style="display: none">${s.html}</div>`);
    });
    $(this.options.insertEl).append(`<script>${script}</script>`);

    this.writeCSS($);
    fs.writeFileSync(htmlFilePath, $.html());
  }

  writeCSS ($) {
    const cssPath = path.resolve(__dirname, './dps.css');
    const css = fs.readFileSync(cssPath, { encoding: 'utf-8' });
    const styleEl = $('style');
    if (!styleEl.length) {
      $('head').append(`<style>${css}</style>`);
    } else {
      styleEl.append(css);
    }
  }

  getDPSConfig (compilation) {
    const configFilePath = path.resolve(compilation.options.context, 'dps.config.js');
    const config = fs.existsSync(configFilePath) ? require(configFilePath) : {};
    const $writePageStructure = config.writePageStructure;
    config.writePageStructure = async function (html) {
      if (typeof $writePageStructure === 'function') {
        await Reflect.apply($writePageStructure, this, [html]);
      }
      await Reflect.apply(writePageStructure, this, [html]);
    };
    return config;
  }

  createDps (pp, config, compilation, route) {
    const cfg = cloneDeep(config);
    cfg.url = route.url;
    const dps = new DrawPageStructure(cfg);
    dps.route = route;
    dps.plugin = this;
    dps.pp = pp;
    dps.config = cfg;
    this.skeletons.push({
      id: route.skeletonId,
      el: `document.querySelector('#${route.skeletonId}')`,
      pathRegex: route.path
    });
    return dps;
  }

  generateSkeletons () {
    return this.skeletons
      .map(s => {
        return `
                    {id: '${s.id}', el: ${s.el}, pathRegex: ${s.pathRegex.toString()}}
                `;
      }).join(',');
  }

  generateScript () {
    return `
            var pathname = window.location.pathname;
            var hash = window.location.hash;
            var skeletons = [${this.generateSkeletons()}];
            var isMatched = function(pathReg, mode) {
                if (mode === 'hash') {
                    return pathReg.test(hash.replace('#', ''));
                }
                else if (mode === 'history') {
                    return pathReg.test(pathname);
                }
                return false;
            };
            var showSkeleton = function(skeletonId) {
                for (var i = 0; i < skeletons.length; i++) {
                    var skeleton = skeletons[i];
                    if (skeletonId === skeleton.id) {
                        skeleton.el.style = 'display:block;';
                    }else {
                        skeleton.el.style = 'display:none;';
                    }
                }
            };
            for (var j = 0; j < skeletons.length; j++) {
                var skeleton = skeletons[j];
                if (isMatched(skeleton.pathRegex, 'history')) {
                    showSkeleton(skeleton.id);
                    break;
                }
            }
        `;
  }
}
module.exports = AutoDpsPlugin;
