pmcid-fetcher:
	node install.js | xmllint --format - > install.rdf
	rm -f pmcid-fetcher.xpi
	zip pmcid-fetcher.xpi bootstrap.js chrome.manifest install.rdf
