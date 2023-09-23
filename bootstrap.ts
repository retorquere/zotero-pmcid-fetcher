/* eslint-disable @typescript-eslint/ban-types, prefer-rest-params, @typescript-eslint/no-unnecessary-type-assertion, no-throw-literal, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, prefer-arrow/prefer-arrow-functions */

declare const Components: any
declare var Services: any // eslint-disable-line no-var
declare const dump: (msg: string) => void

var Zotero // eslint-disable-line no-var
var notifier // eslint-disable-line no-var
var ChromeUtils // eslint-disable-line no-var

Components.utils.importGlobalProperties(['fetch'])
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

async function waitForZotero() {
  debug('waitForZotero')
  if (typeof Zotero != 'undefined') {
    await Zotero.initializationPromise
    return
  }

  if (typeof Services == 'undefined') {
    ({ Services } = ChromeUtils.import('resource://gre/modules/Services.jsm'))
  }
  const windows = Services.wm.getEnumerator('navigator:browser')
  let found = false
  while (windows.hasMoreElements()) {
    const win = windows.getNext()
    if (win.Zotero) {
      Zotero = win.Zotero
      found = true
      break
    }
  }
  if (!found) {
    await new Promise(resolve => {
      const listener = {
        onOpenWindow: aWindow => {
          // Wait for the window to finish loading
          const domWindow = aWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
            .getInterface(Components.interfaces.nsIDOMWindowInternal || Components.interfaces.nsIDOMWindow)
          domWindow.addEventListener('load', () => {
            domWindow.removeEventListener('load', arguments.callee, false) // eslint-disable-line no-caller
            if (domWindow.Zotero) {
              Services.wm.removeListener(listener)
              Zotero = domWindow.Zotero
              resolve(undefined)
            }
          }, false)
        },
      }
      Services.wm.addListener(listener)
    })
  }
  await Zotero.initializationPromise
}

// --- //

export function install(_data, _reason) { }

export async function startup({ resourceURI, rootURI = resourceURI.spec }) {
  debug('waiting for zotero')
  await waitForZotero()
  debug('zotero loaded, loading lib')
  Services.scriptloader.loadSubScript(`${rootURI}lib.js`, { Zotero })
  debug('zotero loaded, lib loaded')
  Zotero.PMCIDFetcher.startup()
  debug('lib started')
}

export function shutdown(_data, _reason) {
  Zotero.PMCIDFetcher.shutdown()
}

export function uninstall(_data, _reason) { }
