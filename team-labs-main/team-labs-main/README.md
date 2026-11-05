# POKEMONS WORLD — IDEAS 4.0 Dome Hunt

A 2-minute Pokémon photo hunt for a 160° semi-oval dome, presented at **IDEAS 4.0** by the
**Centre of Excellence, Artificial Intelligence**, powered by NVIDIA.

Up to **30 trainers** scan one QR code and sit down, and their phones become **Poké cameras**.
Each player gets a colored crosshair on the dome. They aim by pointing the phone (gyroscope) or dragging
on its screen, then tap **SNAP** to photograph Pokémon before anyone else does. A sassy, cheerful
**Poke Queen** narrates in natural Hindi with Hinglish captions. Snap the mythic **Mewtwo** to win real goodies.

## Running it

```bash
npm install
npm run tunnel      # best on campus Wi-Fi: public https link, works on iPhone and Android
npm run serve       # or: same Wi-Fi / laptop hotspot only
```

Open **http://localhost:3000** on the dome PC, press `F` for fullscreen, and **click once** to wake
the audio (browsers block sound until the first click).

On event day, double-click **`start-dome.bat`** instead (`start-dome.bat tunnel` for the public link). It builds the
game, starts the server in its own window, and opens the dome in **Edge kiosk mode**: full screen, no
browser bars, and no throttling when the window loses focus. Press `Alt+F4` to leave kiosk mode.

## How a round works

| Phase | What happens | Host |
| --- | --- | --- |
| **Lobby** | Big join QR + 30-seat grid. Names appear as trainers join. Phones can change name here. | `SPACE` starts the round |
| **Intro** (~85 s) | The narrator explains the rules. **SNAP is locked** on every phone (🔒) until the hunt starts. | `SPACE`/`N` skips |
| **Hunt** (2:00) | Snap Pokémon. Combos multiply points (up to ×3). Mewtwo appears once. **Golden hour**: double points in the last 30 s. | `E` ends early |
| **Results** (40 s) | Every phone shows a **different Pokémon for 5 s** — the trainer's best catch (or a lucky one if they caught nothing) in 3D, performing its Special Move — then the full leaderboard. The dome shows the podium. | `SPACE` next group now |

After the results the game resets on its own. A phone from the finished round goes back to the name
screen, so the same device can join again under a **different hunter name**.

## Scoring

| Rarity | Points | Pokémon |
| --- | --- | --- |
| Common | 10 | Vulpix, Ponyta, Eevee, Doduo, Electabuzz, Mankey, Sandshrew, Pikachu, Rhyhorn, Slowpoke, Pidgeotto, Spearow, Farfetch'd, Butterfree |
| Rare | 25 | Ninetales, Rapidash, Growlithe, Scyther, Kangaskhan, Slowbro, Rhydon, Exeggutor, Nidoking, Tauros, Nidoqueen, Flareon, Snorlax, Persian, Jolteon, Raichu, Golbat, Lapras, Dodrio, Fearow, Aerodactyl |
| Legendary | 50 | Arcanine, Charizard, Mew, Articuno, Blastoise, Machamp, Zapdos, Moltres |
| Mythic | 100 + goodies | Mewtwo |

All 44 Pokémon are built in code (`src/screen/world/pokedex.js`, kit in `pokekit.js`): one skinned mesh and one
draw call each, PBR shading with fur sheen, glossy eyes and glowing, flickering flames. Every Pokémon walks in its
own style (`mo` and `anim` in `pokedex.js`: trots, gallops, hops, zig-zag sprints, stomps, waddles, Snorlax naps,
Sandshrew rolls, Pikachu waves, Mewtwo teleports, Charizard takes off, birds swoop, dart, figure-8 and dive) and
performs its Special Move (`src/screen/world/moves.js`) when it appears, every few seconds, and when it is snapped.
Cries and move sounds are synthesized live (`src/shared/cries.js`), so there are no audio files to download.

- **Miss penalty:** every snap that hits nothing costs **5 points** (never below zero) and resets your combo.
- **Combo:** each hit within 9 s of the last raises your multiplier (×1.5, ×2 … ×3).
- **Golden hour:** every snap in the final 30 s counts double.
- **Two snaps on one Pokémon:** the first to hit wins it, and the second gets "Too slow!".

## Mewtwo goodies (limited stock)

