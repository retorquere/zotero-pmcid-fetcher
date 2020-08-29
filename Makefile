schema-log:
	rm -f pmcid-fetcher.xpi
	zip pmcid-fetcher.xpi bootstrap.js chrome.manifest install.rdf
