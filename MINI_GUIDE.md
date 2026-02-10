# MiniChatCore Quick Guide

**Build an anonymous video chat app with MiniChatCore**

Version 0.32 | February 7, 2026

---

## Setup

Every app needs an import map before any `<script type="module">`:

```html
<script type="importmap">
{
    "imports": {
        "minichat-core": "https://proto2.makedo.com:8883/v03/scripts/minichat-core.js",
        "config": "https://proto2.makedo.com:8883/v03/scripts/configServer.js"
    }
}
</script>
```

Then initialize:

```javascript
import MiniChatCore from 'minichat-core';

const chat = window.chat = new MiniChatCore({
    contextId: 'YOUR_CONTEXT_ID',
    contextAuthToken: 'YOUR_CONTEXT_TOKEN'
});
```

> **🧪 Test Credentials**: Use `contextId: 'Kw6w6w6w6w'` and `contextAuthToken: 'Kw6w6w6w6w'` for quick testing.

> **⚠️ Module Scope**: Functions inside `<script type="module">` are not global. To use them with `onclick` handlers, assign to `window`:
> ```javascript
> window.joinRoom = () => { ... };  // ✅ Accessible from onclick
> function joinRoom() { ... }       // ❌ Module-scoped, invisible to HTML
> ```
> Same for `chat` — note `const chat = window.chat = new MiniChatCore(...)`.

---

## User Flow

Anonymous users have two paths — **create** or **join** a room:

```
signupAnonymous(name) → createChannel({ title }) → enterByRoomCode(code) → startLive()
signupAnonymous(name) → enterByRoomCode(code) → startLive()
```

### Create a Room

```javascript
await chat.signupAnonymous('Alex');
const channel = await chat.createChannel({ title: "Alex's Room" });
// channel.room_code is the shareable code (e.g., "X7kQ3m")
await chat.enterByRoomCode(channel.room_code);
// Now in PRE-LIVE — call startLive() when ready
```

### Join a Room

```javascript
await chat.signupAnonymous('Jordan');
await chat.enterByRoomCode('X7kQ3m');
// Now in PRE-LIVE — call startLive() when ready
```

### Always `await` Authentication

`signupAnonymous()` must complete before any other calls. It establishes the session and WebSocket connection.

---

## Member Lifecycle: PRE-LIVE → LIVE → EXIT

```
PRE-LIVE    →    LIVE    →    PRE-LIVE or EXIT
(preparing)      (streaming)   (back or gone)
```

| State | What's happening | How to enter |
|-------|-----------------|--------------|
| **PRE-LIVE** | Channel selected, no WebRTC | `enterByRoomCode()` |
| **LIVE** | WebRTC connected, sending/receiving media | `startLive()` |
| **PRE-LIVE** | WebRTC disconnected, still in channel | `stopLive()` |
| **EXIT** | Fully departed, camera released | `exitChannel()` |

- `startLive()` — Connect WebRTC, go LIVE
- `stopLive()` — Disconnect WebRTC, return to PRE-LIVE (quick rejoin possible)
- `exitChannel()` — Full teardown, release camera/mic

---

## Media Controls

### Toggle vs Mute

Two different concepts — understand the difference:

| Action | What Happens | Camera Light | Others See |
|--------|--------------|--------------|------------|
| `toggleVideo()` | Start/stop capture | On/Off | Video appears/disappears |
| `toggleMuteVideo()` | Hide while capturing | Stays On | Black frame |
| `toggleAudio()` | Start/stop microphone | — | Audio appears/disappears |
| `toggleMuteAudio()` | Silence while capturing | — | Silence |

`toggleScreenshare()` starts/stops screen sharing.

### Recommended UX Pattern

For most video chat applications, use these patterns:

**Camera button:** Use `toggleVideo()` 
- Users expect the camera hardware to turn OFF (light goes off = privacy)
- Stopping capture releases system resources
- Clear visual feedback (camera light off)

**Microphone button:** Use `toggleMuteAudio()` (after initial `toggleAudio()` to start capture)
- Users expect instant unmute (common in meetings)
- Keeps microphone warm for faster response
- No "allow microphone" permission prompt when unmuting

**Example:**
```javascript
// On room entry: start both
await chat.startLive();  // Starts camera + mic

// User clicks mic button (during call)
chat.toggleMuteAudio();  // Mute/unmute - instant, no hardware restart

// User clicks camera button (during call)
chat.toggleVideo();      // Stop/start - hardware light on/off
```

