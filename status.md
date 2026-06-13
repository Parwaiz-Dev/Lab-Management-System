# Lab Management System — Feature & Workflow Audit Report

**Date:** 2026-06-05  
**Project:** Tauri v2 + Rust + React Desktop Application  
**Database:** SQLite (8 migration versions, 12 tables)  
**Modules:** 10 backend, 6 frontend services, 8 pages, 6 UI components

---

## 1. BUSINESS WORKFLOWS — COMPLETE / PARTIAL / MISSING

### ✅ COMPLETE (15 of 23 workflows)

| # | Workflow | Backend | Frontend | Notes |
|---|----------|---------|----------|-------|
| 1 | **Authentication** | [`login`](src-tauri/src/modules/auth/commands.rs:15), [`logout`](src-tauri/src/modules/auth/commands.rs:52), [`get_current_session`](src-tauri/src/modules/auth/commands.rs:87) | [`LoginPage`](src/modules/auth/pages/LoginPage.tsx:8), [`authService`](src/modules/auth/services/authService.ts:10) | bcrypt hashing, session-based, role support |
| 2 | **User Management** | [`create_user`](src-tauri/src/modules/auth/commands.rs:96), [`list_users`](src-tauri/src/modules/auth/commands.rs:139), [`toggle_user_active`](src-tauri/src/modules/auth/commands.rs:159) | [`UserManagement`](src/modules/auth/components/UserManagement.tsx:13), [`userService`](src/modules/auth/services/userService.ts:10) | Create, list, activate/deactivate, role assignment |
| 3 | **Patient Registration** | [`create_patient`](src-tauri/src/modules/patient/commands.rs:13) with auto-code PID-YYYY-NNNN | [`PatientForm`](src/modules/patient/components/PatientForm.tsx:25) | Full validation, age/unit/gender/phone/referred-by |
| 4 | **Patient Search** | [`search_patients`](src-tauri/src/modules/patient/commands.rs:51) — LIKE on name/code/phone/referred_by | [`PatientForm`](src/modules/patient/components/PatientForm.tsx:86) | Real-time suggestions, min 2 chars, max 10 results |
| 5 | **Test Catalog Management** | 8 commands: [`get_tests`](src-tauri/src/modules/catalog/commands.rs:13), [`add_test`](src-tauri/src/modules/catalog/commands.rs:34), [`update_test`](src-tauri/src/modules/catalog/commands.rs:63), [`delete_test`](src-tauri/src/modules/catalog/commands.rs:104), + parameter CRUD | [`TestCatalogManager`](src/modules/settings/pages/TestCatalogManager.tsx:26) | Full test + parameter CRUD, soft delete, search, inline editing |
| 6 | **Order Creation** | [`create_order`](src-tauri/src/modules/order/commands.rs:13) — validates patient, test prices, computes total server-side, auto invoice_no | [`TestSelector`](src/modules/test/components/TestSelector.tsx:38) | Test selection, parameter checklist, billing summary, payment, confirmation dialog |
| 7 | **Receipt Generation** | [`get_receipt`](src-tauri/src/modules/receipt/commands.rs:12) — JOINs orders + patients + tests, paise conversions | [`ReceiptPage`](src/modules/test/pages/ReceiptPage.tsx:13) | Printable receipt, lab branding, test table, totals |
| 8 | **Report Generation** | [`get_report`](src-tauri/src/modules/report/commands.rs:12) — uses snapshot values, [`get_patient_by_order`](src-tauri/src/modules/report/commands.rs:23) | [`ReportPage`](src/modules/test/pages/ReportPage.tsx:27) | Doctor report with letterhead, grouped results, flag/status indicators, Kannada lab name |
| 9 | **Report Printing** | N/A (CSS-only) | [`ReportPage`](src/modules/test/pages/ReportPage.tsx:113) — `@media print` CSS | Clean print layout, hides sidebar/toolbar |
| 10 | **Payment Recording** | [`update_payment`](src-tauri/src/modules/payment/commands.rs:13) — transaction-based, validates payment ≤ total, inserts payment_history | [`PaymentModal`](src/modules/test/components/PaymentModal.tsx:14) | Amount input, quick-amount buttons, progress bar, confirmation dialog |
| 11 | **Payment History** | [`get_payment_history`](src-tauri/src/modules/payment/commands.rs:70) — returns chronological entries | [`PaymentModal`](src/modules/test/components/PaymentModal.tsx:210) — history section | Loading/error/empty states, scrollable table, date/time + amounts + delta |
| 12 | **Audit Logging** | [`create_audit_log`](src-tauri/src/modules/audit/service.rs:34), snapshot helpers, 424-line test suite | All mutations auto-audited | Every create/update/delete writes to audit_logs |
| 13 | **Audit Review UI** | [`get_audit_logs`](src-tauri/src/modules/audit/commands.rs:17) — paginated, filtered | [`AuditPage`](src/modules/audit/pages/AuditPage.tsx:47) | Search, action/table filters, pagination, detail drawer, summary cards |
| 14 | **Settings Management** | [`save_lab_settings`](src-tauri/src/modules/settings/commands.rs:72) — batch upsert, [`get_all_settings`](src-tauri/src/modules/settings/commands.rs:62) | [`SettingsPage`](src/modules/settings/pages/SettingsPage.tsx:20) | Lab name, address, doctor share, logo upload |
| 15 | **Backup/Restore** | [`export_backup`](src-tauri/src/modules/settings/commands.rs:—), [`restore_backup`](src-tauri/src/modules/settings/commands.rs:—) | [`settingsService`](src/modules/settings/services/settingsService.ts:79) | JSON file export/import via Tauri file dialog |

