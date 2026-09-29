# Third-party attribution

License identifiers below are copied from installed package metadata, not a legal review.
The lockfile records exact installed versions. This pass added only qrcode-generator 2.0.4;
no existing dependency was upgraded. No project-level LICENSE was supplied or invented.

| Runtime package | Installed version | Declared license |
| --- | --- | --- |
| @mediapipe/tasks-vision | 1.0.1 | Apache-2.0 |
| better-sqlite3 | 12.11.1 | MIT |
| cors | 2.8.6 | MIT |
| express | 5.2.1 | MIT |
| qrcode-generator | 2.0.4 | MIT |
| react | 19.3.0 | MIT |
| react-dom | 19.3.0 | MIT |
| socket.io | 4.8.4 | MIT |
| socket.io-client | 4.8.4 | MIT |
| zod | 4.6.5 | MIT |
| zustand | 5.0.15 | MIT |

QR generator source header: Copyright (c) 2009 Kazuhiko Arase; licensed under MIT.
Its original source notice is retained in the installed package. The QR stores the actual session URL,
not display names or medical information.

MediaPipe supplies the hand-landmark model/runtime; the team did not train it. Vendored WASM
[provenance and matching version](../public/wasm/README.md) and model
[source/checksum](../public/models/README.md) are recorded separately. The npm SDK declares
Apache-2.0; this document does not infer separate model-weight licensing from SDK metadata.
Preserve upstream notices and verify model redistribution terms before a wider release.

Screenshots in [the gallery](assets/README.md) were produced from this app with sample data.
Fixture/mock input remains labeled. No stock camera image is used as recognition evidence.
