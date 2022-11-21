'use strict'

/* global Components, Services, dump */

Components.utils.importGlobalProperties(['fetch'])
Components.utils.import('resource://gre/modules/Services.jsm')

function setTimeout(callback, ms) {
  const timer = Components.classes['@mozilla.org/timer;1'].createInstance(Components.interfaces.nsITimer)
  timer.initWithCallback({notify: callback}, ms, Components.interfaces.nsITimer.TYPE_ONE_SHOT)
  return timer
}

/*
function clearTimeout(timer) {
  timer.cancel()
}
*/

let Zotero
let notifier

const classname = 'fetch-pmcid'

function debug(msg) {
  msg = `PMCID: ${msg}`
  if (Zotero) {
    Zotero.debug(msg)
  } else {
    dump(msg + '\n')
  }
}
function flash(title, body = null, timeout = 8) {
  try {
    debug(`flashed ${JSON.stringify({title, body})}`)
    const pw = new Zotero.ProgressWindow()
    pw.changeHeadline(`PMCID: ${title}`)
    if (!body) body = title
    pw.addDescription(body)
    pw.show()
    pw.startCloseTimer(timeout * 1000)
  } catch (err) {
    debug('@flash failed: ' + JSON.stringify({title, body}) + ': ' + err.message)
  }
}

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
  debug(`posting ${body.length}`)
  try {
    let response = await fetch('https://file.io', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `text=${encodeURI(body)}`,
    })
    if (!response.ok) throw new Error(response.statusText)

    response = await response.text()
    debug(`got: ${response}`)
    response = JSON.parse(response)
    if (!response.success) throw new Error(response.message)

    return response.link
  } catch (err) {
    Services.prompt.alert(null, 'PMCID Debug logs', err.message)
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
    debug(`items.rdf: ${JSON.stringify(response)}`)
    urls.push(response)
  }

  response = await postLog('text/plain', Zotero.getErrors(true).concat(
    '',
    '',
    Zotero.Debug.getConsoleViewerOutput()
  ).join('\n').trim())
  if (!response) return
  debug(`debug.txt: ${JSON.stringify(response)}`)
  urls.push(response)

  debug(`debug log: ${JSON.stringify(urls)}`)
  Services.prompt.alert(null, 'PMCID Debug logs', urls.join('\n'))
}

async function running() {
  const prefs = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch)
  const port = prefs.getIntPref('extensions.zotero.httpServer.port')
  debug(`trying fetch on http://127.0.0.1:${port}`)
  if (port) {
    try {
      await Promise.race([fetch(`http://127.0.0.1:${port}`), new Promise((resolve, reject) => { setTimeout(function() { reject(new Error('request timed out')) }, 1000) })])
      return true
    } catch (err) {
      debug(`startup fetch failed: ${err.message}`)
    }
  }

  // assume not running yet
  debug('no running Zotero found, awaiting zotero-loaded')
  return new Promise(function(resolve, _reject) {
    const observerService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService)
    const loadObserver = function() {
      debug('Zotero loaded')
      observerService.removeObserver(loadObserver, 'zotero-loaded')
      resolve(true)
    }
    observerService.addObserver(loadObserver, 'zotero-loaded', false)
  })
}

function getField(item, field) {
  try {
    return item.getField(field) || ''
  } catch (err) {
    debug(err.message)
    return ''
  }
}

