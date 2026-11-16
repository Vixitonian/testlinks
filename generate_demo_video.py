import os, sys, time, json, asyncio, subprocess, shutil, math
from playwright.sync_api import sync_playwright
import edge_tts
import static_ffmpeg

static_ffmpeg.add_paths()
ffmpeg_bin = shutil.which("ffmpeg")
print("Using ffmpeg:", ffmpeg_bin)

WORK_DIR = "/home/deploy/projects/testlinks-9/demo_video"
os.makedirs(WORK_DIR, exist_ok=True)
SCREENS_DIR = os.path.join(WORK_DIR, "screens")
SLIDES_DIR = os.path.join(WORK_DIR, "slides")
AUDIO_DIR = os.path.join(WORK_DIR, "audio")
os.makedirs(SCREENS_DIR, exist_ok=True)
os.makedirs(SLIDES_DIR, exist_ok=True)
os.makedirs(AUDIO_DIR, exist_ok=True)

QR_SRC = "/home/deploy/projects/testlinks-9/.bein/uploads/QqbempIwMKA0DKd_NOG Coupons.png"
QR_DEST = os.path.join(WORK_DIR, "qr.png")
shutil.copyfile(QR_SRC, QR_DEST)

# 1. Capture mobile screenshots
print("=== Step 1: Capturing mobile screens ===")
with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(
        viewport={"width": 412, "height": 892},
        device_scale_factor=2
    )
    page = context.new_page()
    page.goto("https://nogcoupons.dxinnovationhub.com", wait_until="networkidle")
    time.sleep(1)
    
    # 01 Login
    page.screenshot(path=os.path.join(SCREENS_DIR, "01_login.png"))
    print("Saved 01_login.png")
    
    # Sign in
    page.fill("#phone", "08144202252")
    # Click chapter picker
    page.click("#chapterPickerBtn")
    time.sleep(0.5)
    page.screenshot(path=os.path.join(SCREENS_DIR, "02_chapter_picker.png"))
    print("Saved 02_chapter_picker.png")
    
    # Select chapter from list
    page.click(".picker-row")
    time.sleep(0.5)
    page.click("[data-act='do-login']")
    time.sleep(2)
    
    # 03 Home
    page.screenshot(path=os.path.join(SCREENS_DIR, "03_home.png"))
    print("Saved 03_home.png")
    
    # 04 Type modal / region
    page.click("[data-act='type-one']")
    time.sleep(0.8)
    page.screenshot(path=os.path.join(SCREENS_DIR, "04_type_modal.png"))
    print("Saved 04_type_modal.png")
    
    browser.close()

# 2. Generate Nigerian Voiceovers
print("=== Step 2: Generating voiceover with en-NG-EzinneNeural ===")
voice = "en-NG-EzinneNeural"
scenes_info = [
    {
        "id": "scene1",
        "title": "Welcome & Portal Introduction",
        "audio_file": "scene1.mp3",
        "text": "Welcome to the Port Harcourt Night of Glory Coupon Portal! Submitting your coupons is now faster and easier than ever. Scan the QR code on your screen or open bit dot L Y slash nog hyphen upload on your mobile phone."
    },
    {
        "id": "scene2",
        "title": "Step 1: Fast Sign In",
        "audio_file": "scene2.mp3",
        "text": "Step one: Sign in instantly! Simply enter your phone number, select your church chapter, and tap Enter. No passwords, no emails, and no verification codes required!"
    },
    {
        "id": "scene3",
        "title": "Step 2: Snap Your Coupon",
        "audio_file": "scene3.mp3",
        "text": "Step two: Snap your coupon! Tap Snap Photo to take a clear picture of the coupon with your phone. If you prefer to type it in manually, simply tap Type it in."
    },
    {
        "id": "scene4",
        "title": "Step 3: Confirm Region & Save",
        "audio_file": "scene4.mp3",
        "text": "Step three: Confirm the nearest region where the coupon was collected, and tap Save Coupon. Your submission is recorded immediately, even if your internet is slow or offline!"
    },
    {
        "id": "scene5",
        "title": "Wrap Up & Call To Action",
        "audio_file": "scene5.mp3",
        "text": "That is all! Fast, simple, and reliable. Scan the QR code right now or visit bit dot L Y slash nog hyphen upload to submit your coupons today. God bless you!"
    }
]

