/// Patient module integration tests.
#[cfg(test)]
mod tests {
    use crate::modules::patient::service::{
        add_doctor, create_patient, get_all_doctors, get_default_doctor, get_doctors,
        search_patients, set_default_doctor, set_doctor_active, update_doctor,
    };
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
                name TEXT UNIQUE NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                is_default INTEGER NOT NULL DEFAULT 0
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_single_default ON doctors(is_default) WHERE is_default = 1;
            CREATE INDEX IF NOT EXISTS idx_doctors_active ON doctors(is_active);

            INSERT INTO patients (id, patient_code, name, age_value, age_unit, gender, phone, referred_by)
            VALUES (1, 'P001', 'John Doe', 35, 'Years', 'Male', '9876543210', 'Dr. Smith');
            INSERT INTO patients (id, patient_code, name, phone)
            VALUES (2, 'P002', 'Jane Doe', '9876543211');
            INSERT INTO doctors (id, name, is_active, is_default) VALUES (1, 'Dr. Smith', 1, 0);
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
    fn search_patients_empty_query_returns_all() {
        let conn = test_db();
        // search_patients with empty query returns all recent patients
        let results = search_patients(&conn, "".into()).unwrap();
        assert_eq!(results.len(), 2);
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
                name TEXT UNIQUE NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                is_default INTEGER NOT NULL DEFAULT 0
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
        let id = add_doctor(&conn, "Dr. New".into()).unwrap();
        assert!(id > 0);
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
    fn add_duplicate_doctor_returns_error() {
        let conn = test_db();
        add_doctor(&conn, "Dr. Dup".into()).unwrap();
        let result = add_doctor(&conn, "Dr. Dup".into());
        assert!(result.is_err());
    }

    // ── update_patient & delete_patient ──

    #[test]
    fn update_patient_success() {
        let mut conn = test_db();
        crate::modules::patient::service::update_patient(
            &mut conn,
            1,
            "John Updated".into(),
            Some(36),
            Some("Years".into()),
            Some("Male".into()),
            Some("9999999999".into()),
            Some("Dr. Smith".into()),
        )
        .unwrap();

        let patients = search_patients(&conn, "John Updated".into()).unwrap();
        assert_eq!(patients.len(), 1);
        assert_eq!(patients[0].name, "John Updated");
        assert_eq!(patients[0].phone, Some("9999999999".to_string()));
    }

    #[test]
    fn delete_patient_success() {
        let mut conn = test_db();
        crate::modules::patient::service::delete_patient(&mut conn, 2).unwrap();
        let patients = search_patients(&conn, "Jane Doe".into()).unwrap();
        assert!(patients.is_empty());
    }

    // ── DOCTOR MANAGEMENT & DEFAULT DOCTOR TESTS ──

    #[test]
    fn test_doctor_default_management() {
        let mut conn = test_db();

        // Initially no default doctor
        let default_doc = get_default_doctor(&conn).unwrap();
        assert!(default_doc.is_none());

        // Add two doctors
        let id_alpha = add_doctor(&conn, "Dr. Alpha".into()).unwrap();
        let id_beta = add_doctor(&conn, "Dr. Beta".into()).unwrap();

        // Set Alpha as default
        set_default_doctor(&mut conn, id_alpha).unwrap();
        let default_doc = get_default_doctor(&conn).unwrap().expect("Should have default");
        assert_eq!(default_doc.id, id_alpha);
        assert_eq!(default_doc.name, "Dr. Alpha");
        assert!(default_doc.is_default);

        // Switch default to Beta
        set_default_doctor(&mut conn, id_beta).unwrap();
        let default_doc = get_default_doctor(&conn).unwrap().expect("Should have default");
        assert_eq!(default_doc.id, id_beta);
        assert_eq!(default_doc.name, "Dr. Beta");

        // Verify Alpha is no longer default in all doctors list
        let all = get_all_doctors(&conn).unwrap();
        let alpha = all.iter().find(|d| d.id == id_alpha).unwrap();
        let beta = all.iter().find(|d| d.id == id_beta).unwrap();
        assert!(!alpha.is_default);
        assert!(beta.is_default);
    }

    #[test]
    fn test_partial_unique_index_enforces_single_default() {
        let conn = test_db();
        let id_alpha = add_doctor(&conn, "Dr. Alpha".into()).unwrap();
        let id_beta = add_doctor(&conn, "Dr. Beta".into()).unwrap();

        // Set Alpha as default via SQL
        conn.execute("UPDATE doctors SET is_default = 1 WHERE id = ?1", rusqlite::params![id_alpha]).unwrap();

        // Attempting to set Beta as default directly in SQL without clearing Alpha MUST fail due to idx_doctors_single_default
        let err = conn.execute("UPDATE doctors SET is_default = 1 WHERE id = ?1", rusqlite::params![id_beta]);
        assert!(err.is_err(), "Partial unique index must prevent two default doctors");
    }

    #[test]
    fn test_doctor_deactivation_and_reactivation() {
        let mut conn = test_db();
        let id = add_doctor(&conn, "Dr. Active".into()).unwrap();

        // Set as default
        set_default_doctor(&mut conn, id).unwrap();
        assert!(get_default_doctor(&conn).unwrap().is_some());

        // Deactivating the default doctor should clear the default flag
        set_doctor_active(&mut conn, id, false).unwrap();

        // Default doctor should now be None
        let default_doc = get_default_doctor(&conn).unwrap();
        assert!(default_doc.is_none());

        // Deactivated doctor should NOT be in active get_doctors()
        let active_docs = get_doctors(&conn).unwrap();
        assert!(!active_docs.contains(&"Dr. Active".to_string()));

        // But should still be in get_all_doctors() as inactive
        let all_docs = get_all_doctors(&conn).unwrap();
        let doc = all_docs.iter().find(|d| d.id == id).unwrap();
        assert!(!doc.is_active);
        assert!(!doc.is_default);

        // Attempting to set an inactive doctor as default must fail
        let set_def_err = set_default_doctor(&mut conn, id);
        assert!(set_def_err.is_err());

        // Reactivate doctor
        set_doctor_active(&mut conn, id, true).unwrap();
        let active_docs_again = get_doctors(&conn).unwrap();
        assert!(active_docs_again.contains(&"Dr. Active".to_string()));
    }

    #[test]
    fn test_doctor_rename_and_validation() {
        let conn = test_db();
        let id = add_doctor(&conn, "Dr. First".into()).unwrap();

        // Rejects empty name
        assert!(update_doctor(&conn, id, "".into()).is_err());

        // Rejects duplicate name
        add_doctor(&conn, "Dr. Second".into()).unwrap();
        assert!(update_doctor(&conn, id, "Dr. Second".into()).is_err());

        // Renames successfully
        update_doctor(&conn, id, "Dr. First Modified".into()).unwrap();
        let all = get_all_doctors(&conn).unwrap();
        let doc = all.iter().find(|d| d.id == id).unwrap();
        assert_eq!(doc.name, "Dr. First Modified");
    }

    #[test]
    fn test_safeguard_historical_patient_referral_preserved_on_doctor_rename() {
        let mut conn = test_db();

        // Register a doctor
        let doc_id = add_doctor(&conn, "Dr. Original".into()).unwrap();

        // Register a patient referred by Dr. Original
        let _patient_id = create_patient(
            &mut conn,
            "Patient With History".into(),
            Some(45),
            Some("Years".into()),
            Some("Male".into()),
            Some("9000000000".into()),
            Some("Dr. Original".into()),
        )
        .unwrap();

        // Later, administrator renames Dr. Original to Dr. Updated Name
        update_doctor(&conn, doc_id, "Dr. Updated Name".into()).unwrap();

        // Verify in doctors table: name changed
        let all_docs = get_all_doctors(&conn).unwrap();
        let doc = all_docs.iter().find(|d| d.id == doc_id).unwrap();
        assert_eq!(doc.name, "Dr. Updated Name");

        // SAFEGUARD 1: Verify in patients table: historical referred_by remains 'Dr. Original'
        let patients = search_patients(&conn, "Patient With History".into()).unwrap();
        assert_eq!(patients.len(), 1);
        assert_eq!(patients[0].referred_by, Some("Dr. Original".to_string()));
    }

    #[test]
    fn test_safeguard_migration_17_on_legacy_database() {
        // Create an in-memory database representing pre-migration-17 state
        let mut conn = Connection::open_in_memory().unwrap();

        // Set user_version to 16 and create pre-existing schema
        conn.execute_batch(
            "
            PRAGMA user_version = 16;

            -- Legacy doctors table without is_active and is_default
            CREATE TABLE doctors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            );

            -- Orders table for doctor_commissions foreign key safety
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT
            );

            INSERT INTO doctors (id, name) VALUES (1, 'Dr. Legacy One');
            INSERT INTO doctors (id, name) VALUES (2, 'Dr. Legacy Two');
            ",
        )
        .unwrap();

        // Now execute run_migrations, which should apply migration 17
        crate::db::migrations::run_migrations(&mut conn).unwrap();

        // Verify user_version is updated to 17
        let v: i32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0)).unwrap();
        assert_eq!(v, 17, "Migration 17 must be applied and user_version set to 17");

        // Verify columns exist on legacy doctors table with correct defaults
        let docs = get_all_doctors(&conn).unwrap();
        assert_eq!(docs.len(), 2);
        for d in docs {
            assert!(d.is_active, "Existing legacy doctor must be active by default");
            assert!(!d.is_default, "Existing legacy doctor must not be default by default");
        }

        // Verify partial unique index is enforced on migrated DB
        conn.execute("UPDATE doctors SET is_default = 1 WHERE id = 1", []).unwrap();
        let conflict = conn.execute("UPDATE doctors SET is_default = 1 WHERE id = 2", []);
        assert!(conflict.is_err(), "Partial unique index must prevent two default doctors");
    }
}
