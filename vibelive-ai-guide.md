# VibeLive Get Started Guide

**VibeLive API Guide v0.79 + Design Guide v2.4 + Error Guide v1.0**

Last updated: 2026-04-06

---

## Authority Rule

When the API Guide and Design Guide conflict:

- **API Guide** defines system behavior and lifecycle semantics
- **Design Guide** defines visual presentation and interaction rules

For visual conflicts, the Design Guide wins.

---

## Implementation Checklist

Scannable list of every functional requirement across both guides. Use this to verify completeness.

### Entry Flow
- [ ] Name input (max 24 chars, autofocus)
- [ ] "Start a Room" button creates room via `signup()` → `createRoom()` → `enterByRoomCode()`
- [ ] "Join" button joins room via `signup()` → `enterByRoomCode(code)`
- [ ] Dynamic button priority: "Start a Room" is primary when no code entered; "Join" becomes primary when code is entered
- [ ] URL deep linking: auto-fill room code from `?code=` parameter, swap "Join" to primary
- [ ] Shareable invite link: copy-link produces full URL with `?code=<roomCode>`, not just the raw code
- [ ] Name validation hint on disabled button click
- [ ] Button loading states (spinner + "Creating..." for Start; disabled-only for Join)

### Pre-Live Screen
- [ ] Topbar: app name (left) + room code + copy-code button + copy-link button (right)
- [ ] Camera preview tile (~70% of available space)
- [ ] Camera and mic toggle buttons
- [ ] "Go Live" primary CTA + "Back" secondary button
- [ ] No remote participants visible
- [ ] Element-First Rule: both camera and screenshare tiles created and registered via `registerTile()` in `channelSelected`

### Live Screen
- [ ] Same topbar as pre-live
- [ ] Camera tiles in `#cameraGrid` with 16:9 aspect ratio, responsive layout (1→2→2×2→3+2)
- [ ] Separate `#screenshareGrid` above `#cameraGrid`
- [ ] Camera toggle (`setVideo(on)`), mic toggle (`setAudioMuted(muted)`), screenshare toggle (`setScreenshare(on)`)
- [ ] Leave button with danger styling, visually separated
- [ ] Remote tiles created via `registerTile()` in `remoteStreamStart`
- [ ] Tile cleanup handled automatically by SDK for registered tiles (member exit, screenshare end, room exit, kick)

### Media & Tiles
- [ ] All tile visibility and indicators driven by unified `memberStateChange` event
- [ ] `memberStateChange` state shape: `{ status, live, video, audio, screenVideo }` -- same for local AND remote
- [ ] Camera tile: placeholder shown when `state.video !== 'ON'`
- [ ] Screenshare tile: `display` toggled based on `state.screenVideo !== 'OFF'`
- [ ] Media indicators (camera + mic) on camera tiles using inline SVG icons (read `state.video`, `state.audio`)
- [ ] LIVE status badge on active tiles (read `state.live`)
- [ ] Initials placeholder when camera is off
- [ ] Green room member list populated from `getMembers()` on `channelSelected`, kept current via `memberStateChange`

### Sharing
- [ ] Copy-code button: copies raw room code
- [ ] Copy-link button: copies full URL with `?code=<roomCode>`
- [ ] "Copied!" tooltip below button for 1.5 seconds (not a global toast)

### Theme
- [ ] Dark mode default, light mode option
- [ ] Theme toggle in bottom-right corner (fixed, z-index: 100)
- [ ] Choice persists via localStorage
- [ ] Respect `prefers-color-scheme` on first visit

### Session End
- [ ] Handle `kicked` event for server-initiated exits (e.g. trial time limit)
- [ ] Styled modal for session-ended message (never native `alert()`)
- [ ] Call `exitRoom()` in kicked handler to clean up, then return to entry screen
- [ ] Shared teardown function for both user exit and kicked handler

### Error Handling
- [ ] Register global `VibeLive.on('error', ...)` handler
- [ ] Dev bugs (`INIT_*`, `STATE_*`): log to console, never show to user
- [ ] `SCREENSHARE_CANCELLED`: silently ignore (user chose to cancel)
- [ ] `ROOM_KICKED`: show styled modal, redirect to entry screen, do not auto-rejoin
- [ ] `MEDIA_PERMISSION_DENIED`: show permission guide with browser-specific instructions
- [ ] `MEDIA_DEVICE_BUSY`: show retry button ("camera in use by another app")
- [ ] `NETWORK_WS_DISCONNECTED`: show subtle "reconnecting..." indicator, auto-hide on restore
- [ ] `NETWORK_OFFLINE`: show offline banner, auto-retry on `online` event
- [ ] Retriable errors (`error.retriable === true`): show toast with retry option
- [ ] Non-retriable errors: show persistent message with `error.hint` if available
- [ ] Never show raw error codes to users — always use friendly messages

### Production
- [ ] Trial projects: `projectId` only, no token needed
- [ ] Production projects: server-side proxy adds `X-Project-Auth-Token` header
- [ ] Pass proxy URL via `proxy` option in `VibeLive.init()`

---

# VibeLive SDK -- API Reference & Example

**Build an anonymous video chat app with VibeLive**

Version 0.79 | April 02, 2026

## Implementation Directives

1. **Use ONLY the methods, properties, and events documented below.** Do not infer or invent any API not listed in the Methods, State Getters, or Events tables. If you need functionality not covered, leave a `// TODO` comment.
2. **Wire ALL Required events** from the Event Checklist. Do not skip any.
3. **Follow the example's code structure.** Do not combine separate handlers into unified abstractions (e.g., merging camera and screenshare logic into one function).
4. **Read actual state from SDK getters.** Never hardcode indicator values -- always use `getMemberState(id)` or read `mediaState` / `screenState`.
5. **Include all `<video>` attributes** shown in the example: `autoplay`, `playsinline`, `muted`.
6. **`createTile` must return a valid element** for both new and existing tiles.

## Setup

**Option A -- ESM** (recommended for `type="module"` scripts):
```html
<script type="module">
import VibeLive from 'https://makedo.com/sdk/makedo-vibelive.esm.js';
VibeLive.init({ projectId: 'YOUR_TRIAL_PROJECT_ID' });
</script>
```

**Option B -- IIFE** (plain `<script>` tag, no import):
```html
<script src="https://makedo.com/sdk/makedo-vibelive.min.js"></script>
<script>
VibeLive.init({ projectId: 'YOUR_TRIAL_PROJECT_ID' });
</script>
```

> Do NOT `import` from `.min.js` -- the IIFE bundle has no `export default`.

`VibeLive` is attached to `window` automatically -- usable in `onclick` handlers without extra wiring.

### Singleton vs. Multiple Instances

**Most apps need only the singleton.** `VibeLive.init()` creates a single shared instance attached to `window.VibeLive`. All examples in this guide use the singleton.

For the rare case where one page must host **multiple independent meetings** (e.g., a monitoring dashboard, side-by-side rooms), use `createInstance()`:

```js
const room1 = VibeLive.createInstance({ projectId: 'YOUR_TRIAL_PROJECT_ID' });
const room2 = VibeLive.createInstance({ projectId: 'YOUR_TRIAL_PROJECT_ID' });

await room1.signup('Alice');
await room1.enterByRoomCode('ABC123');

await room2.signup('Alice');
await room2.enterByRoomCode('DEF456');
```

Each instance has its own WebRTC connection, WebSocket, member tracking, and media state. The API surface is identical to the singleton -- every method, getter, and event listed below works the same way. Instances do not share state.

**Use the singleton (`VibeLive.init()`) unless you have a concrete need for multiple simultaneous rooms.**

## Lifecycle

```
[Not joined] -> signup/login -> enterByRoomCode(code) -> [PRE-LIVE] -> startLive() -> [LIVE] -> stopLive() -> [PRE-LIVE]
```

- **PRE-LIVE**: In room, camera/mic available for preview, no WebRTC connection.
- **LIVE**: WebRTC connected, streaming to/from other members.

## Rules (must follow)

1. **Use `registerTile()` for all tiles**: After creating a tile DOM element, call `VibeLive.registerTile(memberId, streamType, element)`. This auto-finds the `<video>` inside and registers it (replaces `setLocalCamera`/`setRemoteCamera` etc.). Registered tiles are **auto-removed from the DOM** when a member exits, a screenshare ends, you leave the room, or you get kicked. Do NOT manually remove registered tiles -- the SDK handles lifecycle cleanup.

