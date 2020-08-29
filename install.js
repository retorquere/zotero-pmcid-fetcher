const pkg = require('./package.json')
const pug = require('pug')
const template = pug.compileFile('install.pug')
console.log(template({
  name: pkg.description,
  description: pkg.description,
  version: pkg.version,
  bootstrapped: true,
  id: pkg.name.replace('zotero-', '') + pkg.author.email.replace(/.*@/, '@'),
  homepage: pkg.homepage,
  author: pkg.author,
  updateURL: pkg.repository.url.replace('git+https', 'https').replace(/\.git$/, '/releases/download/release/update.rdf')
}))
