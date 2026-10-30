import { assert, describe, it } from "@effect/vitest";
import * as NodeSqliteClient from "@cctools/shared/nodeSqliteClient";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

import { migrationManifest, runMigrations } from "./Migrations.ts";
import { reconcileForkMigrationLedger } from "./reconcileForkMigrationLedger.ts";
import Feedback from "./Migrations/061_Feedback.ts";
import PerfReports from "./Migrations/062_PerfReports.ts";

const forkMigrations = [
  [41, "ProjectionThreadsParentThreadId"],
  [42, "ProjectionThreadHandoffs"],
  [43, "RepairProjectionMigrationCollision"],
  [44, "ProjectionThreadsLastMessagePreview"],
  [45, "AuthSessionClientConnection"],
  [46, "Feedback"],
  [47, "ProjectionThreadHandoffsMode"],
  [48, "PerfReports"],
  [49, "ProjectionThreadLinkedPullRequest"],
  [50, "ProjectionThreadsUnsettledAt"],
  [51, "ClearAutomaticProjectModelDefaults"],
  [52, "ProjectionProjectsAutoPull"],
  [53, "RepairAutomaticSettlementTimestamps"],
  [54, "ProjectionProjectIcon"],
  [55, "ProjectionThreadBranchPullRequest"],
  [56, "ProjectionThreadsActiveOrderKey"],
  [57, "ProjectionThreadPullRequests"],
  [58, "ProjectionThreadsChatSubMode"],
  [59, "ProjectionThreadsActivityCounts"],
] as const;