2. **Visibility is yours**: The SDK attaches streams to `<video>` elements (`srcObject`) but never shows or hides anything. Use `memberStateChange` to toggle visibility and update indicators for all members.

3. **Video off != stream end**: A remote member can turn off video while keeping audio active. The stream stays alive (`remoteStreamEnd` does NOT fire), but the video track disappears. `memberStateChange` handles this automatically -- the `video` field changes to `'OFF'` or `'MUTED'`.

4. **Use detail fields for state**: Read `.videoDetail` / `.audioDetail` (returns `'ON'` | `'MUTED'` | `'OFF'`), NOT `.video` / `.audio` (booleans that stay `true` when muted).

5. **`await` everything async**: All methods that touch network (`signup`, `login`, `startLive`, `setVideo`, `enterByRoomCode`, etc.) return promises.

6. **Use `getMembers()` for display names and member lists**: `VibeLive.user` is the raw auth object (has `.username`). For `displayName`, call `await VibeLive.getMembers()` after entering a room. This returns all members with `displayStatus` (`'LIVE'`, `'PRE-LIVE'`, `'EXITED'`), including lobby members -- useful for green room / waiting room UIs. Keep the list current by updating on each `memberStateChange` event using `state.status`.

7. **One tile per stream type**: Each member can have a camera tile AND a screenshare tile. ID pattern: `tile-{memberId}-camera`, `tile-{memberId}-screenshare`.

8. **Stream exists != all tracks are ON**: When `remoteStreamStart` fires, do NOT assume video/audio are both active. Always read actual state from `VibeLive.getMediaStates(id)`. A member can start a stream with video on and audio off (or vice versa).

## Event Checklist

Every event below exists for a specific reason. **Omitting any REQUIRED event causes incorrect state, stale UI, or missing cleanup.**

### Required -- omitting these causes bugs

| Event | Why it's required |
|-------|-------------------|
| `channelSelected` | Set up local tiles, show controls, enable buttons |
| `memberStateChange` | **Unified state for any member** -- updates LIVE/VID/AUD indicators and placeholder visibility. Fires on every state change for every member (local and remote). Same shape always. |
| `remoteStreamStart` | Create remote tile via `registerTile()` -- without this, no remote video appears |

### Recommended -- omitting these degrades experience

| Event | Why it's recommended |
|-------|----------------------|
| `localJoined` | Update button enabled/disabled state on going live |
| `localLeft` | Update button state on stop-live |
| `remoteJoined` | Pre-create tile before stream arrives (avoids flash of missing content) |
| `kicked` | Show message to user, call `exitRoom()` to clean up, return to entry screen |
| `error` | Display or log `MakedoError` with `.code`, `.hint` for debugging |
| `warning` | Log non-fatal issues (e.g. brief network interruptions) |

### Optional -- SDK handles these automatically when using `registerTile()`

| Event | Notes |
|-------|-------|
| `remoteStreamEnd` | Screenshare tiles auto-removed by SDK. Only needed if you want custom animation before removal. |
| `remoteLeft` | Tiles auto-removed for exited members by SDK. Only needed if you want custom exit behavior. |
| `localMediaChange` | Covered by `memberStateChange` for indicators. Only needed for extra local-only UI. |
| `localLiveChange` | Covered by `memberStateChange`. Only needed if you want a separate local-only live handler. |
| `remoteLiveChange` | Covered by `memberStateChange`. Only needed if you want a separate remote-only live handler. |
| `remoteMediaChange` | Covered by `memberStateChange`. Only needed if you want a separate remote-only media handler. |

## Complete Working Example

```html
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { background: #000; color: #fff; font-family: system-ui; margin: 0; padding: 1rem; }
  button, input { background: #000; color: #fff; border: 1px solid #666; padding: .4rem .8rem; margin: .2rem; }
  button:hover { background: #fff; color: #000; cursor: pointer; }
  button:disabled { opacity: .3; cursor: default; }
  .grid { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: 1rem; }
  .tile { position: relative; width: 320px; height: 240px; background: #111; overflow: hidden; }
  .tile video { width: 100%; height: 100%; object-fit: cover; display: none; }
  .tile video.visible { display: block; }
  .tile .placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
  .tile .placeholder.hidden { display: none !important; }
  .tile .name { position: absolute; bottom: 4px; left: 4px; font-size: 11px; background: rgba(0,0,0,.6); padding: 2px 6px; }
  .ind { position: absolute; top: 4px; left: 4px; font-size: 10px; font-weight: bold; margin-right: 4px; }
  .ind.on { color: #0f0; } .ind.off { color: #f00; }
</style>
</head><body>

<div id="entry">
  <input id="nameInput" placeholder="Your name">
  <input id="codeInput" placeholder="Room code">
  <button onclick="join()">Join</button>
  <button onclick="createRoom()">Create Room</button>
</div>

<div id="controls" style="display:none">
  <span id="roomInfo"></span>
  <button id="btnLive" onclick="VibeLive.startLive()" disabled>Go Live</button>
  <button id="btnStop" onclick="VibeLive.stopLive()" disabled>Stop Live</button>
  <button onclick="VibeLive.setVideo(!VibeLive.mediaState.video)">Video</button>
  <button onclick="VibeLive.setAudio(!VibeLive.mediaState.audio)">Mic</button>
  <button onclick="VibeLive.setScreenshare(!VibeLive.screenState.video)">Screen</button>
  <button onclick="VibeLive.exitRoom()">Exit</button>
</div>

<div class="grid" id="grid"></div>

<script type="module">
import VibeLive from 'https://makedo.com/sdk/makedo-vibelive.esm.js';
VibeLive.init({ projectId: 'YOUR_TRIAL_PROJECT_ID' });

// ---- Helpers ----

function createTile(id, name, streamType, isLocal) {
    const tileId = `tile-${id}-${streamType}`;
    if (document.getElementById(tileId)) return document.getElementById(tileId);
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.id = tileId;
    const label = streamType === 'screenshare'
        ? `${isLocal ? 'Your' : name + "'s"} Screen`
        : name;
    tile.innerHTML = `
        <span class="ind ind-live off">LIVE</span>
        <span class="ind ind-vid off" style="left:40px">VID</span>
        <span class="ind ind-aud off" style="left:72px">AUD</span>
        <div class="placeholder"><span>${label}</span></div>
        <video autoplay playsinline ${isLocal || streamType === 'screenshare' ? 'muted' : ''}></video>
        <div class="name">${label}</div>`;
    document.getElementById('grid').appendChild(tile);
    if (streamType === 'screenshare') tile.style.display = 'none';
    // registerTile auto-finds <video> and registers it (replaces setLocalCamera/setRemoteCamera).
    // SDK auto-removes registered tiles on member exit, screenshare end, room exit, or kick.
    VibeLive.registerTile(id, streamType, tile);
    return tile;
}

function setIndicator(tileId, type, isOn) {
    const el = document.getElementById(tileId)?.querySelector(`.ind-${type}`);
    if (el) { el.classList.toggle('on', isOn); el.classList.toggle('off', !isOn); }
}

function updateTileVisibility(tileId, videoOn) {
    const tile = document.getElementById(tileId);
    if (!tile) return;
    tile.querySelector('.placeholder')?.classList.toggle('hidden', videoOn);
    tile.querySelector('video')?.classList.toggle('visible', videoOn);
}

function updateButtons() {
    const live = VibeLive.isLive;
    document.getElementById('btnLive').disabled = live;
    document.getElementById('btnStop').disabled = !live;
}

// ---- Events ----

VibeLive.on('channelSelected', async (channel) => {
    document.getElementById('entry').style.display = 'none';
    document.getElementById('controls').style.display = 'block';
    const members = await VibeLive.getMembers();
    const self = members.find(m => m.id === VibeLive.memberId);
    createTile(VibeLive.memberId, self?.displayName || 'You', 'camera', true);
    createTile(VibeLive.memberId, self?.displayName || 'You', 'screenshare', true);
    updateButtons();
});

VibeLive.on('localJoined', () => {
    updateButtons();
});

VibeLive.on('localLeft', () => {
    updateButtons();
});

// ---- Unified state handler -- indicators + visibility for ALL members ----

VibeLive.on('memberStateChange', (id, state) => {
    // state = { status: 'LIVE'|'PRE-LIVE'|'EXITED', live: boolean, video, audio, screenVideo }
    const camTile = `tile-${id}-camera`;

    // Camera indicators
    setIndicator(camTile, 'live', state.live);
    setIndicator(camTile, 'vid', state.video === 'ON');
    setIndicator(camTile, 'aud', state.audio === 'ON');

    // Camera placeholder <-> video visibility
    updateTileVisibility(camTile, state.video === 'ON');

    // Screenshare tile show/hide
    const screenTile = document.getElementById(`tile-${id}-screenshare`);
    if (screenTile) {
        screenTile.style.display = state.screenVideo !== 'OFF' ? 'block' : 'none';
        screenTile.querySelector('.placeholder')?.classList.toggle('hidden', state.screenVideo !== 'OFF');
        screenTile.querySelector('video')?.classList.toggle('visible', state.screenVideo !== 'OFF');
    }
});

VibeLive.on('remoteJoined', (id) => {
    const m = VibeLive.getMember(id);
    createTile(id, m?.displayName || 'Remote', 'camera', false);
});

VibeLive.on('remoteStreamStart', (id, type) => {
    const m = VibeLive.getMember(id);
    createTile(id, m?.displayName || 'Remote', type, false);
    // registerTile (inside createTile) handles video element registration.
    // memberStateChange handles indicators. Nothing else needed.
});

// remoteStreamEnd: screenshare tiles auto-removed by SDK (registered tile).
// remoteLeft: tiles auto-removed by SDK when member exits (registered tiles).

VibeLive.on('kicked', (message) => {
    alert(message || 'You have been removed from this room.');
    VibeLive.exitRoom();  // SDK auto-removes all registered tiles
    document.getElementById('controls').style.display = 'none';
    document.getElementById('entry').style.display = 'block';
});

VibeLive.on('error', (context, error) => {
    console.error(`[${context}]`, error.code || '', error.message);
});

VibeLive.on('warning', (context, message) => {
    console.warn(`[${context}]`, message);
});

// ---- Entry Actions ----

window.join = async function() {
    const name = document.getElementById('nameInput').value.trim() || 'Guest';
    const code = document.getElementById('codeInput').value.trim();
    if (!code) return alert('Enter a room code');
    await VibeLive.signup(name);
    await VibeLive.enterByRoomCode(code);
};

window.createRoom = async function() {
    const name = document.getElementById('nameInput').value.trim() || 'Guest';
    await VibeLive.signup(name);
    const room = await VibeLive.createRoom('My Room');
    document.getElementById('roomInfo').textContent = `Room code: ${room.room_code}`;
    await VibeLive.enterByRoomCode(room.room_code);
};
</script>
</body></html>
```