Use `toggleMuteVideo()` only for specialized cases (e.g., "hide self while fixing appearance" but keep capturing).

### Pitfall: `audioMuted` Persists Across State Transitions

The `audio` and `audioMuted` flags in `localMediaState` are **independent**. Changing one does not reset the other.

This creates a subtle bug when PRE-LIVE and LIVE use different toggle methods:

| Screen | Toggle Method | Changes |
|--------|--------------|---------|
| PRE-LIVE | `toggleAudio()` | `audio` on/off |
| LIVE | `toggleMuteAudio()` | `audioMuted` on/off |

**Problem scenario:**
1. User mutes mic in LIVE → `{ audio: true, audioMuted: true }`
2. User returns to PRE-LIVE (WebRTC disconnects, hardware stays on)
3. PRE-LIVE button checks only `audio` → shows ON
4. But mic is effectively silent (`audioMuted` is still `true`)

**Rule:** Always derive effective mic state from **both** flags:

```javascript
const effectivelyOn = s.audio && !s.audioMuted;
```

And handle the cross-state edge case in your toggle logic:

```javascript
// PRE-LIVE mic toggle
if (effectivelyOn) {
    chat.toggleAudio();                       // Stop capture
} else {
    if (!s.audio) chat.toggleAudio();         // Start capture
    if (s.audioMuted) chat.toggleMuteAudio(); // Clear stuck mute
}

// LIVE mic toggle
if (!s.audio) {
    chat.toggleAudio();       // Start capture (was stopped in pre-live)
} else {
    chat.toggleMuteAudio();   // Mute/unmute
}
```

This does not apply to video — since both screens typically use `toggleVideo()`, the `videoMuted` flag stays `false` and only `video` matters.

### Pitfall: `videoMuted` on Screenshare (Browser Stop)

When the user stops sharing via the **browser's native "Stop sharing" button** (not your app's toggle), the SDK sets `screenshareState` to `{ video: true, videoMuted: true }` rather than `{ video: false }`. If you only check `screen.video`, the screenshare tile will persist as a black rectangle.

**Rule:** Always derive effective screenshare state from **both** flags:

```javascript
const screenActive = screen.video && !screen.videoMuted;
```

Apply this in:
- `onLocalMemberMediaChange` — to remove the tile when `!screenActive`
- `updateLocalControlUI` — so the screen share button reflects the true state

For **remote** screenshare cleanup, use both event paths:
- `onRemoteMemberStreamEnd` — removes tile when the stream ends
- `onRemoteMemberMediaChange` — removes tile when `screen_video_detail === 'OFF'` (backup for participants where `onRemoteMemberStreamEnd` may not fire)

### Screenshare Availability

Screen sharing can be offered in **LIVE mode only** or in **both PRE-LIVE and LIVE**. Choose based on your app's needs:

| Approach | When to use |
|----------|-------------|
| **LIVE only** (default) | Most apps — screenshare is a sharing action that implies an audience. Keeps the lobby simple. |
| **PRE-LIVE + LIVE** | Presentation-oriented apps where hosts may want to queue up a screen share before going live, or preview their shared content first. |

In both cases, follow the Element-First Rule: create and register the screenshare tile in `onChannelSelected` (hidden with `display: none`). The only difference is whether you show the screenshare toggle button in pre-live controls.

> **Default assumption:** Screenshare controls appear in LIVE mode only. Add them to PRE-LIVE if your app has a presentation or "green room" use case.

### Reading Local Media State

```javascript
chat.localMediaState
// → { audio: true/false, video: true/false, audioMuted: true/false, videoMuted: true/false }

chat.screenshareState
// → { video: true/false, videoMuted: true/false }
```

### Reading Remote Media State

```javascript
const states = chat.getMemberMediaStates(memberId);
// states.cam_audio_detail: 'ON' | 'MUTED' | 'OFF'
// states.cam_video_detail: 'ON' | 'HIDDEN' | 'OFF'
// states.screen_audio_detail: 'ON' | 'MUTED' | 'OFF'
// states.screen_video_detail: 'ON' | 'HIDDEN' | 'OFF'
```

**State meanings:**
- `'ON'` - Track is enabled and ready (may be in PRE-LIVE or LIVE)
- `'MUTED'` / `'HIDDEN'` - Track exists but is muted/hidden
- `'OFF'` - Track is disabled or not present

