# Strike API - Visual Troubleshooting Guide

## The Problem

You're seeing: **"Authentication failed"** ❌

## The Solution Path

```
┌─────────────────────────────────────────────┐
│  Getting "Authentication Failed" Error?     │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Step 1: Try the Debug Tool                 │
│  (Easy, visual, no typing required)         │
│  ► Click "Debug" button in dialog           │
│  ► Paste your API key                       │
│  ► Click "Run Tests"                        │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
   ✓ PASS         ✗ FAIL
   (Green)        (Red)
       │               │
       │               ├──► 401? Bad key
       │               │    → Get new key
       │               │
       │               ├──► 404? Endpoint wrong
       │               │    → Try different method
       │               │
       │               └──► Network error?
       │                    → Check connection
       │
       ▼
  Try Connecting
  (Now it should work!)
```

## Step-by-Step Visual

### 1️⃣ See the Error
You click "Connect Strike" and see:
```
❌ Authentication failed
The API key appears to be invalid...
```

### 2️⃣ Click Debug
You see this dialog:
```
┌─────────────────────────────────────────┐
│ Strike API Debug Tester         ☓       │
├─────────────────────────────────────────┤
│                                         │
│ API Key: [●●●●●●●●●●●●●]  [Show]     │
│                                         │
│ [  Run Tests  ] [↻]        [Debug]     │
│                                         │
│ (paste key and click Run Tests)        │
│                                         │
└─────────────────────────────────────────┘
```

### 3️⃣ Run Tests
You see results like:
```
Test Results:

✓ Bearer token at /v1/me
  Status: 200
  Time: 245ms

✗ X-API-Key header at /v1/me
  Status: 401
  Time: 198ms

✓ Bearer token at /v1/account
  Status: 200
  Time: 201ms

✗ Bearer token at /v1/user
  Status: 404
  Time: 175ms

✓ Found 2 working methods!
```

### 4️⃣ Understand Results

**GREEN checkmark = ✓ Works**
```
✓ Bearer token at /v1/me
  Status: 200 ← This is good!
```

**RED X = ✗ Doesn't work**
```
✗ X-API-Key header at /v1/me
  Status: 401 ← Authentication failed
```

### 5️⃣ What Status Codes Mean

| Code | Meaning | Your Key |
|------|---------|----------|
| 200 ✓ | Success | ✓ Works! |
| 401 ✗ | Unauthorized | ✗ Bad/expired |
| 403 ✗ | Forbidden | ✗ No permission |
| 404 ✗ | Not Found | ✗ Wrong endpoint |
| 500 ⚠️ | Server Error | ⚠️ Strike issue |

## Decision Tree

```
Did tests show any green (200 status)?
│
├─ YES (Green 200s)
│  │
│  └─► Your key is VALID!
│       Try normal "Connect Strike" button
│       It should work now
│
└─ NO (All red)
   │
   ├─ Mostly 401s?
   │  │
   │  └─► Bad/expired key
   │       ► Go to Strike Settings
   │       ► Delete old key
   │       ► Create new key
   │       ► Try again
   │
   ├─ Mix of errors?
   │  │
   │  └─► API might be down
   │       ► Check https://strike.me
   │       ► Try again later
   │
   └─ Network errors?
      │
      └─► Connection issue
          ► Try WiFi instead
          ► Try different network
          ► Try different browser
```

## Common Visual Outcomes

### Outcome 1: All Green ✓

```
✓ Bearer token at /v1/me
  Status: 200

✓ X-API-Key header at /v1/me
  Status: 200

✓ Bearer token at /v1/account
  Status: 200

✓ Bearer token at /v1/user
  Status: 200

✓ Found 4 working methods!
```

**What it means**: Your API key is perfect!
**What to do**: Try normal connection - it will work now

---

### Outcome 2: Some Green, Some Red

```
✓ Bearer token at /v1/me
  Status: 200

✗ X-API-Key header at /v1/me
  Status: 401

✓ Bearer token at /v1/account
  Status: 200

✗ Bearer token at /v1/user
  Status: 404

✓ Found 2 working methods!
```

**What it means**: Your API key works with some methods!
**What to do**: Try normal connection - the app will use the working methods

---

### Outcome 3: All Red ✗

```
✗ Bearer token at /v1/me
  Status: 401

✗ X-API-Key header at /v1/me
  Status: 401

✗ Bearer token at /v1/account
  Status: 401

✗ Bearer token at /v1/user
  Status: 401

✗ No working authentication method found.
```

**What it means**: Your API key is invalid or expired
**What to do**:
1. Go to Strike Settings → API
2. Delete your old key
3. Create a new key
4. Copy and paste again
5. Run tests again

## Manual Testing (If Debug Tool Doesn't Show)

If you're tech-savvy and want to test manually:

### In Browser Console (F12):

```javascript
// Your API key
const key = "sk_live_YOUR_ACTUAL_KEY";

// Test 1
fetch('https://api.strike.me/v1/me', {
  headers: { 'Authorization': `Bearer ${key}` }
}).then(r => console.log('Test 1:', r.status))
  .catch(e => console.log('Test 1 error:', e.message));

// Test 2
fetch('https://api.strike.me/v1/me', {
  headers: { 'X-API-Key': key }
}).then(r => console.log('Test 2:', r.status))
  .catch(e => console.log('Test 2 error:', e.message));
```

If you see `Test 1: 200` or `Test 2: 200`, your key works!

## The Quick Path

```
1. See error message       [1 second]
       ▼
2. Click Debug button      [2 seconds]
       ▼
3. Paste API key           [3 seconds]
       ▼
4. Click Run Tests         [2 seconds]
       ▼
5. See results             [Instant]
       ▼
6. Know what's wrong       [Done!]

Total time: ~30 seconds
```

## Why This Helps

**Old Way:**
- ❌ Confusing error: "Authentication failed"
- ❌ No idea what's wrong
- ❌ Have to dig through console
- ❌ Could be key, could be network, could be API

**New Way:**
- ✓ Click Debug button
- ✓ See exactly which methods work/fail
- ✓ Know instantly if key is good
- ✓ Color-coded (green = good, red = bad)

## Questions?

### Q: What if tests show green but connection still fails?
**A:** Try the normal connection button - it will use the working methods now.

### Q: What if all tests are red?
**A:** Your API key is invalid. Generate a new one in Strike Settings.

### Q: What if tests time out?
**A:** Strike API might be slow. Try again or check their status.

### Q: Can I use this to test multiple keys?
**A:** Yes! Clear the field and paste a different key, then run tests again.

---

**That's it!** The Debug tool makes authentication issues super obvious. 🎯
