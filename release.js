require('dotenv').config()
const path = require('path')
const fs = require('fs')
const Octokit = require('@octokit/rest').Octokit

const pkg = require('./package.json')

const octokit = new Octokit({ auth: `token ${process.env.GITHUB_TOKEN}` })

const [ , owner, repo ] = pkg.repository.url.match(/https:\/\/github.com\/([^\/]+)\/([^.]+).git$/)
const xpi = pkg.name + '-' + pkg.version + '.xpi';

(async function() {
  // create release and attach xpi
  let release = await octokit.repos.createRelease({ owner, repo, tag_name: `v${pkg.version}`, body: ''})

  await octokit.repos.uploadReleaseAsset({
    owner,
    repo,
    url: release.data.upload_url,
    release_id: release.data.id,
    data: fs.readFileSync(xpi),
    headers: {
      'content-type': 'application/vnd.zotero.plugin',
      'content-length': fs.statSync(xpi).size,
    },
    name: xpi,
  })

  release = await octokit.repos.getReleaseByTag({ owner, repo, tag: 'release' })

  const assets = (await octokit.repos.listReleaseAssets({ owner, repo, release_id: release.data.id })).data
  const update_rdf = assets.find(asset => asset.name === 'update.rdf')
  if (update_rdf) await octokit.repos.deleteReleaseAsset({ owner, repo, asset_id: update_rdf.id })

  await octokit.repos.uploadReleaseAsset({
    owner,
    repo,
    url: release.data.upload_url,
    release_id: release.data.id,
    data: fs.readFileSync('update.rdf'),
    headers: {
      'content-type': 'application/rdf+xml',
      'content-length': fs.statSync('update.rdf').size,
    },
    name: 'update.rdf',
  })

})().catch(err => { throw err })
