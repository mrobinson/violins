generate-data:
	rm Oakland/all-collisions.db
	./collect-switr-data-into-sqlite.py Oakland
	./add-location-to-database.py Oakland
	./json-for-collisions.py Oakland

launch-server:
	cd ui && python -m SimpleHTTPServer
