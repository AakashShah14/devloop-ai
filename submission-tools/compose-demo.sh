#!/bin/zsh
set -euo pipefail

PROJECT_ROOT="${0:A:h:h}"
VIDEO_TMP="/private/tmp/devloop-submission-video"
RAW_VIDEO="$VIDEO_TMP/raw/devloop.webm"
NARRATION_TXT="$PROJECT_ROOT/submission-tools/narration.txt"
CAPTIONS="$PROJECT_ROOT/submission-tools/captions.srt"
OUTPUT="$PROJECT_ROOT/submission/DevLoop-AI-Demo.mp4"
SLIDES_DIR="/private/tmp/devloop-pitch-rendered"

mkdir -p "$VIDEO_TMP/audio" "$VIDEO_TMP/composed" "$PROJECT_ROOT/submission"

say -v Samantha -r 175 -f "$NARRATION_TXT" -o "$VIDEO_TMP/audio/narration.aiff"
ffmpeg -y -v error -i "$VIDEO_TMP/audio/narration.aiff" -ar 48000 -ac 2 "$VIDEO_TMP/audio/narration.wav"

NARRATION_DURATION="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$VIDEO_TMP/audio/narration.wav")"
node "$PROJECT_ROOT/submission-tools/generate-captions.mjs" "$NARRATION_TXT" "$NARRATION_DURATION" "$CAPTIONS"
cp "$CAPTIONS" "$VIDEO_TMP/captions.srt"
/Users/aakshshah/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  "$PROJECT_ROOT/submission-tools/render-captions.py" \
  "$CAPTIONS" \
  "$VIDEO_TMP/caption-images"

ffmpeg -y -v error \
  -f concat -safe 0 -i "$VIDEO_TMP/caption-images/captions.ffconcat" \
  -vf "fps=30,format=rgba" -c:v qtrle "$VIDEO_TMP/composed/captions.mov"

ffmpeg -y -v error \
  -loop 1 -t 12 -i "$SLIDES_DIR/slide-1.png" \
  -loop 1 -t 18 -i "$SLIDES_DIR/slide-2.png" \
  -loop 1 -t 20 -i "$SLIDES_DIR/slide-3.png" \
  -i "$RAW_VIDEO" \
  -loop 1 -t 38 -i "$SLIDES_DIR/slide-4.png" \
  -loop 1 -t 27 -i "$SLIDES_DIR/slide-5.png" \
  -loop 1 -t 25 -i "$SLIDES_DIR/slide-6.png" \
  -filter_complex "\
    [0:v]scale=1920:1080,setsar=1,fps=30[v0];\
    [1:v]scale=1920:1080,setsar=1,fps=30[v1];\
    [2:v]scale=1920:1080,setsar=1,fps=30[v2];\
    [3:v]scale=1920:1080,setsar=1,fps=30[v3];\
    [4:v]scale=1920:1080,setsar=1,fps=30[v4];\
    [5:v]scale=1920:1080,setsar=1,fps=30[v5];\
    [6:v]scale=1920:1080,setsar=1,fps=30[v6];\
    [v0][v1][v2][v3][v4][v5][v6]concat=n=7:v=1:a=0[visual]" \
  -map "[visual]" -an -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p "$VIDEO_TMP/composed/visual.mp4"

ffmpeg -y -v error \
  -i "$VIDEO_TMP/composed/visual.mp4" \
  -i "$VIDEO_TMP/audio/narration.wav" \
  -i "$VIDEO_TMP/composed/captions.mov" \
  -filter_complex "[0:v][2:v]overlay=(W-w)/2:H-h-36:format=auto[captioned]" \
  -map "[captioned]" -map 1:a:0 -c:v libx264 -preset ultrafast -crf 21 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$OUTPUT"

echo "$OUTPUT"
