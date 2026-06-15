import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { getTransactionAssignments } from '@/lib/splitUtils';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const { paymentMethods } = usePaymentMethods();
  
  // Initialize from URL params or defaults
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedBucketId, setSelectedBucketId] = useState<string>(searchParams.get('category') || 'all');
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>(
    (searchParams.get('type') as 'all' | 'income' | 'expense') || 'all'
  );
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>(
    (searchParams.get('sort') as any) || 'date-desc'
  );
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [minAmount, setMinAmount] = useState(searchParams.get('minAmount') || '');
  const [maxAmount, setMaxAmount] = useState(searchParams.get('maxAmount') || '');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(searchParams.get('paymentMethod') || 'all');
  const [showFilters, setShowFilters] = useState(false);

  // Apply filters and update URL
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

    // Filter by bucket (handles both legacy single-assignment and splits)
    if (selectedBucketId && selectedBucketId !== 'all') {
      filtered = filtered.filter((t) => {
        const assignments = getTransactionAssignments(t);
        return assignments.some((a) => a.bucketId === selectedBucketId);
      });
    }

    // Filter by type
    if (selectedType === 'income') {
      filtered = filtered.filter((t) => t.isIncome);
    } else if (selectedType === 'expense') {
      filtered = filtered.filter((t) => !t.isIncome);
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate).getTime();
      filtered = filtered.filter((t) => new Date(t.date).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).getTime();
      filtered = filtered.filter((t) => new Date(t.date).getTime() <= end);
    }

    // Filter by amount range
    if (minAmount) {
      const min = parseFloat(minAmount);
      filtered = filtered.filter((t) => t.amount >= min);
    }
    if (maxAmount) {
      const max = parseFloat(maxAmount);
      filtered = filtered.filter((t) => t.amount <= max);
    }

    // Filter by payment method
    if (selectedPaymentMethod && selectedPaymentMethod !== 'all') {
      filtered = filtered.filter((t) => t.paymentMethod === selectedPaymentMethod);
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

    // Update URL with current filters
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedBucketId !== 'all') params.set('category', selectedBucketId);
    if (selectedType !== 'all') params.set('type', selectedType);
    if (sortBy !== 'date-desc') params.set('sort', sortBy);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (minAmount) params.set('minAmount', minAmount);
    if (maxAmount) params.set('maxAmount', maxAmount);
    
    if (params.toString()) {
      setSearchParams(params);
    }

    onFilter(filtered);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedBucketId('all');
    setSelectedType('all');
    setSortBy('date-desc');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setSearchParams(new URLSearchParams());
    onFilter([]);
  };

  // Apply filters on mount if URL has actual search/filter params
  // (ignore lineItemId which is handled by the parent TransactionsPanel)
  useEffect(() => {
    const hasSearchParams =
      searchParams.get('search') ||
      searchParams.get('category') ||
      searchParams.get('type') ||
      searchParams.get('sort') ||
      searchParams.get('startDate') ||
      searchParams.get('endDate') ||
      searchParams.get('minAmount') ||
      searchParams.get('maxAmount');
    if (hasSearchParams) {
      applyFilters();
    } else {
      // Clear any stale filtered results when no search params are active
      onFilter([]);
    }
  }, [searchParams]);

  const hasActiveFilters =
    searchQuery.trim() || 
    selectedBucketId !== 'all' || 
    selectedType !== 'all' || 
    sortBy !== 'date-desc' ||
    startDate ||
    endDate ||
    minAmount ||
    maxAmount;

  const activeFilterCount = [
    searchQuery.trim(),
    selectedBucketId !== 'all',
    selectedType !== 'all',
    sortBy !== 'date-desc',
    startDate,
    endDate,
    minAmount,
    maxAmount,
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

           {/* Date range filters */}
           <div className="grid grid-cols-2 gap-2">
             <div>
               <label className="text-xs text-muted-foreground mb-1 block">From</label>
               <Input
                 type="date"
                 value={startDate}
                 onChange={(e) => setStartDate(e.target.value)}
                 className="h-9 text-xs"
               />
             </div>
             <div>
               <label className="text-xs text-muted-foreground mb-1 block">To</label>
               <Input
                 type="date"
                 value={endDate}
                 onChange={(e) => setEndDate(e.target.value)}
                 className="h-9 text-xs"
               />
             </div>
           </div>

           {/* Amount range filters */}
           <div className="grid grid-cols-2 gap-2">
             <div>
               <label className="text-xs text-muted-foreground mb-1 block">Min Amount</label>
               <Input
                 type="number"
                 placeholder="0"
                 value={minAmount}
                 onChange={(e) => setMinAmount(e.target.value)}
                 className="h-9 text-xs"
                 min="0"
               />
             </div>
             <div>
               <label className="text-xs text-muted-foreground mb-1 block">Max Amount</label>
               <Input
                 type="number"
                 placeholder="∞"
                 value={maxAmount}
                 onChange={(e) => setMaxAmount(e.target.value)}
                 className="h-9 text-xs"
                 min="0"
               />
             </div>
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
           {startDate && (
             <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80" onClick={() => { setStartDate(''); applyFilters(); }}>
               From {startDate}
               <X className="h-2.5 w-2.5 ml-1" />
             </Badge>
           )}
           {endDate && (
             <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80" onClick={() => { setEndDate(''); applyFilters(); }}>
               To {endDate}
               <X className="h-2.5 w-2.5 ml-1" />
             </Badge>
           )}
           {minAmount && (
             <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80" onClick={() => { setMinAmount(''); applyFilters(); }}>
               ≥ {minAmount}
               <X className="h-2.5 w-2.5 ml-1" />
             </Badge>
           )}
           {maxAmount && (
             <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-secondary/80" onClick={() => { setMaxAmount(''); applyFilters(); }}>
               ≤ {maxAmount}
               <X className="h-2.5 w-2.5 ml-1" />
             </Badge>
           )}
         </div>
       )}
    </div>
  );
}
