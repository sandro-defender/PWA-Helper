# Reference

`progressier.json` is the original one-line JSON manifest served by Progressier
for `staff.you.ge`. `progressier.decompiled.json` is its pretty-printed JSON
copy; the original manifest is preserved unchanged.

`Script.js` is a user-supplied copy of the hosted Progressier client bundle.
`Script.decompiled.js` is a readable, Prettier-formatted copy for inspection; it
is not a clean-room reimplementation or part of the runtime. Both client files
are kept only for local parity research and must not be deployed.

The readable client copy can be regenerated with:

```sh
npm exec --yes --package=prettier@3.6.2 -- prettier reference/Script.js \
  --parser babel > reference/Script.decompiled.js
```

The deployed manifest is `/manifest.webmanifest`. It preserves the original
identity (`id`, `start_url`, scope, name, colors) and adds local icons, a share
target, both protocol handlers, categories and `launch_handler`.

Do not deploy this folder.
