---
name: testing-secretary-api
description: Test the secretary-api WhatsApp/Baileys service deployed on Fly.io end-to-end. Use when verifying API endpoints, WhatsApp auth persistence, or Fly deploy/restart behavior.
---

# Testing secretary-api (Fly.io + WhatsApp/Baileys)

Node/Express + socket.io service that connects to WhatsApp via `@whiskeysockets/baileys`. State (`instances`, `chats`) is **in-memory**; WhatsApp auth is persisted to disk under `DATA_DIR` (folders `auth_info_<id>`).

## Deployment facts
- App name: `secretary-api`, region `gru`, served at `https://secretary-api.fly.dev`.
- Listens on port 3000 (`internal_port = 3000`). Health check hits `GET /health`.
- Auth persists on a Fly **volume** mounted at `/data` (`DATA_DIR=/data`). Volumes are **per-machine** and state is in-memory, so run a **single machine** (`fly scale count 1`).
- No Dockerfile was originally committed; a `FROM node:20-slim` Dockerfile is required for `fly deploy` to build.

## Devin Secrets Needed
- `FLY_API_TOKEN` — a Fly deploy token (`fly tokens create deploy -a secretary-api`). Used for all `fly` CLI calls. Export it before running commands; do not print it.

## Endpoints to verify
- `GET /health` -> 200 `{"status":"ok"}`
- `GET /` -> 200 `{"status":"ok","service":"secretary-api"}`
- `GET /instances` -> JSON of instances; the `default` instance shows `connectionStatus` and a base64 `qrCodeData` data URL when `QR_READY`.
- `GET /chats` -> `{}` when no conversations.

## Core test: WhatsApp auth survives a restart
This is the highest-value check (the bug was auth living on ephemeral disk). Completing an actual WhatsApp login needs the owner's phone, so test **persistence of the volume**, not the scan:
1. `fly ssh console -a secretary-api -C "sh -c 'df -h /data; ls -la /data'"` — confirm `/data` is its own mount (e.g. `/dev/vdc`) and contains `auth_info_default`.
2. Write a sentinel: `... -C "sh -c 'echo <uuid> > /data/devin_persist_test.txt'"`.
3. `fly machine restart <machine_id> -a secretary-api` (wait for `started` + health passing).
4. Re-SSH and `cat /data/devin_persist_test.txt` — same UUID means the volume persisted. Remove the sentinel afterward.

## Visual proof (recording)
- Render the live QR by loading a tiny local HTML page that `fetch()`es `https://secretary-api.fly.dev/instances` and sets an `<img src=qrCodeData>` (CORS is open). The deployed app generates the QR; scanning is out of scope.

## Fly CLI tips / gotchas
- The token the user provides is often the **app deploy token**; `fly status`, `fly machine status`, `fly ssh console`, `fly tokens list` work, but `fly logs` (streaming) may return 401. Read logs from the Fly dashboard or `fly machine status` events instead.
- `fly machine status <id> -a <app>` shows recent events; `SOURCE=user` `launch` events mean an external/CI action (deploy or restart) recreated the machine — a repeated pattern here indicates an external automation loop, not a crash.
- `fly deploy` fails with "app does not have a Dockerfile or buildpacks configured" if no Dockerfile/`[build]` exists — add a Dockerfile.
- With a `[[mounts]]` in fly.toml, deploy needs an unattached volume in-region first: `fly volumes create secretary_data -r gru -s 1 -a secretary-api`.

## Browser automation gotcha
- Chrome omnibox autocompletes a shorter URL (e.g. `.../`) back to a previously visited longer one (e.g. `.../health`). After typing the URL, press `Delete` to clear the inline autocomplete before `Enter`, or navigation goes to the wrong path.
