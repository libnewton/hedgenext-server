# HedgeNext
- Fork of [HedgeDoc](https://github.com/hedgedoc/hedgedoc) focussed on Nextcloud integration.
- Various features and customizations.
- Use https://github.com/libnewton/hedgenext-plugin (https://apps.nextcloud.com/apps/hedgenext)
- More documentation coming.
### Quickstart
- copy the `docker-compose.yml` and the `.env.example` on your server.
- move `.env.example` to `.env`
- edit the values in `.env`
- `docker-compose up -d`


## Setting up PDF Export

Deploy `browserless/chrome:latest` [Guide](https://www.browserless.io/docs/docker-quickstart) on the container runtime of your choice. Fly.io or Northflank are some free-ish options.

Setting the following environment variables worked for me:
```
CHROME_REFRESH_TIME=3600000
CONNECTION_TIMEOUT=90000
FUNCTION_ENABLE_INCOGNITO_MODE=true
MAX_CONCURRENT_SESSIONS=3
PREBOOT_CHROME=true
TOKEN=<A secure token here!!!>
```
Make sure to adjust the token stated here inside your `.env` file.