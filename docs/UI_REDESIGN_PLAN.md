# Sat Sorter - Professional UI Redesign Plan

## Vision
Transform Sat Sorter into a **premium fintech application** with a modern, clean, and professional design that rivals apps like Stripe, Square, and high-end banking apps.

---

## Design System Overhaul

### 1. Color Palette Enhancement

**Current**: Basic Bitcoin Orange + Blues
**Updated**: Professional gradient system

```typescript
// Light Mode
--primary: 28 100% 50%      // Bitcoin Orange (keep)
--primary-dark: 28 100% 40% // Darker accent
--success: 142 72% 45%      // Green (income)
--warning: 45 100% 50%      // Amber (alerts)
--destructive: 0 84% 60%    // Red (expenses)
--neutral-50: 0 0% 98%
--neutral-100: 0 0% 95%
--neutral-200: 220 13% 91%  // (existing border)
--neutral-900: 220 20% 10%  // (existing foreground)

// Dark Mode
--primary-dark: 28 100% 55% // Lighter orange
--neutral-800: 220 20% 13%  // Darker backgrounds
--neutral-700: 220 15% 18%  // (existing)
```

### 2. Typography System

```typescript
// Headlines
h1: "font-bold text-4xl md:text-5xl tracking-tight leading-tight"
h2: "font-bold text-3xl md:text-4xl tracking-tight"
h3: "font-semibold text-2xl md:text-3xl"
h4: "font-semibold text-xl"

// Body
body-lg: "font-normal text-lg leading-relaxed"
body: "font-normal text-base leading-relaxed"
body-sm: "font-normal text-sm leading-relaxed"
caption: "font-normal text-xs text-muted-foreground"

// Special
label: "font-medium text-sm uppercase tracking-wider"
mono: "font-mono text-sm"
```

### 3. Spacing & Layout

```
Grid: 8px base unit
Padding: 8px, 12px, 16px, 24px, 32px, 48px
Gaps: 12px, 16px, 24px, 32px
Border Radius: 8px (sm), 12px (md), 16px (lg), 24px (xl)
Shadows:
  xs: 0 1px 2px rgba(0,0,0,0.05)
  sm: 0 2px 4px rgba(0,0,0,0.08)
  md: 0 4px 8px rgba(0,0,0,0.12)
  lg: 0 8px 16px rgba(0,0,0,0.15)
  xl: 0 12px 24px rgba(0,0,0,0.18)
```

---

## Component Redesigns

### 1. Header (BudgetHeader)

**Current Issues**:
- Too cramped with many small buttons
- Icon-heavy, minimal text clarity
- Small logo
- Too much information density

**Proposed Redesign**:
```tsx
// Hero header with gradient background
<header className="bg-gradient-to-r from-primary via-primary/95 to-orange-500 
  text-white relative overflow-hidden">
  
  {/* Decorative elements */}
  <div className="absolute inset-0 opacity-10">
    <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
    <div className="absolute bottom-0 left-0 w-72 h-72 bg-white rounded-full blur-3xl" />
  </div>
  
  {/* Content with proper hierarchy */}
  <div className="relative container mx-auto px-6 py-8">
    
    {/* Primary info */}
    <div className="mb-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm 
          flex items-center justify-center">
          <Bitcoin className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Sat Sorter</h1>
          <p className="text-white/80 text-sm">Zero-based Bitcoin budgeting</p>
        </div>
      </div>
    </div>
    
    {/* Month display - prominent */}
    <div className="mb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-white/60 text-sm uppercase tracking-widest">Current Month</p>
          <p className="text-4xl font-bold">{formatMonth(currentMonth)}</p>
        </div>
        <div className="flex gap-3">
          {/* Navigation buttons */}
        </div>
      </div>
    </div>
    
    {/* Budget summary cards - 3 column */}
    <div className="grid grid-cols-3 gap-4">
      <SummaryCard label="Income" amount={income} accent="success" />
      <SummaryCard label="Budgeted" amount={budgeted} accent="primary" />
      <SummaryCard label="Remaining" amount={remaining} accent={remaining > 0 ? "success" : "destructive"} />
    </div>
    
  </div>
</header>
```

**Features**:
- Gradient background with glassmorphism
- Clear visual hierarchy
- Summary cards at a glance
- Breathing room and elegance

---

### 2. Budget Cards (BucketCard)

**Current Issues**:
- Flat appearance
- Minimal visual distinction
- Poor hierarchy

