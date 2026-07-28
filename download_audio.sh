#!/usr/bin/env bash
#
# Download Pastor Jude's 6 links as MP3 audio and zip them.
# Run this on your own computer or phone (Termux) — a normal home/mobile
# network. It does NOT work from the cloud sandbox because YouTube blocks
# that environment's IP, but it works fine from a regular connection.
#
# One-time setup:
#   pip install -U yt-dlp
#   and install ffmpeg:
#     macOS:         brew install ffmpeg
#     Ubuntu/Debian: sudo apt install ffmpeg
#     Windows:       winget install Gyan.FFmpeg   (or: choco install ffmpeg)
#     Termux:        pkg install python ffmpeg && pip install -U yt-dlp
#
# Then:
#   bash download_audio.sh
#
set -euo pipefail

OUTDIR="audio_downloads"
mkdir -p "$OUTDIR"

LINKS=(
  "https://youtu.be/8KOrgC6CiDA"
  "https://youtu.be/BALeDjLkYCs"
  "https://youtu.be/NZ0JNFBk-8w"
  "https://www.facebook.com/share/v/1DJW1RoRiH/"
  "https://youtu.be/to2sNtLBD84"
  "https://youtu.be/zhlLfTN0DOg"
)

for url in "${LINKS[@]}"; do
  echo ">>> Downloading audio: $url"
  yt-dlp \
    -f 'bestaudio/best' \
    -x --audio-format mp3 --audio-quality 0 \
    --no-playlist \
    --embed-metadata \
    -o "$OUTDIR/%(title).80B [%(id)s].%(ext)s" \
    "$url" || echo "!!! Failed: $url (skipping)"
done

echo ">>> Zipping..."
zip -j audio_downloads.zip "$OUTDIR"/*.mp3
echo ">>> Done: audio_downloads.zip"
