# CSV Transaction Import - User Guide

## Overview

Instead of using the problematic Strike API, we now have a **CSV import feature** that's simple, reliable, and works with any financial service.

## How to Use

### Step 1: Export Your Transactions

**From Strike:**
1. Log into your Strike account
2. Find "Transactions" or "History" section
3. Click "Export" or "Download"
4. Choose CSV format
5. Save the file

**From PayPal:**
1. Go to Activity or History
2. Click Download
3. Select CSV format

**From Your Bank:**
1. Go to Transactions or Activity
2. Look for Export/Download button
3. Choose CSV format

**From Other Services:**
- Most apps have an Export to CSV option
- Look in Settings or Account section

### Step 2: Import into Sat Sorter

1. Go to your **Budget** page
2. Look for the blue banner: "Import transactions from Strike, PayPal, or any CSV export"
3. Click **"Import Transactions"** button
4. A dialog will open
5. Click **"Select CSV File"**
6. Choose your exported CSV file
7. Wait a moment for processing
8. Done! Transactions are imported

### Step 3: Assign to Categories

After import:
1. Go to your **Transactions Panel** (right sidebar)
2. Click on an unassigned transaction
3. Select the bucket (category) and line item
4. The transaction is assigned
5. Repeat for other transactions or use auto-categorization

## CSV Format

Your CSV file needs this format:

```
date,description,amount
2024-01-15,Starbucks,-5.99
2024-01-16,Whole Foods,-45.32
2024-01-17,Paycheck,+2500.00
2024-01-18,Uber,-12.50
```

**Requirements:**
- **First line:** Headers (date, description, amount)
- **Date format:** YYYY-MM-DD (2024-01-15)
- **Amount:** Positive or negative (negative = expense)
- **Description:** Any text (merchant name, etc.)

## Features

✅ **Auto-Categorization**
- Recognizes Starbucks → Food/Restaurants
- Recognizes Whole Foods → Food/Groceries
- Recognizes Uber → Transportation
- And 20+ other patterns
- You can always change the category

✅ **Duplicate Detection**
- Won't import the same transaction twice
- Checks date + amount + description
- Skips duplicates silently

✅ **Income & Expenses**
- Negative amounts (-5.99) = Expense
- Positive amounts (+2500) = Income
- Auto-detected from CSV

✅ **Error Handling**
- Skips invalid lines
- Shows success count
- Tells you how many were skipped

## Supported Services

### ✅ Works With
- Strike
- PayPal
- Bank CSV exports
- Apple Card/Google Pay (if they export CSV)
- Venmo (if they export CSV)
- Square Cash
- Any service with CSV export

### Requirements
The CSV must have:
1. A header line (date, description, amount)
2. Date in YYYY-MM-DD format
3. Amount as a number (positive or negative)

## Example Workflows

### Workflow 1: Import Monthly Bill Pay

1. Export Strike bill pay history as CSV
2. Click Import Transactions
3. Select the CSV
4. Wait for import to complete (usually instant)
5. See "Imported 8 transactions"
6. Check Transactions panel
7. Assign to "Housing" or "Utilities" category
8. Done!

### Workflow 2: Import All Strike Transactions

1. Export entire Strike history (all transactions)
2. Import into Sat Sorter
3. Most will auto-categorize
4. Adjust any mis-categorizations
5. View your spending patterns

### Workflow 3: Mixed Import (Strike + PayPal)

1. Export Strike transactions
2. Import Strike CSV (8 transactions)
3. Export PayPal transactions
4. Import PayPal CSV (12 transactions)
5. Now see combined spending

## Troubleshooting

### "No transactions found"
**Problem:** CSV format wasn't recognized

**Solution:**
- Check first line has: `date,description,amount`
- Check dates are YYYY-MM-DD format (2024-01-15)
- Make sure file is actually CSV, not Excel

### "Imported 0 transactions"
**Problem:** All lines were skipped

**Solution:**
- Check date format (must be YYYY-MM-DD)
- Make sure amount column has numbers
- Skip the header line (don't count it)

### "Some transactions didn't import"
**Problem:** Some lines had errors

**Solution:**
- Check date format on problematic lines
- Make sure amount is a number
- Remove any extra quotes or special characters

### "Some transactions were skipped"
**Problem:** They were duplicates

**Solution:**
- That's expected! Duplicates are good to skip
- Check your Transactions panel
- You might have imported that CSV before

## CSV Tips

### Export with Headers
Most services automatically include a header line. Make sure it's there!

### Remove Extra Columns
If you export with 10 columns, you only need 3:
- date
- description  
- amount

You can delete the others or just leave them (they'll be ignored).

### Date Format
**MUST be:** YYYY-MM-DD
- ✅ 2024-01-15 (correct)
- ❌ 1/15/2024 (wrong)
- ❌ 01-15-2024 (wrong)
- ❌ Jan 15, 2024 (wrong)

### Amounts
**Can be either:**
- -5.99 (negative = expense)
- 5.99 (assume positive = income)
- Don't include currency symbols ($, €, etc.)
- Don't include commas (1000 not 1,000)

## Example CSVs

### Strike Format
```
date,description,amount
2024-01-15,Starbucks Coffee,-5.99
2024-01-16,Whole Foods Market,-45.32
2024-01-17,Direct Deposit,+2500.00
```

### PayPal Format
```
date,description,amount
2024-01-15,Starbucks,-5.99
2024-01-16,Whole Foods,-45.32
2024-01-17,Salary Deposit,2500.00
```

### Bank Format
```
date,description,amount
2024-01-15,COFFEE SHOP,-5.99
2024-01-16,GROCERY STORE,-45.32
2024-01-17,PAYROLL DEPOSIT,2500.00
```

All work! Just make sure the format is correct.

## Advanced: Manual CSV Creation

If you don't have CSV export, you can create one manually:

1. Open Google Sheets or Excel
2. Create 3 columns: date, description, amount
3. Add your transactions
4. File → Download → CSV
5. Import into Sat Sorter

## Auto-Categorization Reference

The system recognizes these merchants automatically:

**Food & Dining**
- Starbucks → Food/Restaurants
- Whole Foods, Kroger → Food/Groceries
- Pizza, Burger shops → Food/Restaurants
- DoorDash, Uber Eats → Food/Restaurants

**Transportation**
- Uber, Lyft → Transportation
- Gas stations (Shell, Chevron) → Transportation/Gas
- Airlines → Transportation

**Utilities & Housing**
- Electric, Water companies → Housing/Utilities
- Verizon, AT&T → Housing/Utilities

**Subscriptions**
- Netflix, Spotify → Lifestyle/Subscriptions
- Gym, Fitness → Lifestyle/Entertainment

**Savings**
- Bitcoin, Coinbase → Savings/Bitcoin Stack

**And more...**

You can always change the category manually after import!

## FAQ

**Q: Can I import multiple CSVs?**
A: Yes! Import one, then click Import again for another file.

**Q: What if the category is wrong?**
A: Click the transaction and change the category.

**Q: Can I delete imported transactions?**
A: Yes! Click the X on any transaction to delete it.

**Q: Does it work offline?**
A: Yes! Everything is stored locally on your device.

**Q: Can I export my data?**
A: You can use browser developer tools to access localStorage.

**Q: Is my data private?**
A: Yes! Everything stays on your device. No servers involved.

## Next Steps

1. **Export your transactions** from Strike/PayPal/your bank
2. **Click Import Transactions** on the Budget page
3. **Select your CSV file**
4. **View imported transactions**
5. **Assign to categories** as needed
6. **Track your spending!**

---

**This CSV import is reliable, flexible, and works with any financial service!** 📊
