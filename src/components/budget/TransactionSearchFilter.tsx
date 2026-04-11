import { useState } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { Transaction, Bucket } from '@/lib/budgetTypes';

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
  const [selectedBucketId, setSelectedBucketId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>(
    'date-desc'
  );
  const [showFilters, setShowFilters] = useState(false);

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
    if (selectedBucketId && selectedBucketId !== 'all') {
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

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedBucketId('all');
    setSelectedType('all');
    setSortBy('date-desc');
    onFilter([]);
  };

  const hasActiveFilters =
    searchQuery.trim() || selectedBucketId !== 'all' || selectedType !== 'all' || sortBy !== 'date-desc';

  const activeFilterCount = [
    searchQuery.trim(),
    selectedBucketId !== 'all',
    selectedType !== 'all',
    sortBy !== 'date-desc',
  ].filter(Boolean).length;

  return (
    <div className="space-y-2">
      {/* Search bar with filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyFilters();
              }
            }}
            className="pl-9 h-9"
          />
        </div>
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="icon" className="h-9 w-9 relative">
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
        <Button onClick={applyFilters} size="sm" className="h-9">
          Go
        </Button>
      </div>

      {/* Collapsible filters */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {/* Category filter */}
            <Select value={selectedBucketId} onValueChange={setSelectedBucketId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {buckets.map((bucket) => (
                  <SelectItem key={bucket.id} value={bucket.id}>
                    {bucket.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type filter */}
            <Select value={selectedType} onValueChange={(v: 'all' | 'income' | 'expense') => setSelectedType(v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            {/* Sort filter */}
            <Select value={sortBy} onValueChange={(v: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc') => setSortBy(v)}>
              <SelectTrigger className="h-9 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest first</SelectItem>
                <SelectItem value="date-asc">Oldest first</SelectItem>
                <SelectItem value="amount-desc">Highest amount</SelectItem>
                <SelectItem value="amount-asc">Lowest amount</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear button */}
            {hasActiveFilters && (
              <Button
                onClick={handleClearFilters}
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Active filters badges - only show when filters panel is closed */}
      {hasActiveFilters && !showFilters && (
        <div className="flex flex-wrap gap-1">
          {searchQuery && (
            <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80" onClick={() => { setSearchQuery(''); applyFilters(); }}>
              "{searchQuery.slice(0, 10)}{searchQuery.length > 10 ? '...' : ''}"
              <X className="h-2.5 w-2.5 ml-1" />
            </Badge>
          )}
          {selectedBucketId !== 'all' && (
            <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80" onClick={() => { setSelectedBucketId('all'); applyFilters(); }}>
              {buckets.find((b) => b.id === selectedBucketId)?.name}
              <X className="h-2.5 w-2.5 ml-1" />
            </Badge>
          )}
          {selectedType !== 'all' && (
            <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80" onClick={() => { setSelectedType('all'); applyFilters(); }}>
              {selectedType}
              <X className="h-2.5 w-2.5 ml-1" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
