// RN 0.85's module transform emits `exports.~unstable` for TypeGPU 0.12's
// string-named namespace export. Repair invalid member identifiers after presets.
module.exports = ({ types: t }) => ({
  name: 'typegpu-string-namespace-export-compat',
  post(file) {
    if (!file.opts.filename?.replaceAll('\\', '/').includes('/typegpu/'))
      return;
    file.path.traverse({
      MemberExpression(path) {
        const node = path.node;
        if (
          !node.computed &&
          t.isIdentifier(node.property) &&
          !t.isValidIdentifier(node.property.name, false)
        ) {
          node.property = t.stringLiteral(node.property.name);
          node.computed = true;
        }
      },
    });
  },
});
