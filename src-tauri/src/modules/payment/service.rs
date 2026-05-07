use crate::db::connection::get_connection;
use crate::errors::{AppError, AppResult};
use crate::utils::money::{from_paise, to_paise};
use crate::utils::validation::{validate_amount, validate_positive_id};
use rusqlite::{params, OptionalExtension};

pub fn update_payment(order_id: i32, paid_amount: f64) -> AppResult<()> {
    validate_positive_id(order_id, "order_id")?;
    validate_amount(paid_amount)?;

    let paid_amount_paise = to_paise(paid_amount)?;

    let mut conn = get_connection().map_err(AppError::from)?;
    let tx = conn.transaction().map_err(AppError::from)?;

    let order_amounts: Option<(i64, i64)> = tx
        .query_row(
            "SELECT
                IFNULL(total_amount_paise, 0),
                IFNULL(paid_amount_paise, 0)
             FROM orders
             WHERE id = ?1",
            [order_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(AppError::from)?;

    let Some((total_amount_paise, current_paid_paise)) = order_amounts else {
        return Err(AppError::NotFound(format!("Order {} not found", order_id)));
    };

    if paid_amount_paise > total_amount_paise {
        return Err(AppError::BusinessLogicError(
            "Payment cannot exceed order total".to_string(),
        ));
    }

    if paid_amount_paise < current_paid_paise {
        return Err(AppError::BusinessLogicError(
            "Paid amount cannot be less than the amount already recorded".to_string(),
        ));
    }

    tx.execute(
        "UPDATE orders
         SET paid_amount = ?1,
             paid_amount_paise = ?2
         WHERE id = ?3",
        params![from_paise(paid_amount_paise), paid_amount_paise, order_id],
    )
    .map_err(AppError::from)?;

    tx.commit().map_err(AppError::from)?;

    log::info!(
        "Updated payment for order {} from {} paise to {} paise",
        order_id,
        current_paid_paise,
        paid_amount_paise
    );

    Ok(())
}

pub fn get_daily_summary() -> AppResult<(f64, f64, f64)> {
    let conn = get_connection().map_err(AppError::from)?;

    let (total_paise, paid_paise): (i64, i64) = conn
        .query_row(
            "SELECT
                IFNULL(SUM(total_amount_paise), 0),
                IFNULL(SUM(paid_amount_paise), 0)
             FROM orders
             WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(AppError::from)?;

    let pending_paise = (total_paise - paid_paise).max(0);

    Ok((
        from_paise(total_paise),
        from_paise(paid_paise),
        from_paise(pending_paise),
    ))
}

pub fn get_overall_summary() -> AppResult<(f64, f64, f64)> {
    let conn = get_connection().map_err(AppError::from)?;

    let (total_paise, paid_paise): (i64, i64) = conn
        .query_row(
            "SELECT
                IFNULL(SUM(total_amount_paise), 0),
                IFNULL(SUM(paid_amount_paise), 0)
             FROM orders",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(AppError::from)?;

    let pending_paise = (total_paise - paid_paise).max(0);

    Ok((
        from_paise(total_paise),
        from_paise(paid_paise),
        from_paise(pending_paise),
    ))
}