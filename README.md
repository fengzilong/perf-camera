# perf-camera
record perf video with lighthouse and ffmpeg

# Installation

```bash
yarn global add perf-camera
```

# Usage

```bash
Commands:
  [...urls]  Record videos for these urls

For more info, run any command with the `--help` flag:
  $ index.js --help

Options:
  --repeat <count>  repeat count
  --headless       headless
  -h, --help       Display this message
  -v, --version    Display version number
```

e.g.

```bash
perfcam url1 url2 --repeat=3 --headless
```

# License

MIT
