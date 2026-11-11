# Proposed getumbrel/umbrel-apps pull request

Do not open this until the owner has reviewed it. Nothing in this repository opens that pull request.

When opening it, set `submission` in `umbrel-app.yml` to the new pull request URL. The App Store linter requires that field to be a URL, so the package currently uses `https://github.com/getumbrel/umbrel-apps/pull/TODO` as a placeholder.

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

Add Sat Sorter, a free zero-based Bitcoin budget app. Budget data stays in the browser and syncs encrypted over Nostr. There is no subscription and no Sat Sorter account.

The web container is `ghcr.io/tom-morrow15/sat-sorter:1.0.0`, pinned by its multi-arch index digest. It listens on port 8080. Umbrel opens the app on port 8580 over HTTPS (`requiresHttps: true`, `manifestVersion: 2.0`) because budget encryption uses Web Crypto.

A `maple-proxy` sidecar (`ghcr.io/mapleprivacylabs/maple-proxy:0.5.0`, listening on port 8080) is included so the built-in Maple option can call same-origin `/maple/v1`. Open WebUI and other OpenAI-compatible servers remain optional and are configured inside the app. They are called directly by the browser, so their CORS settings must allow the Umbrel origin.

There is no app login for Umbrel to display. No host ports, named volumes, or bind mounts are published. User budgets are not stored in the container.

Gallery images and an icon are omitted. The Umbrel team creates and hosts those assets.

## Verification

Umbrel testing performed:

`npm run lint:apps -- sat-sorter --check-images` in a checkout of getumbrel/umbrel-apps reported no issues. Port 8580 and the app id `sat-sorter` were not used by another package in that checkout.

A local `docker-compose` run on linux/amd64, with Umbrel's imageless `app_proxy` service left out and the web port published only for the test, served the app at `/` and fell back to the same page for `/budget`. `GET /maple/v1/models` reached the `maple-proxy` container, which answered 401 because no Maple API key was configured.

Environment tested:
- [ ] Umbrel device
- [ ] Local umbrelOS test environment
- [ ] Not runtime tested

The containers were runtime tested with Docker Compose, not inside umbrelOS.

Architecture tested:
- [x] amd64
- [ ] arm64

The published image index contains linux/amd64 and linux/arm64. Only amd64 was started.

Known lint warnings or caveats:

None from `npm run lint:apps -- sat-sorter --check-images`.

## Notes

No permissions, dependencies, migrations, or default credentials. `defaultUsername` and `defaultPassword` are empty.

`requiresHttps` is set because the budget encryption uses the Web Crypto API. The image also falls back when `crypto.randomUUID` or `navigator.clipboard` is missing.

`app_proxy` sets `APP_HOST` to `sat-sorter_web_1` and `APP_PORT` to `8080`.

Logo source, for the Umbrel team to redraw: https://github.com/tom-morrow15/sat-sorter/blob/main/public/icons/icon.svg and https://github.com/tom-morrow15/sat-sorter/blob/main/public/icons/icon-512.png

Screenshots are not attached yet. The owner needs to add them to this pull request. Do not commit gallery images or an icon. The Umbrel team adds those.

## Still needed from the owner

- Review this package and open the getumbrel/umbrel-apps pull request. Do not open it from an automated branch.
- Replace `submission` in `umbrel-app.yml` with that pull request's URL before or as part of the submission.
- Attach app screenshots to the Umbrel pull request body. Gallery images and the App Store icon are added by the Umbrel team, not committed here.
- Confirm the logo links above, or supply a different logo reference.
- If Open WebUI will be used from the Umbrel app, allow the Umbrel HTTPS origin on port 8580 in Open WebUI's CORS settings.
