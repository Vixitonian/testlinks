#!/usr/bin/env python3
"""
Church Demo Video (1080p Widescreen):
Includes:
1. Step 1: Sign in with Phone + Chapter (no passwords/codes).
2. Option 1: "Take picture" button circled in bold electric gold (Camera Capture).
3. Option 2: "From phone" button circled in bold electric gold (Upload from Gallery if camera is not available).
4. Preview & Save: Confirm Nearest Region and tap Save Coupon.
5. Option 3: "Type it in" button circled in bold electric gold (Manual typing).
6. Manual Modal: Enter Name, Phone, and tap Save and close.
7. Step 3: Instant save & offline background sync.
8. Outro: High-contrast QR code and short link bit.ly/nog-upload.
"""
import os, sys, subprocess, shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT_DIR = "/home/deploy/projects/testlinks-9"
DEMO_AUDIO = os.path.join(ROOT_DIR, "demo_audio")
DEMO_SLIDES = os.path.join(ROOT_DIR, "demo_slides")
DEMO_PARTS = os.path.join(ROOT_DIR, "demo_parts")
FINAL_MP4 = os.path.join(ROOT_DIR, "nog_coupon_demo_1080p.mp4")
WEB_MP4 = "/home/deploy/projects/sb-p139/web/nog_coupon_demo_1080p.mp4"
FFMPEG = "/home/deploy/.bein/venv/lib/python3.14/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2"

W, H = 1920, 1080
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def get_font(size, bold=True):
    path = FONT_BOLD if bold else FONT_REG
    return ImageFont.truetype(path, size)

def create_base_canvas():
    im = Image.new("RGBA", (W, H), (10, 15, 29, 255))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 8], fill=(217, 119, 6, 255))
    for r in range(400, 0, -20):
        alpha = int(12 * (1 - r / 400))
        d.ellipse([-100 - r, -100 - r, 300 + r, 300 + r], fill=(30, 58, 138, alpha))
    return im