### ⚠️ PARTIAL (3 of 23 workflows)

| # | Workflow | What Exists | What's Missing |
|---|----------|-------------|----------------|
| 16 | **Result Entry** | [`save_results`](src-tauri/src/modules/result/commands.rs:53) batch, [`get_parameters_by_order`](src-tauri/src/modules/result/commands.rs:82), [`ResultPage`](src/modules/test/pages/ResultPage.tsx:18) grouped by test | No validation/second-approval workflow, no abnormal flag review, no completion confirmation, no reference range display during entry |
| 17 | **Financial Dashboard** | [`get_daily_summary`](src-tauri/src/modules/payment/commands.rs:50), [`get_overall_summary`](src-tauri/src/modules/payment/commands.rs:60), [`LabDashboard`](src/modules/test/pages/LabDashboard.tsx:82) metrics | No date range filtering, no trend charts, no doctor-wise revenue, no export to CSV/PDF |
| 18 | **Order Lifecycle** | [`create_order`](src-tauri/src/modules/order/commands.rs:13), [`get_orders`](src-tauri/src/modules/order/commands.rs:46), [`get_order_status`](src-tauri/src/modules/order/commands.rs:56) | No order editing, no cancellation, no status transition enforcement (Pending → In Progress → Completed), no sample collection step |

### ❌ MISSING (5 of 23 workflows)

| # | Workflow | Gap Description |
|---|----------|-----------------|
| 19 | **Sample Collection** | No sample tracking table, no barcode generation, no collection status, no phlebotomist assignment. The `order_status` column exists but only tracks result completion, not physical sample collection. |
| 20 | **Result Validation/Approval** | No multi-step approval. Results are saved directly by any staff member. No review queue, no abnormal flag alerting, no second-sign-off workflow. |
| 21 | **Data Export** | No CSV, Excel, or PDF export for orders, patients, payments, or audit logs. Only backup/restore (JSON) exists. |
| 22 | **Notifications** | No notification system of any kind. No alerts for pending payments, abnormal results, or overdue orders. |
| 23 | **Patient History View** | Patient search returns current data only. No consolidated view showing all orders, results, and payments for a single patient across time. |

---

## 2. FEATURE MATRIX