- Mewtwo appears **once per round**, at a random moment, and only while goodies remain.
- Set your stock and how often it appears:

  ```bash
  WILDSCAN_GOODIES=10 WILDSCAN_EMBLEMS_PER_ROUND=1 npm run tunnel
  ```

- Each winner gets a claim code (`POKE-XXXX`) on their phone. **One prize per trainer name per phone.**
- Winners are saved to `winners.json` and printed in the server window. The list is at **http://localhost:3000/api/winners** (host PC only).
- Press `K` to release Mewtwo by hand. It won't give a prize once goodies run out.

## Names

Every trainer in a round needs a unique name. The phone offers Pokémon-style names built from shuffled
combinations (`ShinyPika`, `Charizard Ace`, `Team Snorlax`, `Mega Zapdos X`, your own name + a title …), and 🎲 deals
four new ones. Each name on a device is its own player, so friends can share a phone between rounds.

## Phone controls

- **Motion aim:** tap *Motion aim*, point at the glowing target, and tap *Center*. iPhones ask for motion permission once.
- **Drag pad:** drag anywhere on the pad to move the crosshair (also fine-tunes motion aim).
- **SNAP:** take the shot. Locked during the instructions. Misses cost 5 points, so steady aim beats spamming.
- **Low-end phones:** the crosshair moves with GPU transforms (no React re-render per gyro event), motion input is
  batched to one update per frame, there are no blur filters or animated blurred backgrounds, and phones with few
  cores or little memory switch to lite mode automatically (fewer effects, 1× resolution 3D reveal). Force it with `/scanner/?lite=1`.
- The 3D reveal engine is downloaded in the background while the trainer waits in the lobby, never during the hunt.

## Dome / projector

The **dome** view renders a 160° cylindrical panorama from a fixed viewpoint. Each pixel covers the
same angle, so it wraps evenly across a curved screen. Each frame draws **3 camera views** (about 53° each)
and stitches them into the panorama. Press `[` / `]` to match your projector,
or `D` to switch to a flat 16:9 view. URL presets: `/?view=dome&fov=160`.

All host keys: `SPACE` next step · `N` skip intro · `E` end round · `R` back to lobby (panic reset) ·
`K` Mewtwo · `L` legendary · `F` fullscreen · `H` hide HUD · `T` time of day · `Q` quality (High → Balanced → Low) ·
`A` auto quality on/off · `F2` GPU / FPS panel · `+/-` popup size · `M` mute.

## GPU and frame rate

Press **`F2`** on the dome to show the performance panel: which GPU the browser is using, FPS, frame time,
the worst frame, draw calls and the size of the dome views. Add `?perf=1` to the URL to show it at start-up.

- **Green `GPU` badge** (for example *NVIDIA GeForce RTX 3050*): good.
- **Yellow `iGPU`** (Intel UHD / Iris / Radeon Graphics) or **red `CPU!`** (SwiftShader / Basic Render): the browser
  isn't using the NVIDIA card. The panel shows a red warning by itself for the first 20 s.

To make Edge (or Chrome) use the NVIDIA GPU at full power:

1. **Windows Settings → System → Display → Graphics** → *Add desktop app* → `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
   → *Options* → **High performance (NVIDIA)** → Save. Do the same for `chrome.exe` if you use Chrome.
2. **NVIDIA Control Panel → Manage 3D settings → Program settings** → msedge.exe → *Preferred graphics processor:*
   **High-performance NVIDIA processor**, and set *Power management mode:* **Prefer maximum performance**.
3. Edge → `edge://settings/system` → **Use graphics acceleration when available** on. Then **close every Edge window** and reopen it.
4. Check `edge://gpu`: *WebGL2* should say *Hardware accelerated* and the *GL_RENDERER* line should name the NVIDIA card.
5. **Keep the laptop plugged in**, and set *Settings → System → Power → Power mode* to **Best performance**. On battery the GPU is throttled hard.

**Quality.** Auto quality picks **High** on a discrete GPU, **Balanced** on integrated graphics and **Low** on software
rendering. Between rounds (never mid-hunt) it steps down if the dome stays under 42 FPS. The dome also lowers the
resolution of its 3 views by itself if a frame takes too long, and raises it again once things are smooth.

