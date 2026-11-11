# Sat Sorter Umbrel package

Draft for the official Umbrel App Store. It is not submitted. Do not open a pull request against [getumbrel/umbrel-apps](https://github.com/getumbrel/umbrel-apps) from this repository. The proposed title and body are in `SUBMISSION.md`.

A signed-in budget syncs encrypted over Nostr. A guest budget is also stored on the Umbrel at `${APP_DATA_DIR}/data/guest-budget.json`, so it is there for every browser that opens this app. `storage.dataRoot` lets umbrelOS move that folder.

`requiresHttps` is set because budget encryption uses Web Crypto. The image also falls back when `crypto.randomUUID` or `navigator.clipboard` is missing.

The Maple option calls same-origin `/maple/v1`. nginx proxies that to the `maple-proxy` service (`ghcr.io/mapleprivacylabs/maple-proxy:0.5.0`, listen port 8080). Open WebUI and other OpenAI-compatible servers are still configured in the app and are called directly by the browser.

The web image tag is `1.1.0`. The digest in `docker-compose.yml` is filled in after `v1.1.0` is published. `submission` points at the open App Store pull request.

## Lint

Copy this directory into a checkout of getumbrel/umbrel-apps as `sat-sorter/`, then from that repo:

```sh
npm run lint:apps -- sat-sorter --check-images
git diff --check
```

Port 8580 and the app id `sat-sorter` were free in the App Store checkout used to prepare this package. Gallery is empty and there is no icon. The Umbrel team adds those assets.
