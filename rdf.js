const pkg = require('./package.json')
const pug = require('pug')
const prettify = require('prettify-xml')
const fs = require('fs')

let template = pug.compileFile('install.pug')
let rdf = prettify(template({
  version: pkg.version,
  name: pkg.description,
  description: pkg.description,
  bootstrapped: true,
  id: pkg.name.replace('zotero-', '') + pkg.author.email.replace(/.*@/, '@'),
  homepage: pkg.homepage,
  author: pkg.author,
  updateURL: pkg.repository.url.replace('git+https', 'https').replace(/\.git$/, '/releases/download/release/update.rdf')
}))
fs.writeFileSync('install.rdf', rdf)

template = pug.compileFile('update.pug')
rdf = prettify(template({
  version: pkg.version,
  updateLink: pkg.repository.url.replace('git+https', 'https').replace(/\.git$/, `/releases/download/v${pkg.version}/${pkg.name}-${pkg.version}.xpi`)
}))
fs.writeFileSync('update.rdf', rdf)


