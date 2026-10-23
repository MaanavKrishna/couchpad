# Contributing to couchpad

Thanks for helping. Issues and pull requests are welcome.

## Setup

```bash
git clone https://github.com/MaanavKrishna/couchpad.git
cd couchpad
npm ci
npm test            # vitest, runs in Node with jsdom; no browser or network needed
npx tsc --noEmit    # typecheck
npm run example     # reference server + host and phone pages on http://localhost:8787
```

Requires Node 22 or newer.

## Guidelines

- Keep the runtime dependency footprint at `zod` only.
- Keep environment access (WebSocket, RTCPeerConnection, clock, storage) injectable so new behaviour can be unit-tested without a browser.
- Add or update tests in `test/` for any change to the transport, reconnect, chunking or widget behaviour.
- Wire-format changes must stay backward compatible, or be called out clearly in the PR, because servers and phones may run different versions.
- CI runs the typecheck and the tests on every push and pull request. Please make sure both pass.

## Reporting bugs

Open an issue with the browser and OS of the phone and the host, whether the link was `direct` or `relay`, and steps to reproduce.

For security issues, see [SECURITY.md](SECURITY.md) instead of opening a public issue.
