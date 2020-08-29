'use strict'

/* global Components, Services, dump */

Components.utils.importGlobalProperties(['fetch'])
Components.utils.import('resource://gre/modules/Services.jsm')

var Zotero = null
const classname = 'fetch-pmcid'

function translate(items, translator) { // returns a promise
  const deferred = Zotero.Promise.defer()
  const translation = new Zotero.Translate.Export()
  translation.setItems(items)
  translation.setTranslator(translator)
  translation.setHandler('done', (obj, success) => {
    if (success) {
      deferred.resolve(obj ? obj.string : '')
    } else {
      Zotero.debug(`translate with ${translator} failed`, { message: 'undefined' })
      deferred.resolve('')
    }
  })
  translation.translate()
  return deferred.promise
}

async function postLog(contentType, body) {
  Zotero.debug(`posting ${body.length}`)
  try {
    let response = await fetch('https://file.io', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `text=${encodeURI(body)}`,
    })
    if (!response.ok) throw new Error(response.statusText)

    response = await response.text()
    dump(`PMCID: got: ${response}`)
    response = JSON.parse(response)
    if (!response.success) throw new Error(response.message)

    return response.link
  } catch (err) {
    Services.prompt.alert(null, 'PCMID Debug logs', err.message)
    return false
  }
}

async function debugLog() {
  let response

  const urls = []

  const items = Zotero.getActiveZoteroPane().getSelectedItems() || []
  if (items.length) {
    response = await postLog('application/rdf+xml', await translate(items, '14763d24-8ba0-45df-8f52-b8d1108e7ac9')) // RDF
    if (!response) return
    Zotero.debug(`items.rdf: ${JSON.stringify(response)}`)
    urls.push(response)
  }

  response = await postLog('text/plain', Zotero.getErrors(true).concat(
    '',
    '',
    Zotero.Debug.getConsoleViewerOutput()
  ).join('\n').trim())
  if (!response) return
  Zotero.debug(`debug.txt: ${JSON.stringify(response)}`)
  urls.push(response)

  Zotero.debug(`debug log: ${JSON.stringify(urls)}`)
  Services.prompt.alert(null, 'PCMID Debug logs', urls.join('\n'))
}

function getField(item, field) {
  try {
    return item.getField(field) || ''
  } catch (err) {
    Zotero.debug(err.message)
    return ''
  }
}

async function running() {
  const prefs = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch)
  const port = prefs.getIntPref('extensions.zotero.httpServer.port')
  dump(`PMCID: trying fetch on http://127.0.0.1:${port}\n`)
  if (port) {
    try {
      await fetch(`http://127.0.0.1:${port}`)
      return true
    } catch (err) {
      dump(`PMCID: startup fetch failed: ${err.message}\n`)
    }
  }

  // assume not running yet
  dump('PMCID: no running Zotero found, awaiting zotero-loaded\n')
  return new Promise(function(resolve, _reject) {
    const observerService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService)
    const loadObserver = function() {
      dump('PMCID: Zotero loaded\n')
      observerService.removeObserver(loadObserver, 'zotero-loaded')
      resolve(true)
    }
    observerService.addObserver(loadObserver, 'zotero-loaded', false)
  })
}

