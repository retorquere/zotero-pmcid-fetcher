VERSION := $(shell node -e 'console.log(require("./package.json").version)')

pmcid-fetcher:
	rm -f *.xpi
	node rdf.js
	zip zotero-pmcid-fetcher-$(VERSION).xpi bootstrap.js chrome.manifest install.rdf
