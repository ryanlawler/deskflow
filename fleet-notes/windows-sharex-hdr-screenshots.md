# Windows source: ShareX HDR screenshots come out dim (fix)

On an HDR Windows display, ShareX screenshots paste DIM / washed out (whites go
gray, colors muted) on the other fleet machines and locally. It's one wrong setting.

## The fix
ShareX -> Task Settings -> Capture -> HDR section:
- **HDR Tone Map Mode: None**
- **Brightness Scale: 40** (this fleet's box looked right at **60**)

Brightness Scale in this ShareX build is a PERCENT multiplier on output brightness.
The bad value was 16 = "render at 16% brightness" = the dimming.

## Why 40-60
Windows composites HDR where scRGB 1.0 = 80 nits. Your SDR desktop white is scaled up
to your Windows "SDR content brightness" slider (commonly ~200 nits), so a white pixel
lands at 200/80 = 2.5 in the captured buffer. To pull that back to output white you
multiply by 80/200 = 0.4 = Brightness Scale 40.

Formula: **Brightness Scale = 8000 / (your Windows SDR-content-brightness nits)**.
Lower slider -> higher number. This box landed on 60 (implies ~133 nits SDR white).
Re-tune if you move the Windows SDR-brightness slider.

## Gotchas (source-traced, GotoFinal/ShareX-HDR fork shader)
- Tone Map Mode MUST be None. Any other mode (Clip / InfiniteRolloff / Normalize /
  MapCllToSdrWhite) stacks a compression curve on top of the brightness scale and makes
  it DARKER, not better.
- SDR White Level and HDR Brightness Nits are DEAD fields in this build. Changing them
  does nothing.
- This path hard-clips highlights and is monitor-specific.

## More reliable alternatives
- Windows Snipping Tool (Win+Shift+S) with "HDR Screenshot Color Corrector" ON —
  auto-tonemaps, no tuning.
- Official ShareX `develop` build auto-detects your SDR white level (no manual fields).

Note: the fleet clipboard carries a plain SDR image; HDR never survives the transfer,
so the SOURCE capture has to tonemap to SDR correctly. That's why this is a ShareX-side
fix, not a Deskflow one.
