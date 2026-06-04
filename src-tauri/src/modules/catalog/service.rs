use crate::errors::{AppError, AppResult};
use crate::utils::validation::{validate_amount, validate_positive_id};
use rusqlite::{params, Connection};

use super::model::{TestCatalogItem, TestParameterDto};

fn validate_test_name(name: &str) -> AppResult<()> {
    let trimmed = name.trim();

    if trimmed.len() < 2 {
        return Err(AppError::ValidationError(
            "Test name must be at least 2 characters".to_string(),
        ));
    }

    if trimmed.len() > 120 {
        return Err(AppError::ValidationError(
            "Test name must be less than 120 characters".to_string(),
        ));
    }

    Ok(())
}

fn validate_short_text(value: &str, field_name: &str, max_len: usize) -> AppResult<()> {
    if value.trim().len() > max_len {
        return Err(AppError::ValidationError(format!(
            "{} must be less than {} characters",
            field_name, max_len
        )));
    }

    Ok(())
}

pub fn get_tests(conn: &Connection) -> AppResult<Vec<TestCatalogItem>> {
    let mut stmt = conn
        .prepare(
            "SELECT
                t.id,
                t.name,
                t.price,
                tp.id,
                tp.name,
                tp.unit,
                tp.normal_range
             FROM tests t
             LEFT JOIN test_parameters tp
               ON tp.test_id = t.id
              AND IFNULL(tp.is_active, 1) = 1
             WHERE IFNULL(t.is_active, 1) = 1
             ORDER BY t.id ASC, tp.id ASC",
        )
        .map_err(AppError::from)?;

    let mut rows = stmt.query([]).map_err(AppError::from)?;
    let mut tests: Vec<TestCatalogItem> = Vec::new();

    while let Some(row) = rows.next().map_err(AppError::from)? {
        let test_id: i32 = row.get(0)?;
        let test_name: String = row.get(1)?;
        let price: f64 = row.get(2)?;

        if tests.last().map(|test| test.id) != Some(test_id) {
            tests.push(TestCatalogItem {
                id: test_id,
                name: test_name,
                price,
                parameters: Vec::new(),
            });
        }

        if let Some(param_id) = row.get::<_, Option<i32>>(3)? {
            let parameter = TestParameterDto {
                id: param_id,
                name: row.get(4)?,
                unit: row.get(5)?,
                normal_range: row.get(6)?,
            };

            if let Some(last) = tests.last_mut() {
                last.parameters.push(parameter);
            }
        }
    }

    Ok(tests)
}

pub fn get_test_parameters(conn: &Connection, test_id: i32) -> AppResult<Vec<TestParameterDto>> {
    validate_positive_id(test_id, "test_id")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, unit, normal_range
             FROM test_parameters
             WHERE test_id = ?1
               AND IFNULL(is_active, 1) = 1
             ORDER BY id ASC",
        )
        .map_err(AppError::from)?;

    let rows = stmt
        .query_map([test_id], |row| {
            Ok(TestParameterDto {
                id: row.get(0)?,
                name: row.get(1)?,
                unit: row.get(2)?,
                normal_range: row.get(3)?,
            })
        })
        .map_err(AppError::from)?;

    rows.map(|row| row.map_err(AppError::from)).collect()
}

pub fn add_test(conn: &Connection, name: String, price: f64) -> AppResult<i32> {
    validate_test_name(&name)?;
    validate_amount(price)?;

    let cleaned_name = name.trim();

    conn.execute(
        "INSERT INTO tests (name, price, is_active, updated_at)
         VALUES (?1, ?2, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(name) DO UPDATE SET
            price = excluded.price,
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP",
        params![cleaned_name, price],
    )
    .map_err(AppError::from)?;

    let id: i32 = conn
        .query_row(
            "SELECT id FROM tests WHERE name = ?1",
            [cleaned_name],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    Ok(id)
}

pub fn update_test(conn: &Connection, test_id: i32, name: String, price: f64) -> AppResult<()> {
    validate_positive_id(test_id, "test_id")?;
    validate_test_name(&name)?;
    validate_amount(price)?;

    let cleaned_name = name.trim();

    let updated = conn
        .execute(
            "UPDATE tests
             SET name = ?1,
                 price = ?2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?3
               AND IFNULL(is_active, 1) = 1",
            params![cleaned_name, price, test_id],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                AppError::DuplicateError(format!("Test '{}' already exists", cleaned_name))
            } else {
                AppError::from(e)
            }
        })?;

    if updated == 0 {
        return Err(AppError::NotFound(format!(
            "Test {} not found or inactive",
            test_id
        )));
    }

    Ok(())
}