## API Reference

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `init(config)` | `VibeLive` | Initialize. `config`: `{ projectId, proxy?, projectKey?, serverUrl? }` |
| `signup(name)` | `Promise` | Anonymous signup. Must `await`. |
| `login(email, password, projectId?)` | `Promise` | Login with credentials. |
| `logout()` | `Promise` | Logout and cleanup. |
| `createRoom(title, options?)` | `Promise<{ id, room_code, title }>` | Create a room. |
| `enterByRoomCode(code, displayName?)` | `Promise` | Enter room -> PRE-LIVE. |
| `exitRoom()` | `void` | Leave room. Releases media. |
| `selectChannel(channelId, displayName?)` | `Promise` | Enter by channel ID -> PRE-LIVE. |
| `loadChannels()` | `Promise` | Load channel list (login flow). |
| `loadUsers()` | `Promise` | Load user list (login flow). |
| `selectUser(userId)` | `Promise` | Quick-chat with user -> PRE-LIVE. |
| `getChannelInfo(roomCode)` | `Promise<Object>` | Look up channel info without joining. |
| `backToList()` | `void` | Return to channel list (cleanup). |
| `startLive()` | `Promise` | Connect WebRTC -> LIVE. |
| `stopLive(keepMedia?)` | `void` | Disconnect WebRTC -> PRE-LIVE. `keepMedia` default `true`. |
| `setVideo(on)` | `Promise` | Set camera on/off. Idempotent. |
| `setAudio(on)` | `Promise` | Set microphone on/off. Idempotent. |
| `setScreenshare(on)` | `Promise` | Set screenshare on/off. Idempotent. |
| `setVideoMuted(muted)` | `Promise` | Hide/show video (track stays alive). Idempotent. |
| `setAudioMuted(muted)` | `Promise` | Mute/unmute audio (track stays alive). Idempotent. |
| `setScreenshareMuted(muted)` | `Promise` | Hide/show screenshare (track stays alive). Idempotent. |
| `registerTile(memberId, streamType, element)` | `void` | **Recommended.** Register a tile DOM element. Auto-finds `<video>` inside and registers it. SDK auto-removes on member exit, screenshare end, room exit, or kick. |
| `unregisterTile(memberId, streamType)` | `void` | Manually unregister + remove a tile. Rarely needed -- SDK handles cleanup automatically. |
| `setLocalCamera(videoEl)` | `void` | Register local camera `<video>`. Not needed when using `registerTile()`. |
| `setLocalScreen(videoEl)` | `void` | Register local screenshare `<video>`. Not needed when using `registerTile()`. |
| `setRemoteCamera(memberId, videoEl)` | `void` | Register remote camera `<video>`. Not needed when using `registerTile()`. |
| `setRemoteScreen(memberId, videoEl)` | `void` | Register remote screenshare `<video>`. Not needed when using `registerTile()`. |
| `clearLocalCamera()` | `void` | Unregister local camera element. Not needed when using `registerTile()`. |
| `clearLocalScreen()` | `void` | Unregister local screenshare element. Not needed when using `registerTile()`. |
| `clearRemoteCamera(memberId)` | `void` | Unregister remote camera element. Not needed when using `registerTile()`. |
| `clearRemoteScreen(memberId)` | `void` | Unregister remote screenshare element. Not needed when using `registerTile()`. |
| `getMember(memberId)` | `Object \| null` | `{ displayName, displayStatus, hasCamera, hasScreenshare }` |
| `getMemberIds()` | `string[]` | All member IDs in current channel. |
| `getMembers()` | `Promise<Array>` | Fetch all members: `[{ id, displayName, baseStatus, displayStatus }]` |
| `getMediaStates(memberId)` | `Object` | See State Getters below. |
| `getMemberState(memberId)` | `Object` | **Unified state triple** -- works for local AND remote. See State Getters below. |
| `getStream(memberId, streamType)` | `MediaStream \| null` | Raw stream. `streamType`: `'camera'` or `'screenshare'`. |
| `on(event, callback)` | `VibeLive` | Register event handler. Chainable. |
| `createInstance(config)` | `Object` | Create an independent VibeLive instance for multi-room. Same API as the singleton. See "Singleton vs. Multiple Instances" above. |

### State Getters

| Getter | Returns | Notes |
|--------|---------|-------|
| `VibeLive.isLoggedIn` | `boolean` | Authenticated? |
| `VibeLive.isLive` | `boolean` | WebRTC connected? |
| `VibeLive.user` | `Object \| null` | Raw auth user (`username`, NOT `displayName`). |
| `VibeLive.memberId` | `string \| null` | Your member ID in current room. |
| `VibeLive.roomCode` | `string \| null` | Current room's shareable code. |
| `VibeLive.channel` | `Object \| null` | Current channel object. |
| `VibeLive.channels` | `Array` | Loaded channels (login flow). |
| `VibeLive.hasMedia` | `boolean` | Any local media active? |
| `VibeLive.mediaState` | see below | Local camera/mic state. |
| `VibeLive.screenState` | see below | Local screenshare state. |

**`VibeLive.mediaState`** -- local camera/mic:
```json
{ "audio": true, "video": true, "audioMuted": false, "videoMuted": false,
  "audioDetail": "ON", "videoDetail": "ON" }
```

**`VibeLive.screenState`** -- local screenshare:
```json
{ "audio": false, "video": true, "videoMuted": false, "videoDetail": "ON" }
```

**`VibeLive.getMemberState(memberId)`** -- unified state for any member (local or remote, same shape):
```json
{ "status": "LIVE", "live": true, "video": "ON", "audio": "MUTED", "screenVideo": "OFF" }
```
`status` is `'LIVE'`, `'PRE-LIVE'`, or `'EXITED'`. `live` is a convenience boolean (`status === 'LIVE'`).

**`VibeLive.getMediaStates(memberId)`** -- remote member (same `detail` field names):
```json
{ "audioDetail": "ON", "videoDetail": "MUTED", "screenAudioDetail": "OFF", "screenVideoDetail": "ON" }
```

