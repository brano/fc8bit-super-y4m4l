using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.Sqlite;

// FC8Bit Super Y4M4L - scoreboard API.
//
// Two endpoints and a SQLite file. Every POST carries an HMAC over the payload
// so a score cannot simply be curl'd in, plus a timestamp and a single-use
// nonce so a captured request cannot be replayed.
//
// Be clear about what that buys: the HMAC key also lives in the game's
// JavaScript, so anyone willing to read the bundle can mint a valid signature.
// It stops casual fake posts, not a determined player. The checks that hold
// regardless are server-side: score ceiling, name rules, rate limit, replay
// protection. Making this actually tamper-proof needs the server to own the
// scoring (validate a replay of the run, or run the simulation itself), which
// is a different and much larger piece of work.

var builder = WebApplication.CreateBuilder(args);

var cfg = builder.Configuration;
var secret = cfg["Scores:Secret"] ?? "fc8-dev-secret-change-me";
var dbPath = cfg["Scores:DbPath"] ?? "scores.db";
var maxScore = cfg.GetValue("Scores:MaxScore", 500_000);
var skewSeconds = cfg.GetValue("Scores:ClockSkewSeconds", 300);
var origins = cfg.GetSection("Scores:Origins").Get<string[]>()
              ?? ["http://localhost:5199", "http://127.0.0.1:5199"];

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("submit", http => RateLimitPartition.GetFixedWindowLimiter(
        http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));
});

var app = builder.Build();
app.UseCors();
app.UseRateLimiter();

var connectionString = new SqliteConnectionStringBuilder { DataSource = dbPath }.ToString();
Db.Initialise(connectionString);

app.MapGet("/api/health", () => Results.Ok(new { ok = true, utc = DateTimeOffset.UtcNow }));

// ---------------------------------------------------------------- read
app.MapGet("/api/scores", (int? limit) =>
{
    var take = Math.Clamp(limit ?? 10, 1, 100);
    using var cn = new SqliteConnection(connectionString);
    cn.Open();
    using var cmd = cn.CreateCommand();
    cmd.CommandText = """
        SELECT name, score, balls, level, created_utc
        FROM scores
        ORDER BY score DESC, created_utc ASC
        LIMIT $take;
        """;
    cmd.Parameters.AddWithValue("$take", take);

    var rows = new List<ScoreRow>();
    using var rd = cmd.ExecuteReader();
    var rank = 0;
    while (rd.Read())
    {
        rows.Add(new ScoreRow(++rank, rd.GetString(0), rd.GetInt32(1),
                              rd.GetInt32(2), rd.GetInt32(3), rd.GetString(4)));
    }
    return Results.Ok(rows);
});

// ---------------------------------------------------------------- write
app.MapPost("/api/scores", (ScoreSubmission body) =>
{
    var name = (body.Name ?? "").Trim().ToUpperInvariant();
    if (name.Length is < 1 or > 12 || !Regex.IsMatch(name, "^[A-Z0-9 .'-]+$"))
        return Results.BadRequest(new { error = "name must be 1-12 chars, letters/digits only" });

    if (body.Score < 0 || body.Score > maxScore)
        return Results.BadRequest(new { error = $"score out of range (0-{maxScore})" });

    if (body.Balls < 0 || body.Balls > 10_000 || body.Level is < 0 or > 10)
        return Results.BadRequest(new { error = "balls or level out of range" });

    var age = Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeSeconds() - body.Ts);
    if (age > skewSeconds)
        return Results.BadRequest(new { error = "stale request" });

    if (string.IsNullOrWhiteSpace(body.Nonce) || body.Nonce.Length is < 8 or > 64)
        return Results.BadRequest(new { error = "bad nonce" });

    // canonical payload - the client must sign exactly this
    var canonical = $"{name}|{body.Score}|{body.Balls}|{body.Level}|{body.Ts}|{body.Nonce}";
    var expected = Hmac(secret, canonical);
    if (!CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(expected),
            Encoding.ASCII.GetBytes((body.Hash ?? "").ToLowerInvariant())))
        return Results.BadRequest(new { error = "signature mismatch" });

    using var cn = new SqliteConnection(connectionString);
    cn.Open();
    using var tx = cn.BeginTransaction();

    // single-use nonce: the same signed request cannot be replayed
    using (var seen = cn.CreateCommand())
    {
        seen.Transaction = tx;
        seen.CommandText = "INSERT OR IGNORE INTO nonces (nonce, created_utc) VALUES ($n, $t);";
        seen.Parameters.AddWithValue("$n", body.Nonce);
        seen.Parameters.AddWithValue("$t", DateTimeOffset.UtcNow.ToString("O"));
        if (seen.ExecuteNonQuery() == 0)
            return Results.Conflict(new { error = "already submitted" });
    }

    long id;
    using (var ins = cn.CreateCommand())
    {
        ins.Transaction = tx;
        ins.CommandText = """
            INSERT INTO scores (name, score, balls, level, created_utc)
            VALUES ($name, $score, $balls, $level, $t);
            SELECT last_insert_rowid();
            """;
        ins.Parameters.AddWithValue("$name", name);
        ins.Parameters.AddWithValue("$score", body.Score);
        ins.Parameters.AddWithValue("$balls", body.Balls);
        ins.Parameters.AddWithValue("$level", body.Level);
        ins.Parameters.AddWithValue("$t", DateTimeOffset.UtcNow.ToString("O"));
        id = (long)(ins.ExecuteScalar() ?? 0L);
    }

    using (var prune = cn.CreateCommand())
    {
        prune.Transaction = tx;
        prune.CommandText = "DELETE FROM nonces WHERE created_utc < $cut;";
        prune.Parameters.AddWithValue("$cut", DateTimeOffset.UtcNow.AddDays(-1).ToString("O"));
        prune.ExecuteNonQuery();
    }

    tx.Commit();

    // where did they land?
    using var rankCmd = cn.CreateCommand();
    rankCmd.CommandText = "SELECT COUNT(*) + 1 FROM scores WHERE score > $s;";
    rankCmd.Parameters.AddWithValue("$s", body.Score);
    var rank = Convert.ToInt32(rankCmd.ExecuteScalar() ?? 1);

    return Results.Ok(new { id, rank, name, score = body.Score });
}).RequireRateLimiting("submit");

app.Run();

static string Hmac(string key, string payload)
{
    using var h = new HMACSHA256(Encoding.UTF8.GetBytes(key));
    return Convert.ToHexString(h.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
}

record ScoreRow(int Rank, string Name, int Score, int Balls, int Level, string CreatedUtc);

record ScoreSubmission(string? Name, int Score, int Balls, int Level, long Ts, string? Nonce, string? Hash);

static class Db
{
    public static void Initialise(string connectionString)
    {
        using var cn = new SqliteConnection(connectionString);
        cn.Open();
        using var cmd = cn.CreateCommand();
        cmd.CommandText = """
            CREATE TABLE IF NOT EXISTS scores (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                score       INTEGER NOT NULL,
                balls       INTEGER NOT NULL DEFAULT 0,
                level       INTEGER NOT NULL DEFAULT 0,
                created_utc TEXT    NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_scores_score ON scores (score DESC);

            CREATE TABLE IF NOT EXISTS nonces (
                nonce       TEXT PRIMARY KEY,
                created_utc TEXT NOT NULL
            );
            """;
        cmd.ExecuteNonQuery();
    }
}
