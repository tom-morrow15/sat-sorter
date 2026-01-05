import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Transaction, Bucket } from '@/lib/budgetTypes';
import { cn } from '@/lib/utils';

interface TransactionSearchFilterProps {
  transactions: Transaction[];
  buckets: Bucket[];
  onFilter: (filtered: Transaction[]) => void;
}

export function TransactionSearchFilter({
  transactions,
  buckets,
  onFilter,
}: TransactionSearchFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBucketId, setSelectedBucketId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>(
    'date-desc'
  );

  // Apply filters
  const applyFilters = () => {
    let filtered = [...transactions];

    // Search by description
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((t) =>
        t.description.toLowerCase().includes(query) ||
        t.merchantName?.toLowerCase().includes(query)
      );
    }

    // Filter by bucket
    if (selectedBucketId) {
      filtered = filtered.filter((t) => t.bucketId === selectedBucketId);
    }

    // Filter by type
    if (selectedType === 'income') {
      filtered = filtered.filter((t) => t.isIncome);
    } else if (selectedType === 'expense') {
      filtered = filtered.filter((t) => !t.isIncome);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'amount-desc':
          return b.amount - a.amount;
        case 'amount-asc':
          return a.amount - b.amount;
        default:
          return 0;
      }
    });

    onFilter(filtered);
  };

  // Apply filters whenever any filter changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedBucketId('');
    setSelectedType('all');
    setSortBy('date-desc');
  };

  // Use effect to apply filters automatically
  const hasActiveFilters =
    searchQuery.trim() || selectedBucketId || selectedType !== 'all' || sortBy !== 'date-desc';

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search transactions..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              applyFilters();
            }
          }}
          className="pl-9"
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Budget filter */}
        <Select value={selectedBucketId} onValueChange={setSelectedBucketId}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All categories</SelectItem>
            {buckets.map((bucket) => (
              <SelectItem key={bucket.id} value={bucket.id}>
                {bucket.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type filter */}
        <Select value={selectedType} onValueChange={(v: any) => setSelectedType(v)}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort filter */}
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Newest first</SelectItem>
            <SelectItem value="date-asc">Oldest first</SelectItem>
            <SelectItem value="amount-desc">Highest amount</SelectItem>
            <SelectItem value="amount-asc">Lowest amount</SelectItem>
          </SelectContent>
        </Select>

        {/* Apply button */}
        <Button onClick={applyFilters} className="w-full sm:w-auto" variant="default">
          Search
        </Button>

        {/* Clear button */}
        {hasActiveFilters && (
          <Button
            onClick={handleClearFilters}
            variant="outline"
            size="icon"
            className="w-full sm:w-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {searchQuery && (
            <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
              Search: "{searchQuery}"
              <X
                className="h-3 w-3 ml-1"
                onClick={() => setSearchQuery('')}
              />
            </Badge>
          )}
          {selectedBucketId && (
            <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
              Category: {buckets.find((b) => b.id === selectedBucketId)?.name}
              <X
                className="h-3 w-3 ml-1"
                onClick={() => setSelectedBucketId('')}
              />
            </Badge>
          )}
          {selectedType !== 'all' && (
            <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
              Type: {selectedType}
              <X
                className="h-3 w-3 ml-1"
                onClick={() => setSelectedType('all')}
              />
            </Badge>
          )}
          {sortBy !== 'date-desc' && (
            <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
              Sort: {sortBy === 'date-asc' ? 'Oldest' : sortBy === 'amount-desc' ? 'Highest' : 'Lowest'}
              <X
                className="h-3 w-3 ml-1"
                onClick={() => setSortBy('date-desc')}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