**Detail values**: `'ON'` (active), `'MUTED'` (track alive but muted/hidden), `'OFF'` (no track).

**IMPORTANT**: Use `.videoDetail` / `.audioDetail` for UI state, not `.video` / `.audio`. The booleans mean "track exists" and stay `true` when muted.

### Events

Register with `VibeLive.on(event, callback)`.

| Event | Callback signature | When it fires |
|-------|-------------------|---------------|
| `login` | `(user)` | Signup or login succeeded. |
| `loginError` | `(error)` | Signup or login failed. |
| `logout` | `()` | Logged out. |
| `channelsLoaded` | `(channels)` | `loadChannels()` completed. |
| `usersLoaded` | `(users)` | `loadUsers()` completed. |
| `channelSelected` | `(channel)` | Entered a room (PRE-LIVE). Create your local tiles here. |
| `localJoined` | `()` | You went LIVE (`startLive()` completed). |
| `localLeft` | `()` | You returned to PRE-LIVE (`stopLive()` or disconnected). |
| `memberStateChange` | `(memberId, state)` | **Any member's state changed.** `state`: `{ status, live, video, audio, screenVideo }` where `status` is `'LIVE'\|'PRE-LIVE'\|'EXITED'`, `live` is a boolean, and video/audio/screenVideo are `'ON'\|'MUTED'\|'OFF'`. Fires for local AND remote. Use this for all indicators + visibility. |
| `localLiveChange` | `(isLive: boolean)` | Your live status changed. Use for LIVE indicator. |
| `localMediaChange` | `()` | Your camera/mic/screen state changed. Read `VibeLive.mediaState` / `VibeLive.screenState`. |
| `remoteJoined` | `(memberId)` | Remote member connected to WebRTC (fires once per session). |
| `remoteLeft` | `(memberId)` | Remote member stopped streaming. Check `getMember(id).displayStatus` -- may be `'EXITED'` or `'PRE-LIVE'`. |
| `remoteStreamStart` | `(memberId, streamType)` | Remote stream arrived. `streamType`: `'camera'` or `'screenshare'`. Create tile + call `registerTile()` here. |
| `remoteStreamEnd` | `(memberId, streamType)` | Remote stream ended. Screenshare tiles auto-removed if registered. Only needed for custom cleanup UI. |
| `remoteLiveChange` | `(memberId, isLive)` | Remote member's live status changed (camera stream started/ended). |
| `remoteMediaChange` | `(memberId, streamType)` | Remote member's video/audio state changed (mute, unmute, video off/on). **Also needed for placeholder toggling** -- not just indicators. |
| `memberUpdate` | `(memberId)` | Member info/status updated in database. |
| `kicked` | `(message)` | You were removed from the room by the server. |
| `error` | `(context, error)` | Async error. `error` is `MakedoError` with `.code`, `.hint`, `.retriable`. |
| `warning` | `(context, message)` | Non-fatal warning (e.g. element registered after stream started). |

### Error Codes

Access via `VibeLive.ErrorCodes`. Errors are `MakedoError` instances with `.code`, `.message`, `.hint`, `.retriable`, `.context`.

| Code | Category | Retriable |
|------|----------|-----------|
| `INIT_REQUIRED` | Init | No |
| `INIT_INVALID_CONFIG` | Init | No |
| `AUTH_FAILED` | Auth | No |
| `AUTH_SESSION_EXPIRED` | Auth | Yes |
| `AUTH_TOKEN_REFRESH_FAILED` | Auth | Yes |
| `AUTH_PROXY_FAILED` | Auth | No |
| `AUTH_FORBIDDEN` | Auth | No |
| `MEDIA_PERMISSION_DENIED` | Media | No |
| `MEDIA_DEVICE_BUSY` | Media | Yes |
| `MEDIA_NOT_FOUND` | Media | No |
| `MEDIA_OVERCONSTRAINED` | Media | Yes |
| `MEDIA_TRACK_REPLACE_FAILED` | Media | Yes |
| `MEDIA_TRACK_ENDED` | Media | Yes |
| `MEDIA_UNKNOWN` | Media | No |
| `SCREENSHARE_PERMISSION_DENIED` | Screenshare | No |
| `SCREENSHARE_UNSUPPORTED` | Screenshare | No |
| `SCREENSHARE_CANCELLED` | Screenshare | No |
| `SCREENSHARE_UNKNOWN` | Screenshare | No |
| `ROOM_NOT_FOUND` | Room | No |
| `ROOM_JOIN_FAILED` | Room | Yes |
| `ROOM_KICKED` | Room | No |
| `ROOM_SFU_UNREACHABLE` | Room | Yes |
| `NETWORK_HTTP_ERROR` | Network | Yes |
| `NETWORK_TIMEOUT` | Network | Yes |
| `NETWORK_OFFLINE` | Network | Yes |
| `NETWORK_WS_AUTH_FAILED` | Network | No |
| `NETWORK_WS_DISCONNECTED` | Network | Yes |
| `STATE_NOT_LOGGED_IN` | State | No |
| `STATE_NOT_IN_ROOM` | State | No |
| `STATE_ALREADY_LIVE` | State | No |
| `STATE_NO_ELEMENT` | State | No |

## Pitfalls

1. **`VibeLive.user` has no `displayName`** -- it's the raw auth object. Use `getMembers()` for display names.
2. **`.audio` stays `true` when muted** -- use `.audioDetail === 'ON'` instead of `.audio`.
3. **Creating `<video>` elements in `localMediaChange`** -- too late. The stream is already produced. Create tiles in `channelSelected`.
4. **`remoteStreamStart` signature is `(memberId, streamType)`** -- two arguments, no stream object. Create tile + call `registerTile()` -- the SDK attaches streams automatically.
5. **`.hidden` CSS specificity** -- if your `.hidden` class uses `display: none` and a component class sets `display: flex`, the component wins. Use `!important` on `.hidden` or higher specificity.
6. **`setVideo(on)` vs `setVideoMuted(muted)`** -- `setVideo(false)` turns hardware off (`.videoDetail`: `'OFF'`). `setVideoMuted(true)` keeps capturing but hides (`.videoDetail`: `'MUTED'`). Same pattern for audio: `setAudio(false)` vs `setAudioMuted(true)`.
7. **Screenshare tiles must start hidden** -- set `display: none` initially. `memberStateChange` shows them when `screenVideo !== 'OFF'`.
8. **Do NOT manually remove registered tiles** -- calling `.remove()` on a tile you passed to `registerTile()` bypasses SDK cleanup. Use `unregisterTile()` if you need manual removal, or let the SDK handle it automatically.

## React Integration

React requires different patterns from the vanilla example above. The API is identical -- only the wiring differs.

### Key Differences from Vanilla

- **Init once** in a top-level module or context provider, not inside a component.
- **`useRef`** for `<video>` elements -- React controls the DOM, so no `document.getElementById`.
- **`useEffect` with cleanup** for event wiring -- return a teardown function that calls `exitRoom()`.
- **Do NOT use `registerTile()`** -- it calls `element.remove()` on cleanup, which fights React's reconciler. Use `setLocalCamera`/`setRemoteCamera` directly with refs instead.
- **Read state via SDK getters** in event callbacks, then push into React state with `setState`.

### Complete React Example

```jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import VibeLive from 'https://makedo.com/sdk/makedo-vibelive.esm.js';

VibeLive.init({ projectId: 'YOUR_TRIAL_PROJECT_ID' });

function VideoTile({ memberId, streamType, name, isLocal }) {
    const videoRef = useRef(null);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        if (isLocal) {
            if (streamType === 'camera') VibeLive.setLocalCamera(el);
            else VibeLive.setLocalScreen(el);
        } else {
            if (streamType === 'camera') VibeLive.setRemoteCamera(memberId, el);
            else VibeLive.setRemoteScreen(memberId, el);
        }
        return () => {
            if (isLocal) {
                if (streamType === 'camera') VibeLive.clearLocalCamera();
                else VibeLive.clearLocalScreen();
            } else {
                if (streamType === 'camera') VibeLive.clearRemoteCamera(memberId);
                else VibeLive.clearRemoteScreen(memberId);
            }
        };
    }, [memberId, streamType, isLocal]);

    return (
        <div style={{ position: 'relative', width: 320, height: 240, background: '#111' }}>
            <video ref={videoRef} autoPlay playsInline muted={isLocal || streamType === 'screenshare'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <span style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 11, background: '#000a', padding: '2px 6px', color: '#fff' }}>
                {streamType === 'screenshare' ? `${name} (Screen)` : name}
            </span>
        </div>
    );
}

export default function MeetingRoom() {
    const [inRoom, setInRoom] = useState(false);
    const [isLive, setIsLive] = useState(false);
    const [tiles, setTiles] = useState([]);       // [{ id, name, type, isLocal }]
    const [members, setMembers] = useState([]);    // [{ id, name, status }]
    const nameRef = useRef('');
    const codeRef = useRef('');

    // Helper: update one member in the members list
    const updateMember = useCallback((id, status) => {
        const m = VibeLive.getMember(id);
        const name = m?.displayName || 'Unknown';
        setMembers(prev => {
            if (status === 'EXITED') return prev.filter(x => x.id !== id);
            const idx = prev.findIndex(x => x.id === id);
            const entry = { id, name, status };
            if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next; }
            return [...prev, entry];
        });
    }, []);

    // Helper: add a tile if not already present
    const addTile = useCallback((id, name, type, isLocal) => {
        setTiles(prev => {
            if (prev.some(t => t.id === id && t.type === type)) return prev;
            return [...prev, { id, name, type, isLocal }];
        });
    }, []);

    // Helper: remove tiles for a member
    const removeTiles = useCallback((id) => {
        setTiles(prev => prev.filter(t => t.id !== id));
    }, []);

    useEffect(() => {
        VibeLive.on('channelSelected', async () => {
            setInRoom(true);
            const list = await VibeLive.getMembers();
            const self = list.find(m => m.id === VibeLive.memberId);
            addTile(VibeLive.memberId, self?.displayName || 'You', 'camera', true);
            setMembers(list.map(m => ({ id: m.id, name: m.displayName, status: m.displayStatus })));
        });
        VibeLive.on('localJoined', () => setIsLive(true));
        VibeLive.on('localLeft', () => setIsLive(false));
        VibeLive.on('memberStateChange', (id, state) => updateMember(id, state.status));
        VibeLive.on('remoteStreamStart', (id, type) => {
            const m = VibeLive.getMember(id);
            addTile(id, m?.displayName || 'Remote', type, false);
        });
        VibeLive.on('remoteLeft', (id) => removeTiles(id));
        VibeLive.on('error', (ctx, err) => console.error(`[${ctx}]`, err.message));
        return () => { VibeLive.exitRoom(); };
    }, [addTile, removeTiles, updateMember]);

    const join = async () => {
        await VibeLive.signup(nameRef.current || 'Guest');
        await VibeLive.enterByRoomCode(codeRef.current);
    };

    if (!inRoom) {
        return (
            <div>
                <input placeholder="Name" onChange={e => nameRef.current = e.target.value} />
                <input placeholder="Room code" onChange={e => codeRef.current = e.target.value} />
                <button onClick={join}>Join</button>
            </div>
        );
    }

    return (
        <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {members.filter(m => m.status !== 'EXITED').map(m => (
                    <span key={m.id} style={{ padding: '4px 8px', border: '1px solid',
                        borderColor: m.status === 'LIVE' ? '#0f0' : '#ff0',
                        color: m.status === 'LIVE' ? '#0f0' : '#ff0', fontSize: 11 }}>
                        {m.name}
                    </span>
                ))}
            </div>
            <div>
                <button onClick={() => VibeLive.startLive()} disabled={isLive}>Go Live</button>
                <button onClick={() => VibeLive.stopLive()} disabled={!isLive}>Stop</button>
                <button onClick={() => VibeLive.setVideo(!VibeLive.mediaState.video)}>Cam</button>
                <button onClick={() => VibeLive.setAudio(!VibeLive.mediaState.audio)}>Mic</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {tiles.map(t => (
                    <VideoTile key={`${t.id}-${t.type}`} memberId={t.id}
                        streamType={t.type} name={t.name} isLocal={t.isLocal} />
                ))}
            </div>
        </div>
    );
}
```

### React Pitfalls

1. **Do NOT use `registerTile()`** in React -- the SDK's DOM removal conflicts with React's virtual DOM. Use `setLocalCamera`/`setRemoteCamera` with refs and manage tile visibility via React state.
2. **Do NOT call `VibeLive.init()` inside a component** -- it runs on every render. Call it once at module scope or in a context provider.
3. **Always return a cleanup function** from `useEffect` that calls `exitRoom()` -- otherwise hot-reload or unmount leaks the WebRTC connection.
4. **Use `useRef` for input values** in join forms -- `useState` causes re-renders on every keystroke which can interfere with SDK callbacks firing mid-render.

### Multi-Room in React

Use `createInstance()` per component. Each instance is independent:

```jsx
function MeetingPanel({ roomCode }) {
    const vl = useRef(null);
    if (!vl.current) vl.current = VibeLive.createInstance({ projectId: 'YOUR_TRIAL_PROJECT_ID' });

    useEffect(() => {
        const inst = vl.current;
        inst.on('channelSelected', () => { /* ... */ });
        inst.on('memberStateChange', (id, state) => { /* ... */ });
        inst.signup('Observer').then(() => inst.enterByRoomCode(roomCode));
        return () => { inst.exitRoom(); };
    }, [roomCode]);

    // ... render using vl.current instead of VibeLive
}

// Usage: three independent meeting panels
<MeetingPanel roomCode="ABC123" />
<MeetingPanel roomCode="DEF456" />
<MeetingPanel roomCode="GHI789" />
```

---

# Design Guide v2.4

---

## Authority & Scope

This section defines **visual, interaction, and layout rules** for VibeLive-based apps.

### Authority Rule (Important)

When behavior or lifecycle rules conflict:

- **API Guide** defines system behavior and lifecycle semantics
- **Design Guide** (this section) defines visual presentation and interaction rules

Design Guide must not override VibeLive lifecycle behavior. For visual conflicts, the Design Guide wins.

---

## Lifecycle Model (Authoritative)

This guide follows the VibeLive lifecycle exactly:

```
PRE-LIVE → LIVE → PRE-LIVE / EXIT
```

### State Definitions

- **PRE-LIVE**
  - User is inside the room context
  - Camera and mic preview may be active
  - WebRTC is NOT connected
  - No media is transmitted

- **LIVE**
  - WebRTC is connected
  - Media is actively transmitted

- **EXIT**
  - User has fully left the room
  - Camera and mic are released
  - Tiles must be destroyed

> PRE-LIVE is NOT a lobby and NOT a partial join.

---

## Core Design Philosophy

1. **Good defaults beat configuration** — if the user does nothing, the UI should still feel right.
2. **Visual fairness** — participants are equal unless explicitly designed otherwise.
3. **Space-aware layouts** — no cramped or floating tiles.
4. **Mobile-first, desktop-enhanced** — vertical clarity first, spatial balance later.
5. **Neutral first, accent second** — accents communicate meaning, not decoration.
6. **No emoji** — use inline SVG icons exclusively. Emoji are platform-inconsistent and not styleable.

---

## Color Theme & Tokens (Default: VibeLive Teal)

Default theme used unless overridden by product-specific theming.

- Accent: `#0EA5A4`
- Radius: `16px`
- Max content width: `980px`
- Font stack: `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`

### Canonical CSS Variables

```css
:root {
  --radius: 16px;
  --max: 980px;
  --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;

  --bg: #f7f9f8;
  --card: #ffffff;
  --soft: #f0f4f3;
  --border: #e2e8f0;
  --borderSoft: #dbe2ea;

  --text: #1e293b;
  --muted: #64748b;
  --muted2: #9ca3af;

  --accent: #0EA5A4;
  --accentHover: #0d9488;
  --accentSoft: rgba(14,165,164,.10);
  --accentBorder: rgba(14,165,164,.35);

  --liveBg: #e8f4ed;
  --liveBorder: #a6c5a3;
  --liveText: #324252;

  --disabledBg: #f3f4f6;
  --disabledBorder: #e5e7eb;
  --disabledText: #6b7280;

  --dangerBg: #FEF2F2;
  --dangerBorder: #fca5a5;
  --dangerText: #b91c1c;

  --overlay: rgba(30, 41, 59, 0.5);
}
```

---

## Entry Flow

### Entry Screen (Required)

Use **two separated cards**:

#### Card Structure

```
┌─────────────────────────────┐
│  Name Card                  │
│  ┌───────────────────────┐  │
│  │ Your name             │  │
│  │ [___________________] │  │
│  └───────────────────────┘  │
└─────────────────────────────┘

┌─────────────────────────────┐
│  Action Card                │
│                             │
│  [ + Start a Room ] (primary)│
│                             │
│  ────────── OR ──────────   │
│                             │
│  Join with room code        │
│  [_________] [ Join ]       │
│                             │
└─────────────────────────────┘
```

