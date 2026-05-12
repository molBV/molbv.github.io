# Option Trading Hero V4

Offline browser game for replaying a QQQ/Sonic trading day as an options scalping trainer.

## How to play

1. Unzip the folder.
2. Open `index.html` in Chrome.
3. Click **Start Level**.
4. Press **Space** to run Sonic, click Sonic choices or use the option chain, and press **S** or click the position panel to sell.

## New in V4

- Music playlist folder: `music/`
- Three packed tracks included:
  - `background.mp3`
  - `solarflex-retro-arcade-game-music-491487.mp3`
  - `mondamusic-retro-arcade-game-music-491667.mp3`
- Music volume slider.
- Music automatically cycles to the next track when one ends.
- Simulation mode generates a new level from the currently loaded candle level.
- Simulation uses empirical candle behavior from the loaded recording: intraday returns, wick sizes, volume spikes, gaps, and block-style regimes are resampled with random variation.

## Level files

The default level is loaded from:

`levels/default-level.js`

You can also load a Sonic recorder JSON file from the start screen. Once loaded, simulation mode will generate random levels based on that file instead of the default QQQ day.

## Notes

- Browsers usually block autoplay. Click **Music: on** after starting if the music does not begin.
- Buys are simulated at ask and sells at bid.
- This is a practice game, not a real pricing or execution system.
