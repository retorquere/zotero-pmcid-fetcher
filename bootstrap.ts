/* eslint-disable @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/ban-types, prefer-rest-params, @typescript-eslint/no-unnecessary-type-assertion, no-throw-literal, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */

declare const Components: any
declare var Services: any // eslint-disable-line no-var
declare const dump: (msg: string) => void

var Zotero // eslint-disable-line no-var
var notifier // eslint-disable-line no-var
var ChromeUtils // eslint-disable-line no-var

Components.utils.import('resource://gre/modules/Services.jsm')

function debug(msg) {
  msg = `PMCID: (bootstrap) ${msg}`
  if (Zotero) {
    Zotero.debug(msg)
  }
  else {
    dump(`${msg}\n`)
  }
}

const classname = 'fetch-pmcid'

export function install(_data, _reason) {}
export function uninstall(_data, _reason) {}

export async function startup({ resourceURI, rootURI = resourceURI.spec }) {
  debug('waiting for zotero')
  Services.scriptloader.loadSubScript(`${rootURI}lib.js`, { Zotero })
  debug('zotero loaded, lib loaded')
  Zotero.PMCIDFetcher.startup()
  Zotero.PMCIDFetcher.onMainWindowLoad({ window: Zotero.getMainWindow() })
  debug('lib started')
}

export function shutdown(_data, _reason) {
  Zotero.PMCIDFetcher?.shutdown()
}

export function onMainWindowLoad({ window }) {
  Zotero.PMCIDFetcher?.onMainWindowLoad({ window })
}

export function onMainWindowUnload({ window }) {
  Zotero.PMCIDFetcher?.onMainWindowUnload({ window })
}
