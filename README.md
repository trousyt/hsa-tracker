# HSA Expense Tracker

A web application for tracking qualified HSA (Health Savings Account) medical expenses. Store receipts, track reimbursements, and optimize your HSA distributions.

## Features

- **Expense Management**: Create, edit, and delete medical expenses with date, provider, amount, and notes
- **Document Storage**: Upload receipts and statements (JPEG, PNG, PDF) with automatic compression
- **OCR Receipt Parsing**: Automatic extraction of date, amount, and provider from uploaded receipts using Google Cloud Document AI
- **Reimbursement Tracking**: Track full and partial reimbursements with complete history
- **Reimbursement Optimizer**: Find the fewest expenses that sum to a target dollar amount (uses FIFO prioritization)
- **Dashboard**: View summary statistics and expense breakdowns
- **CSV Export**: Export all expenses for record-keeping
- **URL-based Navigation**: Tab state syncs to URL for bookmarking and sharing
- **Keyboard Shortcuts**: Press `Ctrl+N` (or `Cmd+N` on Mac) to quickly add new expenses

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui + Tailwind CSS v4
- **Backend**: Convex (real-time database + file storage)
- **Forms**: React Hook Form + Zod validation
- **Tables**: TanStack Table

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd HSATracker-Deux
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Set up Convex:
   ```bash
   bunx convex dev --once --configure=new
   ```
   This will create a new Convex project and configure your environment.

4. Start the development server:
   ```bash
   bun run dev
   ```

   In a separate terminal, start Convex:
   ```bash
   bunx convex dev
   ```

5. Open http://localhost:5173 in your browser

### Build for Production

```bash
bun run build
```

## Project Structure

```
HSATracker-Deux/
├── convex/                 # Backend (Convex functions)
│   ├── schema.ts          # Database schema
│   ├── expenses.ts        # Expense CRUD operations
│   ├── documents.ts       # Document storage
│   ├── reimbursements.ts  # Reimbursement tracking
│   └── optimizer.ts       # DP algorithm for optimization
├── src/
│   ├── components/
│   │   ├── ui/            # shadcn/ui components
│   │   ├── dashboard/     # Dashboard components
│   │   ├── expenses/      # Expense management
│   │   ├── documents/     # Document upload/viewing
│   │   ├── reimbursements/# Reimbursement tracking
│   │   ├── optimizer/     # Optimization interface
│   │   └── shared/        # Shared components
│   ├── lib/
│   │   ├── utils.ts       # Utility functions
│   │   ├── currency.ts    # Currency formatting
│   │   ├── compression.ts # Image compression
│   │   └── export.ts      # CSV export
│   ├── App.tsx
│   └── main.tsx
└── docs/
    └── plans/             # Feature plans
```

## Data Model

- **Expenses**: Date paid, provider, amount (stored in cents), status, documents
- **Documents**: File storage with metadata (filename, size, mime type)
- **Reimbursements**: Links to expenses with amount and date

All monetary values are stored as integers (cents) to avoid floating-point errors.

## Optimizer Algorithm

The reimbursement optimizer uses a Dynamic Programming approach (subset sum):
- **Goal**: Find the minimum number of expenses that sum to a target amount
- **Tiebreaker**: FIFO (oldest expenses preferred)
- **Complexity**: O(n × target) where n = number of expenses

## Future Enhancements

- [ ] Multi-user authentication
- [ ] Expense categories (dental, vision, medical, etc.)
- [ ] Tax year grouping
- [ ] Dark mode

## License

MIT
