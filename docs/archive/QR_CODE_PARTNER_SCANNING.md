# QR Code Partner Scanning - Feature Implementation

## Overview

Added QR code scanning capability for adding budget partners. Users can now quickly add partners by scanning their npub QR code instead of typing or copy-pasting long addresses.

---

## Features

### ✅ QR Code Scanning
- Full-screen QR scanner modal
- Camera selection (front/back on mobile)
- Real-time scanning with visual feedback
- Error handling and retry capability

### ✅ Input Methods
Users can add partners via:
1. **Type manually** - Traditional text input
2. **Paste address** - Copy/paste npub or hex key
3. **Scan QR code** - Quick camera-based entry (NEW)

### ✅ Format Support
Scans work with:
- ✅ `npub1...` format (NIP-19 encoded)
- ✅ `nostr:npub1...` URI format
- ✅ `nostr:` prefix auto-stripped
- ✅ Hex public key format (64 char)

---

## User Experience

### Adding a Partner with QR Code

**Step 1: Open Partner Dialog**
```
User clicks: Profile Icon → "Budget Partners" → "Add Partner"
```

**Step 2: Scan QR Code**
```
Dialog shows:
┌──────────────────────────────┐
│ Partner Nostr Address        │
│                              │
│ [Input Field]  [📱 QR Button]│
│                              │
│ Enter npub, public key,      │
│ or scan QR code              │
└──────────────────────────────┘

User clicks: QR Code button
```

**Step 3: Camera Opens**
```
Full-screen QR Scanner Modal
├─ Camera feed
├─ QR frame overlay
├─ "Switch Camera" button (if multiple cameras)
└─ Error handling if camera not available
```

**Step 4: Point at QR Code**
```
Partner shows their npub QR code
(Usually in their Nostr client, profile, or settings)

User points phone at code
Scanner detects and reads automatically
```

**Step 5: Address Populated**
```
Scanner closes automatically
Input field now shows: npub1abc123...

User selects permission level
Clicks "Add"
Partner added successfully!
```

---

## Technical Implementation

### Components

**File**: `src/components/budget/ManagePartnersDialog.tsx`

**New Elements Added**:
```typescript
// State for QR scanner dialog
const [showQRScanner, setShowQRScanner] = useState(false);

// Handler for scanned QR codes
const handleQRScan = (scannedValue: string) => {
  // Remove 'nostr:' prefix if present
  let pubkey = scannedValue.trim();
  if (pubkey.startsWith('nostr:')) {
    pubkey = pubkey.substring(6);
  }
  // Populate input field
  setNewPartnerPubkey(pubkey);
  setShowQRScanner(false);
};
```

### QRScanner Component

**File**: `src/components/budget/QRScanner.tsx` (already exists)

Uses `html5-qrcode` library for:
- Cross-browser QR code detection
- Camera access and permissions
- Multi-camera support
- Real-time decoding

**Features**:
- Automatic camera detection
- Camera switching for multiple devices
- Error handling for permission denials
- Async initialization

---

## UI Layout

### Before Adding Partner

```
Add Partner Form:
┌─────────────────────────────────────┐
│ Partner Nostr Address               │
│ [Input for npub or hex key........] │
│ (Helper text about format)          │
│                                     │
│ Permission Level                    │
│ [Dropdown: View Only / Can Edit]    │
│                                     │
│ [Add Button] [Cancel Button]        │
└─────────────────────────────────────┘
```

### With QR Code Button (NEW)

```
Add Partner Form:
┌─────────────────────────────────────┐
│ Partner Nostr Address               │
│ ┌─────────────────────────────────┐ │
│ │[Input for npub or hex key...  ]  │ │
│ │              [📱 Scan QR]        │ │
│ └─────────────────────────────────┘ │
│ (Helper: "Enter npub, public key,  │
│  or scan QR code")                  │
│                                     │
│ Permission Level                    │
│ [Dropdown: View Only / Can Edit]    │
│                                     │
│ [Add Button] [Cancel Button]        │
└─────────────────────────────────────┘
```

### QR Scanner Modal

```
┌────────────────────────────────┐
│ ❌ Scan Partner's npub         │
│ Point camera at their QR code │
├────────────────────────────────┤
│                                │
│     ┌──────────────────┐       │
│     │                  │       │
│     │  [Live Camera]   │       │
│     │  + QR Frame      │       │
│     │                  │       │
│     └──────────────────┘       │
│                                │
│  [Switch Camera] (if available)│
│  Position QR code in frame     │
└────────────────────────────────┘
```

---

## Validation & Error Handling

### Input Validation

After scanning, input goes through same validation as manual entry:

```typescript
const isHex = /^[0-9a-f]{64}$/i.test(pubkey);
const isNpub = pubkey.startsWith('npub1') && pubkey.length >= 56;

if (!isHex && !isNpub) {
  // Show error
  setValidationError('Invalid format...');
}
```

### Camera Permissions

**Scenarios Handled:**
```
1. Camera not available
   → Error: "No cameras found on this device"
   
2. Camera permission denied
   → Error: "Camera permission denied. Please allow camera access."
   
3. Camera access fails
   → Error: "Failed to start camera. Please try again."
   
4. Generic error
   → Error: "Something went wrong"
   → [Try Again] button available
```

### Scanned Value Processing

```typescript
// Handles various QR code formats
const handleQRScan = (scannedValue: string) => {
  let pubkey = scannedValue.trim();
  
  // Remove URI prefix if present
  if (pubkey.startsWith('nostr:')) {
    pubkey = pubkey.substring(6);
  }
  
  // Now pubkey is clean and ready
  setNewPartnerPubkey(pubkey);
  setShowQRScanner(false);
};
```

---

## Mobile Considerations

### Android
- ✅ Full camera support
- ✅ Works with front and back cameras
- ✅ Automatic orientation handling
- ✅ Permission management via browser

### iOS
- ✅ Works in Safari and other browsers
- ✅ Requires user permission first time
- ✅ Can switch between cameras
- ✅ Fast decoding

### Desktop
- ✅ Works with built-in webcams
- ✅ Can switch between USB cameras
- ✅ Useful for scanning from phone/tablet
- ✅ Terminal-based QR generators supported

---

## Accessibility

### Keyboard Support
- ❌ QR scanner requires camera (can't use keyboard)
- ✅ Manual input still available for accessibility
- ✅ Tab/Enter navigation in form

### Screen Readers
- ✅ Button labeled "Scan QR code"
- ✅ Dialog title and description announced
- ✅ Error messages announced
- ✅ Input field accessible

### Visual Feedback
- ✅ QR frame overlay shows scanning area
- ✅ Camera loading animation
- ✅ Error messages with icons
- ✅ "Try Again" button always visible on error

---

## Testing Checklist

- [x] QR button appears next to input field
- [x] QR button opens scanner dialog
- [x] Scanner can access camera (with permission)
- [x] Scanner detects and reads QR codes
- [x] Scanned npub populates input field
- [x] Scanner dialog closes after successful scan
- [x] Validation still works on scanned input
- [x] Can manually enter if scan fails
- [x] Camera switch button works
- [x] Handles camera permission denial
- [x] Works on mobile (tested)
- [x] Works on desktop (tested)
- [x] Error messages are helpful
- [x] Retry functionality works

---

## Browser Compatibility

**Supported:**
- ✅ Chrome/Chromium 79+
- ✅ Firefox 77+
- ✅ Safari 11+
- ✅ Edge 79+
- ✅ Mobile browsers (iOS Safari, Chrome Android)

**Requirements:**
- Camera permissions
- HTTPS connection (for camera access)
- Modern browser with MediaDevices API

---

## Future Enhancements

### Potential Improvements
1. **Batch Scanning** - Scan multiple partners in one session
2. **QR Code Generation** - Generate your own npub QR for sharing
3. **Contact Book** - Save frequently added partners
4. **Barcode Support** - Support other barcode formats
5. **Image Upload** - Upload QR code image instead of camera
6. **Desktop Integration** - Drag/drop QR images

---

## Summary

✅ **QR Code Scanning** - Full implementation complete
✅ **Fallback to Manual Entry** - Always available
✅ **Mobile Friendly** - Optimized for mobile devices
✅ **Error Handling** - Comprehensive error scenarios
✅ **User Friendly** - Intuitive workflow
✅ **Accessible** - Keyboard and screen reader support

This feature significantly improves the UX for adding budget partners,
making it quick and frictionless while maintaining the conversation-first
approach to shared budgeting.

---

## Implementation Details

**File Modified:**
- `src/components/budget/ManagePartnersDialog.tsx`

**Component Used:**
- `src/components/budget/QRScanner.tsx` (already existed)

**Library:**
- `html5-qrcode` - Already in dependencies

**Build Status:**
- ✅ Compiles without errors
- ✅ No TypeScript issues
- ✅ Ready for production

---

## How to Use

### For Users:
1. Go to Profile Icon → "Budget Partners"
2. Click "Add Partner"
3. Click the QR code icon (📱)
4. Point camera at partner's npub QR code
5. Address auto-populates
6. Select permission level
7. Click "Add"

### For Partners:
- Generate your npub QR code in your Nostr client
- Share with budget partner
- They scan it to add you quickly
- Accept invite when you see it in your account

---

**Feature Complete and Production Ready** ✅
