# Self-Destruct & Expiry Verification Test Guide

## Overview
This guide helps you verify that the self-destruct mechanism (MongoDB TTL auto-deletion) is working correctly for both ParrotShare (clips) and ParrotURL (short links).

## Architecture
- **TTL Index:** MongoDB automatically deletes documents when their `expiresAt` timestamp passes
- **Delay:** Usually 1-2 minutes after expiry time
- **Manual Cleanup:** Also available via `npm run cleanup:confirm` (optional, not needed for normal operation)

---

## Test 1: ParrotURL Self-Destruct (5-Minute Expiry)

### Prerequisites
- Deployed frontend on Vercel
- Deployed backend on Render
- Both env vars correctly set

### Steps

1. **Open your Vercel frontend** (e.g., https://parrot-nest.vercel.app)

2. **Switch to ParrotURL tab** (if not already selected)

3. **Create a short URL with 5m expiry:**
   - Destination URL: `https://www.google.com`
   - Custom Slug: (leave blank for random)
   - Expiry: **5m (Quick Burn)**
   - Click "Shorten URL"

4. **Record the details:**
   - Short URL: _________________ (e.g., `https://parrot-nest.vercel.app/abc123`)
   - Short ID: _________________ (e.g., `abc123`)
   - Time created: _________________ (e.g., 2:30 PM)

5. **Wait exactly 5 minutes** (you can test the link immediately to confirm it works first)

6. **After 5 minutes, try to access the short URL:**
   - Open the short URL in browser
   - Expected response: **404 error** with message "Short URL not found"
   - ✅ Success: Link is deleted
   - ❌ Failed: Link still works (TTL not triggering)

7. **Check backend logs on Render:**
   - Go to Render dashboard → Logs
   - Look for entries around the 5-minute mark
   - Should see redirect attempts and then silence (no more requests)

### Results
- [ ] Short URL returned 404 after 5 minutes
- [ ] Link automatically deleted from database
- [ ] No errors in backend logs

---

## Test 2: ParrotShare Self-Destruct (5-Minute Expiry)

### Steps

1. **Switch to ParrotShare tab**

2. **Create a clip with 5m expiry:**
   - Select "Snippet" mode
   - Enter test text: `This is a test clip that will self-destruct`
   - Expiry: **5m (Quick Burn)**
   - Click "Create Clip"

3. **Record the details:**
   - Clip Code: _________________ (5 digits, e.g., `12345`)
   - Time created: _________________ (e.g., 2:35 PM)
   - Delete Token: _________________ (save this)

4. **Verify the clip works immediately:**
   - Share the code with yourself (or copy it)
   - Switch to "Retrieve" tab
   - Enter the code and click "Get Clip"
   - Confirm you can see the text ✅

5. **Wait exactly 5 minutes** from creation time

6. **After 5 minutes, try to retrieve the clip:**
   - Enter the same code again
   - Expected response: **404 error** with "Clip not found"
   - ✅ Success: Clip is deleted
   - ❌ Failed: Clip still exists

7. **Check backend uploads folder:**
   - SSH into Render instance or check storage
   - Path: `/backend/uploads/`
   - Verify any uploaded files are **not present** (if you uploaded a file with the clip)

### Results
- [ ] Clip returned 404 after 5 minutes
- [ ] Clip automatically deleted from database
- [ ] Associated files deleted from storage

---

## Test 3: URL with Longer Expiry (1h - Optional)

### Purpose
Verify that links DON'T expire too early.

### Steps

1. **Create a short URL with 1h expiry:**
   - Destination: `https://www.example.com`
   - Expiry: **1h (Phantom Hour)**
   - Click "Shorten URL"

2. **Verify it works immediately:** ✅

3. **Wait 5 minutes** (not the full hour)

4. **Access the link again:** Should still work ✅

5. **Expected:** Link remains valid until ~60 minutes from creation

### Results
- [ ] 1h link still works after 5 minutes
- [ ] No premature deletion

---

## Test 4: MongoDB TTL Index Verification (Advanced)

### Option A: Via MongoDB Atlas UI
1. Go to https://cloud.mongodb.com
2. Select your cluster and database
3. Collections: `urls` and `clips`
4. Indexes tab → look for `expiresAt_1` with **TTL** label
5. Should show: `expires after 0 seconds`

### Option B: Via MongoDB CLI
```bash
mongosh "mongodb+srv://..." --eval "
  db.urls.getIndexes().forEach(idx => {
    if (idx.expireAfterSeconds !== undefined) {
      print('URL TTL Index:', JSON.stringify(idx));
    }
  });
"
```

### Results
- [ ] TTL index exists on `urls.expiresAt`
- [ ] TTL index exists on `clips.expiresAt`
- [ ] Status: Active

---

## Troubleshooting

### Problem: Link/Clip Still Accessible After Expiry

**Possible Causes:**
1. **TTL index not created:** Check MongoDB Atlas indexes
2. **Time not synced:** Ensure backend server time is correct
3. **Env vars wrong:** Verify `MONGO_URI` is correct
4. **Browser cache:** Try incognito/private window
5. **Timezone mismatch:** Verify backend timezone

**Solutions:**
- Manually recreate TTL index: See MongoDB docs
- Check backend logs for errors: `Render → Logs`
- Test with fresh browser session
- Wait 2-3 minutes after expiry (MongoDB can delay)

### Problem: Unexpected 503 or Database Errors

**Check:**
1. MongoDB connection status (Render logs)
2. MONGO_URI is URL-encoded if it has special characters
3. Network/VPN not blocking MongoDB Atlas

---

## Success Criteria

✅ **All tests pass if:**
- 5m URLs return 404 after ~5-6 minutes
- 5m Clips return 404 after ~5-6 minutes
- 1h URLs still work after 5 minutes
- TTL indexes are active in MongoDB
- No errors in backend logs

✅ **Self-destruct mechanism is working correctly**

---

## Timeline for Testing

| Time | Action |
|------|--------|
| 2:30 PM | Create 5m URL + 5m Clip |
| 2:35 PM | Verify both work immediately |
| 2:40 PM | Verify 1h URL still works |
| 2:35-2:40 PM | Wait for TTL to trigger |
| 2:41 PM | Test 5m URL → should return 404 |
| 2:41 PM | Test 5m Clip → should return 404 |
| 2:42 PM | Review backend logs |
| 2:43 PM | Check MongoDB indexes |

---

## Reporting Results

When you complete the tests, provide:
1. ✅ or ❌ for each test
2. Actual timestamps vs expected
3. Any error messages observed
4. Backend log excerpts (if relevant)

Example:
```
✅ Test 1 (URL 5m): Created 2:30, returned 404 at 2:36 (6 min delay—normal)
✅ Test 2 (Clip 5m): Created 2:35, returned 404 at 2:41 (6 min delay—normal)
✅ Test 3 (URL 1h): Created 2:40, still works at 2:45 (expected)
✅ Test 4 (TTL Index): Both collections have active TTL indexes
```

---

## Notes

- **Expiry times are approximate:** MongoDB TTL can have 1-2 minute variance
- **No manual cleanup needed:** TTL does everything automatically
- **Clips with files:** Files in `/uploads/` are deleted when clip expires
- **QR codes:** Pre-generated QR codes are ephemeral (not stored long-term)

Good luck! Report back when tests complete. 🦜