| Feature | Backend | Frontend | Status | Coverage | Gaps |
|---------|---------|----------|--------|----------|------|
| Authentication | [`auth`](src-tauri/src/modules/auth/commands.rs) | [`LoginPage`](src/modules/auth/pages/LoginPage.tsx), [`authService`](src/modules/auth/services/authService.ts) | ✅ Complete | 100% | — |
| User CRUD | [`auth`](src-tauri/src/modules/auth/commands.rs:96) | [`UserManagement`](src/modules/auth/components/UserManagement.tsx), [`userService`](src/modules/auth/services/userService.ts) | ✅ Complete | 100% | — |
| Patient CRUD | [`patient`](src-tauri/src/modules/patient/commands.rs) | [`PatientForm`](src/modules/patient/components/PatientForm.tsx), [`patientService`](src/modules/patient/services/patientService.ts) | ✅ Complete | 100% | No patient edit/update |
| Patient Search | [`patient`](src-tauri/src/modules/patient/commands.rs:51) | [`PatientForm`](src/modules/patient/components/PatientForm.tsx:86) | ✅ Complete | 100% | — |
| Doctor Management | [`patient`](src-tauri/src/modules/patient/commands.rs:62) | [`PatientForm`](src/modules/patient/components/PatientForm.tsx:374) | ✅ Complete | 100% | Add-only, no edit/delete/merge |
| Test Catalog | [`catalog`](src-tauri/src/modules/catalog/commands.rs) | [`TestCatalogManager`](src/modules/settings/pages/TestCatalogManager.tsx) | ✅ Complete | 100% | Full CRUD + parameters |
| Test Parameters | [`catalog`](src-tauri/src/modules/catalog/commands.rs:143) | [`TestCatalogManager`](src/modules/settings/pages/TestCatalogManager.tsx:408) | ✅ Complete | 100% | — |
| `get_test_parameters` | [`get_test_parameters`](src-tauri/src/modules/catalog/commands.rs:23) | **No frontend service method** | ⚠️ Backend-only | 0% | Unused backend command |
| Order Creation | [`order`](src-tauri/src/modules/order/commands.rs:13) | [`TestSelector`](src/modules/test/components/TestSelector.tsx) | ✅ Complete | 100% | — |
| Order Listing | [`get_orders`](src-tauri/src/modules/order/commands.rs:46) | [`LabDashboard`](src/modules/test/pages/LabDashboard.tsx:25) | ✅ Complete | 100% | — |
| Order Status | [`get_order_status`](src-tauri/src/modules/order/commands.rs:56) | [`LabDashboard`](src/modules/test/pages/LabDashboard.tsx:253) | ✅ Complete | 100% | — |
| Order Edit/Cancel | ❌ | ❌ | ❌ Missing | 0% | No backend or frontend |
| Payment Update | [`update_payment`](src-tauri/src/modules/payment/commands.rs:13) | [`PaymentModal`](src/modules/test/components/PaymentModal.tsx:87) | ✅ Complete | 100% | — |
| Payment History | [`get_payment_history`](src-tauri/src/modules/payment/commands.rs:70) | [`PaymentModal`](src/modules/test/components/PaymentModal.tsx:210) | ✅ Complete | 100% | Implemented in Phase 8 |
| Daily Summary | [`get_daily_summary`](src-tauri/src/modules/payment/commands.rs:50) | [`LabDashboard`](src/modules/test/pages/LabDashboard.tsx:45) | ✅ Complete | 100% | — |
| Overall Summary | [`get_overall_summary`](src-tauri/src/modules/payment/commands.rs:60) | [`LabDashboard`](src/modules/test/pages/LabDashboard.tsx:45) | ✅ Complete | 100% | — |
| `Summary` model | [`Summary`](src-tauri/src/modules/payment/model.rs:4) | — | ❌ Dead Code | 0% | Never used in any service/command |
| Result Entry (batch) | [`save_results`](src-tauri/src/modules/result/commands.rs:53) | [`ResultPage`](src/modules/test/pages/ResultPage.tsx:94) | ✅ Complete | 100% | — |
| Result Entry (single) | [`save_result`](src-tauri/src/modules/result/commands.rs:13) | **Not used in frontend** | ⚠️ Backend-only | 0% | Only `save_results` batch used |
| Result Parameters | [`get_parameters_by_order`](src-tauri/src/modules/result/commands.rs:82) | [`ResultPage`](src/modules/test/pages/ResultPage.tsx:57) | ✅ Complete | 100% | — |
| Result Validation | ❌ | ❌ | ❌ Missing | 0% | No approval workflow |
| Report Generation | [`report`](src-tauri/src/modules/report/commands.rs) | [`ReportPage`](src/modules/test/pages/ReportPage.tsx) | ✅ Complete | 100% | — |
| Report Printing | N/A | [`ReportPage`](src/modules/test/pages/ReportPage.tsx) print CSS | ✅ Complete | 100% | — |
| Receipt Generation | [`receipt`](src-tauri/src/modules/receipt/commands.rs) | [`ReceiptPage`](src/modules/test/pages/ReceiptPage.tsx) | ✅ Complete | 100% | — |
| Audit Logging | [`audit`](src-tauri/src/modules/audit/service.rs) | All mutations auto-audited | ✅ Complete | 100% | 424-line test suite |
| Audit Logs UI | [`get_audit_logs`](src-tauri/src/modules/audit/commands.rs:17) | [`AuditPage`](src/modules/audit/pages/AuditPage.tsx) | ✅ Complete | 100% | — |
| Record History | [`get_record_history`](src-tauri/src/modules/audit/commands.rs:45) | [`auditService.getRecordHistory`](src/modules/audit/services/auditService.ts:33) | ⚠️ Backend+Service | 0% | Not called in any UI page |
| User Activity | [`get_user_activity`](src-tauri/src/modules/audit/commands.rs:63) | [`auditService.getUserActivity`](src/modules/audit/services/auditService.ts:49) | ⚠️ Backend+Service | 0% | Not called in any UI page |
| Settings (batch) | [`save_lab_settings`](src-tauri/src/modules/settings/commands.rs:72) | [`SettingsPage`](src/modules/settings/pages/SettingsPage.tsx:96) | ✅ Complete | 100% | — |
| Settings (individual) | [`get_setting`](src-tauri/src/modules/settings/commands.rs:13), [`set_setting`](src-tauri/src/modules/settings/commands.rs:24) | [`settingsService`](src/modules/settings/services/settingsService.ts:12) | ⚠️ Backend+Service | 0% | Not called in any UI page |
| Backup/Restore | [`settings`](src-tauri/src/modules/settings/commands.rs) | [`SettingsPage`](src/modules/settings/pages/SettingsPage.tsx:137) | ✅ Complete | 100% | JSON-only |
| Data Export | ❌ | ❌ | ❌ Missing | 0% | No CSV/Excel/PDF |
| Sample Collection | ❌ | ❌ | ❌ Missing | 0% | No module exists |
| Notifications | ❌ | ❌ | ❌ Missing | 0% | No module exists |
| Patient History | ❌ | ❌ | ❌ Missing | 0% | No consolidated view |
| Discount Management | `discount_amount` column | ❌ | ❌ Missing | 0% | Column exists in schema, no UI |
| Inventory Tracking | ❌ | ❌ | ❌ Missing | 0% | No module exists |
| `ResultEntry` component | — | [`ResultEntry`](src/modules/test/components/ResultEntry.tsx) (268 lines) | ❌ Dead Code | 0% | Not imported anywhere |