describe("fork migration ledger repair", () => {
  it.effect("repairs the fork ledger and preserves feedback and perf reports", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations({ toMigrationInclusive: 50 });
      const sharedHistory = yield* sql`
        SELECT * FROM effect_sql_migrations WHERE migration_id < 41 ORDER BY migration_id
      `;
      yield* sql`DELETE FROM effect_sql_migrations WHERE migration_id >= 41`;
      for (const [id, name] of forkMigrations) {
        yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name, created_at)
          VALUES (${id}, ${name}, ${`2026-09-01 00:00:${id}`})
        `;
      }
      yield* Feedback;
      yield* PerfReports;
      yield* sql`
        INSERT INTO feedback (id, kind, message, client_json, created_at)
        VALUES ('feedback-sentinel', 'bug', 'Keep this feedback', '{}', '2026-09-01')
      `;
      yield* sql`
        INSERT INTO feedback_attachments
          (feedback_id, attachment_id, name, mime_type, size_bytes, relative_path, position)
        VALUES ('feedback-sentinel', 'attachment-sentinel', 'image.png', 'image/png', 42, 'image.png', 0)
      `;
      yield* sql`
        INSERT INTO perf_reports (id, created_at, client_json, context_json, summary_json, samples_json)
        VALUES ('perf-sentinel', '2026-09-01', '{}', '{}', '{}', '[]')
      `;
      const feedback = yield* sql`SELECT * FROM feedback`;
      const attachments = yield* sql`SELECT * FROM feedback_attachments`;
      const reports = yield* sql`SELECT * FROM perf_reports`;

      assert.deepStrictEqual(yield* runMigrations(), [
        [51, "ProjectionThreadMessageContext"],
        [52, "ProjectionThreadTitleState"],
        [53, "PullRequestFilesViewed"],
        [54, "ProjectionThreadsAutoSettleDisabledAt"],
        [55, "OrchestrationV2"],
        [56, "RemoveRedundantProjectionIndexes"],
        [57, "ScheduledTaskWebhooks"],
        [58, "WebhookRelayDeliveries"],
        [59, "McpAppModelContext"],
        [60, "ThreadSnapshotWindowIndexes"],
        [61, "Feedback"],
        [62, "PerfReports"],
        [63, "ChatListMessageIndex"],
      ]);
      const history = yield* sql<{ readonly migration_id: number; readonly name: string }>`
        SELECT migration_id, name FROM effect_sql_migrations ORDER BY migration_id
      `;
      assert.deepStrictEqual(
        history.map((row) => [row.migration_id, row.name] as const),
        migrationManifest,
      );
      assert.strictEqual(history.length, 63);
      assert.deepStrictEqual(
        history.slice(-3).map((row) => [row.migration_id, row.name]),
        [
          [61, "Feedback"],
          [62, "PerfReports"],
          [63, "ChatListMessageIndex"],
        ],
      );
      assert.deepStrictEqual(
        yield* sql`SELECT * FROM effect_sql_migrations WHERE migration_id < 41 ORDER BY migration_id`,
        sharedHistory,
      );
      assert.deepStrictEqual(
        yield* sql`
          SELECT migration_id, created_at FROM effect_sql_migrations
          WHERE migration_id BETWEEN 41 AND 50 ORDER BY migration_id
        `,
        [45, 49, 50, 51, 52, 53, 54, 55, 56, 57].map((sourceId, index) => ({
          migration_id: index + 41,
          created_at: `2026-09-01 00:00:${sourceId}`,
        })),
      );
      assert.deepStrictEqual(
        yield* sql`
          SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'orchestration_v2_events'
        `,
        [{ name: "orchestration_v2_events" }],
      );
      assert.deepStrictEqual(yield* sql`SELECT * FROM feedback`, feedback);
      assert.deepStrictEqual(yield* sql`SELECT * FROM feedback_attachments`, attachments);
      assert.deepStrictEqual(yield* sql`SELECT * FROM perf_reports`, reports);
      assert.deepStrictEqual(
        yield* sql`
          SELECT name FROM sqlite_master WHERE type = 'index'
          AND name = 'orchestration_v2_projection_turn_items_messages_idx'
        `,
        [{ name: "orchestration_v2_projection_turn_items_messages_idx" }],
      );
    }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: ":memory:" }))),
  );

  it.effect("runs and records feedback and perf migrations on a fresh database", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      assert.deepStrictEqual(yield* runMigrations(), migrationManifest);
      const history = yield* sql<{ readonly migration_id: number; readonly name: string }>`
        SELECT migration_id, name FROM effect_sql_migrations ORDER BY migration_id
      `;
      assert.deepStrictEqual(
        history.map((row) => [row.migration_id, row.name] as const),
        migrationManifest,
      );
      assert.strictEqual(history.length, 63);
      assert.deepStrictEqual(
        history.slice(-3).map((row) => [row.migration_id, row.name]),
        [
          [61, "Feedback"],
          [62, "PerfReports"],
          [63, "ChatListMessageIndex"],
        ],
      );
      assert.deepStrictEqual(
        yield* sql`
          SELECT name FROM sqlite_master WHERE type = 'table'
          AND name IN ('feedback', 'feedback_attachments', 'perf_reports') ORDER BY name
        `,
        [{ name: "feedback" }, { name: "feedback_attachments" }, { name: "perf_reports" }],
      );
    }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: ":memory:" }))),
  );

  it.effect("keeps the upstream ledger intact and runs only migrations 61 and 62", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations({ toMigrationInclusive: 60 });
      const history = yield* sql`SELECT * FROM effect_sql_migrations ORDER BY migration_id`;
      assert.deepStrictEqual(yield* runMigrations(), [
        [61, "Feedback"],
        [62, "PerfReports"],
        [63, "ChatListMessageIndex"],
      ]);
      assert.deepStrictEqual(
        yield* sql`SELECT * FROM effect_sql_migrations WHERE migration_id <= 60 ORDER BY migration_id`,
        history,
      );
      assert.deepStrictEqual(
        yield* sql`
          SELECT migration_id, name FROM effect_sql_migrations WHERE migration_id > 60 ORDER BY migration_id
        `,
        [
          { migration_id: 61, name: "Feedback" },
          { migration_id: 62, name: "PerfReports" },
          { migration_id: 63, name: "ChatListMessageIndex" },
        ],
      );
    }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: ":memory:" }))),
  );

  it.effect("upgrades schema 62 once and preserves turn items and the prior ledger", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations({ toMigrationInclusive: 62 });
      yield* sql`
        INSERT INTO orchestration_v2_projection_turn_items
          (turn_item_id, thread_id, run_id, ordinal, type, status, updated_at, payload_json)
        VALUES ('item-sentinel', 'thread-sentinel', NULL, 0, 'user_message', 'completed',
          '2026-10-19', '{"text":"Keep this message"}')
      `;
      const items = yield* sql`SELECT * FROM orchestration_v2_projection_turn_items`;
      const history = yield* sql`SELECT * FROM effect_sql_migrations ORDER BY migration_id`;
      assert.deepStrictEqual(yield* runMigrations(), [[63, "ChatListMessageIndex"]]);
      assert.deepStrictEqual(
        yield* sql`SELECT * FROM effect_sql_migrations WHERE migration_id <= 62 ORDER BY migration_id`,
        history,
      );
      assert.deepStrictEqual(
        yield* sql`SELECT * FROM orchestration_v2_projection_turn_items`,
        items,
      );
      const indexes = yield* sql<{ readonly sql: string }>`
        SELECT sql FROM sqlite_master WHERE type = 'index'
        AND name = 'orchestration_v2_projection_turn_items_messages_idx'
      `;
      assert.deepStrictEqual(
        indexes.map((index) => index.sql.replace(/\s+/g, " ").trim()),
        [
          "CREATE INDEX orchestration_v2_projection_turn_items_messages_idx ON orchestration_v2_projection_turn_items(thread_id, run_id) WHERE type IN ('user_message', 'assistant_message')",
        ],
      );
      const migratedHistory = yield* sql`SELECT * FROM effect_sql_migrations ORDER BY migration_id`;
      assert.deepStrictEqual(yield* runMigrations(), []);
      assert.deepStrictEqual(
        yield* sql`SELECT * FROM effect_sql_migrations ORDER BY migration_id`,
        migratedHistory,
      );
      assert.deepStrictEqual(
        yield* sql`SELECT * FROM orchestration_v2_projection_turn_items`,
        items,
      );
    }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: ":memory:" }))),
  );

  it.effect("keeps a diverged upstream ledger byte-identical and runs pending migrations", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations({ toMigrationInclusive: 50 });
      yield* sql`
        UPDATE effect_sql_migrations SET name = 'ThreadSummaryTimeline' WHERE migration_id = 41
      `;
      const history = yield* sql`SELECT * FROM effect_sql_migrations ORDER BY migration_id`;
      yield* reconcileForkMigrationLedger();
      assert.deepStrictEqual(
        yield* sql`SELECT * FROM effect_sql_migrations ORDER BY migration_id`,
        history,
      );
      assert.deepStrictEqual(yield* runMigrations(), [
        [51, "ProjectionThreadMessageContext"],
        [52, "ProjectionThreadTitleState"],
        [53, "PullRequestFilesViewed"],
        [54, "ProjectionThreadsAutoSettleDisabledAt"],
        [55, "OrchestrationV2"],
        [56, "RemoveRedundantProjectionIndexes"],
        [57, "ScheduledTaskWebhooks"],
        [58, "WebhookRelayDeliveries"],
        [59, "McpAppModelContext"],
        [60, "ThreadSnapshotWindowIndexes"],
        [61, "Feedback"],
        [62, "PerfReports"],
        [63, "ChatListMessageIndex"],
      ]);
      assert.deepStrictEqual(
        yield* sql`SELECT * FROM effect_sql_migrations WHERE migration_id <= 50 ORDER BY migration_id`,
        history,
      );
      assert.deepStrictEqual(
        yield* sql`SELECT name FROM effect_sql_migrations WHERE migration_id = 41`,
        [{ name: "ThreadSummaryTimeline" }],
      );
    }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: ":memory:" }))),
  );

  it.effect("tolerates a future migration after the complete upstream ledger", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations();
      yield* sql`
        INSERT INTO effect_sql_migrations (migration_id, name, created_at)
        VALUES (64, 'FutureMigration', '2026-09-01 00:00:64')
      `;
      const history = yield* sql`SELECT * FROM effect_sql_migrations ORDER BY migration_id`;
      assert.deepStrictEqual(yield* runMigrations(), []);
      assert.deepStrictEqual(
        yield* sql`SELECT * FROM effect_sql_migrations ORDER BY migration_id`,
        history,
      );
    }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: ":memory:" }))),
  );

  it.effect("leaves a partial fork signature byte-identical without repairing it", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations({ toMigrationInclusive: 40 });
      for (const [id, name] of forkMigrations.filter(([id]) => id <= 57)) {
        yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name, created_at)
          VALUES (${id}, ${name}, ${`2026-09-01 00:00:${id}`})
        `;
      }
      const history = yield* sql`SELECT * FROM effect_sql_migrations ORDER BY migration_id`;
      yield* reconcileForkMigrationLedger();
      assert.deepStrictEqual(
        yield* sql`SELECT * FROM effect_sql_migrations ORDER BY migration_id`,
        history,
      );
    }).pipe(Effect.provide(NodeSqliteClient.layer({ filename: ":memory:" }))),
  );
});
