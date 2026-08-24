/* eslint-disable @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/ban-types, prefer-rest-params, @typescript-eslint/no-unnecessary-type-assertion, no-throw-literal, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */

import { DebugLogSender } from 'zotero-plugin/debug-log'

declare const Components: any
declare var Services: any // eslint-disable-line no-var
declare const dump: (msg: string) => void

function debug(msg) {
  msg = `PMCID: (bootstrap) ${msg}`
  if (Zotero) {
    Zotero.debug(msg)
  }
  else {
    dump(`${msg}\n`)
  }
  dump(`${msg}\n`)
}

export function install(_data, _reason) {}
export function uninstall(_data, _reason) {}

export async function startup({ resourceURI, rootURI = resourceURI.spec }) {
  debug('bootstrap startup')
  const sender = new DebugLogSender('zotero-pmcid-fetcher@iris-advies.com', 'Send PMCID fetcher debug log', ['extensions.zotero.pmcid.'])
  sender.enabled = true

  Services.scriptloader.loadSubScript(`${rootURI}lib.js`, { rootURI, Zotero })
  debug('zotero loaded, lib loaded')
  Zotero.PMCIDFetcher.startup()
  Zotero.PMCIDFetcher.onMainWindowLoad({ window: Zotero.getMainWindow() })
  debug('lib started')
}

export function shutdown(_data, _reason) {
  debug('bootstrap shutdown')
  Zotero.PMCIDFetcher?.shutdown()
}

export function onMainWindowLoad({ window }) {
  debug('bootstrap onMainWindowLoad')
  Zotero.PMCIDFetcher?.onMainWindowLoad({ window })
}

export function onMainWindowUnload() {
  debug('bootstrap onMainWindowUnload')
  Zotero.PMCIDFetcher?.onMainWindowUnload()
}
