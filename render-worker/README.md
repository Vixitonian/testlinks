# Render worker for your Mac

Claude's cloud session has no graphics card, so turning a whiteboard animation into an MP4 there takes about 13 minutes per minute of video. This worker lets your Mac do the rendering instead.

## How it works

The GitHub repo is the hand-off point. Nothing connects to your Mac directly.

1. Claude posts a job: it pushes `render-jobs/<name>/` (the page, the narration and a `job.json`) to its branch.
2. The worker on your Mac checks the repo every 30 seconds. When it sees a new job, it pushes `claimed.txt` so Claude knows a Mac is online.
3. Your Mac renders the MP4 with `export.js` and pushes `out.mp4` back to the same branch (or `error.txt` with the log if something fails).
4. Claude pulls `out.mp4` and sends it to you.

If no worker claims a job within 3 minutes, Claude falls back to rendering in the cloud, which is slower.

## One-time setup (no Homebrew needed)

You need three things on the Mac: git, Node.js, and a GitHub login that can push to `vixitonian/testlinks`. ffmpeg comes bundled with the worker (the `ffmpeg-static` package), so you don't install it yourself.

**1. git.** Open Terminal and run:
```bash
xcode-select --install
```
Click Install in the window that appears (it takes a few minutes). If it says the tools are already installed, you're done.

**2. Node.js.** Download the macOS installer (the LTS version) from https://nodejs.org, open the `.pkg` and click through it. Check it worked:
```bash
node -v && npm -v
```

**3. A GitHub token** so the worker can push the video back. On github.com go to Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. Choose the `vixitonian/testlinks` repository and give it **Contents: Read and write**. Copy the token.

**4. Clone the repo, then install and start the worker:**
```bash
git clone -b ccr-cbf0e978-2gg7er https://github.com/vixitonian/testlinks.git ~/apprelab-render
```
When git asks, use your GitHub username and paste the **token as the password**. macOS saves it in your Keychain, so the worker can push later without asking again.
```bash
cd ~/apprelab-render
git config user.name "Render worker"
git config user.email "you@example.com"   # any address you like for these commits
./render-worker/install.sh
```
`install.sh` installs the headless browser and ffmpeg into `render-worker/node_modules`, then starts the worker in the background and again at every login.

Once this branch is merged, clone `main` instead of `ccr-cbf0e978-2gg7er`.

If you'd rather use Homebrew or the GitHub CLI later, they work too: `brew install git node` and `gh auth login` replace steps 1 to 3.

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
| `export.js` | the worker | Renders frames in headless Chromium and joins them into an MP4 with the bundled ffmpeg (or `$FFMPEG` / ffmpeg on PATH) |
| `submit.sh` | Claude | `submit.sh NAME page.html narration.mp3 [fps] [width]` posts a job and pushes it |
| `wait.sh` | Claude | `wait.sh NAME` waits for the claim and the MP4 (exit 0 done, 2 no worker, 3 error, 4 timeout) |

## Security notes

- The worker renders pages from this repo's branches only. Anyone who can push to the repo can make your Mac open a page in a headless browser, so keep push access limited to people you trust.
- No tokens are stored in job files. The worker pushes with the token saved in your Keychain in step 4. Revoke it on GitHub at any time to cut the worker off.
