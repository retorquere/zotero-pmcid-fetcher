/* eslint-disable prefer-rest-params, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion, no-throw-literal */

import { DebugLog } from 'zotero-plugin/debug-log'

declare const Components: any
declare const Cu: any
declare var Zotero: any // eslint-disable-line no-var

Components.utils.import('resource://gre/modules/Services.jsm')

import { PromptService } from './prompt'

function debug(msg: string) {
  Zotero.debug(`PMCID: ${msg}`)
}

debug('loading...')

const is7 = Zotero.platformMajorVersion >= 102
if (is7) Cu.importGlobalProperties(['fetch'])
Cu.importGlobalProperties(['Blob', 'FormData'])

function create(doc: Document, name: string): HTMLElement {
  const elt: HTMLElement = is7 ? (doc as any).createXULElement(name) : doc.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', name)
  return elt
}

type Trampoline = Function & { disabled?: boolean } // eslint-disable-line @typescript-eslint/ban-types
const trampolines: Trampoline[] = []

function patch(object: any, method: string, patcher: (f: Function) => Function, mem?: Trampoline[]): void { // eslint-disable-line @typescript-eslint/ban-types
  if (typeof object[method] !== 'function') throw new Error(`monkey-patch: ${method} is not a function`)

  const orig: Function = object[method] // eslint-disable-line @typescript-eslint/ban-types
  const patched = patcher(orig)
  object[method] = function trampoline() {
    return (trampoline as Trampoline).disabled ? orig.apply(this, arguments) : patched.apply(this, arguments)
  }
  trampolines.push(object[method] as Trampoline)
  if (mem) mem.push(object[method] as Trampoline)
}
function unpatch(functions?: Trampoline[]) {
  for (const trampoline of (functions || trampolines)) {
    trampoline.disabled = true
  }
}

class Deferred {
  public promise: Promise<void>
  public resolve: (data?: any) => void
  public reject: (err: Error) => void

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
    for (const op of ['then', 'catch']) {
      this[op] = this.promise[op].bind(this.promise)
    }
  }
}

class Throttle {
  private jobs: WeakMap<Deferred, number> = new WeakMap
  private job = 0
  private queue = []
  private interval: number

  constructor() {
    this.interval = Zotero.getMainWindow().setInterval(() => {
      if (!this.queue) return Zotero.getMainWindow().clearInterval(this.interval)

      const deferred: Deferred = this.queue.shift()
      if (deferred) {
        debug(`${(new Date).toISOString()} starting ${this.jobs.get(deferred)}`)
        this.jobs.delete(deferred)
        deferred.resolve()
      }
    }, 400) // NCBI limits to 3 requests per second
  }

  /*
  constructor() {
    void this.run()
  }

  private async run() {
    while (this.queue) {
      const deferred: Deferred = this.queue.shift()
      if (deferred) {
        debug(`${(new Date).toISOString()} starting ${this.jobs.get(deferred)}`)
        this.jobs.delete(deferred)
        deferred.resolve()
      }
      await Zotero.Promise.delay(400) // NCBI limits to 3 requests per second
    }
  }
  */

  slot() {
    const deferred = new Deferred
    this.jobs.set(deferred, ++this.job)
    debug(`${(new Date).toISOString()} scheduling ${this.jobs.get(deferred)}`)
    this.queue.push(deferred)
    return deferred.promise
  }

  shutdown() {
    this.queue = null
    this.jobs = null
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
  }
  catch (err) {
    debug(`@flash failed: ${JSON.stringify({title, body})}: ${err}`)
  }
}

function getField(item, field) {
  try {
    return item.getField(field) || ''
  }
  catch (err) {
    debug(`${err}`)
    return ''
  }
}

function errorlist(list?: Record<string, string>) {
  if (!list) return ''

  let error = ''
  for (const [k, v] of Object.entries(list)) {
    if (Array.isArray(v) && !v.length) continue
    error += `${k}: ${JSON.stringify(v)}\n`
  }
  return error
}

const classname = 'fetch-pmcid'

function selectedItems(): any[] {
  return Zotero.getActiveZoteroPane().getSelectedItems().filter(item => item.isRegularItem() && !item.isFeedItem) as any[]
}

