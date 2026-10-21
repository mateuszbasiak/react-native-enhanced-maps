module.exports = {
  plugins: [
    require.resolve('./babel/typegpu-exports.cjs'),
    '@babel/plugin-transform-export-namespace-from',
    '@babel/plugin-transform-class-static-block',
  ],
  presets: ['module:@react-native/babel-preset'],
};