def draw_phone_mockup(base, screenshot_path, center_x, center_y, target_h=930, highlight=None):
    sc = Image.open(os.path.join(ROOT_DIR, screenshot_path)).convert("RGBA")
    aspect = sc.width / sc.height
    phone_h = target_h
    phone_w = int(phone_h * aspect)
    sc_resized = sc.resize((phone_w, phone_h), Image.Resampling.LANCZOS)
    
    corner_radius = 42
    border_thick = 12
    total_w = phone_w + border_thick * 2
    total_h = phone_h + border_thick * 2
    
    frame = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle([0, 0, total_w, total_h], radius=corner_radius, fill=(30, 41, 59, 255), outline=(71, 85, 105, 255), width=3)
    
    mask = Image.new("L", (phone_w, phone_h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, phone_w, phone_h], radius=corner_radius - 8, fill=255)
    
    if highlight:
        scale_x = phone_w / sc.width
        scale_y = phone_h / sc.height
        
        overlay = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        glow = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        
        if highlight == "shoot":
            x1 = int(32 * scale_x) - 10
            x2 = int(827 * scale_x) + 10
            y1 = int(1592 * scale_y) - 8
            y2 = int(1711 * scale_y) + 8
            ring_color = (250, 204, 21, 255)
            badge_color = (234, 88, 12, 255)
            tag_text = "👉 TAP HERE"
        elif highlight == "type":
            x1 = int(32 * scale_x) - 8
            x2 = int(421 * scale_x) + 8
            y1 = int(1728 * scale_y) - 8
            y2 = int(1831 * scale_y) + 8
            ring_color = (250, 204, 21, 255)
            badge_color = (234, 88, 12, 255)
            tag_text = "👉 TAP HERE"
        elif highlight == "phone":
            x1 = int(439 * scale_x) - 8
            x2 = int(827 * scale_x) + 8
            y1 = int(1728 * scale_y) - 8
            y2 = int(1831 * scale_y) + 8
            ring_color = (250, 204, 21, 255)
            badge_color = (234, 88, 12, 255)
            tag_text = "👉 TAP HERE"
            
        gd.rounded_rectangle([x1 - 6, y1 - 6, x2 + 6, y2 + 6], radius=24, outline=(250, 204, 21, 220), width=12)
        glow = glow.filter(ImageFilter.GaussianBlur(8))
        od.rounded_rectangle([x1, y1, x2, y2], radius=22, outline=ring_color, width=7)
        
        bw = 190
        bh = 42
        bx = max(10, min(phone_w - bw - 10, x1 + (x2 - x1 - bw) // 2))
        by = y1 - 48
        od.rounded_rectangle([bx, by, bx + bw, by + bh], radius=12, fill=badge_color, outline=(255, 255, 255, 255), width=3)
        font = get_font(21, True)
        tw = od.textlength(tag_text, font=font)
        od.text((bx + (bw - tw) // 2, by + 9), tag_text, font=font, fill=(255, 255, 255, 255))
        
        sc_resized = Image.alpha_composite(sc_resized, glow)
        sc_resized = Image.alpha_composite(sc_resized, overlay)
        
    frame.paste(sc_resized, (border_thick, border_thick), mask)
    
    shadow_pad = 40
    shadow = Image.new("RGBA", (total_w + shadow_pad * 2, total_h + shadow_pad * 2), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([shadow_pad, shadow_pad + 10, shadow_pad + total_w, shadow_pad + total_h + 10], radius=corner_radius + 4, fill=(0, 0, 0, 180))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    
    top_left_x = center_x - total_w // 2
    top_left_y = center_y - total_h // 2
    base.paste(shadow, (top_left_x - shadow_pad, top_left_y - shadow_pad), shadow)
    base.paste(frame, (top_left_x, top_left_y), frame)

def build_slide3a():
    im = create_base_canvas()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([80, 70, 520, 125], radius=12, fill=(16, 185, 129, 60), outline=(52, 211, 153, 220), width=2)
    d.text((105, 83), "OPTION 1 · CAMERA CAPTURE", font=get_font(26, True), fill=(255, 255, 255, 255))
    d.text((80, 165), 'Tap "Take picture"', font=get_font(64, True), fill=(52, 211, 153, 255))
    d.text((80, 255), "The primary, fastest way to capture church coupons.", font=get_font(32, False), fill=(226, 232, 240, 255))
    
    cards = [
        ("1. Tap The Big Button", "Located right at the bottom center of your screen."),
        ("2. Instant Camera Shutter", "Opens your phone camera immediately with zero lag."),
        ("3. Point & Snap", "Hold your phone over the paper coupon to take a clear shot.")
    ]
    cy = 340
    for title, desc in cards:
        d.rounded_rectangle([80, cy, 980, cy + 145], radius=18, fill=(15, 23, 42, 240), outline=(52, 211, 153, 180), width=2)
        d.text((115, cy + 26), title, font=get_font(32, True), fill=(250, 204, 21, 255))
        d.text((115, cy + 80), desc, font=get_font(24, False), fill=(241, 245, 249, 255))
        cy += 175
        
    draw_phone_mockup(im, "demo_assets/03_home.png", center_x=1440, center_y=540, target_h=930, highlight="shoot")
    im.convert("RGB").save(os.path.join(DEMO_SLIDES, "s3a.png"), quality=95)

def build_slide_phone():
    im = create_base_canvas()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([80, 70, 560, 125], radius=12, fill=(14, 165, 233, 60), outline=(56, 189, 248, 220), width=2)
    d.text((105, 83), "OPTION 2 · UPLOAD FROM PHONE", font=get_font(26, True), fill=(255, 255, 255, 255))
    d.text((80, 165), 'Tap "From phone"', font=get_font(64, True), fill=(56, 189, 248, 255))
    d.text((80, 255), "Upload from your gallery if camera is not available.", font=get_font(32, False), fill=(226, 232, 240, 255))
    
    cards = [
        ("1. If Camera Is Unavailable", "Tap 'From phone' right beside 'Type it in'."),
        ("2. Choose From Gallery", "Pick already captured coupon photos from your phone files."),
        ("3. Instant Review & Save", "Opens the same preview to choose region and save immediately.")
    ]
    cy = 340
    for title, desc in cards:
        d.rounded_rectangle([80, cy, 980, cy + 145], radius=18, fill=(15, 23, 42, 240), outline=(56, 189, 248, 180), width=2)
        d.text((115, cy + 26), title, font=get_font(32, True), fill=(250, 204, 21, 255))
        d.text((115, cy + 80), desc, font=get_font(24, False), fill=(241, 245, 249, 255))
        cy += 175
        
    draw_phone_mockup(im, "demo_assets/03_home.png", center_x=1440, center_y=540, target_h=930, highlight="phone")
    im.convert("RGB").save(os.path.join(DEMO_SLIDES, "s3_phone.png"), quality=95)

def build_slide3b():
    im = create_base_canvas()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([80, 70, 520, 125], radius=12, fill=(16, 185, 129, 60), outline=(52, 211, 153, 220), width=2)
    d.text((105, 83), "STEP 2 · PREVIEW & SAVE", font=get_font(26, True), fill=(255, 255, 255, 255))
    d.text((80, 165), "Confirm & Save Coupon", font=get_font(60, True), fill=(255, 255, 255, 255))
    d.text((80, 255), "Review your snap or upload, and save with one tap.", font=get_font(32, False), fill=(203, 213, 225, 255))
    
    cards = [
        ("1. Photo Preview", "Check coupon photo clarity directly on your phone."),
        ("2. Nearest Region", "Pre-filled with your chapter or pick where collected."),
        ("3. Tap 'Save Coupon'", "Confirmed instantly and saved securely to your device.")
    ]
    cy = 340
    for title, desc in cards:
        d.rounded_rectangle([80, cy, 980, cy + 145], radius=18, fill=(15, 23, 42, 240), outline=(51, 65, 85, 255), width=2)
        d.text((115, cy + 26), title, font=get_font(32, True), fill=(52, 211, 153, 255))
        d.text((115, cy + 80), desc, font=get_font(24, False), fill=(241, 245, 249, 255))
        cy += 175
        
    draw_phone_mockup(im, "demo_assets/06_photo_preview.png", center_x=1440, center_y=540, target_h=930)
    im.convert("RGB").save(os.path.join(DEMO_SLIDES, "s3b.png"), quality=95)

def build_slide4a():
    im = create_base_canvas()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([80, 70, 520, 125], radius=12, fill=(245, 158, 11, 60), outline=(251, 191, 36, 220), width=2)
    d.text((105, 83), "OPTION 3 · MANUAL FLOW", font=get_font(26, True), fill=(255, 255, 255, 255))
    d.text((80, 165), 'Tap "Type it in"', font=get_font(64, True), fill=(251, 191, 36, 255))
    d.text((80, 255), "Fast keyboard entry — no photo needed.", font=get_font(32, False), fill=(226, 232, 240, 255))
    
    cards = [
        ("1. Tap 'Type it in'", "Located directly below the primary camera button."),
        ("2. Instant Bottom Sheet", "Opens the entry form immediately without changing screens."),
        ("3. Ideal for Batches", "Perfect for typing stacks of coupons quickly and easily.")
    ]
    cy = 340
    for title, desc in cards:
        d.rounded_rectangle([80, cy, 980, cy + 145], radius=18, fill=(15, 23, 42, 240), outline=(251, 191, 36, 180), width=2)
        d.text((115, cy + 26), title, font=get_font(32, True), fill=(250, 204, 21, 255))
        d.text((115, cy + 80), desc, font=get_font(24, False), fill=(241, 245, 249, 255))
        cy += 175
        
    draw_phone_mockup(im, "demo_assets/03_home.png", center_x=1440, center_y=540, target_h=930, highlight="type")
    im.convert("RGB").save(os.path.join(DEMO_SLIDES, "s4a.png"), quality=95)

def build_slide4b():
    im = create_base_canvas()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([80, 70, 520, 125], radius=12, fill=(245, 158, 11, 60), outline=(251, 191, 36, 220), width=2)
    d.text((105, 83), "OPTION 3 · ENTER & SAVE", font=get_font(26, True), fill=(255, 255, 255, 255))
    d.text((80, 165), "Enter Details & Save", font=get_font(60, True), fill=(255, 255, 255, 255))
    d.text((80, 255), "Fill attendee name and phone, then tap Save.", font=get_font(32, False), fill=(203, 213, 225, 255))
    
    cards = [
        ("1. Attendee Name", "Type the full name written on the coupon."),
        ("2. Phone Number", "Enter their WhatsApp or contact phone number."),
        ("3. Tap 'Save and close'", "Confirmed instantly and added to your uploaded list.")
    ]
    cy = 340
    for title, desc in cards:
        d.rounded_rectangle([80, cy, 980, cy + 145], radius=18, fill=(15, 23, 42, 240), outline=(51, 65, 85, 255), width=2)
        d.text((115, cy + 26), title, font=get_font(32, True), fill=(251, 191, 36, 255))
        d.text((115, cy + 80), desc, font=get_font(24, False), fill=(241, 245, 249, 255))
        cy += 175
        
    draw_phone_mockup(im, "demo_assets/04_type_modal.png", center_x=1440, center_y=540, target_h=930)
    im.convert("RGB").save(os.path.join(DEMO_SLIDES, "s4b.png"), quality=95)

if __name__ == "__main__":
    build_slide3a()
    build_slide_phone()
    build_slide3b()
    build_slide4a()
    build_slide4b()
