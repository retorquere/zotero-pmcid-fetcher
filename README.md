Auto Import
=================

Install by downloading the [latest version](https://github.com/retorquere/zotero-pmcid-fetcher/releases/latest)

Fetch PMCID/PMID for items with a DOI. Select items, right-click, Fetch PMCID

Or, if you always want them:

* Open the Zotero [hidden preferences](https://www.zotero.org/support/preferences/hidden_preferences)
* Create a new key of type `boolean`, name it `extensions.zotero.pmcid.auto`, and set it to `true`
* Add or modify items and PMCIDs/PMIDs magically appear

The first time you fetch PMCID/PMID, a popup will appear to ask if you also want the PMCID/PMID tags as Zotero keywords. If you check the "Don't ask again" checkbox, it will remember your choice and not ask again. If you leave it unchecked, it will ask any time you're getting PMCID/PMID information for items. If you checked the checkbox but change your mind, go into the hidden preferences again, search for the key `extensions.zotero.pmcid.tags`, and change it to your new preference.

# Support - read carefully

My time is extremely limited for a number of very great reasons (you shall have to trust me on this). Because of this, I
cannot accept bug reports or support requests on anything but the latest version. If you submit an issue report,
please include the version that you are on. By the time I get to your issue, the latest version might have bumped up
already, and you will have to upgrade (you might have auto-upgraded already however) and re-verify that your issue still exists.
Apologies for the inconvenience, but such are the breaks.

