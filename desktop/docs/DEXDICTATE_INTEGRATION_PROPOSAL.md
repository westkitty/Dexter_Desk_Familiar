# DexDictate <-> Dexter Desk Familiar IPC Contract Proposal

## Context
- **Dexter Desk Familiar**: macOS Electron desktop companion app (`desktop/` product in `westkitty/Dexter_Desk_Familiar`).
- **DexDictate**: macOS local speech dictation utility using WhisperKit (`westkitty/DexDictate_MacOS`).

## Current Architecture & Limitation
DexDictate executes on-device speech transcription and outputs text by synthesizing `CGEvent` keyboard events into whatever macOS application currently holds keyboard focus.

Because DexDictate does not expose a local socket, named pipe, Mach/XPC service, or CLI interface with transcript output, Dexter Desk Familiar cannot receive transcription events programmatically.

Direct programmatic handoff is currently **BLOCKED**.

## Proposed Upstream IPC Contract

### Transport: Local Unix Domain Socket
- **Socket Path**: `$TMPDIR/dexdictate/dexdictate.sock` (mode `0600`)
- **Format**: UTF-8 Line-Delimited JSON (NDJSON)

### Connection Lifecycle

1. **Client Handshake**:
```json
{
  "v": 1,
  "client": "dexter-desk-familiar",
  "action": "subscribe",
  "events": ["status", "partial", "final"]
}
```

2. **Server Response**:
```json
{
  "v": 1,
  "status": "ready",
  "model": "whisperkit-coreml-small-en",
  "active": false
}
```

3. **Transcription Stream**:
```json
{"type": "state", "state": "recording", "timestamp": 1730480000.123}
{"type": "partial", "text": "hey dex", "stable": false, "timestamp": 1730480001.450}
{"type": "final", "text": "Hey Dexter, how is the build looking?", "confidence": 0.94, "durationMs": 2400}
{"type": "state", "state": "idle", "timestamp": 1730480003.555}
```

### Interim Interoperability
Until the upstream socket is available, Dexter guides users to:
1. Open Dexter's Conversation panel (`Cmd+Shift+D`).
2. Focus the message input field.
3. Trigger DexDictate's global hotkey.
4. DexDictate types the transcribed text directly into Dexter's prompt box via macOS Accessibility.