- **Name card**: Label + text input (max 24 chars), **autofocus on load** — typing your name is the default CTA
- **Action card**: Primary CTA, OR divider, then room code input + Join button side by side
- Both actions are **always visible** — no hiding/showing based on code input
- **Join row layout**: Room code input takes **75%**, Join button takes **25%** (`flex: 0 0 25%`)

#### Disabled Button Styling

- Disabled buttons appear at **full opacity** — no dimming, no grey overrides
- Only `cursor: not-allowed` is applied to indicate the disabled state
- Buttons retain their full color identity (accent for primary, soft for secondary) at all times
- This ensures the visual hierarchy and color cues are clear even before the user has typed a name

#### Name Validation Hint

- When a user clicks a disabled button without entering a name, show a **hint message** below the name input: "Please enter your name first"
- The hint uses `--dangerText` color and fades in/out
- The name input is auto-focused so the user can immediately start typing
- The hint disappears after 3 seconds or when the user starts typing

#### Button Loading Behavior

- **"Start a Room"** → shows spinner + "Creating..." while connecting (indicates room creation in progress)
- **"Join"** → label stays as **"Join"** while connecting (button is disabled only, no text change)

#### Dynamic Button Priority

- **No room code entered** → "Start a Room" = primary (accent color), "Join" = secondary
- **Room code entered** → "Join" = primary (accent color), "Start a Room" = secondary
- This guides users naturally toward the most relevant action

#### URL Deep Linking (`?code=`)

- Auto-fill room code from URL parameter
- Triggers dynamic priority swap → "Join" becomes primary

#### Shareable Invite Link

- Copy/share actions must produce a full URL with `?code=<roomCode>`, not the raw code alone
- This ensures recipients land directly into the join flow via deep linking

---

## Pre-Live Setup Screen (PRE-LIVE)

Purpose:
- Camera preview
- Mic / camera toggles
- Readiness confirmation

Rules:
- **Same topbar as live screen** — app name (left), room code + copy-code + copy-link buttons (right)
- Content below topbar is **vertically and horizontally centered**
- Camera preview uses **~70% of available space** — balanced size that avoids feeling cramped or overwhelming (e.g. use `min(70%, calc((100vh - offset) * 16/9 * 0.7))`)
- The content wrapper must use `align-self: stretch` so percentage-based widths resolve against the full viewport width
- Controls below preview
- **Go Live / Enter Room** is primary CTA, placed in an action row below controls
- **Back button** sits alongside "Go Live" in the same row — secondary styling (soft background, border), navigates back to the entry screen, exits the channel, and releases camera/mic preview
- No other participants visible
- Camera off → initials placeholder (stable tile size)
- **No drag/resize handles** — tile interaction controls (drag handle, resize handle) are hidden in pre-live; they only appear on live room tiles
- **Element-First Rule**: Both camera and screenshare tiles must be created and registered here (screenshare tile starts hidden with `display: none`). This ensures video elements exist before streams are produced.

---

## Video Tile Rules (Unified)

### Tile Anatomy (Camera Tiles)

Each **camera tile** contains:
- Video OR initials placeholder
- Name label (bottom-left) — local user shows **"Name (You)"** (e.g. "April (You)"), remote users show their display name
- Camera + mic indicators (**always visible**)
- **LIVE status badge** — shown on all tiles (local and remote) when the participant is live. Uses `--liveBg` / `--liveText` styling. Badge is hidden when the participant is not live.

Tiles never contain controls.

