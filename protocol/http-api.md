# Public HTTP API

This document defines the stable interoperability surface. Implementations may use any internal architecture as long as they preserve the public behavior and comply with the applicable licence and trademarks.

## Configuration

`GET /v1/sites/{site}/config` returns public presentation settings including the assistant name, business name, greeting, languages, accent, suggestions, handoff URL, and voice availability.

## Grounded answers

`POST /v1/sites/{site}/ask` accepts JSON:

```json
{
  "question": "What services do you offer?",
  "history": [],
  "language": "en",
  "mode": "text"
}
```

The response is `text/event-stream`. Token events contain `{"type":"token","text":"..."}`. The final event contains `type`, `answered`, `language`, `sources`, and `handoff`.

## Voice

- `POST /transcribe` accepts a supported audio body and returns recognized text and language.
- `POST /speak` accepts text, language, and an optional voice, and returns audio.
- `/live` upgrades to a WebSocket for a continuous voice session.

Clients must treat voice availability as a capability and provide a text or device-speech fallback.

## Leads

`POST /leads` accepts a visitor-provided name, contact, and optional message. Clients must never submit contact information without the visitor's deliberate action.

## Compatibility

Protocol version `1` is backward-compatible within its major version. New optional fields may appear. Clients must ignore fields they do not understand.
