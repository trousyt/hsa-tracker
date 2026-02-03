# Expense Sorting & Filtering Brainstorm

**Date:** 2026-02-03
**Status:** Ready for planning

## What We're Building

Add sorting and filtering to the expenses table:
- **Sorting:** Default to Date descending, clickable Date and Amount column headers to toggle sort
- **Filtering:** Text input that filters by Provider, Comment (contains, case-insensitive) OR Amount (exact match)

## Context

- TanStack Table already in use with `getSortedRowModel()` - just needs default sort state
- `getFilteredRowModel()` available - add global filter function
- No external libraries needed

## Key Decisions

1. **Default sort:** Date descending (newest first)
2. **Sortable columns:** Date and Amount - clickable headers with arrow indicators
3. **Filter input:** Single text field in the header area
4. **Provider matching:** Contains, case-insensitive ("smith" matches "Dr. Smith")
5. **Comment matching:** Contains, case-insensitive ("checkup" matches "Annual checkup")
6. **Amount matching:** Exact match on formatted amount ("125.00" matches $125.00)
7. **No date filtering** - dates already sorted, keeps filter simple

## Technical Approach

```typescript
// Add to useReactTable config
const [globalFilter, setGlobalFilter] = useState("")

const table = useReactTable({
  // ... existing config
  state: {
    sorting,
    globalFilter,
  },
  initialState: {
    sorting: [{ id: "datePaid", desc: true }],
  },
  getFilteredRowModel: getFilteredRowModel(),
  globalFilterFn: (row, columnId, filterValue) => {
    const provider = row.getValue("provider") as string
    const comment = (row.getValue("comment") as string) || ""
    const amount = formatCurrency(row.getValue("amountCents") as number)
    const search = filterValue.toLowerCase()

    return (
      provider.toLowerCase().includes(search) ||
      comment.toLowerCase().includes(search) ||
      amount === `$${filterValue}` ||
      amount.includes(filterValue)
    )
  },
})
```

## UI Placement

Add search input next to the status filter dropdown:
```
[Search expenses...] [Status ▼] [Import] [Export] [+ Add Expense]
```

## Open Questions

None - ready for implementation.
