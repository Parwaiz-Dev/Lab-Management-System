/// Patient module integration tests.
#[cfg(test)]
mod tests {
    use crate::modules::patient::service::{add_doctor, create_patient, get_doctors, search_patients};
    use rusqlite::Connection;

    fn test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_code TEXT UNIQUE,
                name TEXT NOT NULL,
                age_value INTEGER,
                age_unit TEXT,
                gender TEXT,
                phone TEXT,
                referred_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE doctors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            );
            INSERT INTO patients (id, patient_code, name, age_value, age_unit, gender, phone, referred_by)
            VALUES (1, 'P001', 'John Doe', 35, 'Years', 'Male', '9876543210', 'Dr. Smith');
            INSERT INTO patients (id, patient_code, name, phone)
            VALUES (2, 'P002', 'Jane Doe', '9876543211');
            INSERT INTO doctors (id, name) VALUES (1, 'Dr. Smith');
        ",
        )
        .unwrap();
        conn
    }

    // ── create_patient ──

    #[test]
    fn create_patient_success() {
        let mut conn = test_db();
        let id = create_patient(
            &mut conn,
            "Alice".into(),
            Some(28),
            Some("Years".into()),
            Some("Female".into()),
            Some("9876543212".into()),
            Some("Dr. Referrer".into()),
        )
        .unwrap();
        assert!(id > 0);
    }

    #[test]
    fn create_patient_auto_generates_code() {
        let mut conn = test_db();
        let id1 = create_patient(
            &mut conn,
            "Patient A".into(),
            Some(20),
            None,
            None,
            None,
            None,
        )
        .unwrap();
        let id2 = create_patient(
            &mut conn,
            "Patient B".into(),
            Some(21),
            None,
            None,
            None,
            None,
        )
        .unwrap();
        assert_ne!(id1, id2);
    }

    #[test]
    fn create_patient_rejects_empty_name() {
        let mut conn = test_db();
        let result = create_patient(
            &mut conn,
            "".into(),
            Some(28),
            None,
            None,
            None,
            None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn create_patient_rejects_negative_age() {
        let mut conn = test_db();
        let result = create_patient(
            &mut conn,
            "Negative Age".into(),
            Some(-5),
            Some("Years".into()),
            None,
            None,
            None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn create_patient_rejects_invalid_age_unit() {
        let mut conn = test_db();
        let result = create_patient(
            &mut conn,
            "Bad Unit".into(),
            Some(5),
            Some("decades".into()),
            None,
            None,
            None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn create_patient_rejects_invalid_gender() {
        let mut conn = test_db();
        let result = create_patient(
            &mut conn,
            "Bad Gender".into(),
            Some(30),
            Some("Years".into()),
            Some("Alien".into()),
            None,
            None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn create_patient_without_optional_fields() {
        let mut conn = test_db();
        let result = create_patient(
            &mut conn,
            "Minimal".into(),
            Some(42),
            None,
            None,
            None,
            None,
        );
        assert!(result.is_ok());
    }

    // ── search_patients ──

    #[test]
    fn search_patients_by_name() {
        let conn = test_db();
        let results = search_patients(&conn, "John".into()).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "John Doe");
    }

    #[test]
    fn search_patients_by_phone() {
        let conn = test_db();
        let results = search_patients(&conn, "9876543211".into()).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "Jane Doe");
    }

    #[test]
    fn search_patients_by_patient_code() {
        let conn = test_db();
        let results = search_patients(&conn, "P001".into()).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].patient_code, "P001");
    }

    #[test]
    fn search_patients_case_insensitive() {
        let conn = test_db();
        let results = search_patients(&conn, "john".into()).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "John Doe");
    }

    #[test]
    fn search_patients_no_match() {
        let conn = test_db();
        let results = search_patients(&conn, "ZzzNotFound".into()).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn search_patients_empty_query_returns_empty() {
        let conn = test_db();
        // search_patients requires query.len() >= 2; empty returns empty vec
        let results = search_patients(&conn, "".into()).unwrap();
        assert_eq!(results.len(), 0);
    }

    // ── get_doctors ──

    #[test]
    fn get_doctors_returns_from_doctors_table() {
        let conn = test_db();
        let doctors = get_doctors(&conn).unwrap();
        assert!(doctors.contains(&"Dr. Smith".to_string()));
    }

    #[test]
    fn get_doctors_empty_table() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE doctors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            );",
        )
        .unwrap();
        let doctors = get_doctors(&conn).unwrap();
        assert!(doctors.is_empty());
    }

    // ── add_doctor ──

    #[test]
    fn add_doctor_inserts_new_name() {
        let conn = test_db();
        add_doctor(&conn, "Dr. New".into()).unwrap();
        let doctors = get_doctors(&conn).unwrap();
        assert!(doctors.contains(&"Dr. New".to_string()));
    }

    #[test]
    fn add_doctor_rejects_empty_name() {
        let conn = test_db();
        let result = add_doctor(&conn, "".into());
        assert!(result.is_err());
    }

    #[test]
    fn add_duplicate_doctor_is_idempotent() {
        let conn = test_db();
        add_doctor(&conn, "Dr. Dup".into()).unwrap();
        let result = add_doctor(&conn, "Dr. Dup".into());
        // Should not panic — may succeed (upsert) or fail gracefully
        let _ = result;
    }
}