---

## 3. UNUSED BACKEND FEATURES

These are backend commands, services, or models that are **fully implemented and wired** in Rust but have **no corresponding frontend usage**:

| # | Backend Item | Location | Frontend Status |
|---|-------------|----------|-----------------|
| 1 | [`get_test_parameters`](src-tauri/src/modules/catalog/commands.rs:23) command | catalog | No frontend service method exists. The [`TestSelector`](src/modules/test/components/TestSelector.tsx) loads parameters inline via `get_tests` and never calls this standalone command. |
| 2 | [`save_result`](src-tauri/src/modules/result/commands.rs:13) (singular) | result | [`testService.saveResult`](src/modules/test/services/testService.ts:307) exists but is **never called**. Only [`saveResults`](src/modules/test/services/testService.ts:319) (batch) is used in [`ResultPage`](src/modules/test/pages/ResultPage.tsx:94). |
| 3 | [`get_record_history`](src-tauri/src/modules/audit/commands.rs:45) | audit | [`auditService.getRecordHistory`](src/modules/audit/services/auditService.ts:33) exists but is **never called** in [`AuditPage`](src/modules/audit/pages/AuditPage.tsx) or any other page. |
| 4 | [`get_user_activity`](src-tauri/src/modules/audit/commands.rs:63) | audit | [`auditService.getUserActivity`](src/modules/audit/services/auditService.ts:49) exists but is **never called** in any UI. |
| 5 | [`get_setting`](src-tauri/src/modules/settings/commands.rs:13) (individual) | settings | [`settingsService.getSetting`](src/modules/settings/services/settingsService.ts:12) exists but [`SettingsPage`](src/modules/settings/pages/SettingsPage.tsx) only uses [`get_all_settings`](src-tauri/src/modules/settings/commands.rs:62). |
| 6 | [`set_setting`](src-tauri/src/modules/settings/commands.rs:24) (individual) | settings | [`settingsService.setSetting`](src/modules/settings/services/settingsService.ts:17) exists but never called. Only [`save_lab_settings`](src-tauri/src/modules/settings/commands.rs:72) batch is used. |
| 7 | [`Summary`](src-tauri/src/modules/payment/model.rs:4) struct | payment | Defined but never used in any service or command. Complete dead code. |