### Local vs Live Media State

There are two separate "worlds" of media state, and understanding the difference matters for indicators:

| Source | What it reflects | Use for |
|--------|-----------------|--------|
| `chat.localMediaState` | **Hardware state** — is the camera/mic actually capturing? | Local user's indicators |
| `chat.getMemberMediaStates(id)` | **WebRTC state** — what's being transmitted/received? | Remote member indicators |

In **PRE-LIVE**, the local user's camera can be on (for preview) but nothing is being transmitted. `localMediaState.video` is `true`, while remote members see nothing. This is correct — the indicator reflects what the user cares about in the lobby: *"Is my camera on? Do I look okay?"*

In **LIVE**, the two states naturally align. `startLive()` transmits whatever media is already active, and `stopLive()` disconnects WebRTC without touching hardware — so the camera stays on for preview when returning to PRE-LIVE.

**No special logic is needed to synchronize these states.** The lifecycle handles it:
- PRE-LIVE indicators show hardware state (useful for setup)
- LIVE indicators show the same hardware state (which now matches transmission state)
- The "You are not live yet" label and status badge communicate that nothing is being sent

Always use `localMediaState` for the local user's indicators — never `getMemberMediaStates(localMemberId)`, which reflects the WebRTC view and won't be meaningful in PRE-LIVE.

---

## The Element-First Rule

> **Register video elements before streams arrive, not in response to them.**

When MiniChatCore creates a media stream, it immediately attaches to whatever `<video>` element you've registered. No element = stream silently lost.

| Media Type | When to Register | Why |
|---|---|---|
| **Local camera** | At tile creation time | `toggleVideo()` attaches immediately |
| **Local screenshare** | At tile creation time (hidden) | `toggleScreenshare()` attaches immediately |
| **Remote camera** | Inside `onRemoteMemberStreamStart` | Stream is arriving *right now* |
| **Remote screenshare** | Inside `onRemoteMemberStreamStart` | Stream is arriving *right now* |

```javascript
// ✅ Register both local elements at tile creation
chat.setLocalCameraElement(cameraVideoEl);
chat.setLocalScreenElement(screenVideoEl);

// ❌ DON'T create elements in onLocalMemberMediaChange — too late!
```

**Why this matters for screenshare:** When you call `toggleScreenshare()`, the stream is produced **instantly**. If you wait until `onLocalMemberMediaChange` fires to create the tile and call `setLocalScreenElement()`, the stream has already been produced with no element to attach to — result: blank screen. The element must be created and registered **before** the user clicks the screenshare button.

---

## Building Video Tiles

Each video stream gets its own **independent tile** identified by `tile-{memberId}-{streamType}`. This design provides maximum layout flexibility — when a screenshare is active, the layout switches to presentation mode (screenshare fills the main area, camera tiles move to a strip below).

### createVideoTile() Pattern

```javascript
function createVideoTile(memberId, name, streamType, isLocal) {
    const tileId = `tile-${memberId}-${streamType}`;
    if (document.getElementById(tileId)) return; // Guard duplicates

    const tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.id = tileId;
    tile.dataset.memberId = memberId;       // For easy filtering
    tile.dataset.streamType = streamType;   // 'camera' or 'screenshare'

    // Video Container
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';

    const placeholder = document.createElement('div');
    placeholder.className = 'video-placeholder';
    if (streamType === 'camera') {
        placeholder.innerHTML = `<span>${isLocal ? 'You' : name}</span>`;
    } else {
        placeholder.innerHTML = `<span>🖥️ ${isLocal ? 'Your' : name + "'s"} Screen</span>`;
    }

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;   // Required for iOS
    video.muted = (isLocal || streamType === 'screenshare');  // Prevent echo

    videoContainer.appendChild(placeholder);
    videoContainer.appendChild(video);

    // Member Info Bar (customize per stream type)
    const memberInfo = document.createElement('div');
    memberInfo.className = 'member-info';
    if (streamType === 'camera') {
        memberInfo.innerHTML = `
            <span class="member-name">${isLocal ? 'You' : name}</span>
            <div class="member-indicators">
                <span class="status-badge"></span>
                <span class="indicator cam-video" title="Camera"><!-- SVG icon --></span>
                <span class="indicator cam-audio" title="Microphone"><!-- SVG icon --></span>
            </div>
        `;
    }
    // Screen share tiles: no member-info (content only, not a participant)
    // Name labels, indicators, and badges are hidden via CSS in presentation mode

    // Assemble
    tile.appendChild(videoContainer);
    tile.appendChild(memberInfo);
    document.getElementById('videoGrid').appendChild(tile);

    // Register local elements immediately (Element-First Rule)
    if (isLocal) {
        if (streamType === 'camera') {
            chat.setLocalCameraElement(video);
        } else {
            chat.setLocalScreenElement(video);
        }
    }
}
```

