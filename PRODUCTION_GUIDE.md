# 🚀 Production Deployment Guide
# Lab Management System - Production-Grade Deployment

## 📋 Table of Contents
1. [Pre-Production Checklist](#pre-production-checklist)
2. [Installation & Setup](#installation--setup)
3. [Configuration](#configuration)
4. [Database Management](#database-management)
5. [Backup & Disaster Recovery](#backup--disaster-recovery)
6. [Security Hardening](#security-hardening)
7. [Monitoring & Logging](#monitoring--logging)
8. [Performance Optimization](#performance-optimization)
9. [Troubleshooting](#troubleshooting)

---

## 🔍 Pre-Production Checklist

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] ESLint passes without warnings
- [ ] All database migrations tested
- [ ] Form validation working on all fields
- [ ] Error handling in all async operations
- [ ] No console.errors in production logs

### Testing
- [ ] Patient creation/search tested
- [ ] Order creation with multiple tests verified
- [ ] Result entry flow tested end-to-end
- [ ] Payment scenarios tested (full, partial, corrections)
- [ ] Receipt generation verified
- [ ] Backup/restore tested successfully
- [ ] Multi-user scenarios tested (if applicable)

### Security
- [ ] All inputs validated (server-side)
- [ ] No hardcoded secrets or credentials
- [ ] Database backups encrypted
- [ ] File permissions set correctly (db files)
- [ ] Logging doesn't expose sensitive data
- [ ] User access controls reviewed

### Database
- [ ] Database migrations complete
- [ ] Indexes created for performance
- [ ] Backup strategy tested
- [ ] Recovery procedure tested
- [ ] Database size monitored
- [ ] Transaction support verified

### Deployment
- [ ] Environment variables configured
- [ ] .env file created from .env.example
- [ ] Database initialization tested
- [ ] Application logs configured
- [ ] Monitoring alerts set up
- [ ] Rollback procedure documented

---

## 📦 Installation & Setup

### System Requirements
```
Operating System:
  - Windows 10/11 or MacOS 10.15+ or Linux (Ubuntu 18.04+)
  - 2GB RAM minimum, 4GB recommended
  - 500MB disk space minimum

Software Requirements:
  - Tauri 2.10+ prerequisites installed
  - .NET Runtime 6.0+ (Windows)
  - SQLite 3.31+ (bundled)
```

### Step 1: Installation
```bash
# Clone or download the application
# Extract to deployment location
cd /path/to/lab-management-system

# Install Node dependencies
npm install

# Install Rust dependencies (if building from source)
cargo build --release

# Build for production
npm run build
```

### Step 2: Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env with production settings
nano .env  # or use your preferred editor
```

### Step 3: Initialize Database
```bash
# Database initializes automatically on first run
# To manually verify:
npm run tauri build  # or run the built application
```

---

## ⚙️ Configuration

### Environment Variables
See `.env.example` for all available options.

**Critical Settings:**
```bash
APP_ENV=production              # Production mode
LOG_LEVEL=warn                  # Minimal logging
DEBUG=false                     # Disable debug mode
MAX_BACKUPS=10                  # Keep 10 backup versions
ANALYTICS_ENABLED=true          # Enable telemetry
```

### Database Configuration
```bash
# Default: ~/.local/share/lab-management-system/lab_data.db
# Custom location:
DB_PATH=/opt/lab/data/lab_data.db
```

---

## 🗄️ Database Management

### Database Initialization
Database tables are created automatically on first run:

```
Tables:
  - patients (primary patient records)
  - tests (test definitions)
  - test_parameters (test measurements)
  - orders (test orders)
  - order_tests (order line items)
  - results (test result values)
  - settings (key-value configuration)
  - doctors (referring physician references)
```

### Database Indexes
For optimal performance, ensure indexes are created:

```sql
-- Patient lookup optimization
CREATE INDEX IF NOT EXISTS idx_patient_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_patient_code ON patients(patient_code);

-- Order queries
CREATE INDEX IF NOT EXISTS idx_order_patient ON orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_order_date ON orders(created_at);

-- Result lookups
CREATE INDEX IF NOT EXISTS idx_result_order ON results(order_id);
```

### Regular Maintenance
```bash
# Weekly database optimization
sqlite3 lab_data.db "VACUUM; ANALYZE;"

# Monitor database size
du -h lab_data.db

# Check database integrity
sqlite3 lab_data.db "PRAGMA integrity_check;"
```

---

## 💾 Backup & Disaster Recovery

### Automated Backup
The system creates backups automatically:
- **Location**: Same directory as main database
- **Filename**: `lab_backup.db`
- **Retention**: Controlled by `MAX_BACKUPS` setting
- **Trigger**: Manual via UI or via API

### Manual Backup
```bash
# Using the application's export function
# Via UI: Settings → Backup → Export

# Or manually copy the database
cp ~/.local/share/lab-management-system/lab_data.db backup_$(date +%Y%m%d).db
```

### Backup Strategy
**Daily Backups:**
```bash
#!/bin/bash
# Daily backup script (run via cron)
BACKUP_DIR="/backups/lab-system"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SOURCE="$HOME/.local/share/lab-management-system/lab_data.db"
DEST="$BACKUP_DIR/lab_data_$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"
cp "$SOURCE" "$DEST"

# Compress older backups
gzip "$DEST"

# Delete backups older than 30 days
find "$BACKUP_DIR" -name "*.db.gz" -mtime +30 -delete
```

### Restore from Backup
```bash
# Via UI: Settings → Backup → Restore

# Or manually restore
cp backup_20240101.db ~/.local/share/lab-management-system/lab_data.db
# Restart application
```

### Disaster Recovery
In case of data loss:

1. **Full Database Corruption:**
   - Stop the application
   - Restore from latest backup
   - Verify database integrity: `sqlite3 lab_data.db "PRAGMA integrity_check;"`
   - Restart application

2. **Partial Data Loss:**
   - Use transaction logs if available
   - Restore to point-in-time if supported
   - Contact support

---

## 🔒 Security Hardening

### File System Security
```bash
# Restrict database file permissions
chmod 600 ~/.local/share/lab-management-system/lab_data.db

# Restrict backup directory
chmod 700 ~/.local/share/lab-management-system/

# SELinux (if enabled)
semanage fcontext -a -t user_home_t "~/.local/share/lab-management-system(/.*)?"
restorecon -r ~/.local/share/lab-management-system/
```

### Data Security Best Practices
- ✅ **Regular Backups**: Daily encrypted backups
- ✅ **Access Control**: Limit application access to authorized users
- ✅ **Input Validation**: All inputs validated server-side
- ✅ **Logging**: Sensitive data excluded from logs
- ✅ **Database Encryption**: Consider encrypting backups (future)
- ✅ **Network**: Don't expose database port over network

### Credential Management
- Never commit `.env` files to version control
- Use secrets management for production deployments
- Rotate credentials periodically
- Audit access logs regularly

---

## 📊 Monitoring & Logging

### Log Locations
```
Windows:
  ~/AppData/Roaming/Lab Management System/logs/

macOS:
  ~/Library/Logs/Lab Management System/

Linux:
  ~/.config/lab-management-system/logs/
```

### Log Levels
```
ERROR:   Application failures requiring attention
WARN:    Potential issues, degraded performance
INFO:    Important events (startup, backups, etc.)
DEBUG:   Detailed information (development only)
TRACE:   Very detailed information (development only)
```

### Production Logging
```bash
# Production: Only warnings and errors
LOG_LEVEL=warn

# Monitor key events:
grep -E "ERROR|FAILED|EXCEPTION" application.log

# Check database operations
grep "database" application.log

# Review backups
grep "backup" application.log
```

### Key Metrics to Monitor
- Database size growth
- Backup completion success rate
- Error rates in logs
- User activity patterns
- System resource usage (CPU, memory, disk)

### Alerting Setup
Configure alerts for:
- Failed backups
- Database errors
- Disk space warnings (< 10% free)
- Crashes or exceptions

---

## ⚡ Performance Optimization

### Database Optimization
```sql
-- Regular analysis for query planner
PRAGMA optimize;

-- Check query plans
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE patient_id = ?;

-- Monitor slow queries (query execution > 100ms)
PRAGMA slow_query_log = 1;
```

### Application Optimization
- ✅ **Search Result Limits**: Max 10 results per search
- ✅ **Query Batching**: Fetch related data together
- ✅ **Caching**: Cache test lists, doctor names
- ✅ **Lazy Loading**: Load large result sets on demand

### Recommended Indexes
For production systems, ensure these indexes exist:

```sql
-- Patient operations
CREATE INDEX idx_patient_name ON patients(name);
CREATE INDEX idx_patient_code ON patients(patient_code);

-- Order operations
CREATE INDEX idx_order_patient ON orders(patient_id);
CREATE INDEX idx_order_created ON orders(created_at);
CREATE INDEX idx_order_tests ON order_tests(order_id);

-- Results
CREATE INDEX idx_results_order ON results(order_id);
CREATE INDEX idx_results_param ON results(parameter_id);
```

### System Resource Limits
```bash
# Monitor resource usage
top -b -n 1 | head -20

# Check disk usage
df -h | grep lab

# Memory usage
ps aux | grep lab-management
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Lock
**Symptom**: "database is locked" errors

**Solution**:
```bash
# Stop the application
pkill -f "lab-management"

# Check for locks
lsof | grep lab_data.db

# Force close if necessary
# Restart application
```

#### 2. Slow Queries
**Symptom**: Orders or searches take > 5 seconds

**Solution**:
```sql
-- Check if indexes exist
SELECT * FROM sqlite_master WHERE type='index';

-- Run optimization
PRAGMA optimize;

-- Analyze database
ANALYZE;
```

#### 3. Backup Failures
**Symptom**: Backup operation fails or takes too long

**Solution**:
```bash
# Check disk space
df -h

# Verify database integrity
sqlite3 lab_data.db "PRAGMA integrity_check;"

# Manual backup
cp lab_data.db lab_backup_manual.db
```

#### 4. High Memory Usage
**Symptom**: Application uses > 500MB RAM

**Solution**:
- Restart the application
- Check for memory leaks in logs
- Reduce `MAX_SEARCH_RESULTS` if searching returns huge datasets
- Archive old orders to separate database (future feature)

### Debug Mode
Enable debug logging for troubleshooting:
```bash
APP_ENV=development
DEBUG=true
LOG_LEVEL=debug
```

### Getting Help
When reporting issues, include:
- Error logs (from log directory)
- Database size and record counts
- Steps to reproduce
- System information (OS, version, etc.)

---

## 📞 Support & Maintenance

### Version Updates
- Check for updates regularly
- Test updates in staging environment first
- Follow migration guides for database changes
- Backup before updating

### Regular Maintenance Schedule
```
Daily:
  - Monitor log files
  - Check disk space
  
Weekly:
  - Database optimization (VACUUM, ANALYZE)
  - Backup verification
  - Performance review

Monthly:
  - Security updates
  - Backup integrity check
  - License verification (if applicable)

Quarterly:
  - Full security audit
  - Database schema review
  - Performance optimization review
```

---

## 📞 Contact & Support
For production issues:
- Review logs first
- Check troubleshooting guide
- Contact support with logs and reproduction steps

---

**Last Updated**: April 2026
**Version**: 1.0.0
**Status**: Production Ready