| Tier | Grass blades | Shadows | Max view size |
| --- | --- | --- | --- |
| High | 70 000 | soft, 2048 | 1690 px |
| Balanced | 40 000 | 1024 | 1267 px |
| Low | 18 000 | off | 986 px |

Run on an RTX 3050 laptop GPU at 1920×1080: the dome holds ~100–120 FPS during a 30-player hunt.

What keeps it smooth: shaders are compiled during loading (no freeze the first time a legendary or the Mewtwo
appears), Pokémon models are built once and cloned, new Pokémon appear two at a time instead of all at once, the
sound engine starts during loading instead of on the first click, the grass is split into chunks that are skipped
when out of view, there are no per-Pokémon lights, and the HUD has no glass blur (blur is re-rendered over the 3D
scene every frame). The PC screen is kept awake while the dome is open.

## Narration

The host is a sassy, cheerful **Poke Queen** speaking natural **Hindi** ("हाय ट्रेनर्स! पोकेमॉन्स वर्ल्ड के दरवाज़े खुल गए हैं…")
with **Hinglish** subtitles on the dome. The lines are in `src/shared/narration.js` (`say` is spoken, `sub` is the subtitle).

The voice files in `public/voice/*.mp3` use Microsoft's neural Hindi female voice (*Swara*), slightly brighter and slower.
After editing a line, re-render them (needs internet):

```bash
npm run voice
```

Add `?voice=natural` to the dome URL to speak live with Edge's built-in voice instead.

## Using realistic 3D models (optional)

The built-in Pokémon are procedural. To use professionally made, rigged models (for example a
licensed rigged pack), add `public/models/models.json`:

```json
{ "pikachu": { "file": "pikachu.glb", "size": 2.2, "clips": { "walk": "Walk", "run": "Run", "idle": "Idle" } } }
```

Put the `.glb` files next to it. Every listed species uses the real model; the rest stay procedural.

## Network notes

The phone controller is a touch pad, so it needs no HTTPS. On the LAN the QR opens a plain
`http://<laptop-ip>:3000/scanner/` link, which has no certificate warning page. `npm run tunnel`
gives a public link with a real certificate (cloudflared in `./bin/`). If the Wi-Fi blocks devices
from reaching each other, which is common on campus, use the tunnel or the laptop's Mobile Hotspot.

## Load test (rehearse with 30 fake phones)

With the server and the dome page running:

```bash
npm run loadtest                                  # 30 bots, one round, on localhost:3000
node scripts/loadtest.cjs --bots=30 --rounds=3   # soak test: several rounds back to back
```

The bots join, aim and snap like real players. It ends with a summary (shots, hits, lost replies, reply time,
disconnects) and **RESULT: PASS** when nothing was lost and 95% of replies arrived in under 300 ms. Phones get a
slim update (no Pokémon list) at most 4 times a second, plus an instant one whenever the phase changes. Aim updates
are sent as droppable packets so a busy network never queues them up.

## Event-day checklist

1. Laptop **plugged in**, power mode **Best performance**, Edge set to the **NVIDIA GPU** (see above).
2. Network: Windows Mobile Hotspot allows only **8 devices**, so for 30 phones use a **dedicated 5 GHz router**
   (laptop on a cable if possible) or `start-dome.bat tunnel`. Campus Wi-Fi often blocks phones from reaching each other.
3. Run `start-dome.bat`, click once on the dome to wake the narrator, press `F2`, and check for the green **GPU**
   badge and about 60+ FPS. Press `F2` again to hide it.
4. Test with two phones (one Android, one iPhone): join, *Motion aim*, *Center*, snap.
5. Before the doors open: `npm run loadtest` once, then `R` to return to an empty lobby.
6. Each group: `SPACE` to start. The intro runs itself, the hunt is 2 minutes, and the results reset to the lobby automatically.
7. If anything looks stuck: `R` (back to lobby). Phones reconnect by themselves. As a last resort, press `F5` on the dome; the round keeps running on the server.

## Rehearsal settings

```bash
WILDSCAN_ROUND_SEC=90 WILDSCAN_INTRO_SEC=70 WILDSCAN_RESULTS_SEC=20 npm run serve
```

## Credits

All Pokémon models, effects and sounds are generated procedurally in code.
Pokémon is a trademark of Nintendo / Creatures / GAME FREAK; this is a non-commercial event fan game.
