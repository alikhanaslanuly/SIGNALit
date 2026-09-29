# Two-minute pitch

Speak calmly at about 120 words per minute. Use the real demo only after the device checklist passes.

**Problem**
Some patients find it hard to speak. They may need water, help, or a simple way to answer a nurse.
SIGNALit is our prototype for this communication.

**Live demo**
The patient opens the camera and shows a hand gesture. Here I try HELP with a bent pinky.
The app tells me which finger to straighten and highlights that finger. I correct my hand and
hold the pose. The request appears at the nurse station. The nurse acknowledges it, sends
“I'm coming”, and completes it. The patient can see these steps.

**Why SIGNALit is different**
We connect gesture recognition to a full communication workflow. We also explain how to correct
a pose. The patient does not need to guess why recognition failed. We support six gestures,
English and Russian, and a larger bedside view.

**Technology**
MediaPipe gives us 21 hand landmarks.
Our team implemented gesture scoring, hold confirmation, Error Mode,
dialog logic and the communication workflow.
We use React for the screens, realtime events for updates, and SQLite for saved requests.

**Privacy**
Camera processing happens on the device. We send communication events, not camera images or video.
For this demo, we use sample patient details.

**Limitations**
This is a prototype, not a clinical system. Lighting, hand position, and camera quality can affect it.
Automated tests do not prove that every patient can use it.

**Next step**
We will test it with new users on real devices, improve the confusing steps, and add the access
controls needed before any real patient use.
