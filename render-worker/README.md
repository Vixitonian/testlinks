# Render worker for your Mac

Claude's cloud session has no graphics card, so turning a whiteboard animation into an MP4 there takes about 13 minutes per minute of video. This worker lets your Mac do the rendering instead.

## How it works

The GitHub repo is the hand-off point. Nothing connects to your Mac directly.

1. Claude posts a job: it pushes `render-jobs/<name>/` (the page, the narration and a `job.json`) to its branch.
2. The worker on your Mac checks the repo every 30 seconds. When it sees a new job, it pushes `claimed.txt` so Claude knows a Mac is online.
3. Your Mac renders the MP4 with `export.js` and pushes `out.mp4` back to the same branch (or `error.txt` with the log if something fails).
4. Claude pulls `out.mp4` and sends it to you.

If no worker claims a job within 3 minutes, Claude falls back to rendering in the cloud, which is slower.

## One-time setup

You need a GitHub login on the Mac that can push to `vixitonian/testlinks`.

```bash
# 1. Tools (skip any you already have)
brew install git node ffmpeg gh
gh auth login            # choose GitHub.com, HTTPS, and log in with the browser

# 2. A clone just for the worker
git clone -b ccr-cbf0e978-2gg7er https://github.com/vixitonian/testlinks.git ~/apprelab-render
cd ~/apprelab-render
git config user.name "Render worker"
git config user.email "you@example.com"   # any address you like for these commits

# 3. Install and start (also starts it again at every login)
./render-worker/install.sh
```

Once this branch is merged, clone `main` instead of `ccr-cbf0e978-2gg7er`.

## Day to day

| Task | Command |
|---|---|
| Watch what it's doing | `tail -f ~/Library/Logs/apprelab-render-worker.log` |
| Stop it | `launchctl bootout gui/$(id -u)/com.apprelab.render-worker` |
| Start it again | `./render-worker/install.sh` |
| Watch only some branches | Put `<key>EnvironmentVariables</key><dict><key>BRANCH_GLOB</key><string>ccr-*</string></dict>` in the plist and rerun `install.sh` |

A macOS notification appears when a render starts and when it finishes. The worker keeps the Mac awake only while it is rendering, so leave the Mac on (lid open, or plugged in with an external display) when you expect a job.

## Files

| File | Who runs it | What it does |
|---|---|---|
| `render-worker.sh` | your Mac (launchd) | Watches every branch for jobs, renders them, pushes results |
| `install.sh` | you, once | Checks the tools, installs Playwright and Chromium, registers the launchd agent |
| `export.js` | the worker | Renders frames in headless Chromium and joins them into an MP4 with ffmpeg |
| `submit.sh` | Claude | `submit.sh NAME page.html narration.mp3 [fps] [width]` posts a job and pushes it |
| `wait.sh` | Claude | `wait.sh NAME` waits for the claim and the MP4 (exit 0 done, 2 no worker, 3 error, 4 timeout) |

## Security notes

- The worker renders pages from this repo's branches only. Anyone who can push to the repo can make your Mac open a page in a headless browser, so keep push access limited to people you trust.
- No tokens are stored in job files. The worker pushes with the GitHub login you set up in step 1.