async function fetchPMCID() {
  const ZoteroPane = Zotero.getActiveZoteroPane()
  const items = ZoteroPane.getSelectedItems().filter(item => !item.isNote() && !item.isAttachment())

  for (const item of items) {
    const extra = item.getField('extra').split('\n')

    const has = extra.reduce((acc, line) => {
      const m = line.match(/^(PMC?ID):/i)
      if (m) acc[m[1].toLowerCase()] = true
      return acc
    }, {})

    if (has.pmcid && has.pmid) continue

    let doi = getField(item, 'DOI')

    if (!doi && (doi = getField(item, 'url'))) {
      if (!doi.match(/^https?:\/\/doi.org\//i)) doi = ''
    }

    if (!doi && (doi = extra.find(line => line.match(/^DOI:/i)))) {
      doi = doi.replace(/^DOI:\s*/i, '')
    }

    doi = doi.replace(/^https?:\/\/doi.org\//i, '')

    if (!doi) continue

    try {
      const url = `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?tool=zotero-pmcid-fetcher&email=emiliano.heyns@iris-advies.com&ids=${encodeURIComponent(doi)}&format=json`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Unexpected response from API')
      const data = await response.json()
      if (data.status !== 'ok') throw new Error(`data not OK: ${JSON.stringify(data)}`)
      if (!data.records) throw new Error(`no records: ${JSON.stringify(data)}`)
      if (data.records.length !== 1) throw new Error(`${data.records.length} records: ${JSON.stringify(data)}`)

      for (const id of ['pmcid', 'pmid']) {
        if (!has[id] && data.records[0][id]) extra.push(`${id.toUpperCase()}: ${data.records[0][id]}`)
      }

      item.setField('extra', extra.join('\n'))
      await item.saveTx()

    } catch (err) {
      Zotero.debug(`could not fetch PMCID for ${doi}: ${err.message}`)
    }
  }
}

function updateMenu() {
  dump('PMCID: update menu\n')
  const ZoteroPane = Zotero.getActiveZoteroPane()
  const menu = ZoteroPane.document.getElementById('zotero-itemmenu')
  let menuitem

  if (!(menuitem = ZoteroPane.document.getElementById('fetch-pmcid'))) {
    menuitem = ZoteroPane.document.createElement('menuitem')
    menuitem.setAttribute('id', 'fetch-pmcid')
    menuitem.setAttribute('label', 'Fetch PMCID keys')
    menuitem.classList.add(classname)
    menuitem.addEventListener('command', function() { fetchPMCID().catch(err => Zotero.debug(err.message)) }, false)

    menu.appendChild(menuitem)
  }

  const items = ZoteroPane.getSelectedItems().filter(item => !item.isNote() && !item.isAttachment())
  menuitem.hidden = !items.length
}

function cleanup() {
  if (Zotero) {
    const ZoteroPane = Zotero.getActiveZoteroPane()
    ZoteroPane.document.getElementById('zotero-itemmenu').removeEventListener('popupshowing', updateMenu, false)

    for (const node of Array.from(ZoteroPane.document.getElementsByClassName(classname))) {
      node.parentElement.removeChild(node)
    }
  }
}

// --- //

function install(_data, _reason) { }

function startup(_data, _reason) {
  (async function() {
    cleanup()
    dump('PMCID: started\n')

    await running()
    Zotero = Components.classes['@zotero.org/Zotero;1'].getService(Components.interfaces.nsISupports).wrappedJSObject
    await Zotero.Schema.schemaUpdatePromise

    dump('PMCID: Zotero loaded\n')

    const ZoteroPane = Zotero.getActiveZoteroPane()
    const menu = ZoteroPane.document.getElementById('menu_HelpPopup')

    let menuitem = ZoteroPane.document.createElement('menuseparator')
    menuitem.classList.add(classname)
    menu.appendChild(menuitem)

    menuitem = ZoteroPane.document.createElement('menuitem')
    menuitem.setAttribute('id', 'fetch-pmcid')
    menuitem.setAttribute('label', 'Fetch PMCID keys: send debug log')
    menuitem.classList.add(classname)
    menuitem.addEventListener('command', function() { debugLog().catch(err => Zotero.debug(err.message)) }, false)
    menu.appendChild(menuitem)

    ZoteroPane.document.getElementById('zotero-itemmenu').addEventListener('popupshowing', updateMenu, false)

    dump('PMCID: menu installed\n')

  })()
    .catch(err => {
      dump(err.message + '\n')
    })
}

function shutdown(_data, _reason) {
  cleanup()
}

function uninstall(_data, _reason) { }