**Verdict:** 7 backend features are fully implemented but dead. None are critical — they are either redundant (batch versions preferred) or niche (record-level audit history). The `Summary` struct is pure dead code and should be removed.

---

## 4. UNUSED FRONTEND FEATURES

| # | Frontend Item | Location | Status |
|---|--------------|----------|--------|
| 1 | [`ResultEntry`](src/modules/test/components/ResultEntry.tsx) component | 268 lines | **Dead code.** A standalone result entry component that duplicates [`ResultPage`](src/modules/test/pages/ResultPage.tsx) functionality but is never imported in any file. Contains its own normalization layer, state management, save/clear actions, and toast. |
| 2 | [`auditService.getRecordHistory`](src/modules/audit/services/auditService.ts:33) | 15 lines | Service method exists but never called from any page. |
| 3 | [`auditService.getUserActivity`](src/modules/audit/services/auditService.ts:49) | 11 lines | Service method exists but never called from any page. |
| 4 | [`settingsService.getSetting`](src/modules/settings/services/settingsService.ts:12) | 10 lines | Service method exists but never called from SettingsPage. |
| 5 | [`settingsService.setSetting`](src/modules/settings/services/settingsService.ts:17) | 9 lines | Service method exists but never called from SettingsPage. |
| 6 | [`testService.saveResult`](src/modules/test/services/testService.ts:307) (singular) | 15 lines | Service method exists but never called. Only batch `saveResults` used. |
| 7 | `_insert_css.js` | Temp file | Helper script from Phase 8 CSS insertion. Should be deleted. |

**Verdict:** One dead component ([`ResultEntry`](src/modules/test/components/ResultEntry.tsx), 268 lines), one leftover temp file, and 5 service methods with no callers. Low risk — all are self-contained and don't affect running code.

---

## 5. MISSING HIGH-VALUE FEATURES (Top 10, Ranked)

