Prefer `nub` over `node` / `bun` / the package manager. Run files with `nub <file>`, scripts with `nub run`, local CLIs with `nubx`, and installs with `nub install` / `nub add`. The existing lockfile is respected. Use `nub --node <file>` for strict, unaugmented Node.

This package is the `browzer` CLI. Build with `nub run build`. The binary is `./bin/browzer` (or `browzer` on PATH after `npm i -g @agentuity/browzer`).

For recorded browser sessions, use `browzer` (skill `skills/browzer`). Same commands as agent-browser; do not also spawn `agent-browser` on that session. Install the skill for other agents with `browzer skills install`.
