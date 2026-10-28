# Reference

`progressier.json` is the original one-line JSON manifest served by Progressier
for `staff.you.ge`. `progressier.decompiled.json` is its pretty-printed JSON
copy for easier reading. The original is preserved unchanged. Neither file is
part of the deployment.

The deployed manifest is `/manifest.webmanifest`. It preserves the original
identity (`id`, `start_url`, scope, name, colors) and adds local icons, a share
target, both protocol handlers, categories and `launch_handler`.

Do not deploy this folder.