| Rank | Feature | Value | Effort | Rationale |
|------|---------|-------|--------|-----------|
| 1 | **Result Validation / Second-Approval Workflow** | 🔴 Critical | Medium | Results are currently saved directly with no review. A lab needs quality control: abnormal flag review, second sign-off, or at minimum a "Review Pending → Approved" status transition. This is the #1 clinical safety gap. |
| 2 | **Sample Collection Tracking** | 🔴 Critical | High | No physical sample tracking exists. A lab needs to know: was blood drawn? When? By whom? What tube type? Is the sample adequate? This bridges the gap between order creation and result entry. |
| 3 | **Patient History View** | 🟠 High | Medium | Currently impossible to view a patient's complete history — all orders, results, payments — in one place. Essential for returning patients and clinical context. |
| 4 | **Data Export (CSV/Excel)** | 🟠 High | Low | No way to export orders, payments, audit logs, or patient data. Required for accounting, reporting to doctors, and data portability. The data is already structured — just needs formatting. |
| 5 | **Order Editing & Cancellation** | 🟠 High | Medium | Orders cannot be modified after creation. If a wrong test is selected or a patient cancels, there's no recourse. Needs: add/remove tests, cancel order (with reason), refund workflow. |
| 6 | **Discount Management** | 🟡 Medium | Low | The `discount_amount` column exists in the database but has zero UI. Labs routinely give discounts. This is a low-effort, high-perception-value feature. |
| 7 | **Date Range Filtering on Dashboard** | 🟡 Medium | Low | Dashboard shows all-time metrics only. No "today", "this week", "this month", or custom date range. The backend queries already support it — just needs UI parameters. |
| 8 | **Doctor-wise Revenue & Referral Analytics** | 🟡 Medium | Medium | `referred_by` is captured on every patient but never analyzed. Labs need to know which doctors refer the most patients and how much revenue they generate. |
| 9 | **Role-Based UI Differentiation** | 🟡 Medium | Medium | Admin and staff see identical UI. Staff should not access Settings, User Management, or Test Catalog. The backend already enforces roles — the frontend just doesn't gate pages. |
| 10 | **Print/Export Receipt as PDF** | 🟢 Low | Low | Receipts are printable via browser print but can't be saved as PDF or emailed. A "Save as PDF" button would be a simple quality-of-life improvement. |

---

## 6. RECOMMENDED NEXT STEP

### **Result Validation & Approval Workflow**

**Why this one:**

1. **Clinical safety gap.** Results are currently saved directly to the database with no review step. A typo in a glucose value (e.g., 110 vs 1100) goes straight to the doctor's report. This is the single highest-risk gap in the entire system.

2. **High value, moderate effort.** The backend already has all the infrastructure: audit logging, result storage, report generation. The work is primarily:
   - Add a `status` field to results (draft → reviewed → approved)
   - Add a `reviewed_by` / `approved_by` column
   - Create a "Review Queue" page showing pending results
   - Add a badge/indicator on the dashboard for orders needing review
   - Gate report generation behind "approved" status

3. **Builds on existing work.** Does not require new modules, new tables (beyond column additions), or new workflows. It enhances the existing result entry → report pipeline.

4. **Immediate business value.** Any lab manager evaluating this software would flag "no result review" as a dealbreaker. This is table-stakes for clinical software.

**Estimated scope:**
- Backend: 2 new commands (`review_result`, `approve_result`), 1 migration (add status columns), 1 service update
- Frontend: 1 new page/component (Review Queue), modifications to ResultPage, ReportPage, LabDashboard
- ~400-600 lines of new code total

---

## 7. IMPLEMENTATION READINESS

### Codebase Quality Assessment

