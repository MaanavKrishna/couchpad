# Security policy

## Supported versions

Only the latest release on `main` gets security fixes.

## Reporting a vulnerability

Please do not open a public issue. Report it privately through GitHub's [private vulnerability reporting](https://github.com/MaanavKrishna/couchpad/security/advisories/new) for this repository. Include a description, the affected version or commit, and steps to reproduce.

You can expect an acknowledgement within a few days.

## Scope notes

couchpad does not ship a server. A signaling server you build on its protocol must set `from` on forwarded `signal` and `relay` messages itself and never trust the sender's claim. It should also rate-limit joins and treat rejoin and TV tokens as secrets. couchpad validates every peer message and widget list with zod schemas, but your game should still treat player input (text, drawings) as untrusted.
