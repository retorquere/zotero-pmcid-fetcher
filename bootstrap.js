'use strict';

Components.utils.importGlobalProperties(['fetch'])

var Zotero = null

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
  return new Promise(function(resolve, reject) {
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
    let extra = item.getField('extra').split('\n')
    if (extra.find(line => line.match(/^PMC?ID:/i))) continue

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

      if (data.records[0].pmcid) extra.push(`PMCID: ${data.records[0].pmcid}`)
      if (data.records[0].pmid) extra.push(`PMID: ${data.records[0].pmid}`)

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
    menuitem.addEventListener('command', function() { fetchPMCID().catch(err => Zotero.debug(err.message)) }, false)

    menu.appendChild(menuitem)
  }

  const items = ZoteroPane.getSelectedItems().filter(item => !item.isNote() && !item.isAttachment())
  menuitem.hidden = !items.length
}

// --- //
function install(data, reason) { }

function startup(data, reason) {
  (async function() {
    dump('PMCID: started\n')

    await running()
    Zotero = Components.classes['@zotero.org/Zotero;1'].getService(Components.interfaces.nsISupports).wrappedJSObject
    await Zotero.Schema.schemaUpdatePromise

    dump('PMCID: Zotero loaded\n')
    const ZoteroPane = Zotero.getActiveZoteroPane()
    ZoteroPane.document.getElementById('zotero-itemmenu').addEventListener('popupshowing', updateMenu, false)
    dump('PMCID: menu installed\n')

  })()
  .catch(err => {
    dump(err.message + '\n')
  })
}

function shutdown(data, reason) {
  if (Zotero) {
    const ZoteroPane = Zotero.getActiveZoteroPane()
    ZoteroPane.document.getElementById('zotero-itemmenu').removeEventListener('popupshowing', updateMenu, false)
    const menuitem = ZoteroPane.document.getElementById('fetch-pmcid')
    if (menuitem) menuitem.hidden = true
  }
}

function uninstall(data, reason) { }
