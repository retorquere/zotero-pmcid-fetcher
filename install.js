const pkg = require('./package.json')
const pug = require('pug')
const template = pug.compileFile('install.pug')
console.log(template({version: pkg.version}))