async def gen_all_audio():
    for sc in scenes_info:
        fpath = os.path.join(AUDIO_DIR, sc["audio_file"])
        c = edge_tts.Communicate(sc["text"], voice, rate="+2%")
        await c.save(fpath)
        print("Generated audio:", sc["audio_file"])

asyncio.run(gen_all_audio())

for sc in scenes_info:
    fpath = os.path.join(AUDIO_DIR, sc["audio_file"])
    cmd = ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "json", fpath]
    res = subprocess.check_output(cmd)
    dur = float(json.loads(res)["format"]["duration"])
    sc["duration"] = round(dur + 0.6, 2)
    print(f"Duration {sc['id']}: {dur:.2f}s (+0.6s padding = {sc['duration']:.2f}s)")

total_duration = sum(sc["duration"] for sc in scenes_info)
print(f"Total video length: {total_duration:.2f} seconds")

# 3. Generate High-Contrast Projector HTML Slides
print("=== Step 3: Generating Projector Slides (1920x1080) ===")

def phone_mockup_html(img_path):
    return f"""
    <div class="phone-frame">
      <div class="notch"></div>
      <img src="file://{img_path}" class="phone-screen" />
    </div>
    """

slide_templates = {
    "scene1": f"""
    <div class="slide bg-gradient">
      <div class="top-bar">
        <div class="church-badge">PORT HARCOURT NIGHT OF GLORY</div>
        <div class="church-sub">OFFICIAL COUPON SUBMISSION PORTAL</div>
      </div>
      
      <div class="content-row">
        <div class="left-hero">
          <div class="pill-badge">CHURCH MEMBERS & VOLUNTEERS</div>
          <h1 class="hero-title">Submit Coupons <span class="highlight-gold">In Seconds</span></h1>
          <p class="hero-desc">The new digital portal makes coupon collection fast, seamless, and paperless. No technical skills needed!</p>
          
          <div class="feature-grid">
            <div class="feat-card">
              <div class="feat-icon">⚡</div>
              <div class="feat-text">
                <div class="feat-title">No Passwords</div>
                <div class="feat-sub">Log in with just your phone number</div>
              </div>
            </div>
            <div class="feat-card">
              <div class="feat-icon">📸</div>
              <div class="feat-text">
                <div class="feat-title">Camera First</div>
                <div class="feat-sub">Snap photo or type in details</div>
              </div>
            </div>
            <div class="feat-card">
              <div class="feat-icon">📶</div>
              <div class="feat-text">
                <div class="feat-title">Works Offline</div>
                <div class="feat-sub">Saves even when network is slow</div>
              </div>
            </div>
          </div>
          
          <div class="link-banner">
            <span class="link-label">VISIT DIRECTLY:</span>
            <span class="link-url">https://bit.ly/nog-upload</span>
          </div>
        </div>
        
        <div class="right-qr">
          <div class="qr-box">
            <div class="qr-glow"></div>
            <div class="qr-inner">
              <div class="qr-tag">POINT CAMERA TO SCAN</div>
              <img src="file://{QR_DEST}" class="qr-img" />
              <div class="qr-url">bit.ly/nog-upload</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    """,
    
    "scene2": f"""
    <div class="slide bg-gradient">
      <div class="top-bar">
        <div class="church-badge">PORT HARCOURT NIGHT OF GLORY</div>
        <div class="step-pill">STEP 1 OF 3</div>
      </div>
      
      <div class="content-row">
        <div class="left-col">
          <div class="step-num-badge">STEP 01</div>
          <h1 class="step-title">Instant Sign In</h1>
          <p class="step-subtitle">No passwords or emails to remember!</p>
          
          <div class="instruction-list">
            <div class="inst-item">
              <div class="inst-num">1</div>
              <div class="inst-body">
                <div class="inst-head">Enter Your Phone Number</div>
                <div class="inst-detail">Type your mobile phone number into the box.</div>
              </div>
            </div>
            <div class="inst-item">
              <div class="inst-num">2</div>
              <div class="inst-body">
                <div class="inst-head">Select Your Chapter</div>
                <div class="inst-detail">Tap the chapter picker to choose your local church chapter.</div>
              </div>
            </div>
            <div class="inst-item">
              <div class="inst-num">3</div>
              <div class="inst-body">
                <div class="inst-head">Tap "Enter"</div>
                <div class="inst-detail">You are instantly inside the app!</div>
              </div>
            </div>
          </div>
          
          <div class="highlight-box">
            <span class="hl-icon">💡</span>
            <span class="hl-text">Your phone stays logged in automatically for the entire program!</span>
          </div>
        </div>
        
        <div class="right-mockup">
          {phone_mockup_html(os.path.join(SCREENS_DIR, "01_login.png"))}
        </div>
      </div>
    </div>
    """,
    
    "scene3": f"""
    <div class="slide bg-gradient">
      <div class="top-bar">
        <div class="church-badge">PORT HARCOURT NIGHT OF GLORY</div>
        <div class="step-pill">STEP 2 OF 3</div>
      </div>
      
      <div class="content-row">
        <div class="left-col">
          <div class="step-num-badge">STEP 02</div>
          <h1 class="step-title">Snap Your Coupon</h1>
          <p class="step-subtitle">Take a fast photo or type the information directly.</p>
          
          <div class="instruction-list">
            <div class="inst-item">
              <div class="inst-num">1</div>
              <div class="inst-body">
                <div class="inst-head">Tap "Snap photo"</div>
                <div class="inst-detail">The big green button opens your phone camera immediately.</div>
              </div>
            </div>
            <div class="inst-item">
              <div class="inst-num">2</div>
              <div class="inst-body">
                <div class="inst-head">Capture Clear Picture</div>
                <div class="inst-detail">Ensure coupon number, name, and phone are visible.</div>
              </div>
            </div>
            <div class="inst-item">
              <div class="inst-num">3</div>
              <div class="inst-body">
                <div class="inst-head">Or Tap "Type it in"</div>
                <div class="inst-detail">Enter details by hand if the coupon cannot be photographed.</div>
              </div>
            </div>
          </div>
          
          <div class="highlight-box">
            <span class="hl-icon">⚡</span>
            <span class="hl-text">Optimized photo compression uploads in under 2 seconds!</span>
          </div>
        </div>
        
        <div class="right-mockup">
          {phone_mockup_html(os.path.join(SCREENS_DIR, "03_home.png"))}
        </div>
      </div>
    </div>
    """,
    
    "scene4": f"""
    <div class="slide bg-gradient">
      <div class="top-bar">
        <div class="church-badge">PORT HARCOURT NIGHT OF GLORY</div>
        <div class="step-pill">STEP 3 OF 3</div>
      </div>
      
      <div class="content-row">
        <div class="left-col">
          <div class="step-num-badge">STEP 03</div>
          <h1 class="step-title">Confirm Region & Save</h1>
          <p class="step-subtitle">Zero wait time — saved and synced immediately!</p>
          
          <div class="instruction-list">
            <div class="inst-item">
              <div class="inst-num">1</div>
              <div class="inst-body">
                <div class="inst-head">Nearest Region</div>
                <div class="inst-detail">Confirms the location where the coupon was collected.</div>
              </div>
            </div>
            <div class="inst-item">
              <div class="inst-num">2</div>
              <div class="inst-body">
                <div class="inst-head">Tap "Save Coupon"</div>
                <div class="inst-detail">One tap submits the coupon directly to the database.</div>
              </div>
            </div>
            <div class="inst-item">
              <div class="inst-num">3</div>
              <div class="inst-body">
                <div class="inst-head">Done! Instant Counter Update</div>
                <div class="inst-detail">Your coupon is saved and listed on your screen.</div>
              </div>
            </div>
          </div>
          
          <div class="highlight-box">
            <span class="hl-icon">📶</span>
            <span class="hl-text">Works 100% offline — uploads automatically when back online!</span>
          </div>
        </div>
        
        <div class="right-mockup">
          {phone_mockup_html(os.path.join(SCREENS_DIR, "04_type_modal.png"))}
        </div>
      </div>
    </div>
    """,
    
    "scene5": f"""
    <div class="slide bg-gradient text-center-layout">
      <div class="top-bar-centered">
        <div class="church-badge">PORT HARCOURT NIGHT OF GLORY</div>
        <div class="church-sub">THANK YOU FOR YOUR DILIGENT SERVICE</div>
      </div>
      
      <h1 class="cta-main-title">SCAN NOW TO START UPLOADING</h1>
      
      <div class="cta-center-row">
        <div class="cta-qr-box">
          <img src="file://{QR_DEST}" class="cta-qr-img" />
          <div class="cta-qr-label">POINT PHONE CAMERA HERE</div>
        </div>
      </div>
      
      <div class="cta-link-pill">
        <span class="cta-short-url">https://bit.ly/nog-upload</span>
      </div>
      
      <div class="cta-summary-badges">
        <div class="s-badge"><span>1</span> Enter Phone</div>
        <div class="s-badge"><span>2</span> Snap Coupon</div>
        <div class="s-badge"><span>3</span> Save & Done</div>
      </div>
      
      <div class="cta-footer">
        "Whatever you do, work at it with all your heart, as working for the Lord" • Colossians 3:23
      </div>
    </div>
    """
}