| Dimension | Rating | Notes |
|-----------|--------|-------|
| **Backend Architecture** | ⭐⭐⭐⭐⭐ | Clean modular separation (10 modules), consistent command→service→model pattern, comprehensive error handling via [`AppError`](src-tauri/src/errors/mod.rs), proper money handling via [`money.rs`](src-tauri/src/utils/money.rs), thorough input validation via [`validation.rs`](src-tauri/src/utils/validation.rs), transaction-based mutations, audit logging on all mutations |
| **Frontend Architecture** | ⭐⭐⭐⭐ | Well-organized module structure, consistent service layer pattern, proper TypeScript types in [`types/index.ts`](src/types/index.ts), robust normalization layer for Rust tuple responses, component composition is clean. Minor: no React Router (state-based routing), some dead code |
| **Database Design** | ⭐⭐⭐⭐ | 12 well-structured tables, 8 migration versions with proper column additions and indexes, paise-based money storage (no floating-point currency), soft delete pattern, snapshot columns for audit integrity. Minor: `discount_amount` column unused |
| **Testing** | ⭐⭐⭐ | Backend: [`audit/service_test.rs`](src-tauri/src/modules/audit/service_test.rs) (424 lines, 16 tests covering all audit scenarios), [`validation.rs`](src-tauri/src/utils/validation.rs) (4 unit tests), [`money.rs`](src-tauri/src/utils/money.rs) (4 unit tests), [`config.rs`](src-tauri/src/config.rs) (1 unit test). Frontend: No tests. No integration tests. |
| **Security** | ⭐⭐⭐⭐ | bcrypt password hashing, role-based access control (admin/staff), session management, all commands require auth, mutations audit-logged, password never logged. Minor: no rate limiting on login |
| **Error Handling** | ⭐⭐⭐⭐⭐ | Backend: [`AppError`](src-tauri/src/errors/mod.rs) enum with 8 variants, user-friendly messages, proper `From<rusqlite::Error>` mapping. Frontend: consistent `toErrorMessage()` pattern, toast notifications, loading/error/empty states on all data-fetching components |
| **Code Consistency** | ⭐⭐⭐⭐⭐ | Uniform patterns throughout: all backend modules follow identical structure (mod.rs → model.rs → service.rs → commands.rs), all frontend services follow identical pattern, all pages use `useState`/`useEffect`/`useCallback` consistently, CSS follows BEM-like naming |

### Technical Debt

| Item | Severity | Effort to Fix |
|------|----------|---------------|
| [`ResultEntry.tsx`](src/modules/test/components/ResultEntry.tsx) dead code (268 lines) | Low | 5 min — delete file |
| [`Summary`](src-tauri/src/modules/payment/model.rs:4) dead struct | Low | 2 min — remove struct |
| 5 unused service methods (frontend) | Low | 10 min — remove or document |
| `_insert_css.js` temp file | Low | 1 min — delete |
| No React Router — state-based routing | Medium | 2-4 hours — migrate to `react-router-dom` |
| No frontend tests | Medium | 4-8 hours — add Vitest + React Testing Library |
| `discount_amount` column unused | Low | Already exists in schema, just needs UI |
| No keyboard shortcuts | Low | 1-2 hours — add to dashboard |

### Build Health

- **npm run build:** ✅ Passes (tsc + vite, 47 modules, ~260ms)
- **cargo build:** ✅ Passes (~1.1s, 7 pre-existing warnings, 0 new warnings)
- **Pre-existing cargo warnings:** 7 (unused imports, unused variables — all in audit module, non-critical)

### Overall Maturity Assessment

**Current State: v0.8 — Feature-Complete Core, Pre-Production**

The system has a solid, well-architected core covering the primary lab workflow: patient registration → order creation → payment → result entry → report/receipt generation. All 15 complete workflows are production-quality. The 3 partial workflows need modest investment. The 5 missing workflows are the gap between "usable" and "clinical-grade."

**Production readiness blockers:**
1. No result validation/approval workflow (clinical safety)
2. No sample collection tracking (workflow completeness)
3. No data export (business operations)
4. No frontend tests (quality assurance)

**Recommended path to v1.0:**
1. Implement Result Validation (this report's recommendation)
2. Add Sample Collection module
3. Add CSV/Excel export
4. Add frontend test suite
5. Migrate to React Router
6. Clean up dead code and unused service methods