> **Screen share tiles** are an exception — they show a name label and LIVE badge, but no mic/camera indicators. See [Screen Share Tile Semantics](#screen-share-tile-semantics).

### Initials Placeholder

When camera is off, show initials inside the placeholder:
- **Single name** (e.g. "April") → first letter only → **A**
- **Two or more names** (e.g. "April Kim") → first letter of first + last name → **AK**
- Empty/missing name → **?**

### Tile Sizing (Non-Negotiable)

- Size must be independent of camera state
- Use `::before` spacer (`padding-top: 56.25%`)
- Video and placeholder are absolute overlays
- **Hide browser-native video controls** — Chrome and Safari show play/pause overlays on `<video>` elements on hover. Suppress with `::-webkit-media-controls` pseudo-elements set to `display: none !important`

### Grid Containers

Two separate containers are required:
- **`#cameraGrid`** — for camera tiles
- **`#screenshareGrid`** — for screenshare tiles (positioned above camera grid)

This keeps them independently styled and positioned — screenshare tiles are typically larger, full-width, or in a separate layout area.

### Media Indicators

- Default state: cam OFF, mic OFF
- Icons required (no color-only meaning)
- **No emoji characters** — all icons must be inline SVG or icon font. Emoji rendering is inconsistent across platforms and does not meet design quality standards.

Indicator visibility must be **immediately obvious** at any tile size:
- ON → `--accent` icon color + accent-tinted background pill (`rgba(accent, .25)`)
- OFF → `--dangerText` icon color + danger-tinted background pill (`rgba(danger, .25)`)
- **On video tiles** (inside `.member-info`): indicators use **higher opacity backgrounds** (`rgba(accent, .7)` / `rgba(danger, .7)`) with white icon color to ensure visibility against any video content
- Do NOT rely on opacity alone to distinguish states — opacity differences are too subtle on dark backgrounds and at small sizes

---

## Tile Lifecycle Rules

- Create tile on room entry or member visibility
- **Remote tiles appear when the participant is LIVE or PRE-LIVE** — both active and pre-live members are visible to others
- **Do NOT remove camera tiles** on LIVE → PRE-LIVE — they may rejoin
- **Screenshare tiles are ephemeral** — remove entirely when sharing stops (`remoteStreamEnd` for screenshare)
- Remove camera tiles only when `displayStatus === 'EXITED'`

---

## Screen Share (Presentation Mode)

### Screen Share Priority

- Multiple participants may share their screen simultaneously
- All active screen shares are displayed **side by side** in the screenshare area
- On mobile (narrow viewports), multiple screenshares **stack vertically**
- Screen shares always occupy the primary visual surface above camera tiles

### Screen Share Layout Rules

- Each screen share creates a **separate tile** inside a shared `#screenshareGrid` container
- Camera tiles always remain visible in the strip below
- Screen share tiles divide the available area equally (flexbox `flex: 1`)
- Each screen share must preserve its native aspect ratio
- Letterboxing is preferred over cropping
- Screen share tiles must never be visually smaller than participant camera tiles

### Participant Camera Strip

- Participant camera tiles are placed in a horizontal strip
- Default position: bottom
- Tiles are equal size
- Strip must not obscure critical screen content
- Strip may scroll horizontally if space is limited

### Screen Share Tile Semantics

- Screen share tiles:
  - Show a **name label** identifying whose screen is being shared (e.g. "April's Screen", "Your Screen")
  - Show **LIVE badge** (same styling as camera tiles)
  - Do NOT show mic/camera indicators
- Local user sees **"Your Screen"**; remote users see **"Name's Screen"**
- Screen share is content with ownership attribution

### Screen Share Transitions

- Entering or exiting screen share must use a smooth layout transition
- Avoid sudden jumps or full reflow
- Participant tile positions should remain stable where possible

Known SDK limitation: local self screenshare preview may appear black.

---

## Tile Layout Decision Model (Authoritative)

Tile layout selection must follow these steps **in order**.
Do not jump directly from tile count to grid.

### Step 1: Determine Context

Inputs:
- Visible tile count (exclude hidden / `display: none` tiles)
- Viewport width, height, and aspect ratio
- Screen type: desktop or mobile

### Step 2: Preserve Aspect Ratio (Hard Rule)

- All tiles must preserve **16:9**
- Cropping is allowed only as a last resort
- Letterboxing is preferred over distortion
- **Distortion is never allowed**

### Step 3: Choose Row-Based Layout First

Before using multi-row grids, attempt:
- Single-row layouts for 1–3 participants (desktop)
- Balanced row splits for odd counts (e.g. 3+2, 4+3)

### Step 4: Center the Group

- The entire tile group must be **visually centered**
- Empty space must be distributed symmetrically
- No top-left anchoring

### Step 5: Expand to Grid Only When Necessary

Use multi-row grids only when:
- A single row would reduce tiles below a comfortable size
- Or the viewport aspect ratio makes rows impractical

Tiles must always attempt to maximize usable screen space **without violating aspect ratio or visual balance**.

A layout that fills more space but feels cramped or uneven is considered incorrect.

### Space-Maximizing Principle

Single-participant and pre-live tiles must **fill the available viewport**, not use small fixed widths. Size the tile based on viewport height to maintain 16:9 without overflow:

```css
/* Example: solo tile fills available space */
width: min(100%, calc((100vh - chrome_offset) * 16 / 9));
```

Where `chrome_offset` accounts for topbar, controls bar, and padding. This ensures the tile is as large as possible regardless of screen size, and adapts correctly when the window resizes.

### Preferred Desktop Row Patterns

| Tile Count | Preferred Layout |
|-----------:|------------------|
| 1 | Single tile, centered |
| 2 | 1 row x 2 |
| 3 | 1 row x 3 (fallback: 2 + 1 centered) |
| 4 | 2 x 2 |
| 5 | 3 + 2 (centered) |
| 6 | 3 x 2 |
| 7 | 4 + 3 |
| 8 | 4 x 2 |

Notes:
- Row splits must be centered as a group
- Avoid single orphan tiles on their own row

### Three-Participant Layout Rule

Default behavior (desktop):
- Use a single-row layout (1 x 3)
- All tiles equal size
- Group centered

Fallback behavior:
- A 2 + 1 layout is permitted only when a single-row layout would reduce tiles below minimum readable size
- Fallback must preserve visual balance and must not imply hierarchy
- The single tile must be horizontally centered beneath the top row

### Mobile (<=640px)

- 2–3: vertical stack
- 4+: 2-column grid
- Remove column spanning

### Tile Layout Anti-Patterns (Do Not Implement)

- Jumping layout when a participant toggles camera
- Reordering tiles based on audio level
- Host tiles being larger by default
- Left-aligned grids with empty trailing space
- Shrinking all tiles to fit a new participant instantly

When implementing tile layout logic, **prioritize visual balance over mathematical simplicity**.

---

## Topbar (Consistent Across Screens)

PRE-LIVE and LIVE screens must share an **identical topbar**:

- **Left**: App name (e.g. "TinyRoom")
- **Right**: Room code (monospace, accent-colored pill) + copy-code button + copy-link button

This gives users persistent access to sharing tools and maintains visual continuity across state transitions. The topbar sits at the top edge, outside the centered content area.

### Copy Button Feedback

- When a copy button (copy-code or copy-link) is clicked, a **"Copied!" tooltip** appears directly below the button
- The tooltip fades in, stays for 1.5 seconds, then fades out
- Styled with inverted colors (`--text` background, `--bg` text) for contrast against the topbar
- No toast notification — feedback is localized to the button itself

---

## Controls Placement

Primary controls:
- Mic
- Camera
- Leave room

Secondary:
- Screen share
- Settings

Placement:
- Desktop: bottom center bar
- Mobile: floating bottom bar

Leave button must be visually separated (danger affordance).

### Leave Room Behavior

When the user leaves a room:
- Return to the **entry screen** (create/join), NOT the pre-live screen
- All video tiles must be destroyed
- Camera and mic preview must be released
- Room state is fully reset — the user can start or join a new room immediately

---

## Session-Ended Modal (Kicked)

When the server ends a meeting (e.g. trial time limit), the app must show a **styled modal** — never a native browser `alert()`.

### Modal Design

- **Overlay**: Full-screen fixed overlay using `--overlay` background, `z-index: 9999`
- **Card**: Centered, max-width `340px`, `90%` width, using `--card` background with `--radius` border-radius
- **Title**: "Session ended" — `14px`, `font-weight: 600`, `--text` color
- **Message**: Server-provided message or fallback text — `13px`, `--muted` color, `line-height: 1.5`, supports multi-line (`white-space: pre-line`)
- **Button**: Single "OK" button — `--accent` background, white text, `--radius` minus 6px border-radius, `font-weight: 600`
- **Shadow**: `0 8px 32px rgba(0,0,0,.18)`

### Reference HTML

```html
<!-- Kicked Modal -->
<div id="kickedOverlay" style="display:none; position:fixed; inset:0;
    background:var(--overlay); z-index:9999;
    align-items:center; justify-content:center;">
    <div style="background:var(--card); border-radius:16px;
        padding:28px 24px 20px; max-width:340px; width:90%;
        box-shadow:0 8px 32px rgba(0,0,0,.18); text-align:center;">
        <div style="font-size:14px; font-weight:600; color:var(--text);
            margin-bottom:16px;" id="kickedTitle">Session ended</div>
        <div style="font-size:13px; color:var(--muted); line-height:1.5;
            margin-bottom:24px; white-space:pre-line;"
            id="kickedMessage"></div>
        <button onclick="closeKickedModal()"
            style="background:var(--accent); color:#fff; border:none;
            border-radius:10px; padding:10px 32px; font-size:14px;
            font-weight:600; cursor:pointer;">OK</button>
    </div>
</div>
```

```javascript
// Show modal
function showKickedModal(message) {
    document.getElementById('kickedMessage').textContent =
        message || 'You have been removed from the meeting.';
    document.getElementById('kickedOverlay').style.display = 'flex';
}

// Dismiss modal
function closeKickedModal() {
    document.getElementById('kickedOverlay').style.display = 'none';
}
```

### Behavior

- Modal appears after all media cleanup is complete
- Dismissing returns to the entry screen
- All video tiles and preview must already be cleared before the modal appears

---

## Theme Mode: Light / Dark (User Choice)

Users must be able to choose between **Light mode** and **Dark mode**. The choice applies globally across entry, pre-live, and live room states.

### Principles

- **Dark mode is the default**
- Light mode is available as an equal, first-class option
- Mode switching must not affect layout, sizing, or behavior
- Only colors, shadows, and contrast change — **structure stays identical**

### Implementation Rules

- Use CSS variables for all colors (no hard-coded values)
- Theme switch is implemented by toggling a root attribute or class:
  - `data-theme="dark"` (default)
  - `data-theme="light"`
- All components must derive colors from semantic tokens (bg, card, text, accent, etc.)

### Dark Mode Token Guidance

Dark mode should:
- Reduce eye strain
- Preserve hierarchy and contrast
- Avoid pure black backgrounds

Recommended adjustments (example):

```css
[data-theme="dark"] {
  --bg: #0f172a;          /* deep slate */
  --card: #111827;        /* card surface */
  --soft: #1f2937;        /* subtle fill */
  --border: #273244;
  --borderSoft: #334155;

  --text: #e5e7eb;
  --muted: #9ca3af;
  --muted2: #6b7280;

  /* accent remains the same hue */
  --accent: #0EA5A4;
  --accentHover: #14b8a6;
  --accentSoft: rgba(14,165,164,.18);
  --accentBorder: rgba(14,165,164,.45);

  --liveBg: rgba(16,185,129,.15);
  --liveBorder: rgba(16,185,129,.4);
  --liveText: #a7f3d0;

  --dangerBg: rgba(239,68,68,.15);
  --dangerBorder: rgba(239,68,68,.4);
  --dangerText: #fca5a5;

  --overlay: rgba(0,0,0,0.6);
}
```

### UX Rules

- Theme choice must persist (localStorage or user preference)
- Theme toggle is placed in the **bottom-right corner** (fixed position, `z-index: 100`) — visible but unobtrusive across all screens
- Switching themes should be instant (no reload)
- Respect system preference on first visit (`prefers-color-scheme`)
- HTML root element must start with `data-theme="dark"` (dark is the default; JS upgrades to light if system preference or saved choice indicates light)

---

## Motion & Accessibility

Motion:
- Join / leave: soft scale + fade
- Layout reflow: smooth transitions
- Active speaker: subtle emphasis only

Accessibility:
- Never rely on color alone
- Respect reduced-motion
- Readable labels at small sizes
- Avoid flashing

---

## Design Summary

- API Guide controls behavior
- Design Guide controls UI
- PRE-LIVE ≠ EXIT
- Camera tiles persist across LIVE ⇄ PRE-LIVE; screenshare tiles removed on stream end
- Remote members visible in both LIVE and PRE-LIVE states
- Screen share tiles show name label and LIVE badge, but no mic/camera indicators
- Media indicators always visible
- Screen share = separate tile
- Session-ended modal = styled card, never native alert
- Calm, human-first design

---

# Error Handling Guide

**Error Guide v1.0**

Last updated: 2026-04-06

**Handle every SDK error gracefully — never show raw codes to users.**

## How Errors Work

The SDK fires a single `error` event for all async errors:

```js
VibeLive.on('error', (context, error) => {
    // context  — string: which SDK method failed (e.g. 'setVideo', 'joinChannel')
    // error    — MakedoError instance
    console.log(error.code);      // e.g. 'MEDIA_PERMISSION_DENIED'
    console.log(error.message);   // human-readable description
    console.log(error.hint);      // suggested fix (or null)
    console.log(error.retriable); // true, false, or null
    console.log(error.cause);     // original browser/network error (or null)
});
```

You can also check error codes programmatically:

```js
const { ErrorCodes } = VibeLive;

VibeLive.on('error', (context, error) => {
    if (error.code === ErrorCodes.MEDIA_PERMISSION_DENIED) {
        showPermissionDialog();
    }
});
```

## Error Code Reference

### Initialization (dev bugs — never show to users)

| Code | When It Fires | Retriable |
|------|--------------|-----------|
| `INIT_REQUIRED` | SDK method called before `VibeLive.init()` | No |
| `INIT_INVALID_CONFIG` | `init()` called with bad/missing config | No |

### Authentication

| Code | When It Fires | User Message | Retriable |
|------|--------------|-------------|-----------|
| `AUTH_FAILED` | Credentials rejected | "Login failed. Please check your credentials." | No |
| `AUTH_SESSION_EXPIRED` | Session timed out (401) | "Your session has expired. Please sign in again." | Yes |
| `AUTH_TOKEN_REFRESH_FAILED` | Background token refresh failed | "Connection issue. Please sign in again." | Yes |
| `AUTH_PROXY_FAILED` | Auth proxy endpoint error | Show generic "connection error" | No |
| `AUTH_FORBIDDEN` | Wrong projectId/key (403) | Show generic "unable to connect" | No |

### Media (Camera/Mic)

| Code | When It Fires | User Message | Retriable |
|------|--------------|-------------|-----------|
| `MEDIA_PERMISSION_DENIED` | User denied camera/mic | "Camera/mic access was blocked. Check your browser permissions." | No |
| `MEDIA_DEVICE_BUSY` | Camera locked by another app | "Your camera is being used by another app. Close it and try again." | Yes |
| `MEDIA_NOT_FOUND` | No camera or mic detected | "No camera or microphone found. Please connect a device." | No |
| `MEDIA_OVERCONSTRAINED` | Resolution not supported | "Your camera doesn't support the requested quality. Adjusting..." | Yes |
| `MEDIA_TRACK_REPLACE_FAILED` | Device hot-swap failed | "Couldn't switch devices. Try again." | Yes |
| `MEDIA_TRACK_ENDED` | Device unplugged or OS revoked | "Your camera/mic was disconnected." | Yes |
| `MEDIA_UNKNOWN` | Unrecognized media error | "Something went wrong with your camera. Try again." | — |

### Screenshare

| Code | When It Fires | User Message | Retriable |
|------|--------------|-------------|-----------|
| `SCREENSHARE_PERMISSION_DENIED` | OS denied screen share | "Screen sharing was blocked by your system settings." | No |
| `SCREENSHARE_UNSUPPORTED` | Browser lacks support | "Screen sharing isn't supported in this browser." | No |
| `SCREENSHARE_CANCELLED` | User clicked Cancel | **Do nothing.** Not an error. Revert button state. | — |
| `SCREENSHARE_UNKNOWN` | Unrecognized error | "Screen sharing failed. Try again." | — |

### Room / Channel

| Code | When It Fires | User Message | Retriable |
|------|--------------|-------------|-----------|
| `ROOM_NOT_FOUND` | Room doesn't exist or was deleted | "This room doesn't exist or has been removed." | No |
| `ROOM_JOIN_FAILED` | Couldn't join (capacity, server issue) | "Couldn't join the room. Please try again." | Yes |
| `ROOM_KICKED` | Host removed user from room | "You were removed from this room." | No |
| `ROOM_SFU_UNREACHABLE` | Video server not reachable | "Can't reach the video server. Check your connection." | Yes |

### Network

| Code | When It Fires | User Message | Retriable |
|------|--------------|-------------|-----------|
| `NETWORK_HTTP_ERROR` | API returned non-200 | "Something went wrong. Please try again." | Yes |
| `NETWORK_TIMEOUT` | API call timed out | "The request timed out. Check your connection." | Yes |
| `NETWORK_OFFLINE` | No network connection | "You're offline. Check your internet connection." | Yes |
| `NETWORK_WS_AUTH_FAILED` | WebSocket auth rejected | "Real-time connection failed. Please sign in again." | No |
| `NETWORK_WS_DISCONNECTED` | WebSocket dropped | "Connection lost. Reconnecting..." | Yes |

### State Guards (dev bugs — never show to users)

| Code | When It Fires | Retriable |
|------|--------------|-----------|
| `STATE_NOT_LOGGED_IN` | Method called before login | No |
| `STATE_NOT_IN_ROOM` | Media method called outside room | No |
| `STATE_ALREADY_LIVE` | `joinChannel()` called while already live | No |
| `STATE_NO_ELEMENT` | `setVideo(true)` but no tile registered | No |

## Error Object Shape

```
MakedoError {
  .code       — string: one of the codes above
  .message    — string: human-readable description
  .hint       — string|null: suggested resolution
  .retriable  — boolean|null: whether retry could work
  .context    — string|null: which SDK method failed
  .cause      — Error|null: original browser/network error
  .timestamp  — number: Date.now() when created
  .toString() — formatted diagnostic string
  .toJSON()   — plain object for logging
}
```

## Required Error Handler

Every VibeLive app must include this handler. Customize the `showToast` and `showAlert` functions for your UI:

```js
VibeLive.on('error', (context, error) => {
    const { code, message, hint, retriable } = error;

    // Dev bugs — log and fix, never show to users
    if (code.startsWith('INIT_') || code.startsWith('STATE_')) {
        console.error(`[DEV BUG] [${context}] ${code}: ${message}`);
        return;
    }

    // User cancelled screenshare — not an error
    if (code === 'SCREENSHARE_CANCELLED') return;

    // Kicked — special UX flow
    if (code === 'ROOM_KICKED') {
        showModal('You were removed from the room.');
        exitToEntry();
        return;
    }

    // Retriable — show dismissible toast with retry
    if (retriable) {
        console.warn(`[VibeLive] [${context}] ${code}: ${message}`, hint);
        showToast(message, { action: 'Retry' });
        return;
    }

    // Non-retriable — show persistent alert
    console.warn(`[VibeLive] [${context}] ${code}: ${message}`, hint);
    showAlert(message);
});
```

## What to Show vs. What to Log

**CRITICAL: Never display `error.code`, `error.context`, `error.hint`, `error.retriable`, or `error.cause` to users.** These fields are for developer debugging only.

| Field | Show to User? | Log to Console? |
|-------|:---:|:---:|
| Friendly message (from User Message column) | Yes | Yes |
| `error.code` | No | Yes |
| `error.context` | No | Yes |
| `error.hint` | No | Yes |
| `error.retriable` | No | Yes |
| `error.cause` | No | Yes |

**Correct:**
```js
// User sees: "You were removed from this room."
// Console gets: full debug info
console.warn(`[VibeLive] [${context}] ${code}: ${message}`, hint);
showModal('You were removed from this room.');
```

**Wrong:**
```js
// Never show this to a user:
showModal(`[${code}] ${message}\ncontext: ${context}\nhint: ${hint}\nretriable: ${retriable}`);
```

## UX Rules

1. **Never show error codes, context, hints, or debug fields to users.** Only show the friendly message.
2. **Log everything to console** — `code`, `context`, `hint`, `cause` are invaluable for debugging.
3. **Never use native `alert()`.** Use styled toasts or modals.
4. **Retriable errors get a toast** with an optional retry button.
5. **Non-retriable errors get a persistent message** — don't auto-dismiss.
6. **`SCREENSHARE_CANCELLED` is silent** — the user chose to cancel.
7. **`ROOM_KICKED` redirects** — do not auto-rejoin.
8. **Network reconnection** — show a subtle indicator, hide when restored.
9. **Permission errors** — guide the user to fix it (browser settings, close other apps).

---

*VibeLive Get Started Guide -- API v0.79 + Design v2.4 + Error Guide v1.0 | Last updated: 2026-04-06*