**Key points:**
- Each tile is independent — camera and screenshare are separate elements
- `data-member-id` and `data-stream-type` attributes enable easy filtering and styling
- When screenshare is active, CSS switches to presentation mode (screenshare maximized, camera tiles in a bottom strip)
- Screen share tiles show content only — name labels, indicators, and badges are hidden
- `playsInline` is required for iOS

---

## Moving Video Tiles (Preview Areas, Featured Views)

When implementing preview modes, featured speaker layouts, or dynamic repositioning, **always move the existing DOM element** — never remove and recreate.

### ✅ The Safe Way: appendChild()

```javascript
// Moving to a preview area (PRE-LIVE state)
const tile = document.getElementById(`tile-${chat.localMemberId}-camera`);
if (tile) {
    document.getElementById('previewArea').appendChild(tile);
}

// Moving back to main grid (LIVE state)
if (tile) {
    document.getElementById('videoGrid').appendChild(tile);
}
```

**Why this works:**
- `appendChild()` **moves** the element (doesn't clone or recreate)
- The `<video>` element's `srcObject` persists when moved in the DOM
- Element registration (`setLocalCameraElement()`) remains valid
- No need to re-register or reattach the stream

### ❌ Common Mistakes That Break Streams

```javascript
// ❌ WRONG #1: Remove then recreate
const oldTile = document.getElementById(`tile-${memberId}-camera`);
oldTile.remove(); // Stream lost here!
createVideoTile(memberId, name, 'camera', true); // New element = no stream

// ❌ WRONG #2: Clone the element
const original = document.getElementById(`tile-${memberId}-camera`);
const clone = original.cloneNode(true); // New element = no stream
featuredArea.appendChild(clone);

// ❌ WRONG #3: Replace innerHTML
document.getElementById('previewArea').innerHTML = tile.outerHTML; // Destroys element
```

### Real-World Example: PRE-LIVE Preview

Many apps show a "green room" preview before going live:

```javascript
chat.onChannelSelected = async (channel) => {
    // Create local camera tile (Element-First Rule)
    const self = (await chat.getCurrentChannelMembers()).find(m => m.id === chat.localMemberId);
    if (self) {
        createVideoTile(self.id, self.displayName, 'camera', true);
        
        // Move to preview area immediately
        const tile = document.getElementById(`tile-${self.id}-camera`);
        document.getElementById('previewArea').appendChild(tile);
    }
};

chat.onLocalMemberJoined = () => {
    // Move from preview to main grid when going live
    const tile = document.getElementById(`tile-${chat.localMemberId}-camera`);
    if (tile) {
        document.getElementById('videoGrid').appendChild(tile);
    }
    document.getElementById('previewArea').style.display = 'none';
};

chat.onLocalMemberLeft = () => {
    // Move back to preview when stopping live
    const tile = document.getElementById(`tile-${chat.localMemberId}-camera`);
    if (tile) {
        document.getElementById('previewArea').appendChild(tile);
    }
    document.getElementById('previewArea').style.display = 'block';
};
```

**Key insight:** The same tile moves seamlessly between containers. The video keeps playing because the `<video>` element never gets destroyed.

### Other Use Cases

This pattern works for:
- **Featured speaker view** — Move active speaker to larger container
- **Spotlight mode** — Expand selected participant
- **Grid layouts** — Reorder based on speaking activity
- **Breakout transitions** — Move to different layout areas

Always use `appendChild()` to move, never recreate.

---

## Event Handlers

### Event Summary

```javascript
// Connection state (local)
chat.onLocalMemberJoined = () => { };      // You went LIVE
chat.onLocalMemberLeft = () => { };        // You returned to PRE-LIVE

// Remote members
chat.onRemoteMemberJoined = (memberId) => { };
chat.onRemoteMemberLeft = (memberId) => { };
chat.onMemberUpdate = (memberId) => { };   // Status changed (includes self!)

// Streams
chat.onRemoteMemberStreamStart = (memberId, streamType) => { };  // 'camera' or 'screenshare'
chat.onRemoteMemberStreamEnd = (memberId, streamType) => { };
chat.onRemoteMemberMediaChange = (memberId, streamType) => { };  // Mute/unmute

// Local media
chat.onLocalMemberMediaChange = () => { };

// Channel
chat.onChannelSelected = (channel) => { };

// Errors
chat.onError = (context, error) => { };
```

### Handling Remote Streams

When a remote member starts streaming, attach their stream to the tile:

```javascript
chat.onRemoteMemberStreamStart = (memberId, streamType) => {
    if (!isLocalLive) return;  // Privacy-aware: only show when you're live

    const m = chat.getMember(memberId);
    const tileId = `tile-${memberId}-${streamType}`;
    
    // Create tile on demand if needed (streams can arrive before tiles!)
    let tile = document.getElementById(tileId);
    if (!tile) {
        createVideoTile(memberId, m?.displayName || 'Unknown', streamType, false);
        tile = document.getElementById(tileId);
    }

    if (!tile) return;

    const placeholder = tile.querySelector('.video-placeholder');
    const video = tile.querySelector('video');

    if (placeholder) placeholder.classList.add('hidden');
    if (video) {
        video.classList.add('visible');
        if (streamType === 'camera') {
            chat.setRemoteCameraElement(memberId, video);
        } else {
            chat.setRemoteScreenElement(memberId, video);
        }
    }

    updateMemberIndicators(memberId, streamType);
};

chat.onRemoteMemberStreamEnd = (memberId, streamType) => {
    const tileId = `tile-${memberId}-${streamType}`;
    const tile = document.getElementById(tileId);
    if (!tile) return;

    // For screenshare, remove the tile entirely when stream ends
    if (streamType === 'screenshare') {
        tile.remove();
    } else {
        // For camera, show placeholder (they may have just stopped video, audio might continue)
        const video = tile.querySelector('video');
        const placeholder = tile.querySelector('.video-placeholder');

        if (video) video.classList.remove('visible');
        if (placeholder) placeholder.classList.remove('hidden');
    }

    updateMemberIndicators(memberId, streamType);
};
```

> **⚠️ Always create tiles on demand in `onRemoteMemberStreamStart`.**
> When you call `startLive()`, WebRTC begins immediately. If others are already streaming, `onRemoteMemberStreamStart` can fire **before** `onRemoteMemberJoined` — and before your code has built tiles. If the tile doesn't exist, create it right there. Since `createVideoTile()` guards against duplicates, this is always safe.

### Video Placeholder vs Stream Presence

**Important:** A stream can exist with only an audio track (video stopped) or be completely gone. In both cases, you typically want to show the video placeholder since there's no video to display.

**Don't rely solely on stream events for placeholder visibility.** Use `onRemoteMemberMediaChange` to check the actual video state:

```javascript
chat.onRemoteMemberMediaChange = (memberId, streamType) => {
    const states = chat.getMemberMediaStates(memberId);
    const tileId = `tile-${memberId}-${streamType}`;
    const tile = document.getElementById(tileId);
    if (!tile) return;

    const video = tile.querySelector('video');
    const placeholder = tile.querySelector('.video-placeholder');

    // Show placeholder when video is not ON (handles 'OFF' and 'HIDDEN' states)
    let showPlaceholder = false;
    if (streamType === 'camera') {
        showPlaceholder = states.cam_video_detail !== 'ON';
    } else {
        showPlaceholder = states.screen_video_detail !== 'ON';
    }

    if (showPlaceholder) {
        video?.classList.remove('visible');
        placeholder?.classList.remove('hidden');
    } else {
        video?.classList.add('visible');
        placeholder?.classList.add('hidden');
    }

    updateMemberIndicators(memberId, streamType);
};
```

This ensures the placeholder appears whether the video is stopped, hidden (muted), or the stream only has audio.

### Handling Local Media Changes

MiniChatCore attaches streams but **never controls visibility**. Use `onLocalMemberMediaChange` to show/hide your own video tiles:

```javascript
chat.onLocalMemberMediaChange = () => {
    const s = chat.localMediaState;
    const screen = chat.screenshareState;

    // Update camera tile
    const camTile = document.getElementById(`tile-${chat.localMemberId}-camera`);
    if (camTile) {
        const placeholder = camTile.querySelector('.video-placeholder');
        const video = camTile.querySelector('video');
        if (s.video) {
            placeholder?.classList.add('hidden');
            video?.classList.add('visible');
        } else {
            placeholder?.classList.remove('hidden');
            video?.classList.remove('visible');
        }
    }

    // Update screenshare tile visibility (hide tile entirely when not active)
    const screenTile = document.getElementById(`tile-${chat.localMemberId}-screenshare`);
    if (screenTile) {
        if (screen.video) {
            screenTile.style.display = 'flex';
            const placeholder = screenTile.querySelector('.video-placeholder');
            const video = screenTile.querySelector('video');
            placeholder?.classList.add('hidden');
            video?.classList.add('visible');
        } else {
            screenTile.style.display = 'none';
        }
    }

    updateMemberIndicators(chat.localMemberId);
};
```

**Important:** Local video is attached **directly** when you call `toggleVideo()`, not via WebRTC events. `onRemoteMemberStreamStart` only fires for **remote** members.

### Handling Member Left

Check whether they truly exited or just returned to PRE-LIVE:

```javascript
chat.onRemoteMemberLeft = (memberId) => {
    const m = chat.getMember(memberId);
    if (m?.displayStatus === 'INACTIVE') {
        // Remove both camera and screenshare tiles
        document.getElementById(`tile-${memberId}-camera`)?.remove();
        document.getElementById(`tile-${memberId}-screenshare`)?.remove();
    }
    // If PRE-LIVE, keep the tiles — they may rejoin
};
```

---

## Privacy-Aware Visibility

Recommended pattern: only show remote member tiles when the local user is LIVE. This gives users a private "green room" during PRE-LIVE for adjusting camera/mic.

```javascript
let isLocalLive = false;

chat.onChannelSelected = async (channel) => {
    // Show only self camera tile in PRE-LIVE
    const members = await chat.getCurrentChannelMembers();
    const self = members.find(m => m.id === chat.localMemberId);
    if (self) {
        createVideoTile(self.id, self.displayName, 'camera', true);
        // Also create screenshare tile (hidden initially, Element-First Rule)
        createVideoTile(self.id, self.displayName, 'screenshare', true);
    }
};

chat.onLocalMemberJoined = async () => {
    isLocalLive = true;
    // Reveal all remote members now that we're live
    const members = await chat.getCurrentChannelMembers();
    members.forEach(m => {
        if (m.id === chat.localMemberId) return;
        if (m.displayStatus === 'ACTIVE' || m.displayStatus === 'PRE-LIVE') {
            createVideoTile(m.id, m.displayName, 'camera', false);
            // Create screenshare tiles if they have screenshare
            if (m.hasScreenshare) {
                createVideoTile(m.id, m.displayName, 'screenshare', false);
            }
        }
    });
};

chat.onLocalMemberLeft = () => {
    isLocalLive = false;
    // Remove all remote tiles — back to privacy mode
    document.querySelectorAll('.video-tile').forEach(tile => {
        if (tile.dataset.memberId !== chat.localMemberId) {
            tile.remove();
        }
    });
};

chat.onRemoteMemberJoined = (memberId) => {
    if (!isLocalLive) return; // Don't show if we're not live
    const m = chat.getMember(memberId);
    createVideoTile(memberId, m?.displayName || 'Unknown', 'camera', false);
    // Screenshare tiles created on-demand when stream starts
};

chat.onRemoteMemberStreamStart = (memberId, streamType) => {
    if (!isLocalLive) return; // Don't show if we're not live
    // ... attach stream (see above)
};
```

---

## Member Info

```javascript
// Get member details
const member = chat.getMember(memberId);
member.displayName     // "Alex"
member.displayStatus   // 'ACTIVE', 'PRE-LIVE', or 'INACTIVE'
member.hasCamera       // boolean
member.hasScreenshare  // boolean

// Fetch all current channel members
const members = await chat.getCurrentChannelMembers();
// → [{ id, displayName, displayStatus, ... }]
```

Use `chat.localMemberId` to get your own member ID. Use `chat.currentRoomCode` to display the shareable room code.

`onMemberUpdate` fires for ALL members including yourself — useful for updating status badges.

---

## API Quick Reference

### Methods

| Method | Description |
|--------|-------------|
| `signupAnonymous(name)` | Create anonymous guest session |
| `createChannel({ title })` | Create room, returns `{ id, room_code, title }` |
| `enterByRoomCode(code)` | Enter room → PRE-LIVE |
| `startLive()` | Connect WebRTC → LIVE |
| `stopLive()` | Disconnect WebRTC → PRE-LIVE |
| `exitChannel()` | Full teardown, release camera |
| `toggleAudio()` | Start/stop mic |
| `toggleVideo()` | Start/stop camera |
| `toggleScreenshare()` | Start/stop screen share |
| `toggleMuteAudio()` | Mute/unmute mic (while capturing) |
| `toggleMuteVideo()` | Hide/show video (while capturing) |
| `getMember(memberId)` | Get member info |
| `getCurrentChannelMembers()` | Fetch all members in channel |
| `getMemberMediaStates(memberId)` | Get `cam_audio_detail`, `cam_video_detail` |
| `setLocalCameraElement(videoEl)` | Register local camera element |
| `setLocalScreenElement(videoEl)` | Register local screenshare element |
| `setRemoteCameraElement(id, videoEl)` | Bind remote camera element |
| `setRemoteScreenElement(id, videoEl)` | Bind remote screenshare element |

### Getters

| Property | Type | Description |
|----------|------|-------------|
| `isLoggedIn` | boolean | Authenticated? |
| `isInChannel` | boolean | WebRTC connected (LIVE)? |
| `localMemberId` | string | Your member ID |
| `currentRoomCode` | string | Shareable room code |
| `localMediaState` | Object | `{ audio, video, audioMuted, videoMuted }` |
| `screenshareState` | Object | `{ video, videoMuted }` |

---

## Common Mistakes

1. **Not awaiting `signupAnonymous()`** — Session and WebSocket won't be ready for subsequent calls.

2. **Forgetting `startLive()`** — `enterByRoomCode()` only puts you in PRE-LIVE. You must call `startLive()` to connect WebRTC.

3. **Creating video elements too late** — Register elements *before* streams arrive (Element-First Rule). If you create an element inside `onLocalMemberMediaChange`, the stream is already lost.
   
   **⚠️ CRITICAL for screenshare:** The local screenshare `<video>` element must exist and be registered with `setLocalScreenElement()` BEFORE calling `toggleScreenshare()`. Create both camera and screenshare tiles in `onChannelSelected`, with the screenshare tile hidden (`display: none`) until active. Do not create it in response to `onLocalMemberMediaChange` — by then the stream has already been produced with nowhere to attach.

4. **Not creating tiles on demand in `onRemoteMemberStreamStart`** — Stream events can arrive before `onRemoteMemberJoined`. Always check and create.

5. **Missing `playsInline` on video elements** — Required for iOS. Videos won't play inline without it.

6. **Not muting local video** — Always set `muted = true` on your own `<video>` element to prevent audio feedback.

7. **Not checking status in `onRemoteMemberLeft`** — A member with `displayStatus === 'PRE-LIVE'` hasn't left; they may rejoin. Only remove tiles for `'INACTIVE'` members.

8. **Forgetting to handle local media state for indicators** — For the local user's indicators, read from `chat.localMediaState` and `chat.screenshareState`, not from `getMemberMediaStates(localMemberId)` which reflects WebRTC state and won't be meaningful in PRE-LIVE. See "Local vs Live Media State" in Media Controls.

9. **Confusing toggle vs mute** — For camera controls, use `toggleVideo()` (hardware on/off). For microphone controls, use `toggleMuteAudio()` after initial startup (instant mute/unmute). See "Recommended UX Pattern" in Media Controls section.

10. **Removing and recreating tiles to move them** — When implementing preview areas or featured views, use `appendChild()` to move the existing element. Never call `.remove()` then recreate — the stream attachment will be lost. See "Moving Video Tiles" section for the correct pattern.

---

## Reference Implementation

See [MINI_Sonnet_Feb7b.html](MINI_Sonnet_Feb7b.html) for a complete working app (~450 lines including CSS) that implements all patterns in this guide:

- Anonymous room creation and joining
- Independent camera and screenshare tiles (flexible layout)
- Privacy-aware visibility (PRE-LIVE / LIVE)
- Full media controls (toggle, mute, screenshare)
- Media state indicators per member
- Status badges (ACTIVE / PRE-LIVE)
- Error handling
- Presentation mode for screenshare (maximized content, camera strip below)

---

*MiniChatCore v0.31 | For the full API with login, channel lists, and user search, see [MINICHAT_COMPLETE_GUIDE.md](MINICHAT_COMPLETE_GUIDE.md).*
