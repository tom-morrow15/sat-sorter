# getumbrel/umbrel-apps pull request

When the pull request exists, set `submission` in `umbrel-app.yml` to its URL.

## Title

Add Sat Sorter

## Body

## Type

New app

## App

App ID: sat-sorter
Upstream project: https://github.com/tom-morrow15/sat-sorter
Version: 1.0.0

## Summary

Add Sat Sorter, a zero-based budgeting app for Bitcoiners. The store listing says:

Sat Sorter is a zero-based budgeting app built for Bitcoiners. Plan your month by assigning every dollar or sat to a category, track what you spend as you go, and always know exactly what's left.

Private by design. No accounts, no ads, no tracking, and no company holding your financial data. Your budget is encrypted on your device and syncs between your devices over Nostr, so only you can read it.

Budget together. Share a budget with your partner or household and see each other's changes as they happen.

Free and open source. Unlimited categories, line items and months, with no subscription. Ever.

The web container is `ghcr.io/tom-morrow15/sat-sorter:1.0.0`, pinned by its multi-arch index digest. It listens on port 8080. Umbrel opens the app on port 8580.

The compose file includes a `maple-proxy` sidecar (`ghcr.io/mapleprivacylabs/maple-proxy:0.5.0`, listening on port 8080). The web image proxies same-origin `/maple/` to that container so an optional Maple connection can be used without a separate public proxy. No Maple key is baked into the image. Reviewers will see this service in `docker-compose.yml`; it is not part of the store listing.

There is no app login for Umbrel to display. No host ports, named volumes, or bind mounts are published. User budgets are not stored in the container.

Gallery images and an icon are omitted. The Umbrel team creates and hosts those assets. Screenshots will be added in a comment shortly.

## Verification

Umbrel testing performed:

`npm run lint:apps -- sat-sorter --check-images` in a checkout of getumbrel/umbrel-apps reported no issues. Port 8580 and the app id `sat-sorter` were not used by another package in that checkout.

A local `docker-compose` run on linux/amd64, with Umbrel's imageless `app_proxy` service left out and the web port published only for the test, served the app at `/` and fell back to the same page for `/budget`. `GET /maple/v1/models` reached the `maple-proxy` container, which answered 401 because no Maple API key was configured. This was not run inside umbrelOS.

Environment tested:
- [ ] Umbrel device
- [ ] Local umbrelOS test environment
- [x] Not runtime tested

Architecture tested:
- [x] amd64
- [ ] arm64

The published image index contains linux/amd64 and linux/arm64. Only amd64 was started.

Known lint warnings or caveats:

None from `npm run lint:apps -- sat-sorter --check-images`.

## Notes

No permissions, dependencies, migrations, or default credentials. `defaultUsername` and `defaultPassword` are empty.

`requiresHttps` is set, with `manifestVersion: 2.0`, because budget encryption uses the Web Crypto API. The image also falls back when `crypto.randomUUID` or `navigator.clipboard` is missing.

`app_proxy` sets `APP_HOST` to `sat-sorter_web_1` and `APP_PORT` to `8080`.

Logo source, for the Umbrel team to redraw: https://github.com/tom-morrow15/sat-sorter/blob/main/public/icons/icon.svg and https://github.com/tom-morrow15/sat-sorter/blob/main/public/icons/icon-512.png

Screenshots will be added in a comment shortly. Do not commit gallery images or an icon. The Umbrel team adds those.