base_css = """
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1920px;
    height: 1080px;
    overflow: hidden;
    font-family: 'Liberation Sans', 'DejaVu Sans', sans-serif;
    color: #ffffff;
    background: #060b19;
  }
  
  .bg-gradient {
    width: 1920px;
    height: 1080px;
    background: radial-gradient(circle at 80% 20%, #1e295d 0%, #080d21 60%, #030611 100%);
    padding: 48px 72px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
  }
  
  /* Top Bar */
  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 20px;
  }
  .church-badge {
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 3px;
    color: #facc15;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .church-sub {
    font-size: 20px;
    font-weight: 600;
    color: #94a3b8;
    letter-spacing: 1px;
  }
  .step-pill {
    background: #2563eb;
    color: white;
    font-size: 20px;
    font-weight: 800;
    padding: 8px 24px;
    border-radius: 30px;
    letter-spacing: 1.5px;
  }
  
  /* Content Row */
  .content-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 1;
    margin-top: 24px;
    gap: 60px;
  }
  
  .left-hero, .left-col {
    flex: 1.2;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .pill-badge {
    display: inline-block;
    align-self: flex-start;
    background: rgba(250, 204, 21, 0.15);
    color: #facc15;
    border: 1px solid rgba(250, 204, 21, 0.4);
    padding: 6px 18px;
    border-radius: 20px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 1px;
  }
  
  .step-num-badge {
    display: inline-block;
    align-self: flex-start;
    background: #facc15;
    color: #050814;
    padding: 6px 20px;
    border-radius: 8px;
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 2px;
  }
  
  .hero-title, .step-title {
    font-size: 64px;
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: -1px;
  }
  .highlight-gold {
    color: #facc15;
  }
  
  .hero-desc, .step-subtitle {
    font-size: 26px;
    color: #cbd5e1;
    line-height: 1.4;
  }
  
  /* Feature Grid */
  .feature-grid {
    display: flex;
    gap: 16px;
    margin-top: 10px;
  }
  .feat-card {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .feat-icon {
    font-size: 32px;
  }
  .feat-title {
    font-size: 20px;
    font-weight: 800;
    color: white;
  }
  .feat-sub {
    font-size: 15px;
    color: #94a3b8;
    line-height: 1.3;
  }
  
  /* Instructions */
  .instruction-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 6px;
  }
  .inst-item {
    display: flex;
    align-items: center;
    gap: 20px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 16px 22px;
  }
  .inst-num {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: #2563eb;
    color: white;
    font-size: 24px;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .inst-head {
    font-size: 24px;
    font-weight: 800;
    color: #ffffff;
  }
  .inst-detail {
    font-size: 19px;
    color: #94a3b8;
    margin-top: 2px;
  }
  
  .highlight-box {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.35);
    border-radius: 14px;
    padding: 14px 22px;
    display: flex;
    align-items: center;
    gap: 14px;
    color: #34d399;
    font-size: 20px;
    font-weight: 700;
  }
  .hl-icon { font-size: 28px; }
  
  .link-banner {
    display: flex;
    align-items: center;
    gap: 16px;
    background: #0f172a;
    border: 2px solid #facc15;
    border-radius: 16px;
    padding: 14px 26px;
    align-self: flex-start;
  }
  .link-label {
    font-size: 18px;
    font-weight: 800;
    color: #facc15;
    letter-spacing: 1px;
  }
  .link-url {
    font-size: 26px;
    font-weight: 900;
    color: #ffffff;
  }
  
  /* Right QR / Mockup */
  .right-qr {
    flex: 0.9;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .qr-box {
    background: white;
    border-radius: 28px;
    padding: 24px;
    box-shadow: 0 25px 60px rgba(0,0,0,0.6), 0 0 50px rgba(250, 204, 21, 0.25);
    text-align: center;
  }
  .qr-tag {
    font-size: 18px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: 2px;
    margin-bottom: 14px;
  }
  .qr-img {
    width: 380px;
    height: 380px;
    display: block;
    border-radius: 12px;
  }
  .qr-url {
    margin-top: 14px;
    font-size: 24px;
    font-weight: 900;
    color: #2563eb;
    letter-spacing: 1px;
  }
  
  /* Phone Mockup */
  .right-mockup {
    flex: 0.8;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .phone-frame {
    width: 360px;
    height: 760px;
    background: #111;
    border: 10px solid #222;
    border-radius: 54px;
    box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 40px rgba(37, 99, 235, 0.3);
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .phone-frame .notch {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 140px;
    height: 24px;
    background: #111;
    border-bottom-left-radius: 14px;
    border-bottom-right-radius: 14px;
    z-index: 10;
  }
  .phone-screen {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  
  /* Scene 5: Centered CTA */
  .text-center-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    padding: 60px 80px;
  }
  .top-bar-centered {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .cta-main-title {
    font-size: 68px;
    font-weight: 900;
    color: #facc15;
    letter-spacing: 2px;
    margin-top: 10px;
  }
  .cta-center-row {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .cta-qr-box {
    background: white;
    padding: 22px;
    border-radius: 28px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.7), 0 0 60px rgba(250, 204, 21, 0.35);
  }
  .cta-qr-img {
    width: 330px;
    height: 330px;
    display: block;
    border-radius: 10px;
  }
  .cta-qr-label {
    margin-top: 10px;
    font-size: 17px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: 1.5px;
  }
  .cta-link-pill {
    background: #1e293b;
    border: 3px solid #facc15;
    border-radius: 40px;
    padding: 12px 36px;
  }
  .cta-short-url {
    font-size: 34px;
    font-weight: 900;
    color: #ffffff;
    letter-spacing: 1px;
  }
  .cta-summary-badges {
    display: flex;
    gap: 24px;
    justify-content: center;
  }
  .s-badge {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 10px 24px;
    border-radius: 20px;
    font-size: 22px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .s-badge span {
    background: #2563eb;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 900;
  }
  .cta-footer {
    font-size: 20px;
    color: #94a3b8;
    font-style: italic;
  }
</style>
"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    for sc in scenes_info:
        sid = sc["id"]
        full_html = f"<!DOCTYPE html><html><head><meta charset='utf-8'>{base_css}</head><body>{slide_templates[sid]}</body></html>"
        page.set_content(full_html)
        slide_img = os.path.join(SLIDES_DIR, f"{sid}.png")
        page.screenshot(path=slide_img)
        sc["slide_img"] = slide_img
        print(f"Generated slide: {slide_img}")
    browser.close()

# 4. Generate Soft Ambient Background Instrumental Music
print("=== Step 4: Generating background music track ===")
# Synthesize a warm, soft ambient church progression in wav, 44100Hz, stereo
bg_music_wav = os.path.join(WORK_DIR, "ambient_pad.wav")
import wave, struct

sample_rate = 44100
total_samples = int(sample_rate * (total_duration + 5))
# Warm church progression: C - G - Am - F
chords = [
    [261.63, 329.63, 392.00, 523.25], # C major
    [196.00, 246.94, 293.66, 392.00], # G major
    [220.00, 261.63, 329.63, 440.00], # A minor
    [174.61, 220.00, 261.63, 349.23], # F major
]
chord_len = int(sample_rate * 4.0)

with wave.open(bg_music_wav, "wb") as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(sample_rate)
    
    raw_data = bytearray()
    for i in range(total_samples):
        chord_idx = (i // chord_len) % len(chords)
        active_chord = chords[chord_idx]
        
        # gentle envelope
        t = i / sample_rate
        val = 0.0
        for f in active_chord:
            # soft sine harmonics
            val += math.sin(2 * math.pi * f * t) * 0.15
            val += math.sin(2 * math.pi * (f * 2) * t) * 0.05
            val += math.sin(2 * math.pi * (f * 0.5) * t) * 0.1
        
        # fade in at start, fade out at end
        fade = 1.0
        if t < 2.0:
            fade = t / 2.0
        elif t > total_duration:
            fade = max(0.0, 1.0 - (t - total_duration) / 3.0)
            
        sample = int(val * fade * 1800) # subtle background volume
        sample = max(-32767, min(32767, sample))
        packed = struct.pack("<hh", sample, sample)
        raw_data.extend(packed)
        
    wf.writeframes(raw_data)

print("Generated ambient background track:", bg_music_wav)

# 5. Build Scene Clips and Concatenate with ffmpeg
print("=== Step 5: Rendering Scene Clips and Assembling Video ===")
clip_files = []

for sc in scenes_info:
    sid = sc["id"]
    dur = sc["duration"]
    img = sc["slide_img"]
    audio = os.path.join(AUDIO_DIR, sc["audio_file"])
    clip_out = os.path.join(WORK_DIR, f"{sid}_clip.mp4")
    
    # Render scene video clip matching audio duration exactly
    cmd = [
        ffmpeg_bin, "-y",
        "-loop", "1", "-i", img,
        "-i", audio,
        "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-t", str(dur),
        "-shortest",
        clip_out
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    clip_files.append(clip_out)
    print(f"Rendered clip: {clip_out} ({dur}s)")

# Concatenate all scene clips
concat_list = os.path.join(WORK_DIR, "concat.txt")
with open(concat_list, "w") as f:
    for c in clip_files:
        f.write(f"file '{c}'\n")

raw_video = os.path.join(WORK_DIR, "nog_demo_voice_only.mp4")
cmd_cat = [
    ffmpeg_bin, "-y",
    "-f", "concat", "-safe", "0", "-i", concat_list,
    "-c", "copy",
    raw_video
]
subprocess.check_call(cmd_cat, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("Concatenated video created:", raw_video)

# Mix in soft background music
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
subprocess.check_call(cmd_mix, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

final_size = os.path.getsize(FINAL_OUTPUT)
print(f"=== SUCCESS: Video created at {FINAL_OUTPUT} ({final_size / (1024*1024):.2f} MB) ===")

# Verify final duration and streams
cmd_probe = ["ffprobe", "-v", "quiet", "-show_entries", "format=duration:stream=width,height,codec_name", "-of", "json", FINAL_OUTPUT]
probe_res = json.loads(subprocess.check_output(cmd_probe))
print("Final Video Info:", json.dumps(probe_res, indent=2))

