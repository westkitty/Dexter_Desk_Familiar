'use strict';
// DexDictate interoperability module for Dexter Desk Familiar.
// DexDictate (westkitty/DexDictate_MacOS) is a separate macOS app using WhisperKit
// on Apple Silicon to perform on-device speech recognition, inserting transcribed
// text into the active macOS application via Accessibility keystroke simulation.
//
// Because DexDictate does not currently provide a local IPC socket, Mach service,
// URL callback, or CLI pipe, direct programmatic transcript handoff to Dexter is
// BLOCKED. Dexter supports DexDictate via focused-field accessibility dictation,
// and documents an upstream Unix domain socket / XPC contract proposal below.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execSync} = require('node:child_process');

const DEFAULT_APP_PATHS = [
  '/Applications/DexDictate.app',
  path.join(os.homedir(), 'Applications/DexDictate.app')
];

const DEXDICTATE_CONTRACT_PROPOSAL = `# DexDictate <-> Dexter Desk Familiar IPC Contract Proposal

## Overview
DexDictate (macOS) currently performs local speech recognition via WhisperKit and
simulates keystrokes via macOS Accessibility APIs (\`CGEventCreateKeyboardEvent\` /
\`AXUIElement\`).

While effective for arbitrary text fields, simulated typing into an Electron companion
app introduces:
1. Focus-stealing requirement (companion must be the active frontmost window).
2. Rate-limited simulated key events prone to dropped keystrokes.
3. Inability to pass structured metadata (confidence, timestamps, audio levels, language).

## Proposed Upstream IPC Contract

### Transport Options (in order of preference)
1. **Local Unix Domain Socket (Preferred)**
   - Location: \`$TMPDIR/dexdictate/dexdictate.sock\` or \`~/.dexdictate/ipc.sock\`
   - Permissions: \`0600\` (user-only, protected from other local users)
   - Protocol: Line-delimited JSON (NDJSON) over streaming local socket.

2. **Mach Service / XPC**
   - Service name: \`group.com.westkitty.dexdictate.transcription\`
   - Interface: NSXPCConnection publishing transcription events to authorized group members.

### NDJSON Event Protocol (Unix Domain Socket)

#### 1. Handshake & Registration
Client connects to \`dexdictate.sock\` and sends:
\`\`\`json
{"type": "subscribe", "client": "dexter-desk-familiar", "version": "0.4.0", "events": ["status", "partial", "final"]}
\`\`\`
Server responds:
\`\`\`json
{"type": "subscribed", "status": "idle", "sampleRate": 16000, "model": "whisper-small-en"}
\`\`\`

#### 2. Streaming Events
While recording/transcribing, DexDictate emits:
\`\`\`json
{"type": "state", "state": "recording", "timestamp": 1730480000.123}
{"type": "partial", "text": "hey dex", "stable": false, "timestamp": 1730480001.450}
{"type": "final", "text": "Hey Dexter, how is the build looking?", "confidence": 0.94, "durationMs": 2400}
{"type": "state", "state": "idle", "timestamp": 1730480003.555}
\`\`\`

#### 3. Remote Control Intent (Optional)
Dexter can trigger or cancel dictation without global hotkeys:
\`\`\`json
{"type": "start_dictation", "target": "dexter-chat"}
{"type": "cancel_dictation"}
\`\`\`

## Current Status & Interim Fallback
- Direct Handoff: **BLOCKED** (no socket/XPC endpoint exposed in DexDictate v1.0).
- Supported Interim Mode: User opens Dexter's Conversation panel, focuses the input field, and triggers DexDictate via global hotkey. DexDictate types directly into Dexter's text field.
`;

/**
 * Checks if DexDictate is installed and/or running.
 * Accepts optional mocks for testing.
 */
function checkDexDictate({
  appPaths = DEFAULT_APP_PATHS,
  customPath = '',
  execSyncImpl = execSync,
  fsImpl = fs
} = {}) {
  const candidatePaths = customPath
    ? [customPath, ...appPaths]
    : appPaths;

  let installed = false;
  let detectedPath = null;

  for (const candidate of candidatePaths) {
    if (!candidate) continue;
    try {
      const stat = fsImpl.statSync(candidate);
      if (stat.isDirectory() || stat.isFile()) {
        installed = true;
        detectedPath = candidate;
        break;
      }
    } catch {
      // Path does not exist or inaccessible
    }
  }

  let running = false;
  if (execSyncImpl) {
    try {
      const output = String(execSyncImpl('pgrep -x DexDictate || true', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1000
      })).trim();
      running = output.length > 0;
    } catch {
      running = false;
    }
  }

  const status = installed ? 'installed_external_only' : 'not_installed';
  const label = installed
    ? 'Installed — external dictation / Direct handoff unavailable'
    : 'Not installed';

  const guidance = installed
    ? 'DexDictate is ready for external dictation. Open Dexter\'s Conversation panel (Cmd+Shift+D), click inside the message box, and press your DexDictate hotkey. DexDictate will type directly into Dexter.'
    : 'DexDictate is not installed. To use external dictation, install DexDictate.app in /Applications. Alternatively, use whisper.cpp for push-to-talk speech input.';

  return {
    installed,
    running,
    appPath: detectedPath,
    status,
    label,
    directHandoffSupported: false,
    blockedReason: 'DexDictate v1.0 relies on macOS Accessibility keystroke typing into the active text field and does not expose a local socket, URL callback, or XPC transcript export protocol.',
    guidance,
    proposalExcerpt: 'A Unix domain socket protocol is documented in DEXDICTATE_INTEGRATION_PROPOSAL.md.'
  };
}

module.exports = {
  checkDexDictate,
  DEFAULT_APP_PATHS,
  DEXDICTATE_CONTRACT_PROPOSAL,
  getContractProposal: () => DEXDICTATE_CONTRACT_PROPOSAL
};
