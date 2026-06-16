DEST ?= /mnt/irmagi/tiny-pdf-viewer

.PHONY: deploy test

# Copy the runtime files (index.html / js / vendor) to DEST. Dev-only files
# (tests, package.json, docs, Makefile) are not deployed. js/ and vendor/ are
# mirrored with --delete so stale files (e.g. an old pdfjs version) are removed.
deploy:
	mkdir -p "$(DEST)/js" "$(DEST)/vendor"
	cp index.html "$(DEST)/"
	rsync -a --delete --exclude='*.test.js' js/ "$(DEST)/js/"
	rsync -a --delete vendor/ "$(DEST)/vendor/"
	@echo "deployed to $(DEST)"

test:
	node --test