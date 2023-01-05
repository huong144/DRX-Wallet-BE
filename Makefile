all:
	make reinstall
	# TODO
	cd libs/sota-common && rm -rf node_modules && npm i
	make rebuild

rebuild:
	rm -rf dist/bin dist/libs && tsc
	make deps

rebuild-one:
	rm -rf dist/bin/$(t) dist/libs/sota-$(t) && tsc
	make dep t=libs/sota-$(t)
	make dep t=bin/$(t)

build:
	tsc
	make deps

dep:
	cp -f $(t)/package.json dist/$(t)/
	cd dist/$(t) && npm i

deps:
	make dep t=libs/sota-common
	make dep t=libs/sota-bsc
	make dep t=libs/sota-btc
	make dep t=libs/sota-eth
	make dep t=libs/sota-ltc
	make dep t=libs/sota-xrp
	make dep t=libs/sota-trx
	make dep t=libs/sota-polygon
	make dep t=libs/sota-sol
	make dep t=libs/wallet-core
	make dep t=bin/bsc
	make dep t=bin/btc
	make dep t=bin/common
	make dep t=bin/eth
	make dep t=bin/ltc
	make dep t=bin/eth
	make dep t=bin/trx
	make dep t=bin/xrp
	make dep t=bin/polygon
	make dep t=bin/sol
	make dep t=bin/typeorm_migration

ts-dep-reinstall:
	cd $(t) && rm -rf node_modules package-lock.json && npm i

ts-dep-install:
	cd $(t) && rm -rf package-lock.json && npm i

ts-deps:
	make ts-dep-install t=./
	make ts-dep-install t=libs/sota-common
	make ts-dep-install t=libs/sota-btc
	make ts-dep-install t=libs/sota-bsc
	make ts-dep-install t=libs/sota-ltc
	make ts-dep-install t=libs/sota-eth
	make ts-dep-install t=libs/sota-xrp
	make ts-dep-install t=libs/sota-polygon
	make ts-dep-install t=libs/sota-trx
	make ts-dep-install t=libs/sota-sol
	make ts-dep-install t=libs/wallet-core
	make ts-dep-install t=bin/btc
	make ts-dep-install t=bin/bsc
	make ts-dep-install t=bin/ltc
	make ts-dep-install t=bin/eth
	make ts-dep-install t=bin/xrp
	make ts-dep-install t=bin/common
	make ts-dep-install t=bin/polygon
	make ts-dep-install t=bin/trx
	make ts-dep-install t=bin/sol
	make ts-dep-install t=bin/typeorm_migration

ts-dep-reinstall-fix:
	cd $(t) && rm -rf node_modules && npm i

ts-deps-reinstall:
	make ts-dep-reinstall t=./
	make ts-dep-reinstall-fix t=libs/sota-common
	make ts-dep-reinstall t=libs/sota-bsc
	make ts-dep-reinstall t=libs/sota-btc
	make ts-dep-reinstall t=libs/sota-eth
	make ts-dep-reinstall t=libs/sota-ltc
	make ts-dep-reinstall-fix t=libs/sota-xrp
	make ts-dep-reinstall t=libs/sota-polygon
	make ts-dep-reinstall t=libs/sota-trx
	make ts-dep-reinstall t=libs/sota-sol
	make ts-dep-reinstall t=libs/wallet-core
	make ts-dep-reinstall t=bin/typeorm_migration
	make ts-dep-reinstall t=bin/bsc
	make ts-dep-reinstall t=bin/btc
	make ts-dep-reinstall t=bin/common
	make ts-dep-reinstall t=bin/eth
	make ts-dep-reinstall t=bin/ltc
	make ts-dep-reinstall t=bin/xrp
	make ts-dep-reinstall t=bin/polygon
	make ts-dep-reinstall t=bin/trx
	make ts-dep-reinstall t=bin/sol

deps-install:
	make dep-install t=./
	make dep-install t=libs/sota-common
	make dep-install t=libs/sota-bsc
	make dep-install t=libs/sota-btc
	make dep-install t=libs/sota-eth
	make dep-install t=libs/sota-ltc
	make dep-install t=libs/sota-xrp
	make dep-install t=libs/sota-polygon
	make dep-install t=libs/sota-trx
	make dep-install t=libs/sota-sol
	make dep-install t=libs/wallet-core
	make dep-install-fix t=bin/common
	make dep-install-fix t=bin/bsc
	make dep-install-fix t=bin/btc
	make dep-install-fix t=bin/eth
	make dep-install-fix t=bin/ltc
	make dep-install-fix t=bin/xrp
	make dep-install-fix t=bin/polygon
	make dep-install-fix t=bin/trx
	make dep-install-fix t=bin/sol
	make dep-install-fix t=bin/typeorm_migration

dep-install:
	cd dist/$(t) && npm i

dep-install-fix:
	cd dist/$(t) && rm -rf node_modules package-lock.json && npm i

install:
	make ts-deps

reinstall:
	make ts-deps-reinstall

deploy-install:
	make deps-install

dep-pre-deploy:
	cp -f $(t)/package.json dist/$(t)/

deps-pre-deploy:
	make dep-pre-deploy t=libs/sota-common
	make dep-pre-deploy t=libs/sota-bsc
	make dep-pre-deploy t=libs/sota-btc
	make dep-pre-deploy t=libs/sota-eth
	make dep-pre-deploy t=libs/sota-ltc
	make dep-pre-deploy t=libs/sota-xrp
	make dep-pre-deploy t=libs/sota-polygon
	make dep-pre-deploy t=libs/sota-trx
	make dep-pre-deploy t=libs/sota-sol
	make dep-pre-deploy t=libs/wallet-core
	make dep-pre-deploy t=bin/common
	make dep-pre-deploy t=bin/bsc
	make dep-pre-deploy t=bin/btc
	make dep-pre-deploy t=bin/eth
	make dep-pre-deploy t=bin/ltc
	make dep-pre-deploy t=bin/xrp
	make dep-pre-deploy t=bin/polygon
	make dep-pre-deploy t=bin/trx
	make dep-pre-deploy t=bin/sol
	make dep-pre-deploy t=bin/typeorm_migration

migrations:
	cd bin/typeorm_migration && npm run migrations

pre-deploy:
	rm -rf dist/bin dist/libs && tsc
	make deps-pre-deploy

deploy-dev:
	rsync -avhzL --delete \
		--exclude node_modules \
		--exclude .env \
		dist Makefile ubuntu@18.140.253.130:/home/ubuntu/dr-wallet
	ssh ubuntu@18.140.253.130 "cd dr-wallet && make deploy-install"
