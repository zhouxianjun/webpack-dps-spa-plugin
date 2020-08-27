const ppteer = require('fast-install-puppeteer');
const { merge } = require('lodash');
const { log, getAgrType } = require('draw-page-structure/src/utils');

const devices = {
  mobile: [375, 667, 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1'],
  ipad: [1024, 1366, 'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'],
  pc: [1200, 1000, 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1']
};

async function pp ({ device = 'mobile', inject = true, injectProperty, launch = {} }) {
  if (process.platform === 'linux') {
    if (!launch) launch = {};
    if (!launch.args) launch.args = [];

    if (launch.args.indexOf('--no-sandbox') === -1) {
      launch.args.push('--no-sandbox');
      launch.args.push('--disable-setuid-sandbox');
    }

    if (inject && !injectProperty) {
      injectProperty = '__DPS_INJECTED';
    }
  }
  const browser = await ppteer.launch(merge({ headless: true }, launch));

  async function openPage (url, extraHTTPHeaders) {
    const page = await browser.newPage();
    try {
      if (inject) {
        await page.evaluateOnNewDocument(`(function () { window['${injectProperty}'] = ${JSON.stringify(inject)}; })();`);
      }
      const deviceSet = devices[device];
      page.setUserAgent(deviceSet[2]);
      page.setViewport({ width: deviceSet[0], height: deviceSet[1] });

      if (extraHTTPHeaders && getAgrType(extraHTTPHeaders) === 'object') {
        await page.setExtraHTTPHeaders(new Map(Object.entries(extraHTTPHeaders)));
      }
      await page.goto(url, {
        timeout: 2 * 60 * 1000,
        waitUntil: 'networkidle0'
      });
    } catch (e) {
      console.log('\n');
      log.error(e.message);
    }
    return page;
  }
  return {
    browser,
    openPage
  };
};

module.exports = pp;
