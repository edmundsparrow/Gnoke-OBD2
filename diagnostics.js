/**
 * Gnokestation Diagnostics App v2.2
 * Purpose: Mode 03 DTC Reading & Clearing
 */
(() => {
    const DiagnosticsApp = {
        id: 'diagnostics',
        isScanning: false,

        /**
         * Reads Diagnostic Trouble Codes (DTCs)
         */
        async readCodes() {
            if (this.isScanning) return;
            
            const container = document.getElementById('dtc-list');
            if (!container) return;

            // Set UI state and Lock bus
            this.isScanning = true;
            container.innerHTML = `<div class="dtc-status">🔍 Scanning ECU...</div>`;
            System.log('Diagnostics', 'Scan Initiated - Bus Locked');

            try {
                let rawResponse;
                if (window.isSimulating) {
                    await new Promise(r => setTimeout(r, 1500));
                    rawResponse = "43 02 03 00 01 71"; // Simulating P0300 and P0171
                } else {
                    // Send Mode 03 request
                    rawResponse = await window.obd.sendCommand('03');
                }

                const codes = this.parseDTCs(rawResponse);
                this.displayCodes(codes);
            } catch (err) {
                System.log('Diagnostics', `Scan Error: ${err.message}`);
                container.innerHTML = `<div class="dtc-error">Scan Failed</div>`;
            } finally {
                this.isScanning = false;
            }
        },

        /**
         * Logic: Converts raw hex response into an array of DTC strings
         */
        parseDTCs(hex) {
            // Use the global helper from pids.js to get clean bytes
            const bytes = window.parseOBDResponse(hex, '43'); 
            if (!bytes || bytes.length < 1) return [];

            const codes = [];
            // Mode 03 returns 2 bytes per code
            for (let i = 1; i < bytes.length; i += 2) {
                const byte1 = bytes[i].toString(16).padStart(2, '0');
                const byte2 = bytes[i+1]?.toString(16).padStart(2, '0');
                
                if (byte1 && byte2 && byte1 !== '00') {
                    const fullHex = byte1 + byte2;
                    // Use the global decoder from pids.js
                    const decoded = window.decodeDTC(fullHex);
                    if (decoded) codes.push(decoded);
                }
            }
            return codes;
        },

        /**
         * Renders the codes to the UI
         */
        displayCodes(codes) {
            const container = document.getElementById('dtc-list');
            if (!codes || codes.length === 0) {
                container.innerHTML = '<div class="dtc-empty">No DTCs stored in ECU.</div>';
                return;
            }

            container.innerHTML = codes.map(code => `
                <div class="dtc-card">
                    <span class="dtc-code">${code}</span>
                    <span class="dtc-desc">Confirmed Trouble Code</span>
                </div>
            `).join('');
        },

        /**
         * Clears codes (Mode 04)
         */
        async clearCodes() {
            if (!confirm("Clear all diagnostic codes? This resets engine monitors.")) return;
            
            try {
                System.log('Diagnostics', 'Sending Mode 04 (Clear)...');
                await window.obd.sendCommand('04');
                this.displayCodes([]);
                alert("Codes Cleared Successfully");
            } catch (err) {
                System.log('Diagnostics', `Clear Error: ${err.message}`);
            }
        }
    };

    // Self-registration into the core system
    window.System.activeApps.diagnostics = DiagnosticsApp;
    System.log('Diagnostics', '✓ App Loaded');
})();
