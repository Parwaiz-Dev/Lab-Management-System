use crate::errors::{AppError, AppResult};
use crate::utils::validation::{validate_parameter_value, validate_positive_id};
use rusqlite::{params, Connection, Transaction};

use super::model::{OrderParameterDto, ResultInput};

fn ensure_order_exists(conn: &Connection, order_id: i32) -> AppResult<()> {
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM orders WHERE id = ?1",
            [order_id],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    if count == 0 {
        return Err(AppError::NotFound(format!("Order {} not found", order_id)));
    }

    Ok(())
}

fn ensure_parameter_belongs_to_order(
    tx: &Transaction<'_>,
    order_id: i32,
    parameter_id: i32,
) -> AppResult<()> {
    let count: i32 = tx
        .query_row(
            "SELECT COUNT(*)
             FROM order_parameters
             WHERE order_id = ?1
               AND parameter_id = ?2",
            params![order_id, parameter_id],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    if count == 0 {
        return Err(AppError::BusinessLogicError(format!(
            "Parameter {} does not belong to order {}",
            parameter_id, order_id
        )));
    }

    Ok(())
}

pub fn save_result(conn: &mut Connection, order_id: i32, parameter_id: i32, value: String) -> AppResult<()> {
    validate_positive_id(order_id, "order_id")?;
    validate_positive_id(parameter_id, "parameter_id")?;

    let cleaned_value = value.trim().to_string();
    validate_parameter_value(&cleaned_value)?;

    ensure_order_exists(conn, order_id)?;

    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate).map_err(AppError::from)?;

    ensure_parameter_belongs_to_order(&tx, order_id, parameter_id)?;

    tx.execute(
        "INSERT INTO results (order_id, parameter_id, value)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(order_id, parameter_id)
         DO UPDATE SET value = excluded.value",
        params![order_id, parameter_id, cleaned_value],
    )
    .map_err(AppError::from)?;

    tx.commit().map_err(AppError::from)?;

    Ok(())
}

pub fn save_results(conn: &mut Connection, order_id: i32, results: Vec<ResultInput>) -> AppResult<usize> {
    validate_positive_id(order_id, "order_id")?;

    if results.is_empty() {
        return Err(AppError::ValidationError(
            "At least one result value is required".to_string(),
        ));
    }

    ensure_order_exists(conn, order_id)?;

    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate).map_err(AppError::from)?;
    let mut saved_count = 0usize;

    for result in results {
        validate_positive_id(result.parameter_id, "parameter_id")?;

        let cleaned_value = result.value.trim().to_string();

        if cleaned_value.is_empty() {
            continue;
        }

        validate_parameter_value(&cleaned_value)?;

        ensure_parameter_belongs_to_order(&tx, order_id, result.parameter_id)?;

        tx.execute(
            "INSERT INTO results (order_id, parameter_id, value)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(order_id, parameter_id)
             DO UPDATE SET value = excluded.value",
            params![order_id, result.parameter_id, cleaned_value],
        )
        .map_err(AppError::from)?;

        saved_count += 1;
    }

    if saved_count == 0 {
        return Err(AppError::ValidationError(
            "No valid result values were provided".to_string(),
        ));
    }

    tx.commit().map_err(AppError::from)?;

    Ok(saved_count)
}

pub fn get_parameters_by_order(conn: &Connection, order_id: i32) -> AppResult<Vec<OrderParameterDto>> {
    validate_positive_id(order_id, "order_id")?;

    ensure_order_exists(conn, order_id)?;

    let mut stmt = conn
        .prepare(
            "SELECT
                tp.id,
                tp.test_id,
                COALESCE(NULLIF(ot.test_name_snapshot, ''), t.name),
                COALESCE(NULLIF(op.parameter_name_snapshot, ''), tp.name),
                COALESCE(NULLIF(op.unit_snapshot, ''), tp.unit, ''),
                COALESCE(NULLIF(op.normal_range_snapshot, ''), tp.normal_range, ''),
                IFNULL(r.value, ''),
                CASE
                    WHEN r.value IS NOT NULL AND TRIM(r.value) <> '' THEN 1
                    ELSE 0
                END
             FROM order_parameters op
             JOIN test_parameters tp ON tp.id = op.parameter_id
             JOIN tests t ON t.id = tp.test_id
             JOIN order_tests ot
               ON ot.order_id = op.order_id
              AND ot.test_id = tp.test_id
             LEFT JOIN results r
               ON r.order_id = op.order_id
              AND r.parameter_id = op.parameter_id
             WHERE op.order_id = ?1
             ORDER BY ot.id ASC, op.id ASC",
        )
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map([order_id], |row| {
            let entered_number: i32 = row.get(7)?;

            Ok(OrderParameterDto {
                id: row.get(0)?,
                test_id: row.get(1)?,
                test_name: row.get(2)?,
                name: row.get(3)?,
                unit: row.get(4)?,
                normal_range: row.get(5)?,
                value: row.get(6)?,
                is_entered: entered_number == 1,
            })
        })
        .map_err(AppError::from)?;

    rows.map(|row| row.map_err(AppError::from)).collect()
}

pub fn get_results_by_order(conn: &Connection, order_id: i32) -> AppResult<Vec<(i32, String)>> {
    validate_positive_id(order_id, "order_id")?;

    ensure_order_exists(conn, order_id)?;

    let mut stmt = conn
        .prepare(
            "SELECT parameter_id, value
             FROM results
             WHERE order_id = ?1
               AND TRIM(value) <> ''
             ORDER BY parameter_id ASC",
        )
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map([order_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(AppError::from)?;

    rows.map(|row| row.map_err(AppError::from)).collect()
}