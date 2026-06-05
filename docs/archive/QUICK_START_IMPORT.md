# CSV Import - Quick Start (2 Minutes)

## What You Need

1. **CSV file** with your transactions (from Strike, PayPal, your bank, etc.)
2. **Sat Sorter app** (just updated with import feature)
3. That's it!

## CSV Format (Required)

Your file needs 3 columns in this order:

```
date,description,amount
2024-01-15,Starbucks,-5.99
2024-01-16,Whole Foods,-45.32
2024-01-17,Paycheck,+2500.00
```

**Rules:**
- First line: `date,description,amount` (headers)
- Dates: YYYY-MM-DD (2024-01-15, not 1/15/2024)
- Amount: Negative for expenses, positive for income
- No currency symbols or commas in amounts

## Import in 3 Steps

### Step 1: Export from Strike
1. Log into Strike
2. Find Transactions section
3. Click Export/Download
4. Choose CSV
5. Save the file

### Step 2: Import into Sat Sorter
1. Open Sat Sorter Budget page
2. Look for blue banner: "Import transactions..."
3. Click "Import Transactions" button
4. Click "Select CSV File"
5. Choose your file
6. Wait for "Successfully imported X transactions"

### Step 3: Done!
Your transactions are now in Sat Sorter!
- See them in the Transactions panel
- They're auto-categorized (Starbucks → Food, etc.)
- Assign to categories as needed
- Track your spending

## What Happens Automatically

✅ **Merchants Recognized**
- Starbucks → Food/Restaurants
- Whole Foods → Food/Groceries
- Uber → Transportation
- Netflix → Subscriptions
- And 20+ more...

✅ **Duplicates Prevented**
- Won't import same transaction twice
- Safe to import multiple times

✅ **Amount Detection**
- Negative amounts = Expenses
- Positive amounts = Income
- Auto-categorized

## Example Workflow

```
1. Export Strike transactions (CSV)
   ↓
2. Click "Import Transactions" in Sat Sorter
   ↓
3. Select your CSV file
   ↓
4. See "Imported 8 transactions"
   ↓
5. View in Transactions panel
   ↓
6. Assign to budget categories
   ↓
7. Done! Your spending is tracked!
```

## Common Questions

**Q: What if my CSV is from PayPal instead of Strike?**
A: Works perfectly! Just make sure it has date, description, amount columns.

**Q: Can I import multiple times?**
A: Yes! The app prevents duplicates, so it's safe to re-import.

**Q: What if the category is wrong?**
A: Click the transaction and change it. Takes 5 seconds.

**Q: Do I need an API key?**
A: Nope! Just upload the CSV file.

**Q: Does it work offline?**
A: Yes! Everything is local to your device.

**Q: Can I delete imported transactions?**
A: Yes! Click the X on any transaction.

## Troubleshooting

**"No transactions found"**
- Check date format: must be YYYY-MM-DD
- Check first line has: `date,description,amount`

**"Imported 0 transactions"**
- Check date format is YYYY-MM-DD (2024-01-15)
- Make sure amounts are numbers (no symbols)

**Import shows partial count**
- Some transactions might have been duplicates (that's OK!)
- Or some lines had incorrect format

## Need Help?

See full guide: `CSV_IMPORT_GUIDE.md`

---

**That's it! Import your transactions in 2 minutes.** ⚡
