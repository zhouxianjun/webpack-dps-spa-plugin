const nodeExternals = require('webpack-node-externals');
module.exports = {
  configureWebpack: {
    output: {
      libraryExport: 'default'
    }
  },
  devServer: {
    overlay: {
      warnings: false,
      errors: false
    }
  },
  chainWebpack: config => {
    if (process.env.NODE_ENV === 'production') {
      config.externals(nodeExternals());
    }
  }
};
