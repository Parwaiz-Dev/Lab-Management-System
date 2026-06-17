use crate::errors::{AppError, AppResult};
use crate::utils::helpers::payment_status;
use crate::utils::money::from_paise;
use crate::utils::validation::validate_positive_id;
use rusqlite::Connection;

use super::model::{ReceiptData, ReceiptLine};

pub fn get_receipt(conn: &Connection, order_id: i32) -> AppResult<ReceiptData> {
    validate_positive_id(order_id, "order_id")?;

    let (
        patient_name,
        patient_code,
        age_value,
        age_unit,
        gender,
        phone,
        referred_by,
        invoice_no,
        total_paise,
        paid_paise,
        discount_paise,
        order_date,
    ): (
        String,
        String,
        Option<i32>,
        String,
        String,
        String,
        String,
        String,
        i64,
        i64,
        i64,
        String,
    ) = conn
        .query_row(
            "SELECT
                p.name,
                IFNULL(p.patient_code, ''),
                p.age_value,
                IFNULL(p.age_unit, ''),
                IFNULL(p.gender, ''),
                IFNULL(p.phone, ''),
                IFNULL(p.referred_by, 'Self'),
                COALESCE(NULLIF(o.invoice_no, ''), 'INV-' || o.id),
                IFNULL(o.total_amount_paise, 0),
                IFNULL(o.paid_amount_paise, 0),
                IFNULL(o.discount_amount_paise, 0),
                IFNULL(o.created_at, '')
             FROM orders o
             JOIN patients p ON p.id = o.patient_id
             WHERE o.id = ?1",
            [order_id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                    row.get(7)?,
                    row.get(8)?,
                    row.get(9)?,
                    row.get(10)?,
                    row.get(11)?,
                ))
            },
        )
        .map_err(AppError::from)?;

    let mut stmt = conn
        .prepare(
            "SELECT
                COALESCE(NULLIF(ot.test_name_snapshot, ''), t.name),
                CASE
                    WHEN IFNULL(ot.price_paise, 0) > 0 THEN ot.price_paise
                    ELSE ROUND(IFNULL(t.price, 0) * 100)
                END,
                IFNULL((
                    SELECT GROUP_CONCAT(parameter_name, '||')
                    FROM (
                        SELECT COALESCE(NULLIF(op.parameter_name_snapshot, ''), tp.name) AS parameter_name
                        FROM order_parameters op
                        JOIN test_parameters tp ON tp.id = op.parameter_id
                        WHERE op.order_id = ot.order_id
                          AND tp.test_id = ot.test_id
                        ORDER BY op.id ASC
                    )
                ), '')
             FROM order_tests ot
             JOIN tests t ON t.id = ot.test_id
             WHERE ot.order_id = ?1
             ORDER BY ot.id ASC",
        )
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map([order_id], |row| {
            let test_name: String = row.get(0)?;
            let price_paise: i64 = row.get(1)?;
            let parameter_joined: String = row.get(2)?;

            let parameter_names = parameter_joined
                .split("||")
                .map(|item| item.trim().to_string())
                .filter(|item| !item.is_empty())
                .collect::<Vec<String>>();

            Ok(ReceiptLine {
                test_name,
                price: from_paise(price_paise),
                parameter_names,
            })
        })
        .map_err(AppError::from)?;

    let tests = rows
        .map(|row| row.map_err(AppError::from))
        .collect::<AppResult<Vec<ReceiptLine>>>()?;

    let pending_paise = (total_paise - paid_paise).max(0);
    let subtotal_paise = total_paise + discount_paise;

    Ok(ReceiptData {
        order_id,
        invoice_no,

        patient_name,
        patient_code,
        age_value,
        age_unit,
        gender,
        phone,
        referred_by,

        subtotal_amount: from_paise(subtotal_paise),
        discount_amount: from_paise(discount_paise),
        total_amount: from_paise(total_paise),
        paid_amount: from_paise(paid_paise),
        pending_amount: from_paise(pending_paise),
        payment_status: payment_status(total_paise, paid_paise),

        order_date,
        tests,
    })
}