pub fn delete_test(conn: &Connection, test_id: i32) -> AppResult<()> {
    validate_positive_id(test_id, "test_id")?;

    let updated = conn
        .execute(
            "UPDATE tests
             SET is_active = 0,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1
               AND IFNULL(is_active, 1) = 1",
            [test_id],
        )
        .map_err(AppError::from)?;

    if updated == 0 {
        return Err(AppError::NotFound(format!(
            "Test {} not found or already inactive",
            test_id
        )));
    }

    Ok(())
}

pub fn add_test_parameter(
    conn: &Connection,
    test_id: i32,
    name: String,
    unit: String,
    normal_range: String,
) -> AppResult<i32> {
    validate_positive_id(test_id, "test_id")?;
    validate_test_name(&name)?;
    validate_short_text(&unit, "Unit", 50)?;
    validate_short_text(&normal_range, "Reference range", 120)?;


    let test_active: i32 = conn
        .query_row(
            "SELECT COUNT(*)
             FROM tests
             WHERE id = ?1
               AND IFNULL(is_active, 1) = 1",
            [test_id],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    if test_active == 0 {
        return Err(AppError::NotFound(format!(
            "Test {} not found or inactive",
            test_id
        )));
    }

    let cleaned_name = name.trim();
    let cleaned_unit = unit.trim();
    let cleaned_range = normal_range.trim();

    conn.execute(
        "INSERT INTO test_parameters (
            test_id,
            name,
            unit,
            normal_range,
            is_active,
            updated_at
         )
         VALUES (?1, ?2, ?3, ?4, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(test_id, name) DO UPDATE SET
            unit = excluded.unit,
            normal_range = excluded.normal_range,
            is_active = 1,
            updated_at = CURRENT_TIMESTAMP",
        params![test_id, cleaned_name, cleaned_unit, cleaned_range],
    )
    .map_err(AppError::from)?;

    let id: i32 = conn
        .query_row(
            "SELECT id
             FROM test_parameters
             WHERE test_id = ?1
               AND name = ?2",
            params![test_id, cleaned_name],
            |row| row.get(0),
        )
        .map_err(AppError::from)?;

    Ok(id)
}

pub fn update_test_parameter(
    conn: &Connection,
    parameter_id: i32,
    name: String,
    unit: String,
    normal_range: String,
) -> AppResult<()> {
    validate_positive_id(parameter_id, "parameter_id")?;
    validate_test_name(&name)?;
    validate_short_text(&unit, "Unit", 50)?;
    validate_short_text(&normal_range, "Reference range", 120)?;


    let cleaned_name = name.trim();
    let cleaned_unit = unit.trim();
    let cleaned_range = normal_range.trim();

    let updated = conn
        .execute(
            "UPDATE test_parameters
             SET name = ?1,
                 unit = ?2,
                 normal_range = ?3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?4
               AND IFNULL(is_active, 1) = 1",
            params![cleaned_name, cleaned_unit, cleaned_range, parameter_id],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                AppError::DuplicateError(format!(
                    "Parameter '{}' already exists for this test",
                    cleaned_name
                ))
            } else {
                AppError::from(e)
            }
        })?;

    if updated == 0 {
        return Err(AppError::NotFound(format!(
            "Parameter {} not found or inactive",
            parameter_id
        )));
    }

    Ok(())
}

pub fn delete_test_parameter(conn: &Connection, parameter_id: i32) -> AppResult<()> {
    validate_positive_id(parameter_id, "parameter_id")?;


    let updated = conn
        .execute(
            "UPDATE test_parameters
             SET is_active = 0,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1
               AND IFNULL(is_active, 1) = 1",
            [parameter_id],
        )
        .map_err(AppError::from)?;

    if updated == 0 {
        return Err(AppError::NotFound(format!(
            "Parameter {} not found or already inactive",
            parameter_id
        )));
    }

    Ok(())
}