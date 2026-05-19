'use strict';

// ─── VERIFY SEED SCRIPT ───────────────────────────────────────────────────────
// Run this after seed:all to confirm every table has the expected minimum
// row counts. A failing check means something went wrong during seeding
// and the tool will not work correctly until it is fixed.
//
// Usage: node scripts/verify_seed.js
// Or:    npm run seed:verify

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── EXPECTED MINIMUMS ────────────────────────────────────────────────────────
// These are the minimum row counts expected after a full seed:all run.
// The actual counts may be higher if seeding has been run multiple times
// (upsert prevents duplicates so re-running seed:all is always safe).
// Any table below its minimum fails the verification.

const EXPECTED_MINIMUMS = [
  {
    table: 'tech_patterns',
    minimum: 80,
    description: 'Technology fingerprint detection patterns',
    seedScript: 'npm run seed:patterns',
    critical: true
  },
  {
    table: 'clusters',
    minimum: 15,
    description: 'Ecosystem archetype cluster definitions',
    seedScript: 'npm run seed:clusters',
    critical: true
  },
  {
    table: 'co_occurrence',
    minimum: 100,
    description: 'Technology co-occurrence pairs for global graph',
    seedScript: 'npm run seed:clusters',
    critical: true
  },
  {
    table: 'tech_intelligence',
    minimum: 20,
    description: 'Technology intelligence knowledge base profiles',
    seedScript: 'npm run seed:intelligence',
    critical: true
  },
  {
    table: 'architecture_patterns',
    minimum: 8,
    description: 'Architecture pattern combination profiles',
    seedScript: 'npm run seed:intelligence',
    critical: true
  },
  {
    table: 'industry_benchmarks',
    minimum: 8,
    description: 'Industry benchmark comparison profiles',
    seedScript: 'npm run seed:intelligence',
    critical: true
  },
  {
    table: 'cache',
    minimum: 0,
    description: 'Response cache — empty is correct before first scan',
    seedScript: 'N/A — populated automatically by scans',
    critical: false
  },
  {
    table: 'scans',
    minimum: 0,
    description: 'Scan history — empty is correct before first scan',
    seedScript: 'N/A — populated automatically by scans',
    critical: false
  }
];

// ─── COLUMN VERIFICATION ──────────────────────────────────────────────────────
// Verify that the two new columns added in the scans table migration exist.
// These columns were added after the initial table creation and require
// a separate migration — verify_seed checks they are present so a missing
// migration is caught before the first scan fails silently.

const EXPECTED_COLUMNS = [
  {
    table: 'scans',
    columns: ['quality_score', 'stack_changes'],
    description: 'Phase 2 columns added by the scans table migration',
    migrationSql: 'ALTER TABLE scans ADD COLUMN IF NOT EXISTS quality_score INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS stack_changes JSONB NOT NULL DEFAULT \'{}\';'
  }
];

// ─── ENVIRONMENT VERIFICATION ─────────────────────────────────────────────────
// Verify that all required environment variables are present before
// attempting any database connections. A missing variable produces
// a clear error message pointing exactly to what needs to be fixed.

function verifyEnvironment() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('\n❌ ENVIRONMENT ERROR');
    console.error('─────────────────────────────────────────');
    for (const key of missing) {
      console.error(`  Missing: ${key}`);
    }
    console.error('\n  Add these to your .env file and try again.');
    console.error('─────────────────────────────────────────\n');
    process.exit(1);
  }

  console.log('✅ Environment variables verified');
}

// ─── TABLE COUNT CHECK ────────────────────────────────────────────────────────

async function checkTableCount(check) {
  try {
    const { count, error } = await supabase
      .from(check.table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      return {
        table: check.table,
        status: 'error',
        count: null,
        minimum: check.minimum,
        critical: check.critical,
        message: `Database error: ${error.message}`,
        fix: check.seedScript
      };
    }

    const actualCount = count || 0;
    const passes = actualCount >= check.minimum;

    return {
      table: check.table,
      status: passes ? 'pass' : 'fail',
      count: actualCount,
      minimum: check.minimum,
      critical: check.critical,
      description: check.description,
      message: passes
        ? `${actualCount} rows — meets minimum of ${check.minimum}`
        : `${actualCount} rows — below minimum of ${check.minimum}`,
      fix: passes ? null : `Run: ${check.seedScript}`
    };

  } catch (err) {
    return {
      table: check.table,
      status: 'error',
      count: null,
      minimum: check.minimum,
      critical: check.critical,
      message: `Exception: ${err.message}`,
      fix: check.seedScript
    };
  }
}

// ─── COLUMN CHECK ─────────────────────────────────────────────────────────────
// Verify columns exist by attempting to select them.
// If a column does not exist Supabase returns an error we can detect.

async function checkColumns(columnCheck) {
  const results = [];

  for (const column of columnCheck.columns) {
    try {
      const { error } = await supabase
        .from(columnCheck.table)
        .select(column)
        .limit(1);

      if (error && error.message.includes(column)) {
        results.push({
          table: columnCheck.table,
          column,
          status: 'fail',
          message: `Column "${column}" does not exist in table "${columnCheck.table}"`,
          fix: `Run this SQL in Supabase SQL Editor:\n  ${columnCheck.migrationSql}`
        });
      } else {
        results.push({
          table: columnCheck.table,
          column,
          status: 'pass',
          message: `Column "${column}" exists in table "${columnCheck.table}"`
        });
      }
    } catch (err) {
      results.push({
        table: columnCheck.table,
        column,
        status: 'error',
        message: `Could not verify column "${column}": ${err.message}`,
        fix: `Run this SQL in Supabase SQL Editor:\n  ${columnCheck.migrationSql}`
      });
    }
  }

  return results;
}

