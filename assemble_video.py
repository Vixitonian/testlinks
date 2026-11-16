import os, sys, json, subprocess, shutil
import static_ffmpeg

static_ffmpeg.add_paths()
ffmpeg_bin = shutil.which("ffmpeg")
print("Using ffmpeg:", ffmpeg_bin)

WORK_DIR = "/home/deploy/projects/testlinks-9/demo_video"
SLIDES_DIR = os.path.join(WORK_DIR, "slides")
AUDIO_DIR = os.path.join(WORK_DIR, "audio")

scenes = ["scene1", "scene2", "scene3", "scene4", "scene5"]
clip_files = []

for sid in scenes:
    img = os.path.join(SLIDES_DIR, f"{sid}.png")
    audio = os.path.join(AUDIO_DIR, f"{sid}.mp3")
    clip_out = os.path.join(WORK_DIR, f"{sid}_clip.mp4")
    
    cmd_dur = ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "json", audio]
    dur = float(json.loads(subprocess.check_output(cmd_dur))["format"]["duration"]) + 0.6
    
    print(f"Encoding {sid} ({dur:.2f}s)...")
    cmd = [
        ffmpeg_bin, "-y",
        "-loop", "1", "-framerate", "24", "-i", img,
        "-i", audio,
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-t", str(dur),
        "-shortest",
        clip_out
    ]
    subprocess.check_call(cmd)
    clip_files.append(clip_out)
    print(f"Clip ready: {clip_out} ({os.path.getsize(clip_out)} bytes)")

concat_list = os.path.join(WORK_DIR, "concat.txt")
with open(concat_list, "w") as f:
    for c in clip_files:
        f.write(f"file '{c}'\n")

raw_video = os.path.join(WORK_DIR, "nog_raw_concat.mp4")
cmd_cat = [
    ffmpeg_bin, "-y",
    "-f", "concat", "-safe", "0", "-i", concat_list,
    "-c", "copy",
    raw_video
]
subprocess.check_call(cmd_cat)
print("Concatenated raw video:", raw_video, os.path.getsize(raw_video), "bytes")

# Mix ambient audio
bg_music_wav = os.path.join(WORK_DIR, "ambient_pad.wav")
FINAL_OUTPUT = "/home/deploy/projects/testlinks-9/nog_coupons_demo_1080p.mp4"
cmd_mix = [
    ffmpeg_bin, "-y",
    "-i", raw_video,
    "-i", bg_music_wav,
    "-filter_complex", "[0:a]volume=1.0[v_aud];[1:a]volume=0.20[bg_aud];[v_aud][bg_aud]amix=inputs=2:duration=first[aout]",
    "-map", "0:v",
    "-map", "[aout]",
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "256k",
    "-movflags", "+faststart",
    FINAL_OUTPUT
]
subprocess.check_call(cmd_mix)
final_size = os.path.getsize(FINAL_OUTPUT)
print(f"=== FINAL VIDEO GENERATED: {FINAL_OUTPUT} ({final_size / (1024*1024):.2f} MB) ===")

# Verify streams and duration
cmd_probe = ["ffprobe", "-v", "quiet", "-show_entries", "format=duration:stream=width,height,codec_name", "-of", "json", FINAL_OUTPUT]
probe_res = json.loads(subprocess.check_output(cmd_probe))
print("Final Video Info:", json.dumps(probe_res, indent=2))
