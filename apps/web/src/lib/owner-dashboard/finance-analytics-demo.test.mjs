import assert from 'node:assert/strict';
import {
  FINANCE_PERIODS,
  FINANCE_SUMMARY,
  OUTLET_BREAKDOWN,
  PAYMENT_METHODS,
  validateFinanceAnalyticsDemo,
} from './finance-analytics-demo.ts';

assert.equal(validateFinanceAnalyticsDemo(), true);
assert.deepEqual(FINANCE_PERIODS, ['daily', 'weekly', 'monthly']);
assert.equal(
  OUTLET_BREAKDOWN.reduce((sum, outlet) => sum + outlet.revenue, 0),
  FINANCE_SUMMARY.monthly.revenue,
);
assert.equal(
  PAYMENT_METHODS.reduce((sum, method) => sum + method.value, 0),
  100,
);
