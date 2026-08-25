# Freebuff installation

The installers build the `main` branch of the personal Freebuff fork by
default:

```text
https://github.com/viniciusdebruin/freebuff.git
```

They also set the production public URLs before compiling. This matters because
the standalone binary embeds `NEXT_PUBLIC_*` values during the build; running a
binary compiled without them can produce an API or login error on another PC.

## Windows

Run `install-windows.bat` from a normal Command Prompt. Git and Bun are
required. It installs the executable under `%LOCALAPPDATA%\Freebuff\bin`.

## Linux and macOS

Run:

```bash
chmod +x install/install-unix.sh
./install/install-unix.sh
```

Git and Bun are required. The installer offers to install Bun for the current
user if it is missing.

## Installing a different fork or branch

Set these variables before running the installer:

```text
FREEBUFF_REPO_URL=https://github.com/example/freebuff.git
FREEBUFF_BRANCH=main
```

If an existing source directory points to another repository, the installer
stops instead of mixing upstream and fork files. Set `FREEBUFF_SOURCE_DIR` to a
new directory in that case.

The installers never copy credentials or existing login profiles.
