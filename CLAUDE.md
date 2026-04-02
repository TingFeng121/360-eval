# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A 360-degree employee evaluation management system built with Vue 3 + Element Plus + Supabase. Supports three evaluation types: self-evaluation, peer evaluation, and leader evaluation.

## Tech Stack

- **Frontend**: Vue.js 3 + Vite
- **UI Components**: Element Plus
- **Backend/Database**: Supabase (PostgreSQL)
- **Charts**: echarts (vue-echarts)
- **Excel Export**: exceljs + xlsx
- **PDF Export**: jspdf + html2canvas
- **Deployment**: Cloudflare Pages

## Common Commands

```bash
# Development
npm run dev              # Start dev server (Vite)

# Build
npm run build            # Production build
npm run preview          # Preview production build

# Testing
npm run test             # Run tests once (Vitest)
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage
```

## Project Structure

```
src/
├── views/               # Page components
│   ├── Dashboard.vue   # Home/dashboard
│   ├── Evaluation.vue  # Evaluation form
│   ├── Summary.vue     # Data summary & export
│   ├── MyScore.vue     # Personal scores
│   └── ...
├── components/          # Shared components
├── supabase.js         # Supabase API wrapper (~79KB)
├── cache.js            # In-memory caching
├── main.js             # Entry point with routing
└── styles/             # CSS variables & overrides
```

## Key Architecture Patterns

### API Layer (supabase.js)

All database operations are encapsulated in `supabase.js`. Key methods:

- `api.login(username, password)` - Auth with Supabase
- `api.getRadar(userId)` - Get radar chart data with weighted scores
- `api.exportScoreDetail(year, quarter, userId)` - Export Excel data
- `api.getSummary()` - Get aggregated summary data

### Caching Strategy

Simple in-memory cache with 5-minute TTL in `cache.js`:
- User data
- Questions
- Dimensions

### Scoring Algorithm

Weighted average calculation (in `getRadar()`):

```javascript
// Weights from weight_config table
const { self_weight, peer_weight, leader_weight } = weight;

// Calculate weighted total
let totalWeight = 0, totalScore = 0;
if (selfScore !== null) {
  totalScore += selfScore * self_weight;
  totalWeight += self_weight;
}
// ... peer and leader
const total = totalWeight > 0 ? round1(totalScore / totalWeight) : 0;
```

### Radar Chart Data Format

The `getRadar()` API returns:

```javascript
{
  user: { id, name, department },
  period: { year, quarter },
  scores: {
    self_score, peer_score, leader_score, total_score
  },
  dimensions: {
    self: [{ dimension_name, score }, ...],
    peer: [...],
    leader: [...]
  }
}
```

## Database Schema (Key Tables)

- `profiles` - Users (id, username, role, department, permissions)
- `dimensions` - Evaluation dimensions/capabilities (name, sort_order)
- `questions` - Questions (dimension_id, type, content)
- `evaluation_tasks` - Tasks (target_user_id, reviewer_user_id, eval_type, status)
- `answers` - Answers (task_id, question_id, score)
- `weight_config` - Weights (self_weight, peer_weight, leader_weight)
- `current_period` - Current evaluation period (year, quarter)

See `supabase-setup.sql` for complete schema.

## Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Default Login

- Username: `admin`
- Password: `admin123`
