const pkg = require('./package.json')

const branch = require('current-git-branch')()

exports.issue = branch.match(/^gh-([0-9]+)$/) ? branch.replace('gh-', '') : null
exports.version = pkg.version + (exports.issue ? `-${exports.issue}}` : '')
exports.xpi = pkg.name + '-' + exports.version + '.xpi';
