require('dotenv').config()
const path = require('path')
const fs = require('fs')
const Octokit = require('@octokit/rest').Octokit
const branch = require('current-git-branch')()
const version = require('./version')

const pkg = require('./package.json')

const octokit = new Octokit({ auth: `token ${process.env.GITHUB_TOKEN}` })

const [ , owner, repo ] = pkg.repository.url.match(/https:\/\/github.com\/([^\/]+)\/([^.]+).git$/)

(async function() {
  let release, m

  if (branch === 'master') {
    release = await octokit.repos.createRelease({ owner, repo, tag_name: `v${pkg.version}`, body: ''})
  } else if (version.issue) {
    release = await octokit.repos.getReleaseByTag({ owner, repo, tag: 'builds' })

    let expired = new Date()
    expired.setDate(expired.getDate() - 7)
    expired = expired.toISOString()

    for (const asset of release.data.assets || []) {
      if (asset.created_at < expired || asset.name === version.xpi) {
        await octokit.repos.deleteReleaseAsset({ owner, repo, asset_id: asset.id })
      }
    }

  } else {
    throw new Error(`cannot release on ${branch}`)
  }

  await octokit.repos.uploadReleaseAsset({
    owner,
    repo,
    url: release.data.upload_url,
    release_id: release.data.id,
    data: fs.readFileSync(version.xpi),
    headers: {
      'content-type': 'application/vnd.zotero.plugin',
      'content-length': fs.statSync(version.xpi).size,
    },
    name: version.xpi,
  })

  if (branch === 'master') {
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

  } else {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number:
      version.issue,
      body: `Please try [${version.version} ${new Date}](https://github.com/${owner}/${repo}/releases/download/builds/${version.xpi}`,
    })
  }
})().catch(err => { throw err })
