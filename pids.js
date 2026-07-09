/**
 * Gnokestation PIDs & DTC Library v2.0
 * Centralized database for OBD-II Parameter IDs and Diagnostic Trouble Codes
 * 
 * This file is the "universal translator" between raw hex and human values.
 * NEVER NEEDS MODIFICATION unless adding new PIDs/DTCs
 */

(() => {
    // ========================================================================
    // PARAMETER IDs (PIDs) - Vehicle sensor query codes
    // ========================================================================
    // Each PID contains:
    // - code: The hex command sent to ELM327
    // - parse: Function to convert raw bytes to real-world value
    // - unit: Display unit for UI
    
    window.PIDS = {
        // Core Dashboard Metrics
        RPM: { 
            code: '010C', 
            parse: (bytes) => bytes ? ((bytes[0] * 256) + bytes[1]) / 4 : null,
            unit: 'RPM'
        },
        SPEED: { 
            code: '010D', 
            parse: (bytes) => bytes ? bytes[0] : null,
            unit: 'km/h'
        },
        COOLANT: { 
            code: '0105', 
            parse: (bytes) => bytes ? bytes[0] - 40 : null,
            unit: '°C'
        },
        THROTTLE: { 
            code: '0111', 
            parse: (bytes) => bytes ? (bytes[0] * 100) / 255 : null,
            unit: '%'
        },
        
        // Extended Metrics
        FUEL_LEVEL: { 
            code: '012F', 
            parse: (bytes) => bytes ? (bytes[0] * 100) / 255 : null,
            unit: '%'
        },
        BATTERY: { 
            code: '0142', 
            parse: (bytes) => bytes ? ((bytes[0] * 256) + bytes[1]) / 1000 : null,
            unit: 'V'
        },
        ENGINE_LOAD: {
            code: '0104',
            parse: (bytes) => bytes ? (bytes[0] * 100) / 255 : null,
            unit: '%'
        },
        
        // Performance Metrics
        TIMING_ADVANCE: {
            code: '010E',
            parse: (bytes) => bytes ? (bytes[0] - 128) / 2 : null,
            unit: '°'
        },
        INTAKE_TEMP: {
            code: '010F',
            parse: (bytes) => bytes ? bytes[0] - 40 : null,
            unit: '°C'
        },
        MAF_RATE: {
            code: '0110',
            parse: (bytes) => bytes ? ((bytes[0] * 256) + bytes[1]) / 100 : null,
            unit: 'g/s'
        },
        
        // Fuel System
        SHORT_FUEL_TRIM_1: {
            code: '0106',
            parse: (bytes) => bytes ? (bytes[0] - 128) * 100 / 128 : null,
            unit: '%'
        },
        LONG_FUEL_TRIM_1: {
            code: '0107',
            parse: (bytes) => bytes ? (bytes[0] - 128) * 100 / 128 : null,
            unit: '%'
        },
        
        // Oxygen Sensors
        O2_B1S1: {
            code: '0114',
            parse: (bytes) => bytes ? bytes[0] / 200 : null,
            unit: 'V'
        },
        O2_B1S2: {
            code: '0115',
            parse: (bytes) => bytes ? bytes[0] / 200 : null,
            unit: 'V'
        }
    };

    // ========================================================================
    // DIAGNOSTIC TROUBLE CODES (DTCs) - Error code translations
    // ========================================================================
    // Format: 'CODE': 'Human-readable description'
    // P = Powertrain, C = Chassis, B = Body, U = Network
    
    window.DTC_DB = {
        // Fuel & Air Metering
        'P0101': 'Mass Air Flow Sensor Circuit Range/Performance',
        'P0102': 'Mass Air Flow Sensor Circuit Low Input',
        'P0103': 'Mass Air Flow Sensor Circuit High Input',
        'P0171': 'System Too Lean (Bank 1)',
        'P0172': 'System Too Rich (Bank 1)',
        'P0174': 'System Too Lean (Bank 2)',
        'P0175': 'System Too Rich (Bank 2)',
        
        // Ignition System & Misfire
        'P0300': 'Random/Multiple Cylinder Misfire Detected',
        'P0301': 'Cylinder 1 Misfire Detected',
        'P0302': 'Cylinder 2 Misfire Detected',
        'P0303': 'Cylinder 3 Misfire Detected',
        'P0304': 'Cylinder 4 Misfire Detected',
        'P0305': 'Cylinder 5 Misfire Detected',
        'P0306': 'Cylinder 6 Misfire Detected',
        'P0307': 'Cylinder 7 Misfire Detected',
        'P0308': 'Cylinder 8 Misfire Detected',
        
        // Sensors
        'P0110': 'Intake Air Temperature Sensor Circuit Malfunction',
        'P0113': 'Intake Air Temperature Sensor Circuit High',
        'P0115': 'Engine Coolant Temperature Circuit Malfunction',
        'P0117': 'Engine Coolant Temperature Circuit Low Input',
        'P0118': 'Engine Coolant Temperature Circuit High Input',
        'P0120': 'Throttle Position Sensor Circuit Malfunction',
        'P0121': 'Throttle Position Sensor Range/Performance',
        'P0122': 'Throttle Position Sensor Circuit Low Input',
        'P0123': 'Throttle Position Sensor Circuit High Input',
        
        // Oxygen Sensors
        'P0130': 'O2 Sensor Circuit Malfunction (Bank 1, Sensor 1)',
        'P0131': 'O2 Sensor Circuit Low Voltage (Bank 1, Sensor 1)',
        'P0132': 'O2 Sensor Circuit High Voltage (Bank 1, Sensor 1)',
        'P0133': 'O2 Sensor Circuit Slow Response (Bank 1, Sensor 1)',
        'P0134': 'O2 Sensor Circuit No Activity (Bank 1, Sensor 1)',
        'P0135': 'O2 Sensor Heater Circuit Malfunction (Bank 1, Sensor 1)',
        'P0136': 'O2 Sensor Circuit Malfunction (Bank 1, Sensor 2)',
        'P0137': 'O2 Sensor Circuit Low Voltage (Bank 1, Sensor 2)',
        'P0138': 'O2 Sensor Circuit High Voltage (Bank 1, Sensor 2)',
        
        // Catalytic Converter
        'P0420': 'Catalyst System Efficiency Below Threshold (Bank 1)',
        'P0421': 'Warm Up Catalyst Efficiency Below Threshold (Bank 1)',
        'P0430': 'Catalyst System Efficiency Below Threshold (Bank 2)',
        'P0431': 'Warm Up Catalyst Efficiency Below Threshold (Bank 2)',
        
        // EVAP System
        'P0440': 'Evaporative Emission Control System Malfunction',
        'P0441': 'Evaporative Emission Control System Incorrect Purge Flow',
        'P0442': 'Evaporative Emission Control System Leak Detected (Small)',
        'P0443': 'Evaporative Emission Control System Purge Control Valve Circuit',
        'P0446': 'Evaporative Emission Control System Vent Control Circuit',
        'P0455': 'Evaporative Emission Control System Leak Detected (Large)',
        
        // Vehicle Speed & Transmission
        'P0500': 'Vehicle Speed Sensor Malfunction',
        'P0501': 'Vehicle Speed Sensor Range/Performance',
        'P0700': 'Transmission Control System Malfunction',
        'P0715': 'Input/Turbine Speed Sensor Circuit Malfunction',
        'P0720': 'Output Speed Sensor Circuit Malfunction',
        
        // Computer & Communication
        'P0600': 'Serial Communication Link Malfunction',
        'P0601': 'Internal Control Module Memory Check Sum Error',
        'P0602': 'Control Module Programming Error',
        'P0603': 'Internal Control Module Keep Alive Memory (KAM) Error',
        'P0604': 'Internal Control Module Random Access Memory (RAM) Error',
        'P0605': 'Internal Control Module Read Only Memory (ROM) Error',
        'P0606': 'ECM/PCM Processor Fault',
        
        // Charging System
        'P0622': 'Generator Field/F Terminal Circuit Malfunction',
        'P0625': 'Generator Field/F Terminal Circuit Low',
        'P0626': 'Generator Field/F Terminal Circuit High',
        
        // Common Generic Codes
        'P1000': 'OBD System Readiness Test Not Complete',
        'U0100': 'Lost Communication With ECM/PCM',
        'U0101': 'Lost Communication With TCM',
        'U0121': 'Lost Communication With ABS Control Module',
        'C0040': 'Right Front Wheel Speed Circuit Malfunction'
    };

    // ========================================================================
    // HELPER UTILITIES
    // ========================================================================
    
    /**
     * Parse raw ELM327 response into byte array
     * @param {string} hex - Raw response like "41 0C 1A F8"
     * @param {string} expectedMode - Expected mode like "410C"
     * @returns {number[]|null} - Byte array or null if invalid
     */
    window.parseOBDResponse = (hex, expectedMode) => {
        if (!hex || hex.includes('NO DATA') || hex.includes('?') || hex.includes('ERROR')) {
            return null;
        }
        
        // Clean response: remove spaces, headers, and mode echo
        let clean = hex.replace(/\s+/g, '').toUpperCase();
        
        // Remove headers (e.g., "7E8" or "48 6B 10") - they vary by vehicle
        clean = clean.replace(/^[0-9A-F]{2,3}/, '');
        
        // Remove the mode echo
        if (expectedMode) {
            clean = clean.replace(expectedMode, '');
        }
        
        // Convert to byte array
        const pairs = clean.match(/.{1,2}/g);
        return pairs ? pairs.map(p => parseInt(p, 16)) : null;
    };

    /**
     * Decode DTC from hex bytes
     * @param {string} hex - Raw hex like "0300" or "01AB"
     * @returns {string} - Formatted DTC like "P0300"
     */
    window.decodeDTC = (hex) => {
        if (!hex || hex === '0000') return null;
        
        const firstDigit = parseInt(hex[0], 16);
        const prefixMap = {
            0: 'P0', 1: 'P1', 2: 'P2', 3: 'P3',
            4: 'C0', 5: 'C1', 6: 'C2', 7: 'C3',
            8: 'B0', 9: 'B1', 10: 'B2', 11: 'B3',
            12: 'U0', 13: 'U1', 14: 'U2', 15: 'U3'
        };
        
        const prefix = prefixMap[firstDigit] || 'P0';
        return prefix + hex.substring(1);
    };

    System.log('PIDs', `✓ Database loaded: ${Object.keys(window.PIDS).length} PIDs, ${Object.keys(window.DTC_DB).length} DTCs`);
})();