async function fetchPMCID(items) {
  items = items
    .filter(item => item.isRegularItem())
    .map(item => {
      const req = {
        item,
        extra: item.getField('extra').split('\n'),
      }

      for (const line of req.extra) {
        const m = line.match(/^(PMC?ID)\s*:\s*(.+)/i)
        if (m) req[m[1].toLowerCase()] = m[2].trim()
      }

      req.doi = getField(item, 'DOI')

      if (!req.doi && (req.doi = getField(item, 'url'))) {
        if (!req.doi.match(/^https?:\/\/doi.org\//i)) req.doi = ''
      }

      if (!req.doi && (req.doi = req.extra.find(line => line.match(/^DOI:/i)))) {
        req.doi = req.doi.replace(/^DOI:\s*/i, '')
      }

      req.doi = req.doi.replace(/^https?:\/\/doi.org\//i, '')

      return req
    })
    .filter(item => item.doi || item.pmid || item.pmcid)

  // resolve PMID/PMCID based on DOI
  const incomplete = items.filter(item => item.doi && (!item.pmid || !item.pmcid))
  for (const item of incomplete) {
    const url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?' + Object.entries({
      db: 'pubmed',
      term: item.doi,
      retmode: 'json',
      field: 'doi',
    }).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Unexpected response from API')
      const data = await response.json()
      if (!data.esearchresult) throw new Error(`no esearchresult: ${JSON.stringify(data)}`)
      if (!data.esearchresult.count) throw new Error(`no esearchresult.count: ${JSON.stringify(data)}`)
      if (data.esearchresult.count !== '1') throw new Error(`esearchresult.count not 1: ${JSON.stringify(data)}`)
      if (!data.esearchresult.idlist) throw new Error(`no esearchresult.idlist: ${JSON.stringify(data)}`)

      item.pmid = data.esearchresult.idlist[0]
      item.extra.push(`PMID: ${item.pmid}`)
      item.save = true
    } catch (err) {
      flash('Could not fetch PMCID', `${err.message} Could not fetch PMCID for ${url}: ${err.message}`)
    }
  }

  const still_incomplete = incomplete.filter(item => !item.pmid || !item.pmcid)
  const max = 200
  for (const chunk of Array(Math.ceil(still_incomplete.length/max)).fill().map((_, i) => still_incomplete.slice(i*max, (i+1)*max))) {
    const url = 'https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?' + Object.entries({
      tool: 'zotero-pmcid-fetcher',
      email: 'email=emiliano.heyns@iris-advies.com',
      ids: chunk.map(item => item.doi).join(','),
      format: 'json',
      idtype: 'doi',
      versions: 'no',
    }).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Unexpected response from API')
      const data = await response.json()
      if (data.status !== 'ok') throw new Error(`data not OK: ${JSON.stringify(data)}`)
      if (!data.records) throw new Error(`no records: ${JSON.stringify(data)}`)

      for (const item of chunk) {
        const found = data.records.find(f => f.doi === item.doi)
        if (!found) continue

        for (const id of ['pmcid', 'pmid']) {
          if (!item[id] && found[id]) {
            item[id] = found[id]
            item.extra.push(`${id.toUpperCase()}: ${found[id]}`)
            item.save = true
          }
        }
      }
    } catch (err) {
      flash('Could not fetch PMCID', `Could not fetch PMCID for ${url}: ${err.message}`)
    }
  }

  // fetch tags
  const parser = Components.classes['@mozilla.org/xmlextras/domparser;1'].createInstance(Components.interfaces.nsIDOMParser)
  for (const item of items) {
    if (!item.pmid && !item.pmcid) continue

    try {
      const doc = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=PubMed&tool=Zotero&retmode=xml&rettype=citation&id=${item.pmid || item.pmcid}`).then(response => response.text()).then(text => parser.parseFromString(text, 'text/xml'))
      for (const tag of [...doc.querySelectorAll('MeshHeadingList MeshHeading DescriptorName')]) {
        item.item.addTag(tag.textContent)
        item.save = true
      }
      for (const tag of [...doc.querySelectorAll('KeywordList Keyword')]) {
        item.item.addTag(tag.textContent)
        item.save = true
      }
    }
    catch (err) {
      flash('Could not fetch tags', `Could not fetch tags for ${item.pmid || item.pmcid}: ${err.message}`)
    }

    if (item.save) {
      item.item.setField('extra', item.extra.join('\n'))
      await item.item.saveTx()
    }
  }
}

function updateMenu() {
  debug('update menu')
  const ZoteroPane = Zotero.getActiveZoteroPane()

  let menuitem = ZoteroPane.document.getElementById(classname)

  if (!menuitem) {
    debug('creating menu item')
    const menu = ZoteroPane.document.getElementById('zotero-itemmenu')

    menuitem = ZoteroPane.document.createElement('menuseparator')
    menuitem.classList.add(classname)
    menu.appendChild(menuitem)

    menuitem = ZoteroPane.document.createElement('menuitem')
    menuitem.setAttribute('id', classname)
    menuitem.setAttribute('label', 'Fetch PMCID keys')
    menuitem.classList.add(classname)
    menuitem.addEventListener('command', function() { fetchPMCID(Zotero.getActiveZoteroPane().getSelectedItems()).catch(err => debug(err.message)) }, false)
    menu.appendChild(menuitem)
  }

  const items = ZoteroPane.getSelectedItems().filter(item => item.isRegularItem())
  menuitem.hidden = !items.length
  debug(`menu item ${menuitem.hidden ? 'hidden' : 'shown'}`)
}

function cleanup() {
  if (Zotero) {
    debug('cleaning up')
    const ZoteroPane = Zotero.getActiveZoteroPane()
    ZoteroPane.document.getElementById('zotero-itemmenu').removeEventListener('popupshowing', updateMenu, false)

    for (const node of Array.from(ZoteroPane.document.getElementsByClassName(classname))) {
      node.parentElement.removeChild(node)
    }

    if (typeof notifier !== 'undefined') {
      Zotero.Notifier.unregisterObserver(notifier)
      notifier = undefined
    }
  }
}

// --- //

function install(_data, _reason) { }

function startup(_data, _reason) {
  (async function() {
    cleanup()
    debug('started')

    await running()
    Zotero = Components.classes['@zotero.org/Zotero;1'].getService(Components.interfaces.nsISupports).wrappedJSObject
    await Zotero.Schema.schemaUpdatePromise

    debug('Zotero loaded')

    notifier = Zotero.Notifier.registerObserver({
      async notify(action, _type, ids, _extraData) {
        if (!Zotero.Prefs.get('pmcid.auto')) return

        switch (action) {
        case 'add':
        case 'modify':
          break
        default:
          return
        }

        const items = await Zotero.Items.getAsync(ids)
        await Promise.all(items.map(item => item.loadAllData()))
        await fetchPMCID(items)
      }
    }, ['item'], 'pmcid-fetcher')

    const ZoteroPane = Zotero.getActiveZoteroPane()
    const menu = ZoteroPane.document.getElementById('menu_HelpPopup')

    let menuitem = ZoteroPane.document.createElement('menuseparator')
    menuitem.classList.add(classname)
    menu.appendChild(menuitem)

    menuitem = ZoteroPane.document.createElement('menuitem')
    menuitem.setAttribute('label', 'Fetch PMCID keys: send debug log')
    menuitem.classList.add(classname)
    menuitem.addEventListener('command', function() { debugLog().catch(err => Zotero.debug(err.message)) }, false)
    menu.appendChild(menuitem)

    ZoteroPane.document.getElementById('zotero-itemmenu').addEventListener('popupshowing', updateMenu, false)

    debug('menu installed')

  })()
    .catch(err => {
      debug(err.message)
    })
}

function shutdown(_data, _reason) {
  cleanup()
}

function uninstall(_data, _reason) { }
