const fs = require('fs');
const path = require('path');
const { baseUrl } = require('./util');
const { EOL } = require('os');
module.exports = (file) => {
  const content = fs.readFileSync(file, { encoding: 'utf-8' });
  const lines = content.split(/\r?\n/g);
  const index = lines.findIndex(line => line.match(/export default/));
  lines[index] = lines[index].replace('export default', 'module.exports =');
  const tempDir = path.resolve(__dirname, '../../temp');
  if (!fs.existsSync(tempDir) || !fs.statSync(tempDir).isDirectory()) {
    fs.mkdirSync(tempDir);
  }
  const tempFile = path.resolve(tempDir, 'skeleton.routes.js');
  fs.writeFileSync(tempFile, lines.join(EOL), { encoding: 'utf-8' });
  const routes = require(tempFile);
  return routes.filter(r => r.meta && r.meta.skeleton)
    .map(r => {
      const { meta: { skeleton } } = r;
      const cfg = typeof skeleton === 'object' ? skeleton : ({ enable: skeleton === true });
      return {
        enable: true,
        name: r.name,
        path: new RegExp(`^${baseUrl}${r.path}`),
        pathname: `${baseUrl}${r.path}`,
        skeletonId: `skeleton-${r.name}`,
        ...cfg
      };
    })
    .filter(s => s.enable);
};
