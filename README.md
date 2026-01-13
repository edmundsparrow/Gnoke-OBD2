# 🏎️ Gnoke-OBD2 (Alpha)

**Gnokestation | Professional-Grade Web OBD-II Diagnostic Platform**

Gnoke-OBD2 is a high-performance, modular vehicle diagnostic suite built entirely with modern web technologies. By leveraging the **Web Serial** and **Web Bluetooth APIs**, it transforms any browser into a powerful automotive scanner without requiring software installation.



### 🔗 [Live Demo](https://edmundsparrow.github.io/Gnoke-OBD2/)

---

> [!CAUTION]
> **ALPHA VERSION & LEGAL DISCLAIMER**
> This software is currently in an **experimental testing phase**. It is provided "as is" under the **GPLv3 License**, without warranty of any kind. Use at your own risk. The author is not responsible for any damage to vehicle hardware, ECU malfunctions, or data loss. **Always perform testing on a stationary vehicle.**

---

## 🌟 Key Features
* **High-Speed Telemetry**: Smooth 10Hz refresh rate for RPM, Speed, and Engine Load.
* **The Diagnostic Trinity**: 
    * **Mode 03**: Read/Clear Diagnostic Trouble Codes (DTCs).
    * **Mode 02**: Freeze Frame analysis (ECU snapshots during faults).
    * **Mode 01**: Emissions Readiness monitor status for smog-test compliance.
* **Data Recorder**: Log driving sessions to CSV for post-drive performance analysis.
* **Smart Kernel**: Advanced command queuing and 150ms anti-congestion delays to support low-cost/clone ELM327 adapters safely.



## 🛠️ Getting Started
1.  **Open the App**: Launch the [Live Demo](https://gnoke-obd2.netlify.app) in Chrome or Edge.
2.  **Hardware**: Connect your ELM327-compatible USB or Bluetooth adapter.
3.  **Go Live**: Click **Connect**, pair your device, and the platform will automatically initialize the vehicle protocol.

## 💻 For Developers
This project uses a modular "Plugin" architecture. To run locally or build your own modules:
```bash
git clone [https://github.com/edmundsparrow/Gnoke-obd2.git](https://github.com/edmundsparrow/Gnoke-obd2.git)
cd Gnoke-obd2
# Serve via HTTPS or localhost to enable Web Serial/Bluetooth APIs
