const { compileTemplate } = require('@vue/compiler-sfc');
const { join } = require('path');
const { readFileSync } = require('fs');
const SVGO = require('svgo');

async function compileSvg(source, path, isBuild) {
  let { code } = compileTemplate({
    source,
    transformAssetUrls: false,
  });

  code = code.replace('export function render', 'function render');
  code += '\nconst VueComponent = { render };';

  if (!isBuild) {
    code += `\nVueComponent.__hmrId = ${JSON.stringify(path)};`;
  }

  code += `\nexport { VueComponent };`;

  return code;
}

async function optimizeSvg(svgo, content, path) {
  const { data } = await svgo.optimize(content, {
    path,
  });

  return data;
}

module.exports = (options = {}) => {
  const { svgoConfig } = options;
  const svgo = new SVGO(svgoConfig);
  const cache = new Map();

  return {
    transforms: [
      {
        test: (path, query) => {
          const isSVG = path.endsWith('.svg');

          return process.env.NODE_ENV === 'production'
            ? isSVG
            : isSVG && query.import != null;
        },
        transform: async (transformedCode, _, isBuild, path) => {
          let result = cache.get(path);

          if (!result) {
            const code = readFileSync(
              isBuild ? path : join(process.cwd(), path),
            );

            const svg = await optimizeSvg(svgo, code, path);

            result = await compileSvg(svg, path, isBuild);

            if (isBuild) {
              cache.set(path, result);
            }
          }

          return `${transformedCode}\n${result}`;
        },
      },
    ],
  };
};
