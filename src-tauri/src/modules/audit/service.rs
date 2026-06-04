use crate::errors::{AppError, AppResult};
use rusqlite::{params, Connection};

use super::model::AuditLogEntry;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Serialise an optional value to a JSON string.
/// Returns `None` when the serialised string is `"null"`, so that
/// empty / missing data never pollutes the audit log.
fn maybe_json<T: serde::Serialize>(value: &Option<T>) -> Option<String> {
    match value {
        None => None,
        Some(v) => {
            let s = serde_json::to_string(v).ok()?;
            if s == "null" {
                None
            } else {
                Some(s)
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Create — this is the ONLY function that writes to audit_logs.
// Safety rule: failures here are always non-fatal for the caller.
// ---------------------------------------------------------------------------

/// Insert an audit log row.  **Never panics** — returns `Ok(())`
/// even on failure so callers can keep operating.
pub fn create_audit_log(
    conn: &Connection,
    user_id: i64,
    action: &str,
    table_name: &str,
    record_id: Option<i64>,
    old_data: Option<&str>,
    new_data: Option<&str>,
) {
    let result = conn.execute(
        "INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            user_id,
            action,
            table_name,
            record_id,
            old_data,
            new_data,
        ],
    );

    // Intentionally swallow errors — auditing must never break primary flows.
    if let Err(e) = result {
        eprintln!(
            "[audit] failed to write audit log (user={}, action={}, table={}): {}",
            user_id, action, table_name, e
        );
    }
}

// ---------------------------------------------------------------------------
// Audit query helpers — consumed by admin-only commands.
// ---------------------------------------------------------------------------

/// Build the WHERE clause for optional filters.
fn build_filters(
    table_name: Option<&str>,
    record_id: Option<i64>,
    user_id: Option<i64>,
) -> (String, Vec<Box<dyn rusqlite::types::ToSql>>) {
    let mut clauses: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(t) = table_name {
        clauses.push(format!("a.table_name = ?{}", param_values.len() + 1));
        param_values.push(Box::new(t.to_string()));
    }
    if let Some(rid) = record_id {
        clauses.push(format!("a.record_id = ?{}", param_values.len() + 1));
        param_values.push(Box::new(rid));
    }
    if let Some(uid) = user_id {
        clauses.push(format!("a.user_id = ?{}", param_values.len() + 1));
        param_values.push(Box::new(uid));
    }

    let where_clause = if clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", clauses.join(" AND "))
    };

    (where_clause, param_values)
}

/// Fetch audit logs with optional filtering, newest first.
pub fn get_audit_logs(
    conn: &Connection,
    table_name: Option<&str>,
    record_id: Option<i64>,
    user_id: Option<i64>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> AppResult<Vec<AuditLogEntry>> {
    let (where_clause, param_values) = build_filters(table_name, record_id, user_id);

    let limit_val = limit.unwrap_or(100).min(1000);
    let offset_val = offset.unwrap_or(0);

    let sql = format!(
        "SELECT a.id, a.user_id, u.username, a.action, a.table_name,
                a.record_id, a.old_data, a.new_data, a.created_at
         FROM audit_logs a
         LEFT JOIN users u ON a.user_id = u.id
         {}
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT ?{} OFFSET ?{}",
        where_clause,
        param_values.len() + 1,
        param_values.len() + 2,
    );

    let mut stmt = conn.prepare(&sql)?;

    let mut all_params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    for p in param_values {
        all_params.push(p);
    }
    all_params.push(Box::new(limit_val));
    all_params.push(Box::new(offset_val));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = all_params.iter().map(|b| b.as_ref()).collect();

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(AuditLogEntry {
            id: row.get(0)?,
            user_id: row.get(1)?,
            username: row.get::<_, Option<String>>(2)?.unwrap_or_else(|| "unknown".into()),
            action: row.get(3)?,
            table_name: row.get(4)?,
            record_id: row.get(5)?,
            old_data: row.get(6)?,
            new_data: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(row?);
    }

    Ok(entries)
}

/// Get the full change history for a single record.
pub fn get_record_history(
    conn: &Connection,
    table_name: &str,
    record_id: i64,
) -> AppResult<Vec<AuditLogEntry>> {
    get_audit_logs(conn, Some(table_name), Some(record_id), None, Some(200), None)
}

/// Get recent activity for a specific user.
pub fn get_user_activity(
    conn: &Connection,
    user_id: i64,
    limit: Option<i64>,
) -> AppResult<Vec<AuditLogEntry>> {
    get_audit_logs(conn, None, None, Some(user_id), limit, None)
}

// ---------------------------------------------------------------------------
// Convenience helpers used by other services to build old/new snapshots.
// ---------------------------------------------------------------------------

/// Build old_data snapshot by selecting the current row values before mutation.
pub fn snapshot_row(
    conn: &Connection,
    table_name: &str,
    id_column: &str,
    record_id: i64,
    columns: &[&str],
) -> AppResult<Option<String>> {
    let col_list = columns.join(", ");
    let sql = format!(
        "SELECT {} FROM {} WHERE {} = ?1",
        col_list, table_name, id_column
    );

    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt.query_map(params![record_id], |row| {
        let map: Vec<(String, serde_json::Value)> = columns
            .iter()
            .enumerate()
            .filter_map(|(i, &col)| {
                // Use ValueRef to handle ANY column type (TEXT, INTEGER, REAL, etc.)
                let val: rusqlite::Result<String> = row.get_ref(i).map(|v| match v {
                    rusqlite::types::ValueRef::Null => "null".to_string(),
                    rusqlite::types::ValueRef::Integer(n) => n.to_string(),
                    rusqlite::types::ValueRef::Real(f) => f.to_string(),
                    rusqlite::types::ValueRef::Text(s) => {
                        String::from_utf8_lossy(s).to_string()
                    }
                    rusqlite::types::ValueRef::Blob(_) => "<blob>".to_string(),
                });
                val.ok().map(|v| {
                    (col.to_string(), serde_json::Value::String(v))
                })
            })
            .collect();
        Ok(serde_json::Value::Object(
            map.into_iter().collect::<serde_json::Map<_, _>>(),
        ))
    })?;

    if let Some(row) = rows.next() {
        let obj = row?;
        Ok(Some(serde_json::to_string(&obj).unwrap_or_default()))
    } else {
        Ok(None)
    }
}

/// Snapshot a result row identified by (order_id, parameter_id).
/// Used before saving a result to capture the previous value for audit.
pub fn snapshot_result(
    conn: &Connection,
    order_id: i64,
    parameter_id: i64,
) -> AppResult<Option<String>> {
    let mut stmt = conn.prepare(
        "SELECT value FROM results WHERE order_id = ?1 AND parameter_id = ?2",
    )?;
    let mut rows = stmt.query_map(params![order_id, parameter_id], |row| {
        let val: String = row.get(0)?;
        Ok(serde_json::json!({"value": val}))
    })?;

    if let Some(row) = rows.next() {
        let obj = row?;
        Ok(Some(serde_json::to_string(&obj).unwrap_or_default()))
    } else {
        Ok(None)
    }
}

/// Snapshot a setting value identified by its TEXT key.
/// Used before updating a setting to capture the previous value for audit.
pub fn snapshot_setting(
    conn: &Connection,
    key: &str,
) -> AppResult<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query_map(params![key], |row| {
        let val: String = row.get(0)?;
        Ok(serde_json::json!({"value": val}))
    })?;

    if let Some(row) = rows.next() {
        let obj = row?;
        Ok(Some(serde_json::to_string(&obj).unwrap_or_default()))
    } else {
        Ok(None)
    }
}