Zotero.PMCIDFetcher = new class {
  notifier: number
  throttle: Throttle

  startup() {
    debug('startup')
    this.throttle = new Throttle
    debug('throttler installed')

    this.notifier = Zotero.Notifier.registerObserver({
      notify: async (action, _type, ids, _extraData) => {
        if (!Zotero.Prefs.get('pmcid.auto')) return

        switch (action) {
          case 'add':
          case 'modify':
            break
          default:
            return
        }

        const items = await Zotero.Items.getAsync(ids)
        await Promise.all(items.map(item => item.loadAllData() as Promise<any>))
        await this.fetchPMCID(items)
      },
    }, ['item'], 'pmcid-fetcher')
    debug('notifier installed')

    debug('adding help menu')
    DebugLog.register('PMCID fetcher', ['extensions.zotero.pmcid.'])
    debug('help menu added')

    patch(Zotero.getActiveZoteroPane(), 'buildItemContextMenu', original => async function ZoteroPane_buildItemContextMenu() {
      await original.apply(this, arguments) // eslint-disable-line prefer-rest-params

      debug('update menu')

      let menuitem = this.document.getElementById(classname)

      if (!menuitem) {
        debug('creating menu item')
        const menu = this.document.getElementById('zotero-itemmenu')

        menuitem = create(this.document as Document, 'menuseparator')
        menuitem.classList.add(classname)
        menu.appendChild(menuitem)

        menuitem = create(this.document as Document, 'menuitem')
        menuitem.setAttribute('id', classname)
        menuitem.setAttribute('label', 'Fetch PMCID keys')
        menuitem.classList.add(classname)
        menuitem.addEventListener('command', () => { void Zotero.PMCIDFetcher.fetchPMCID() }, false)
        menu.appendChild(menuitem)
      }

      const items = Zotero.getActiveZoteroPane().getSelectedItems().filter(item => item.isRegularItem() && !item.isFeedItem)
      menuitem.hidden = !items.length
      debug(`menu item ${menuitem.hidden ? 'hidden' : menuitem.getAttribute('label')}`)
    })
  }

  shutdown() {
    unpatch()

    this.throttle?.shutdown()
    const doc: Document = Zotero.getActiveZoteroPane().document

    for (const node of Array.from(doc.querySelectorAll(`.${classname}`)) as Element[]) {
      node.remove()
    }

    if (typeof this.notifier !== 'undefined') {
      Zotero.Notifier.unregisterObserver(this.notifier)
      this.notifier = undefined
    }
  }

  async fetchPMCID(items?) {
    try {
      await this.$fetchPMCID(items)
    }
    catch (err) {
      debug(`${err}`)
    }
  }

  async $fetchPMCID(items) {
    items = (items || selectedItems())
      .filter(item => item.isRegularItem() && !item.isFeedItem)
      .map(item => {
        const req = {
          item,
          extra: item.getField('extra').split('\n'),
          doi: '',
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

        req.doi = (req.doi || '').replace(/^https?:\/\/doi.org\//i, '')

        return req
      })
      .filter(item => item.doi && !(item.pmid && item.pmcid))

    // resolve PMID/PMCID based on DOI
    for (const item of items.filter(i => !i.pmid)) {
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${Object.entries({
        db: 'pubmed',
        term: item.doi,
        retmode: 'json',
        field: 'doi',
      }).map(([key, value]: [string, string]) => `${key}=${encodeURIComponent(value)}`).join('&')}`
      debug(url)

      try {
        await this.throttle.slot()
        const response = await fetch(url)
        if (!response.ok) throw { doi: item.doi, error: `NCBI returned ${response.status} (${response.statusText})`, data: {} }

        const data = await response.json()
        if (!data.esearchresult) throw { doi: item.doi, error: 'no search result', data }
        if (data.esearchresult.errorlist?.phrasesnotfound?.length) throw { doi: item.doi, error: `NCBI does not have information on ${item.doi}`, data }
        let error: string
        if (error = errorlist(data.esearchresult.errorlist as Record<string, string>)) throw { doi: item.doi, error, data }
        if (!data.esearchresult.count) throw { doi: item.doi, error: 'zero results', data }
        if (data.esearchresult.count !== '1') throw { doi: item.doi, error: `expected 1 result, got ${data.esearchresult.count}`, data }
        if (!data.esearchresult.idlist) throw { doi: item.doi, error: 'no IDs returned', data }

        item.pmid = data.esearchresult.idlist[0]
        item.extra.push(`PMID: ${item.pmid}`)
        item.save = true
      }
      catch (err) {
        flash('Could not resolve DOI', `Failed to resolve PMID for ${err.doi}: ${err.error}`)
        debug(`Could not fetch resolve for ${url}: ${err.error}: ${JSON.stringify(err.data)}`)
      }
    }

    const still_incomplete = items.filter(item => !item.pmid || !item.pmcid)
    const max = 200
    for (const chunk of Array(Math.ceil(still_incomplete.length/max)).fill(undefined).map((_, i) => still_incomplete.slice(i*max, (i+1)*max))) {
      const dois = chunk.map((item: { doi: string }) => item.doi).join(',')
      const url = `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?${Object.entries({
        tool: 'zotero-pmcid-fetcher',
        email: 'email=emiliano.heyns@iris-advies.com',
        ids: dois,
        format: 'json',
        idtype: 'doi',
        versions: 'no',
      }).map(([key, value]: [string, string]) => `${key}=${encodeURIComponent(value)}`).join('&')}`
      debug(url)

      try {
        await this.throttle.slot()
        const response = await fetch(url)
        if (!response.ok) throw { dois, error: `NCBI returned ${response.status} (${response.statusText})`, data: {} }

        const data = await response.json()
        if (data.status !== 'ok') throw { dois, error: `NCBI returned status ${data.status}`, data }
        if (!data.records) throw { dois, error: 'NCBI returned no records', data }

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
      }
      catch (err) {
        flash('Could not convert DOI to PMID/PMCID', `Failed to convert ${err.dois}: ${err.error}`)
        debug(`Could not convert DOI to PMID/PMCID for ${url}: ${err.error}: ${JSON.stringify(err.data)}`)
      }
    }

    // fetch tags
    const parser = is7 ? new DOMParser : Components.classes['@mozilla.org/xmlextras/domparser;1'].createInstance(Components.interfaces.nsIDOMParser)
    for (const item of items) {
      if (!item.pmid && !item.pmcid) continue

      let tags = Zotero.Prefs.get('pmcid.tags')
      if (typeof tags !== 'boolean') {
        const remember = { value: true }
        tags = PromptService.confirmCheck(null, 'Retrieve PMCID tags', 'Retrieve PMCID tags as keywords?', "Don't ask again", remember)
        if (remember.value) Zotero.Prefs.set('pmcid.tags', tags)
      }
      if (tags) {
        try {
          await this.throttle.slot()
          const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=PubMed&tool=Zotero&retmode=xml&rettype=citation&id=${item.pmid || item.pmcid}`
          const text: string = await (await fetch(url)).text()
          const doc: Document = parser.parseFromString(text, 'text/xml')
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
      }

      if (item.save) {
        item.item.setField('extra', item.extra.join('\n'))
        await item.item.saveTx()
      }
    }
  }
}
