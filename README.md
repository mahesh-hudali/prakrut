# Kannada Book Editor

A Kannada book-writing and first-draft editing tool. You type Kannada using
English phonetics (`naanu` → ನಾನು) and edit directly on realistic, paginated
book pages, then export the manuscript to PDF or DOCX.

Two processes make up the app, and one command starts both:

| Part | What it is | Port |
| --- | --- | --- |
| Frontend | React + Vite editor | 5173 |
| Backend | Flask API wrapping the AI4Bharat IndicXlit transliteration model | 8000 |

## Quick start

```bash
npm start
```

That is the whole thing. On a fresh machine the first run also creates the
Python virtualenv, installs both dependency sets and downloads the ~121 MB
transliteration model, so expect a few minutes. Later runs start in seconds.

When it is ready, open **http://localhost:5173**. Press `Ctrl+C` to stop both
servers.

## Prerequisites

Install these before the first run.

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20 or newer | Ships with npm. https://nodejs.org |
| Python | 3.8, 3.9 or **3.10** | **Not 3.11+** — `fairseq` does not build there |
| Disk space | ~1.5 GB | PyTorch and the model are the bulk of it |

macOS:

```bash
brew install node python@3.10
```

Ubuntu / Debian:

```bash
sudo apt install nodejs npm python3.10 python3.10-venv unzip
```

Windows: run it under WSL2 with the Ubuntu instructions above. The startup
script is bash, and `fairseq` is far easier to install on Linux.

You do not need to pick the Python version yourself — `npm start` searches for
a supported one and tells you what to install if it finds none.

## Running the two halves separately

Once everything is installed, you can run each side on its own — useful when you
want them in separate terminals, or when you are only working on one of them.

Terminal 1, the transliteration backend:

```bash
npm run backend      # http://127.0.0.1:8000
```

Terminal 2, the editor:

```bash
npm run frontend     # http://localhost:5173
```

Order does not matter. The frontend runs fine without the backend — you just get
no transliteration suggestions until it is up, and the status bar says so.

Both honour the usual environment variables, so you can move them if a port is
taken:

```bash
PORT=8001 npm run backend
npm run frontend -- --port 5174
```

If you change the backend port, point the frontend's proxy at it by editing
`apiProxy` in `vite.config.js`.

## All commands

| Command | What it does |
| --- | --- |
| `npm start` | Set up if needed, then run backend + frontend together |
| `npm run setup` | Install everything, but do not start the servers |
| `npm run backend` | Transliteration backend only |
| `npm run frontend` | Editor only (`npm run dev` is the same thing) |
| `npm run package` | Build a portable `.zip` of the project onto your Desktop |
| `npm run build` | Production build into `dist/` |
| `npm test` | Node tests: pagination, export, `.kbook` integrity |
| `npm run test:browser` | Real-Chrome tests: editing, transliteration, exports |
| `npm run test:all` | Both suites |
| `npm run lint` | Oxlint |

## Moving the project to another machine

```bash
npm run package
```

This writes `kannada-editor-<date>.zip` to your Desktop. It deliberately leaves
out `node_modules/` and `backend/.venv/`, because both contain compiled,
machine-specific binaries that will not work elsewhere — they get rebuilt on the
target machine. That keeps the archive to a few MB instead of about 1.5 GB.

On the new machine: unzip it, install the prerequisites above, and run
`npm start`.

If the target machine has no internet, use `./scripts/package.sh --with-model`
instead. That bundles the model checkpoint (~121 MB), so only the Node and
Python package installs still need a network connection.

**Your manuscripts are not part of this.** Save them as `.kbook` files through
`File → Save Project` and keep them wherever you keep your documents. The
editor also autosaves into the browser's IndexedDB for crash recovery, but that
lives in the browser profile and does not travel with the project folder.

## How the pieces fit together

The frontend calls `/transliterate` on its **own** origin, and Vite proxies that
to the backend on port 8000 (`vite.config.js`). Nothing talks cross-origin, so
CORS never comes into play. Vite's port is pinned with `strictPort`, so if 5173
is busy you get a clear error instead of a silent move to another port.

The backend must run with its working directory set to `backend/` — the model
paths inside it are relative, so starting it from the project root fails with a
confusing `FileNotFoundError`. Both `npm start` and `npm run backend` go through
`scripts/backend.sh`, which handles that. The raw equivalent is:

```bash
cd backend && .venv/bin/python api_server.py
```

When started by `npm start` the backend's output goes to `backend.log` in the
project root; `npm run backend` prints it to your terminal instead.

## Troubleshooting

**"Transliteration server unreachable" in the status bar.** The backend died or
never started. Check `backend.log`, then `curl http://127.0.0.1:8000/health`.

**`npm start` says no supported Python was found.** Install Python 3.10 and run
it again — `fairseq 0.12.2` relies on `distutils`, removed in Python 3.11.

**Port 5173 already in use.** Something else is on it, often a Vite server left
over from a previous session. Stop it (`lsof -ti tcp:5173 | xargs kill`) and
retry.

**Suggestions are slow on the first word.** The model loads on demand and stays
resident; only the first request pays the cost.

## Project layout

```
src/
  components/   editor UI (book pages, toolbar, panels, menus)
  hooks/        document state, pagination, transliteration, project I/O
  models/       document model: chapters, paragraphs, runs, comments
  project/      .kbook schema, validation, migrations, IndexedDB autosave
  services/     PDF and DOCX exporters
  utils/        pagination measurement, contentEditable DOM syncing
backend/        Flask API + IndicXlit model
scripts/
  run.sh        setup + start everything      (npm start)
  backend.sh    start the backend alone       (npm run backend)
  package.sh    build a portable archive      (npm run package)
```

## Credits

Transliteration by [AI4Bharat IndicXlit](https://github.com/AI4Bharat/IndicXlit),
used under its published licence.
