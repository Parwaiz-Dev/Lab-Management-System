/**
 * Browser-only Mock Provider for Development & Headless Screenshot Verification.
 * Activated ONLY when running in a standard web browser where Tauri internals are absent.
 * In the actual Tauri desktop application, this file is completely dormant.
 */

export function setupDevMock() {
  if (typeof window === "undefined" || (window as any).__TAURI_INTERNALS__) {
    return;
  }

  const sampleDoctors = [
    "Dr. S. K. Kulkarni (MD)",
    "Dr. Ramesh Patil (MBBS)",
    "Dr. Anand Deshmukh (MS)",
    "Dr. Sneha Joshi (DGO)",
  ];

  const sampleTests = [
    {
      id: 1,
      name: "Complete Blood Count (CBC)",
      price: 350,
      is_active: 1,
      parameters: [
        { id: 101, name: "Hemoglobin", unit: "g/dL", normal_range: "13.0 - 17.0" },
        { id: 102, name: "RBC Count", unit: "mil/uL", normal_range: "4.5 - 5.5" },
        { id: 103, name: "WBC Count", unit: "/cumm", normal_range: "4000 - 11000" },
        { id: 104, name: "Platelet Count", unit: "/cumm", normal_range: "150000 - 450000" },
        { id: 105, name: "Hematocrit (PCV)", unit: "%", normal_range: "40 - 50" },
      ],
    },
    {
      id: 2,
      name: "Lipid Profile",
      price: 650,
      is_active: 1,
      parameters: [
        { id: 201, name: "Total Cholesterol", unit: "mg/dL", normal_range: "< 200" },
        { id: 202, name: "Triglycerides", unit: "mg/dL", normal_range: "< 150" },
        { id: 203, name: "HDL Cholesterol", unit: "mg/dL", normal_range: "40 - 60" },
        { id: 204, name: "LDL Cholesterol", unit: "mg/dL", normal_range: "< 100" },
      ],
    },
    {
      id: 3,
      name: "Blood Glucose Fasting (FBS)",
      price: 100,
      is_active: 1,
      parameters: [
        { id: 301, name: "Fasting Blood Sugar", unit: "mg/dL", normal_range: "70 - 100" },
      ],
    },
    {
      id: 4,
      name: "Thyroid Profile (T3, T4, TSH)",
      price: 550,
      is_active: 1,
      parameters: [
        { id: 401, name: "Total T3", unit: "ng/dL", normal_range: "80 - 200" },
        { id: 402, name: "Total T4", unit: "ug/dL", normal_range: "5.0 - 12.0" },
        { id: 403, name: "TSH", unit: "uIU/mL", normal_range: "0.4 - 4.2" },
      ],
    },
    {
      id: 5,
      name: "Liver Function Test (LFT)",
      price: 700,
      is_active: 1,
      parameters: [
        { id: 501, name: "Bilirubin Total", unit: "mg/dL", normal_range: "0.2 - 1.2" },
        { id: 502, name: "SGOT (AST)", unit: "U/L", normal_range: "10 - 40" },
        { id: 503, name: "SGPT (ALT)", unit: "U/L", normal_range: "10 - 45" },
        { id: 504, name: "Serum Alkaline Phosphatase", unit: "U/L", normal_range: "40 - 130" },
      ],
    },
  ];

  const sampleOrders = [
    {
      id: 101,
      patientId: 1,
      patientCode: "PID-2026-0042",
      patientName: "QA Patient One",
      ageValue: 48,
      ageUnit: "Years",
      gender: "Male",
      phone: "9845012345",
      referredBy: "Dr. S. K. Kulkarni (MD)",
      createdAt: "2026-09-26T09:30:00",
      totalAmount: 1100,
      paidAmount: 1100,
      discountAmount: 0,
      paymentStatus: "Completed",
      reportStatus: "Completed",
      orderStatus: "Completed",
      tests: "Complete Blood Count (CBC), Lipid Profile, Fasting Blood Sugar",
    },
    {
      id: 102,
      patientId: 2,
      patientCode: "PID-2026-0043",
      patientName: "QA Patient Two",
      ageValue: 35,
      ageUnit: "Years",
      gender: "Female",
      phone: "9880198765",
      referredBy: "Dr. Sneha Joshi (DGO)",
      createdAt: "2026-09-26T10:15:00",
      totalAmount: 550,
      paidAmount: 300,
      discountAmount: 0,
      paymentStatus: "Partial",
      reportStatus: "Pending",
      orderStatus: "In Progress",
      tests: "Thyroid Profile (T3, T4, TSH)",
    },
    {
      id: 103,
      patientId: 3,
      patientCode: "PID-2026-0044",
      patientName: "QA Patient Three",
      ageValue: 62,
      ageUnit: "Years",
      gender: "Male",
      phone: "9448154321",
      referredBy: "Self",
      createdAt: "2026-09-26T11:00:00",
      totalAmount: 1050,
      paidAmount: 0,
      discountAmount: 50,
      paymentStatus: "Pending",
      reportStatus: "Pending",
      orderStatus: "Pending",
      tests: "Complete Blood Count (CBC), Liver Function Test (LFT)",
    },
    {
      id: 104,
      patientId: 4,
      patientCode: "PID-2026-0045",
      patientName: "QA Patient Four",
      ageValue: 28,
      ageUnit: "Years",
      gender: "Female",
      phone: "9900234567",
      referredBy: "Dr. Ramesh Patil (MBBS)",
      createdAt: "2026-09-26T11:45:00",
      totalAmount: 450,
      paidAmount: 450,
      discountAmount: 0,
      paymentStatus: "Completed",
      reportStatus: "Completed",
      orderStatus: "Completed",
      tests: "Complete Blood Count (CBC), Blood Glucose Fasting (FBS)",
    },
    {
      id: 105,
      patientId: 5,
      patientCode: "PID-2026-0046",
      patientName: "QA Patient Five",
      ageValue: 54,
      ageUnit: "Years",
      gender: "Male",
      phone: "9740112233",
      referredBy: "Dr. Anand Deshmukh (MS)",
      createdAt: "2026-09-26T12:30:00",
      totalAmount: 700,
      paidAmount: 700,
      discountAmount: 0,
      paymentStatus: "Completed",
      reportStatus: "In Progress",
      orderStatus: "In Progress",
      tests: "Liver Function Test (LFT)",
    },
  ];

  (window as any).__TAURI_INTERNALS__ = {
    invoke: async (cmd: string, args: any = {}) => {
      // Mock router for Tauri commands
      switch (cmd) {
        case "get_current_session":
          return { user_id: 1, username: "admin", role: "admin" };

        case "login":
          return { user_id: 1, username: args.username || "admin", role: "admin" };

        case "logout":
          return "Logged out";

        case "get_doctors":
          return sampleDoctors;

        case "add_doctor":
          if (args.name && !sampleDoctors.includes(args.name)) {
            sampleDoctors.push(args.name);
          }
          return args.name;

        case "get_tests":
          return sampleTests;

        case "get_orders":
        case "get_orders_by_date_range":
          return sampleOrders;

        case "get_daily_summary":
          return { total_sales: 385000, collected: 255000, pending: 130000 };

        case "get_overall_summary":
          return { total_sales: 14500000, collected: 13800000, pending: 700000 };

        case "get_doctor_revenue":
          return Array.from(new Set([
            ...sampleDoctors,
            ...sampleOrders.map((order) => order.referredBy),
          ])).map((doctorName) => {
            const doctorOrders = sampleOrders.filter(
              (order) => order.referredBy === doctorName,
            );
            const patientTotal = doctorOrders.reduce(
              (sum, order) => sum + order.totalAmount,
              0,
            );
            const patientPaid = doctorOrders.reduce(
              (sum, order) => sum + order.paidAmount,
              0,
            );
            const shareRate = Number(
              (window as any).__LAB_SETTINGS__?.doctor_share || 0.15,
            );
            const sharePercentage = shareRate <= 1 ? shareRate * 100 : shareRate;

            const commissionEarned = Math.round(patientTotal * sharePercentage) / 100;
            const registeredIndex = sampleDoctors.findIndex(
              (doctor) => doctor.toLowerCase() === doctorName.toLowerCase(),
            );

            return {
              doctor_id: registeredIndex >= 0 ? registeredIndex + 1 : null,
              doctor_name: doctorName,
              order_count: doctorOrders.length,
              referral_count: doctorOrders.length,
              total_amount: patientTotal,
              eligible_amount: patientTotal,
              paid_amount: patientPaid,
              pending_amount: Math.max(patientTotal - patientPaid, 0),
              share_percentage: sharePercentage,
              share_amount: commissionEarned,
              commission_earned: commissionEarned,
              commission_paid: 0,
              commission_outstanding: commissionEarned,
              last_referral: doctorOrders.at(-1)?.createdAt || "",
              legacy_order_count: doctorOrders.length,
            };
          });

        case "search_patients":
          return [
            { id: 1, patient_code: "PID-QA-0042", name: "QA Patient One", age_value: 48, age_unit: "Years", gender: "Male", phone: "0000000000", referred_by: "Dr. QA One" },
            { id: 2, patient_code: "PID-QA-0043", name: "QA Patient Two", age_value: 35, age_unit: "Years", gender: "Female", phone: "0000000000", referred_by: "Dr. QA Two" },
            { id: 3, patient_code: "PID-QA-0044", name: "QA Patient Three", age_value: 62, age_unit: "Years", gender: "Male", phone: "0000000000", referred_by: "Self" },
          ];

        case "get_parameters_by_order":
          return sampleTests[0].parameters.map((p) => ({
            id: p.id,
            test_id: 1,
            test_name: "Complete Blood Count (CBC)",
            name: p.name,
            unit: p.unit,
            normal_range: p.normal_range,
          }));

        case "get_results_by_order":
          return [
            { parameterId: 101, value: "14.2" },
            { parameterId: 102, value: "4.8" },
            { parameterId: 103, value: "7500" },
            { parameterId: 104, value: "240000" },
            { parameterId: 105, value: "43" },
          ];

        case "get_lab_settings":
        case "get_all_settings":
          return {
            lab_name: "Diagnostic Laboratory",
            lab_address: "QA Environment",
            doctor_share: "0.15",
            lab_logo: "",
          };

        case "get_report":
          return [
            { test_name: "Complete Blood Count (CBC)", parameter_name: "Hemoglobin", unit: "g/dL", normal_range: "13.0 - 17.0", value: "14.2" },
            { test_name: "Complete Blood Count (CBC)", parameter_name: "RBC Count", unit: "mil/uL", normal_range: "4.5 - 5.5", value: "4.8" },
            { test_name: "Complete Blood Count (CBC)", parameter_name: "WBC Count", unit: "/cumm", normal_range: "4000 - 11000", value: "7500" },
            { test_name: "Complete Blood Count (CBC)", parameter_name: "Platelet Count", unit: "/cumm", normal_range: "150000 - 450000", value: "240000" },
            { test_name: "Complete Blood Count (CBC)", parameter_name: "Hematocrit (PCV)", unit: "%", normal_range: "40 - 50", value: "43" },
          ];

        case "get_patient_by_order":
          return {
            id: 1,
            patient_code: "PID-2026-0042",
            name: "QA Patient One",
            age_value: 48,
            age_unit: "Years",
            gender: "Male",
            phone: "9845012345",
            referred_by: "Dr. S. K. Kulkarni (MD)",
            order_date: "2026-09-26T09:30:00",
          };

        case "get_receipt":
          return {
            patient: "QA Patient One",
            invoice: "INV-101",
            total: 1100,
            paid: 1100,
            discount: 0,
            tests: [
              { name: "Complete Blood Count (CBC)", price: 350 },
              { name: "Lipid Profile", price: 650 },
              { name: "Blood Glucose Fasting (FBS)", price: 100 },
            ],
          };

        case "get_payment_history":
          return [
            { id: 1, order_id: args.order_id || 101, previous_paid_paise: 0, new_paid_paise: 60000, total_amount_paise: 110000, created_at: "2026-09-26T09:30:00" },
            { id: 2, order_id: args.order_id || 101, previous_paid_paise: 60000, new_paid_paise: 110000, total_amount_paise: 110000, created_at: "2026-09-26T11:20:00" },
          ];

        case "get_patient_history":
          return {
            patient: { id: 1, patient_code: "PID-QA-0042", name: "QA Patient One", age_value: 48, age_unit: "Years", gender: "Male", phone: "0000000000", referred_by: "Dr. QA One", created_at: "2026-01-15T10:00:00" },
            orders: [
              { id: 101, invoice_no: "INV-101", total_amount_paise: 110000, discount_amount_paise: 0, paid_amount_paise: 110000, status: "Completed", created_at: "2026-09-26T09:30:00", tests: [{ test_id: 1, test_name: "Complete Blood Count (CBC)", price_paise: 35000 }] },
            ],
            payments: [
              { id: 1, order_id: 101, invoice_no: "INV-101", previous_paid_paise: 0, new_paid_paise: 110000, total_amount_paise: 110000, amount_paid_paise: 110000, created_at: "2026-09-26T09:35:00" },
            ],
            results: [
              { order_id: 101, invoice_no: "INV-101", order_date: "2026-09-26T09:30:00", test_name: "Complete Blood Count (CBC)", parameters: [{ parameter_id: 101, parameter_name: "Hemoglobin", unit: "g/dL", normal_range: "13.0 - 17.0", value: "14.2" }] },
            ],
            timeline: [
              { event_type: "ORDER", event_date: "2026-09-26T09:30:00", title: "Order Placed", description: "INV-101 created with 3 tests", reference_id: 101 },
              { event_type: "PAYMENT", event_date: "2026-09-26T09:35:00", title: "Payment Recorded", description: "Paid ₹1,100.00 in full", reference_id: 1 },
              { event_type: "RESULT", event_date: "2026-09-26T12:00:00", title: "Results Completed", description: "CBC parameters finalized", reference_id: 101 },
            ],
          };

        case "get_audit_logs":
          return [
            { id: 1001, user_id: 1, username: "admin", action: "create", table_name: "orders", record_id: 101, old_data: null, new_data: '{"patient_id": 1, "total_paise": 110000}', created_at: "2026-09-26T09:30:00" },
            { id: 1002, user_id: 1, username: "admin", action: "update", table_name: "payment_history", record_id: 1, old_data: '{"paid": 0}', new_data: '{"paid": 110000}', created_at: "2026-09-26T09:35:00" },
            { id: 1003, user_id: 1, username: "admin", action: "create", table_name: "results", record_id: 101, old_data: null, new_data: '{"parameter_id": 101, "value": "14.2"}', created_at: "2026-09-26T12:00:00" },
          ];

        case "list_users":
          return [
            { id: 1, username: "admin", role: "admin", is_active: 1, created_at: "2026-01-01T00:00:00" },
            { id: 2, username: "technician1", role: "staff", is_active: 1, created_at: "2026-02-01T00:00:00" },
          ];

        case "save_export_file":
          return args.target_path || args.filename || "exported_file.pdf";

        default:
          return null;
      }
    },
  };
}
