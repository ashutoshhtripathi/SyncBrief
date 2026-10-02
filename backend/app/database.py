from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def run_migrations():
    """Ensure SQLite columns added in newer versions exist without dropping existing tables."""
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            # 1. Ensure tenants table exists and has default tenant
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS tenants (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(255) NOT NULL,
                    domain VARCHAR(255) UNIQUE NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            default_tenant = conn.execute(text("SELECT id FROM tenants WHERE id = 1")).fetchone()
            if not default_tenant:
                conn.execute(text("""
                    INSERT INTO tenants (id, name, domain, created_at)
                    VALUES (1, 'SyncBrief Enterprise', 'syncbrief.ai', CURRENT_TIMESTAMP)
                """))

            # 2. Check tenant_id across all data tables
            tables_to_scope = ["users", "channels", "sprints", "tasks", "checkins", "blockers", "digests", "audit_logs"]
            for table in tables_to_scope:
                cols = [r[1] for r in conn.execute(text(f"PRAGMA table_info({table})"))]
                if cols and "tenant_id" not in cols:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN tenant_id INTEGER DEFAULT 1"))

            # 3. Check users
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(users)"))]
            if cols:
                if "refresh_token" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN refresh_token VARCHAR(500)"))
                if "deleted_at" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN deleted_at DATETIME"))
            # 4. Check sprints
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(sprints)"))]
            if cols and "deleted_at" not in cols:
                conn.execute(text("ALTER TABLE sprints ADD COLUMN deleted_at DATETIME"))
            # 5. Check tasks
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(tasks)"))]
            if cols:
                if "deleted_at" not in cols:
                    conn.execute(text("ALTER TABLE tasks ADD COLUMN deleted_at DATETIME"))
                if "version" not in cols:
                    conn.execute(text("ALTER TABLE tasks ADD COLUMN version INTEGER DEFAULT 1"))
            # 6. Check audit_logs
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(audit_logs)"))]
            if cols:
                if "actor_id" not in cols:
                    conn.execute(text("ALTER TABLE audit_logs ADD COLUMN actor_id INTEGER"))
                if "actor_name" not in cols:
                    conn.execute(text("ALTER TABLE audit_logs ADD COLUMN actor_name VARCHAR(255)"))
                if "entity_type" not in cols:
                    conn.execute(text("ALTER TABLE audit_logs ADD COLUMN entity_type VARCHAR(50)"))
                if "entity_id" not in cols:
                    conn.execute(text("ALTER TABLE audit_logs ADD COLUMN entity_id INTEGER"))
                if "old_values_json" not in cols:
                    conn.execute(text("ALTER TABLE audit_logs ADD COLUMN old_values_json TEXT"))
                if "new_values_json" not in cols:
                    conn.execute(text("ALTER TABLE audit_logs ADD COLUMN new_values_json TEXT"))
            # 7. Check performance_goals
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(performance_goals)"))]
            if cols:
                if "category" not in cols:
                    conn.execute(text("ALTER TABLE performance_goals ADD COLUMN category VARCHAR(50) DEFAULT 'delivery'"))
            conn.commit()
    except Exception as e:
        print(f"Warning during run_migrations: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

