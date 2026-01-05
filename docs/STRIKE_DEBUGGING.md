# Strike Integration - Debugging Guide

If you're getting an "Authentication failed" error with Strike, this guide will help you troubleshoot.

## Quick Troubleshooting Checklist

- [ ] Copy the **entire** API key from Strike Settings (don't accidentally include spaces)
- [ ] Make sure your API key hasn't expired in Strike Settings
- [ ] Try generating a **new** API key and using that
- [ ] Check your browser console (F12) for detailed error messages
- [ ] Make sure you have internet connection
- [ ] Try in a different browser or incognito/private window
- [ ] Check that Strike.me website is accessible

## How to Check Console Logs

1. **Open browser Developer Tools**:
   - Press `F12` on Windows/Linux
   - Press `Cmd + Option + I` on Mac
   - Or right-click → "Inspect" → "Console" tab

2. **Look for lines starting with `[Strike]`** - these are our debug logs

3. **Copy the full error message** if you need to share it

## Understanding Error Messages

### Error: "All authentication methods failed"

**What it means**: None of the authentication methods we tried worked.

**What to check**:
- Is your API key correct? (Check you copied it fully)
- Is your API key expired? (Log into Strike and check Settings)
- Are you on the internet?

**What to do**:
1. Log into your Strike account
2. Go to Settings → API
3. Generate a completely NEW API key
4. Delete the old one
5. Copy the new one carefully
6. Try again in Sat Sorter

### Error: "401 Unauthorized - check your API key"

**What it means**: The API key is invalid or expired.

**What to check**:
- API key is correct (try copy-pasting again slowly)
- API key hasn't expired
- You're using the right key (sometimes people copy wrong things)

**What to do**:
1. In Strike Settings, delete your old API key
2. Generate a new one
3. Copy the **entire** string (from beginning to end, no spaces)
4. Paste into Sat Sorter and try again

### Error: "Strike API error: 404"

**What it means**: The Strike API endpoint couldn't be found. This might mean:
- Strike API servers are down
- Strike API has changed
- Network connectivity issue

**What to do**:
1. Check that https://strike.me is accessible
2. Wait a few minutes and try again
3. Try on your phone or another device
4. Check [Strike's status page](https://status.strike.me) if it exists

### Error: "CORS error" or "Failed to fetch"

**What it means**: Your browser can't reach Strike's API due to network/security settings.

**What to do**:
1. Try in an incognito/private window
2. Try on a different network (4G instead of WiFi, etc)
3. Check browser extensions aren't blocking requests
4. Try a different browser

## Step-by-Step Debugging

### Step 1: Verify You Have an API Key

1. Go to https://strike.me
2. Log in
3. Click your profile/settings
4. Find "API" or "Developer Settings"
5. Do you see an API key? If not, create one

### Step 2: Check the Key Format

Strike API keys usually look like:
```
sk_live_xxxxxxxxxxxxx
sk_test_xxxxxxxxxxxxx
api_key_xxxxxxxxxxxxx
```

They should:
- Be 20+ characters long
- Not contain spaces
- Be all one line (no line breaks)

### Step 3: Copy Carefully

1. In Strike Settings, find your API key
2. **Click the copy button** (if available) - don't manually select
3. Or select the entire key and copy (Ctrl+C / Cmd+C)
4. Paste into Sat Sorter
5. Don't edit it - use exactly what you copied

### Step 4: Check Expiration

Some API keys expire. If yours is old:
1. Log into Strike
2. Check if your API key shows an expiration date
3. If expired, create a new one
4. Delete the old one
5. Use the new one

### Step 5: Test with Browser Console

If you want to test the API key directly:

1. Open Developer Console (F12)
2. Paste this code (replace YOUR_KEY):

```javascript
// Replace with your actual API key
const apiKey = "sk_live_YOUR_KEY_HERE";

// Test 1: Bearer Token
fetch('https://api.strike.me/v1/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}).then(r => {
  console.log('Test 1 (Bearer):', r.status, r.statusText);
  return r.json();
}).then(d => console.log('Response:', d))
  .catch(e => console.log('Error:', e.message));
```

3. Press Enter
4. Look at the console output - it will tell you if the key works

## Console Log Interpretation

When you try to connect, you'll see logs like:

```
[Strike] Trying: Bearer token at /v1/me
[Strike] URL: https://api.strike.me/v1/me
[Strike] Response: 401 Unauthorized
[Strike] Auth failed (401): {"error":"invalid_token"}
```

**What each line means**:
- `Trying:` - Which authentication method we're testing
- `URL:` - The endpoint being tested
- `Response:` - The HTTP status code (200 is good, 401 is bad, 404 is not found)
- `Auth failed:` - Why it didn't work

## Common Scenarios

### Scenario 1: Just Got API Key, Still Getting Error

**Problem**: Brand new API key isn't working immediately

**Solution**: 
- Strike might need a minute to activate the key
- Try again after 30-60 seconds
- If still fails, generate a new key

### Scenario 2: Key Worked Before, Now Stopped

**Problem**: Your key suddenly stopped working

**Possible causes**:
- Key expired (most likely)
- Strike account suspended
- Security issue on your account

**Solution**:
1. Log into Strike
2. Check your account status
3. Check API key expiration
4. Generate a new key if needed

### Scenario 3: Getting Different Error Than Expected

**Problem**: The error message doesn't match this guide

**Solution**:
1. Copy the **entire error message**
2. Check your browser console for [Strike] logs
3. Share both in a message for support

## Strike API Documentation

If you want to dig deeper, Strike's API might have documentation at:
- https://docs.strike.me
- https://strike.me/developers
- Your Strike account → Settings → API

Look for:
- Authentication method (Bearer token, API key, etc)
- Available endpoints
- Rate limits

## Still Not Working?

If you've tried everything:

1. **Verify internet works**: Can you access https://strike.me?
2. **Check firewall/VPN**: Sometimes network restrictions block API calls
3. **Try different browser**: Could be browser-specific
4. **Clear cache**: Try Ctrl+Shift+Delete to clear browser cache
5. **Restart**: Sometimes just closing/reopening helps
6. **Try another device**: Phone, tablet, different computer

## When to Seek Help

Gather this information and share it (without your actual API key):

```
Browser: Chrome / Firefox / Safari / Edge
OS: Windows / Mac / Linux
Error: [Full error message from toast notification]
Console logs: [Paste the [Strike] lines from browser console]
Key format: [What your key looks like - sk_live_xxx or api_key_xxx?]
Key age: [New / A few days old / Several months old]
```

## Pro Tips

1. **Test with a fresh key**: If stuck, generate a completely new API key from scratch
2. **Copy with the button**: Click the copy button in Strike Settings if available
3. **Paste in Notepad first**: Paste your key in Notepad to verify it's correct, then copy from there
4. **One at a time**: Try connecting when you're not doing other things (could be rate limiting)
5. **Check Strike's status**: Before assuming your key is bad, make sure Strike is online

## Additional Resources

- [Strike Official Site](https://strike.me)
- [Strike Community](https://community.strike.me)
- Check your email - Strike might have sent security notices about your API key

---

**Still stuck?** The console logs will give you the most detailed information. Check the [Strike] lines carefully - they tell you exactly which authentication method failed and why.
