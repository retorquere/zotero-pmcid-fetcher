XPI := $(shell node -e 'console.log(require("./version").xpi)')

pmcid-fetcher:
	npx tsc
	#npm run lint
	rm -f *.xpi
	node rdf.js
	zip $(XPI) bootstrap.js chrome.manifest install.rdf