// ─── CONNECTIVITY CHECK ───────────────────────────────────────────────────────
// Verify basic Supabase connectivity before running all checks.
// A failed connectivity check means all table checks would also fail
// and the error message would be confusing — better to catch it once.

async function checkConnectivity() {
  try {
    const { error } = await supabase
      .from('tech_patterns')
      .select('name')
      .limit(1);

    if (error && error.message.includes('does not exist')) {
      return {
        connected: false,
        message: 'Connected to Supabase but tables do not exist — run SQL migrations first'
      };
    }

    if (error) {
      return {
        connected: false,
        message: `Supabase connection error: ${error.message}`
      };
    }

    return { connected: true, message: 'Supabase connection successful' };

  } catch (err) {
    return {
      connected: false,
      message: `Cannot reach Supabase: ${err.message} — check SUPABASE_URL and SUPABASE_SERVICE_KEY`
    };
  }
}

// ─── REPORT PRINTER ───────────────────────────────────────────────────────────

function printReport(results, columnResults) {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  EIGE v10 — Seed Verification Report');
  console.log('══════════════════════════════════════════════════════\n');

  console.log('TABLE ROW COUNTS');
  console.log('─────────────────────────────────────────────────────');

  let passCount = 0;
  let failCount = 0;
  let errorCount = 0;
  const criticalFailures = [];

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' :
      result.status === 'fail' ? '❌' : '⚠️';

    const criticalLabel = result.critical && result.status !== 'pass'
      ? ' [CRITICAL]' : '';

    console.log(`\n${icon} ${result.table}${criticalLabel}`);
    console.log(`   ${result.description}`);
    console.log(`   Status: ${result.message}`);

    if (result.fix) {
      console.log(`   Fix:    ${result.fix}`);
    }

    if (result.status === 'pass') passCount++;
    else if (result.status === 'fail') {
      failCount++;
      if (result.critical) criticalFailures.push(result.table);
    }
    else errorCount++;
  }

  console.log('\n\nCOLUMN VERIFICATION');
  console.log('─────────────────────────────────────────────────────');

  let columnPassCount = 0;
  let columnFailCount = 0;
  const columnFailures = [];

  for (const result of columnResults) {
    const icon = result.status === 'pass' ? '✅' : '❌';
    console.log(`\n${icon} ${result.table}.${result.column}`);
    console.log(`   ${result.message}`);

    if (result.fix) {
      console.log(`   Fix: ${result.fix}`);
    }

    if (result.status === 'pass') columnPassCount++;
    else {
      columnFailCount++;
      columnFailures.push(`${result.table}.${result.column}`);
    }
  }

  console.log('\n\nSUMMARY');
  console.log('─────────────────────────────────────────────────────');
  console.log(`  Table checks:  ${passCount} passed, ${failCount} failed, ${errorCount} errors`);
  console.log(`  Column checks: ${columnPassCount} passed, ${columnFailCount} failed`);

  const totalFails = failCount + errorCount + columnFailCount;
  const hasCriticalFailures = criticalFailures.length > 0 || columnFailures.length > 0;

  if (totalFails === 0) {
    console.log('\n✅ ALL CHECKS PASSED — EIGE v10 database is fully seeded and ready');
    console.log('\n  Next steps:');
    console.log('  1. Deploy to Render: connect your GitHub repo at render.com');
    console.log('  2. Set environment variables in Render dashboard');
    console.log('  3. Deploy and test: GET https://eige-api.onrender.com/health');
    console.log('  4. Update your frontend API_BASE URL');
  } else {
    console.log('\n❌ VERIFICATION FAILED — fix the issues above before deploying');

    if (criticalFailures.length > 0) {
      console.log('\n  Critical tables with insufficient data:');
      for (const table of criticalFailures) {
        console.log(`  • ${table}`);
      }
    }

    if (columnFailures.length > 0) {
      console.log('\n  Missing columns — database migration required:');
      for (const col of columnFailures) {
        console.log(`  • ${col}`);
      }
    }

    console.log('\n  Quick fix for all table issues: npm run seed:all');
    console.log('  Then run this script again: npm run seed:verify');
  }

  console.log('\n══════════════════════════════════════════════════════\n');

  return totalFails === 0;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nEIGE v10 — Running seed verification...\n');

  verifyEnvironment();

  console.log('Checking Supabase connectivity...');
  const connectivity = await checkConnectivity();

  if (!connectivity.connected) {
    console.error(`\n❌ CONNECTION FAILED: ${connectivity.message}\n`);
    process.exit(1);
  }

  console.log(`✅ ${connectivity.message}\n`);
  console.log('Running table count checks...');

  const tableResults = await Promise.all(
    EXPECTED_MINIMUMS.map(check => checkTableCount(check))
  );

  console.log('Running column verification checks...');

  const columnResults = [];
  for (const columnCheck of EXPECTED_COLUMNS) {
    const results = await checkColumns(columnCheck);
    columnResults.push(...results);
  }

  const allPassed = printReport(tableResults, columnResults);
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error(`\n❌ Verification script error: ${err.message}\n`);
  process.exit(1);
});
