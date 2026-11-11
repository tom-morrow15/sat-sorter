# Sat Sorter Umbrel package (draft)

This is a draft of the official Umbrel App Store package. It is not submitted.
Do not open a pull request against [getumbrel/umbrel-apps](https://github.com/getumbrel/umbrel-apps) from this repository.

Budget data lives in the browser and syncs encrypted over Nostr, so the
containers do not mount a data directory. `storage.dataRoot` is declared so
umbrelOS can relocate the app folder later.

`requiresHttps` is set because budget encryption uses Web Crypto. The image
also falls back when `crypto.randomUUID` or `navigator.clipboard` is missing,
which keeps a plain-HTTP origin from crashing.

The Maple option calls same-origin `/maple/v1`. nginx proxies that to the
`maple-proxy` service (`ghcr.io/mapleprivacylabs/maple-proxy:0.5.0`, listen
port 8080, `MAPLE_HOST` / `MAPLE_PORT`). Open WebUI and other OpenAI-compatible
servers are still configured in the app and are called directly by the
browser, so their CORS settings must allow the Umbrel origin.

## Lint

Copy `umbrel/sat-sorter/` into a checkout of getumbrel/umbrel-apps as
`sat-sorter/`, then from that repo:

```sh
npm run lint:apps -- sat-sorter --check-images
git diff --check
```

The Sat Sorter image line is `sha256:DIGEST_PLACEHOLDER` until the GHCR package
exists and is Public. `--check-images` fails on that placeholder, and it also
checks that port 8580 is free. The Maple proxy digest is the multi-arch index
for tag `0.5.0`.

## Submission

1. Confirm the Netlify deploy of satsorter.com after this change is on `main`.
2. Tag `v1.0.0`. The Docker workflow publishes `ghcr.io/tom-morrow15/sat-sorter:1.0.0` and `:latest` for `linux/amd64` and `linux/arm64`. Do not create the tag from this draft branch.
3. Set the GHCR package to Public.
4. Replace `sha256:DIGEST_PLACEHOLDER` in `docker-compose.yml` with the multi-arch index digest from `docker buildx imagetools inspect ghcr.io/tom-morrow15/sat-sorter:1.0.0`.
5. Run `npm run lint:apps -- sat-sorter --check-images` inside getumbrel/umbrel-apps.
6. Replace `submission` with the pull request URL you are about to open.
7. Open the pull request with the umbrel-apps template. Leave gallery empty and omit an icon. Umbrel creates those assets.
8. After the satsorter.com deploy, retire `worker.ts`, `wrangler.toml`, and the Cloudflare D1 subscription database. The app no longer calls them.
9. If you use Open WebUI with the Umbrel app, allow the Umbrel origin (HTTPS, port 8580) in Open WebUI's CORS settings.