**Proposed Design**:
```tsx
<div className="group">
  <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-xl 
    transition-all duration-300 bg-gradient-to-br from-white to-neutral-50 
    hover:from-white hover:to-neutral-100 dark:from-neutral-900 dark:to-neutral-950">
    
    {/* Accent stripe */}
    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b 
      from-transparent via-primary/50 to-transparent opacity-0 
      group-hover:opacity-100 transition-opacity" />
    
    {/* Header with icon */}
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          
          {/* Large icon */}
          <div className="mt-1 p-3 rounded-lg bg-gradient-to-br 
            from-primary/10 to-primary/5">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-neutral-900 
              dark:text-white mb-1">{bucket.name}</h3>
            <p className="text-sm text-muted-foreground">
              {lineItems.length} line items • ${totalBudgeted}
            </p>
          </div>
        </div>
        
        {/* Amount display - right aligned, prominent */}
        <div className="text-right">
          <p className="text-3xl font-bold text-neutral-900 
            dark:text-white">{formatAmount(total)}</p>
          <p className="text-xs text-muted-foreground">
            {isIncome ? 'Income' : percentUsed}% spent
          </p>
        </div>
      </div>
    </CardHeader>
    
    {/* Progress bar */}
    <div className="px-6 pb-3">
      <div className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full 
        overflow-hidden">
        <div className={`h-full transition-all duration-500 
          ${percentUsed > 100 ? 'bg-destructive' : 'bg-gradient-to-r from-primary to-orange-500'}`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }} />
      </div>
    </div>
    
    {/* Line items - clean list */}
    <CardContent className="space-y-2">
      {lineItems.map(item => (
        <LineItemRow key={item.id} item={item} />
      ))}
    </CardContent>
    
  </Card>
</div>
```

**Visual Enhancements**:
- Accent stripe that appears on hover
- Gradient backgrounds
- Larger, clearer typography
- Better spacing and breathing room
- Smooth progress bar animation
- Improved visual hierarchy

---

### 3. Alerts & Prompts

**Current**: Basic colored alerts
**Proposed**: Elegant, actionable cards

```tsx
<div className="rounded-lg border-0 bg-gradient-to-r 
  from-primary/5 via-primary/3 to-transparent p-4 md:p-6">
  
  <div className="flex gap-4">
    <div className="flex-shrink-0">
      <div className="w-10 h-10 rounded-full bg-primary/10 
        flex items-center justify-center">
        <Zap className="w-5 h-5 text-primary" />
      </div>
    </div>
    
    <div className="flex-1 min-w-0">
      <h3 className="font-semibold text-sm text-neutral-900 
        dark:text-white mb-1">
        Connect Your Wallet
      </h3>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
        Track Lightning transactions automatically and manage payments directly.
      </p>
      <Button size="sm" className="gap-2">
        <Wallet className="w-4 h-4" />
        Connect Now
      </Button>
    </div>
  </div>
</div>
```

---

### 4. Main Content Layout

**Proposed Structure**:
```tsx
<div className="min-h-screen bg-gradient-to-b from-neutral-50 
  to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
  
  {/* Premium header */}
  <BudgetHeader />
  
  {/* Main content with generous padding */}
  <main className="container mx-auto px-4 sm:px-6 py-12">
    
    {/* Section with visual separation */}
    <div className="space-y-8">
      
      {/* Alerts section */}
      <section className="space-y-3">
        {/* Alert cards */}
      </section>
      
      {/* Budget overview section */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 
              dark:text-white">Budget Overview</h2>
            <p className="text-muted-foreground">
              Manage your spending categories
            </p>
          </div>
          <Button gap="gap-2">
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
        </div>
        
        {/* Income section */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase 
            tracking-widest text-muted-foreground">Income</h3>
          <BucketCard {...incomeProps} />
        </section>
        
        {/* Expenses section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase 
            tracking-widest text-muted-foreground">Expense Categories</h3>
          <div className="grid gap-3">
            {expenseBuckets.map((bucket, i) => (
              <BucketCard key={bucket.id} {...bucket} />
            ))}
          </div>
        </section>
        
      </section>
      
    </div>
  </main>
</div>
```

---

## Implementation Priority

### Phase 1: Foundation (High Impact)
1. ✅ Update color palette in `index.css`
2. ✅ Enhance header with gradient background
3. ✅ Redesign budget cards with better spacing
4. ✅ Improve alert/prompt styling

### Phase 2: Polish (Medium Impact)
1. Update line items display
2. Enhance dialogs and modals
3. Improve transaction interface
4. Better empty states

### Phase 3: Advanced (Nice to Have)
1. Glassmorphism effects
2. Custom scrollbars
3. Animated charts
4. Advanced visualizations

---

## Visual Principles

### Hierarchy
- Clear visual distinction between primary, secondary, and tertiary elements
- Use size, color, and weight to guide attention
- Ample whitespace (breathing room)

### Consistency
- Uniform spacing (8px grid)
- Consistent border radius
- Unified icon language
- Cohesive color usage

### Modernity
- Subtle gradients (not overdone)
- Soft shadows instead of harsh outlines
- Smooth transitions
- Clean, minimal borders

### Professionalism
- Generous padding and margins
- Premium typography
- Subtle animations
- Polished interactions

---

## File Changes Needed

1. **src/index.css** - Enhanced color palette, gradients, shadows
2. **src/components/budget/BudgetHeader.tsx** - Full redesign with gradient
3. **src/components/budget/BucketCard.tsx** - Card redesign with accents
4. **src/pages/HomePage.tsx** - Layout restructuring
5. **src/components/ui/alert.tsx** - Alert component improvements
6. **tailwind.config.ts** - Custom gradient definitions

---

## Expected Results

✨ **Before**: Functional but basic web app appearance
✨ **After**: Premium, professional fintech application

Comparable to: Stripe, Square, Revolut, Mercury
