import { describe, it, expect } from 'vitest';
import { parseCSVTransactions } from '@/lib/csvImport';

// Use a fixed BTC price for predictable sats calculations
const USD_PER_BTC = 100_000; // $100k per BTC
const SATS_PER_USD = 100_000_000 / USD_PER_BTC; // = 1000 sats per $1

// Helper: $1 = 1000 sats, so $4.50 = 4500 sats, $5000 = 5,000,000 sats
function usdToSats(usd: number): number {
  return Math.round((usd / USD_PER_BTC) * 100_000_000);
}

describe('parseCSVTransactions', () => {

  // ─── Basic Parsing ──────────────────────────────────────────────

  describe('basic parsing', () => {
    it('parses a simple CSV with headers', () => {
      const csv = `date,description,amount
2024-01-15,Coffee Shop,-4.50
2024-01-14,Paycheck,5000`;

      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);

      expect(result.transactions).toHaveLength(2);
      expect(result.totalRows).toBe(2);
      expect(result.skippedRows).toBe(0);

      // Expense
      expect(result.transactions[0].description).toBe('Coffee Shop');
      expect(result.transactions[0].isIncome).toBe(false);
      expect(result.transactions[0].amount).toBe(usdToSats(4.50));

      // Income
      expect(result.transactions[1].description).toBe('Paycheck');
      expect(result.transactions[1].isIncome).toBe(true);
      expect(result.transactions[1].amount).toBe(usdToSats(5000));
    });

    it('parses a CSV without headers (positional)', () => {
      const csv = `2024-01-15,Coffee Shop,-4.50
2024-01-14,Paycheck,5000`;

      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].description).toBe('Coffee Shop');
      expect(result.transactions[0].isIncome).toBe(false);
    });

    it('handles empty CSV', () => {
      const result = parseCSVTransactions('', 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('handles CSV with only whitespace', () => {
      const result = parseCSVTransactions('   \n  \n  ', 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(0);
    });
  });

  // ─── Date Format Parsing ────────────────────────────────────────

  describe('date formats', () => {
    it('parses ISO dates (YYYY-MM-DD)', () => {
      const csv = `date,description,amount
2024-03-15,Coffee,-5.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toContain('2024-03-15');
    });

    it('parses ISO dates with time (YYYY-MM-DDTHH:MM:SS)', () => {
      const csv = `date,description,amount
2024-03-15T10:30:00,Coffee,-5.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toContain('2024-03-15');
    });

    it('parses US date format (MM/DD/YYYY)', () => {
      const csv = `date,description,amount
03/15/2024,Coffee,-5.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toContain('2024-03-15');
    });

    it('parses US date format with single digits (M/D/YYYY)', () => {
      const csv = `date,description,amount
3/5/2024,Coffee,-5.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toContain('2024-03-05');
    });

    it('parses US date format with 2-digit year (MM/DD/YY)', () => {
      const csv = `date,description,amount
03/15/24,Coffee,-5.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toContain('2024-03-15');
    });

    it('parses European date format when day > 12 (DD/MM/YYYY)', () => {
      const csv = `date,description,amount
15/03/2024,Coffee,-5.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toContain('2024-03-15');
    });

    it('parses European dot format (DD.MM.YYYY)', () => {
      const csv = `date,description,amount
15.03.2024,Coffee,-5.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toContain('2024-03-15');
    });

    it('parses month name format (Jan 15, 2024)', () => {
      const csv = `date,description,amount
Jan 15, 2024,Coffee,-5.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toContain('2024-01-15');
    });

    it('parses full month name (January 15, 2024)', () => {
      const csv = `date,description,amount
January 15, 2024,Coffee,-5.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toContain('2024-01-15');
    });

    it('parses day-first month name (15 Jan 2024)', () => {
      const csv = `date,description,amount
15 Jan 2024,Coffee,-5.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toContain('2024-01-15');
    });

    it('parses Unix timestamp in seconds', () => {
      const csv = `date,description,amount
1710489600,Coffee,-5.00`; // 2024-03-15T08:00:00Z
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toContain('2024-03-15');
    });

    it('parses Unix timestamp in milliseconds', () => {
      const csv = `date,description,amount
1710489600000,Coffee,-5.00`; // 2024-03-15T08:00:00Z
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].date).toContain('2024-03-15');
    });

    it('skips rows with unparseable dates', () => {
      const csv = `date,description,amount
not-a-date,Coffee,-5.00
2024-01-15,Valid,-5.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.skippedRows).toBe(1);
    });
  });

  // ─── Amount Format Parsing ─────────────────────────────────────

  describe('amount formats', () => {
    it('parses dollar amounts ($4.50)', () => {
      const csv = `date,description,amount
2024-01-15,Coffee,$4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(usdToSats(4.50));
      expect(result.transactions[0].isIncome).toBe(true); // positive = income
    });

    it('parses negative dollar amounts (-$4.50)', () => {
      const csv = `date,description,amount
2024-01-15,Coffee,-$4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(usdToSats(4.50));
      expect(result.transactions[0].isIncome).toBe(false);
    });

    it('parses parentheses as negative (($4.50) = expense)', () => {
      const csv = `date,description,amount
2024-01-15,Coffee,($4.50)`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(usdToSats(4.50));
      expect(result.transactions[0].isIncome).toBe(false);
    });

    it('parses comma thousands separator (1,234.56)', () => {
      const csv = `date,description,amount
2024-01-15,Salary,1,234.56`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(usdToSats(1234.56));
      expect(result.transactions[0].isIncome).toBe(true);
    });

    it('parses European decimal (1.234,56)', () => {
      const csv = `date,description,amount
2024-01-15,Salary,1.234,56`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(usdToSats(1234.56));
      expect(result.transactions[0].isIncome).toBe(true);
    });

    it('parses European decimal without thousands (4,50)', () => {
      const csv = `date,description,amount
2024-01-15,Coffee,-4,50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(usdToSats(4.50));
      expect(result.transactions[0].isIncome).toBe(false);
    });

    it('skips zero-amount transactions', () => {
      const csv = `date,description,amount
2024-01-15,Free Item,0.00
2024-01-15,Coffee,-4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
    });

    it('skips rows with unparseable amounts', () => {
      const csv = `date,description,amount
2024-01-15,Coffee,N/A
2024-01-15,Coffee,-4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.skippedRows).toBe(1);
    });

    it('handles explicit positive sign (+4.50)', () => {
      const csv = `date,description,amount
2024-01-15,Refund,+4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].isIncome).toBe(true);
      expect(result.transactions[0].amount).toBe(usdToSats(4.50));
    });

    it('handles euro symbol (€4.50)', () => {
      const csv = `date,description,amount
2024-01-15,Coffee,-€4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(usdToSats(4.50));
    });
  });

  // ─── Sats Denomination ──────────────────────────────────────────

  describe('sats denomination', () => {
    it('parses amounts in sats directly without conversion', () => {
      const csv = `date,description,amount
2024-01-15,Coffee,-450
2024-01-14,Paycheck,5000000`;

      const result = parseCSVTransactions(csv, 'sats');

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].amount).toBe(450);
      expect(result.transactions[0].isIncome).toBe(false);
      expect(result.transactions[1].amount).toBe(5000000);
      expect(result.transactions[1].isIncome).toBe(true);
    });

    it('works without usdPerBtc when unit is sats', () => {
      const csv = `date,description,amount
2024-01-15,Coffee,-450`;
      const result = parseCSVTransactions(csv, 'sats');
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(450);
    });

    it('skips USD rows when usdPerBtc is not available', () => {
      const csv = `date,description,amount
2024-01-15,Coffee,-4.50`;
      const result = parseCSVTransactions(csv, 'usd');
      expect(result.transactions).toHaveLength(0);
      expect(result.skippedRows).toBe(1);
      expect(result.errors.some(e => e.includes('BTC price not available'))).toBe(true);
    });
  });

  // ─── Column Detection ───────────────────────────────────────────

  describe('column detection', () => {
    it('detects columns with alternative header names', () => {
      const csv = `Transaction Date,Payee,Value
2024-01-15,Coffee Shop,-4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Coffee Shop');
      expect(result.detectedColumns.date).toBe('Transaction Date');
      expect(result.detectedColumns.description).toBe('Payee');
      expect(result.detectedColumns.amount).toBe('Value');
    });

    it('detects memo header as description', () => {
      const csv = `Date,Memo,Amount
2024-01-15,Latte purchase,-4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Latte purchase');
    });

    it('detects narration header as description', () => {
      const csv = `Date,Narration,Amount
2024-01-15,Grocery shopping,-55.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Grocery shopping');
    });

    it('handles columns in different order (amount, date, description)', () => {
      const csv = `amount,date,description
-4.50,2024-01-15,Coffee`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Coffee');
      expect(result.transactions[0].date).toContain('2024-01-15');
      expect(result.transactions[0].amount).toBe(usdToSats(4.50));
    });

    it('handles columns with extra columns present', () => {
      const csv = `date,description,amount,balance,category
2024-01-15,Coffee,-4.50,95.50,Food`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Coffee');
      expect(result.transactions[0].amount).toBe(usdToSats(4.50));
    });
  });

  // ─── Quoted Fields ──────────────────────────────────────────────

  describe('quoted fields', () => {
    it('handles commas inside quoted descriptions', () => {
      const csv = `date,description,amount
2024-01-15,"Coffee, Tea & Snacks",-4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Coffee, Tea & Snacks');
    });

    it('handles escaped double quotes inside quoted fields', () => {
      const csv = `date,description,amount
2024-01-15,"John ""The Man"" Smith",-4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('John "The Man" Smith');
    });

    it('handles single-quoted fields', () => {
      const csv = `date,description,amount
2024-01-15,'Coffee Shop',-4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Coffee Shop');
    });
  });

  // ─── Delimiter Detection ────────────────────────────────────────

  describe('delimiter detection', () => {
    it('detects semicolon delimiter', () => {
      const csv = `date;description;amount
2024-01-15;Coffee;-4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Coffee');
      expect(result.transactions[0].amount).toBe(usdToSats(4.50));
    });

    it('detects tab delimiter', () => {
      const csv = `date\tdescription\tamount\n2024-01-15\tCoffee\t-4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Coffee');
      expect(result.transactions[0].amount).toBe(usdToSats(4.50));
    });
  });

  // ─── Line Endings ───────────────────────────────────────────────

  describe('line endings', () => {
    it('handles Windows line endings (\\r\\n)', () => {
      const csv = 'date,description,amount\r\n2024-01-15,Coffee,-4.50\r\n2024-01-14,Pay,5000';
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(2);
    });

    it('handles old Mac line endings (\\r)', () => {
      const csv = 'date,description,amount\r2024-01-15,Coffee,-4.50\r2024-01-14,Pay,5000';
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(2);
    });

    it('handles mixed line endings', () => {
      const csv = 'date,description,amount\r\n2024-01-15,Coffee,-4.50\r2024-01-14,Pay,5000';
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(2);
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles blank lines between data rows', () => {
      const csv = `date,description,amount
2024-01-15,Coffee,-4.50

2024-01-14,Pay,5000

2024-01-13,Gas,-40.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(3);
    });

    it('handles leading/trailing whitespace in values', () => {
      const csv = `date,description,amount
  2024-01-15 ,  Coffee Shop  ,  -4.50  `;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Coffee Shop');
      expect(result.transactions[0].amount).toBe(usdToSats(4.50));
    });

    it('handles empty description by using default text', () => {
      const csv = `date,description,amount
2024-01-15,,-4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].description).toBe('Imported transaction');
    });

    it('skips rows with fewer than 3 columns', () => {
      const csv = `date,description,amount
2024-01-15,Only Two Columns
2024-01-15,Coffee,-4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.skippedRows).toBe(1);
    });

    it('handles very large amounts', () => {
      const csv = `date,description,amount
2024-01-15,Big Salary,1000000.00`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(usdToSats(1000000));
    });

    it('handles very small amounts', () => {
      const csv = `date,description,amount
2024-01-15,Tiny Expense,-0.01`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
      // $0.01 at $100k/BTC = 1 sat (rounding up from 0.01 * 1000 = 10 sats)
      // Actually 0.01 * 100_000_000 / 100_000 = 10 sats
      expect(result.transactions[0].amount).toBeGreaterThan(0);
    });

    it('preserves rawAmount field', () => {
      const csv = `date,description,amount
2024-01-15,Coffee,-4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions[0].rawAmount).toBe(-4.50);
    });

    it('preserves rawAmount for positive amounts', () => {
      const csv = `date,description,amount
2024-01-15,Salary,5000`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions[0].rawAmount).toBe(5000);
    });
  });

  // ─── Real-World CSV Formats ─────────────────────────────────────

  describe('real-world formats', () => {
    it('parses a Strike-like export', () => {
      const csv = `Date,Description,Amount
2024-03-10,BTC Purchase,-25.00
2024-03-09,Received from John,10.00
2024-03-08,Coffee Shop,-4.75
2024-03-07,Direct Deposit,3000.00`;

      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);

      expect(result.transactions).toHaveLength(4);
      expect(result.transactions[0].isIncome).toBe(false);
      expect(result.transactions[1].isIncome).toBe(true);
      expect(result.transactions[2].isIncome).toBe(false);
      expect(result.transactions[3].isIncome).toBe(true);
    });

    it('parses a Cash App-like export', () => {
      const csv = `Date,Activity,Amount
03/15/2024,Coffee,-4.50
03/14/2024,From Mom,50.00
03/13/2024,Gas Station,-35.00`;

      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);

      expect(result.transactions).toHaveLength(3);
      expect(result.detectedColumns.description).toBe('Activity');
    });

    it('parses a bank export with separate Debit/Credit columns', () => {
      const csv = `Transaction Date,Description,Debit,Credit,Running Balance
2024-03-15,GROCERY STORE,52.30,,1000.00
2024-03-14,DIRECT DEPOSIT,,3000.00,3052.30
2024-03-13,COFFEE SHOP,4.50,,3056.80`;

      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);

      expect(result.transactions).toHaveLength(3);

      // Grocery — debit (expense)
      expect(result.transactions[0].description).toBe('GROCERY STORE');
      expect(result.transactions[0].isIncome).toBe(false);
      expect(result.transactions[0].amount).toBe(usdToSats(52.30));

      // Direct deposit — credit (income)
      expect(result.transactions[1].description).toBe('DIRECT DEPOSIT');
      expect(result.transactions[1].isIncome).toBe(true);
      expect(result.transactions[1].amount).toBe(usdToSats(3000));

      // Coffee — debit (expense)
      expect(result.transactions[2].description).toBe('COFFEE SHOP');
      expect(result.transactions[2].isIncome).toBe(false);
      expect(result.transactions[2].amount).toBe(usdToSats(4.50));
    });

    it('parses a bank export with Withdrawal/Deposit column names', () => {
      const csv = `Date,Description,Withdrawal,Deposit
2024-03-15,Grocery,52.30,
2024-03-14,Paycheck,,3000.00`;

      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].isIncome).toBe(false);
      expect(result.transactions[1].isIncome).toBe(true);
    });

    it('parses a wallet export in sats', () => {
      const csv = `date,description,amount
2024-01-15,Lightning payment,-5000
2024-01-14,Lightning received,15000
2024-01-13,Keysend received,100`;

      const result = parseCSVTransactions(csv, 'sats');

      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0].amount).toBe(5000);
      expect(result.transactions[0].isIncome).toBe(false);
      expect(result.transactions[1].amount).toBe(15000);
      expect(result.transactions[1].isIncome).toBe(true);
    });

    it('parses European bank export with semicolons and European amounts', () => {
      const csv = `Datum;Verwendungszweck;Betrag
15.03.2024;Kaffee;-4,50
14.03.2024;Gehalt;3000,00`;

      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].isIncome).toBe(false);
      expect(result.transactions[0].amount).toBe(usdToSats(4.50));
      expect(result.transactions[1].isIncome).toBe(true);
      expect(result.transactions[1].amount).toBe(usdToSats(3000));
    });

    it('parses a large multi-month statement', () => {
      const lines = ['date,description,amount'];
      for (let day = 1; day <= 30; day++) {
        const date = `2024-03-${String(day).padStart(2, '0')}`;
        lines.push(`${date},Daily Coffee,-4.50`);
      }
      lines.push('2024-03-31,Paycheck,5000.00');

      const result = parseCSVTransactions(lines.join('\n'), 'usd', USD_PER_BTC);

      expect(result.transactions).toHaveLength(31);
      expect(result.skippedRows).toBe(0);
      expect(result.transactions.filter(t => t.isIncome)).toHaveLength(1);
      expect(result.transactions.filter(t => !t.isIncome)).toHaveLength(30);
    });

    it('handles BOM character at start of file', () => {
      const csv = '\uFEFFdate,description,amount\n2024-01-15,Coffee,-4.50';
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.transactions).toHaveLength(1);
    });
  });

  // ─── USD to Sats Conversion ─────────────────────────────────────

  describe('USD to sats conversion', () => {
    it('correctly converts $1 to sats at $100k BTC', () => {
      const csv = `date,description,amount
2024-01-15,One Dollar,-1.00`;
      const result = parseCSVTransactions(csv, 'usd', 100_000);
      // $1 / $100,000 * 100,000,000 = 1000 sats
      expect(result.transactions[0].amount).toBe(1000);
    });

    it('correctly converts $1 to sats at $50k BTC', () => {
      const csv = `date,description,amount
2024-01-15,One Dollar,-1.00`;
      const result = parseCSVTransactions(csv, 'usd', 50_000);
      // $1 / $50,000 * 100,000,000 = 2000 sats
      expect(result.transactions[0].amount).toBe(2000);
    });

    it('rounds sats correctly', () => {
      // $0.01 at $100k BTC = 10 sats (exact)
      // $0.005 at $100k BTC = 5 sats (should round)
      const csv = `date,description,amount
2024-01-15,Tiny,-0.005`;
      const result = parseCSVTransactions(csv, 'usd', 100_000);
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(5);
    });
  });

  // ─── Error Reporting ────────────────────────────────────────────

  describe('error reporting', () => {
    it('reports errors with row numbers', () => {
      const csv = `date,description,amount
2024-01-15,Coffee,-4.50
bad-date,Coffee,-4.50
2024-01-15,Coffee,N/A`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.skippedRows).toBe(2);
      expect(result.errors.some(e => e.includes('Row 3'))).toBe(true);
      expect(result.errors.some(e => e.includes('Row 4'))).toBe(true);
    });

    it('reports when CSV file is empty', () => {
      const result = parseCSVTransactions('', 'usd', USD_PER_BTC);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('empty'))).toBe(true);
    });

    it('detects correct columns in output', () => {
      const csv = `Transaction Date,Payee,Amount
2024-01-15,Coffee,-4.50`;
      const result = parseCSVTransactions(csv, 'usd', USD_PER_BTC);
      expect(result.detectedColumns.date).toBe('Transaction Date');
      expect(result.detectedColumns.description).toBe('Payee');
      expect(result.detectedColumns.amount).toBe('Amount');
    });
  });
});
