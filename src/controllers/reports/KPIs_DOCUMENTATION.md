# Platform KPIs Controller Documentation

## Overview

This document describes the KPIs (Key Performance Indicators) controller that calculates and returns dynamic platform metrics from the database.

## Endpoints

### 1. Get Platform KPIs

**Route:** `GET /api/v1/kpis/platform`

**Authentication Required:** Yes (JWT Token)
**Authorization:** Admin or Staff role required

**Response Format:**

```json
{
  "statusCode": 200,
  "data": [
    {
      "title": "Total Revenue",
      "value": "₹66,100",
      "rawValue": 66100,
      "change": "+22.4%",
      "trend": "up",
      "icon": "DollarSign",
      "color": "#F59E0B",
      "bgColor": "#FEF3C7"
    }
    // ... other KPIs
  ],
  "message": "Platform KPIs retrieved successfully"
}
```

### 2. Get KPIs Summary

**Route:** `GET /api/v1/kpis/summary`

**Authentication Required:** Yes (JWT Token)
**Authorization:** Admin or Staff role required

**Response Format:**

```json
{
  "statusCode": 200,
  "data": {
    "period": {
      "start": "2026-01-01T00:00:00.000Z",
      "end": "2026-01-15T00:00:00.000Z"
    },
    "metrics": [...],
    "lastUpdated": "2026-01-15T00:00:00.000Z"
  },
  "message": "KPIs summary retrieved successfully"
}
```

## Metrics Calculated

### 1. Total Revenue

- **Source:** Completed bookings with successful payment status
- **Calculation:** Sum of `pricing.totalAmount` from completed bookings
- **Change:** Percentage change from previous month
- **Time Period:** Current month (1st to current date)

### 2. Total Bookings

- **Source:** Booking collection
- **Calculation:** Count of all bookings created in current month (excluding system-cancelled)
- **Change:** Percentage change from previous month
- **Time Period:** Current month (1st to current date)

### 3. Active Users

- **Source:** User collection
- **Calculation:** Count of non-deleted, non-blocked users updated in current month
- **Change:** Percentage change from previous month
- **Time Period:** Current month (1st to current date)

### 4. Verified Vendors

- **Source:** Vendor collection
- **Calculation:** Count of vendors with:
  - `isVerified: true`
  - `isKYCVerified: true`
  - `kycStatus: 'approved'`
  - `isDeleted: false`
  - `isBlocked: false`
- **Change:** Percentage change from previous month
- **Time Period:** Current month (1st to current date)

### 5. Average Rating

- **Source:** Rating collection
- **Calculation:** Average of all `ratingValue` fields
- **Change:** Absolute change from previous month (e.g., +0.2)
- **Time Period:** Current month (1st to current date)

### 6. Average Growth Rate

- **Source:** Calculated from above metrics
- **Calculation:** Average of (Revenue Growth + Bookings Growth + Users Growth + Vendors Growth) / 4
- **Change:** Percentage change (same value as display)
- **Time Period:** Current month vs previous month

## Data Models Used

1. **User Model** - For active users count

   - Fields: `isDeleted`, `isBlocked`, `updatedAt`

2. **Vendor Model** - For verified vendors count

   - Fields: `isVerified`, `isKYCVerified`, `kycStatus`, `isDeleted`, `isBlocked`, `createdAt`

3. **Booking Model** - For total bookings and revenue

   - Fields: `status`, `paymentStatus`, `createdAt`, `pricing.totalAmount`

4. **Rating Model** - For average rating
   - Fields: `ratingValue`, `createdAt`

## Helper Functions

### `calculatePercentageChange(current, previous)`

Calculates percentage change between two values.

- Returns 100 if previous is 0 and current > 0
- Returns 0 if previous is 0 and current is 0
- Returns ((current - previous) / previous) \* 100 otherwise

### `formatCurrency(value)`

Formats a number as Indian Rupees (INR) currency.

- Uses Intl.NumberFormat with 'en-IN' locale
- Example: 66100 → "₹66,100.00"

### `getTotalRevenue(timeframe)`

Gets total revenue for the specified timeframe.

- **Parameters:** `timeframe` - 'current' or 'previous'
- **Returns:** Total amount as number

### `getTotalBookings(timeframe)`

Gets count of total bookings for the specified timeframe.

- **Parameters:** `timeframe` - 'current' or 'previous'
- **Returns:** Count as number

### `getActiveUsers(timeframe)`

Gets count of active users for the specified timeframe.

- **Parameters:** `timeframe` - 'current' or 'previous'
- **Returns:** Count as number

### `getVerifiedVendors(timeframe)`

Gets count of verified vendors for the specified timeframe.

- **Parameters:** `timeframe` - 'current' or 'previous'
- **Returns:** Count as number

### `getAverageRating(timeframe)`

Gets average rating for the specified timeframe.

- **Parameters:** `timeframe` - 'current' or 'previous'
- **Returns:** Average as number (0-5 typically)

## Usage Examples

### Frontend Implementation

```javascript
// Fetch platform KPIs
const fetchKPIs = async () => {
  try {
    const response = await fetch('/api/v1/kpis/platform', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const { data } = await response.json();
    setKPIs(data);
  } catch (error) {
    console.error('Error fetching KPIs:', error);
  }
};

// Use in component
<div className="kpi-grid">
  {kpis.map((kpi) => (
    <KPICard key={kpi.title} kpi={kpi} />
  ))}
</div>;
```

## Performance Considerations

1. **Aggregation Pipeline:** Uses MongoDB aggregation for efficient calculations
2. **Indexing:** Ensure the following fields are indexed:

   - `Booking`: `status`, `paymentStatus`, `createdAt`, `user`
   - `User`: `isDeleted`, `isBlocked`, `updatedAt`
   - `Vendor`: `isVerified`, `isKYCVerified`, `kycStatus`, `isDeleted`, `isBlocked`
   - `Rating`: `createdAt`

3. **Caching:** Consider implementing caching for KPIs (they don't need real-time updates)

## Error Handling

All functions include try-catch blocks and return default values (0) on error. Error messages are logged to console for debugging.

## Future Enhancements

1. Add date range filtering parameter
2. Implement caching with TTL
3. Add export functionality (PDF/CSV)
4. Add historical data tracking
5. Add comparison with specific time periods
6. Add vendor-specific KPIs
7. Add user-specific KPIs
