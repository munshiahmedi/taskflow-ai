CREATE TABLE users (
    id INT NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'MANAGER', 'TEAM_MEMBER') NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4;

CREATE TABLE clients (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NULL,
    phone VARCHAR(30) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4;

CREATE TABLE service_types (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    engagement_kind ENUM('ONE_TIME', 'RECURRING') NOT NULL,
    recurrence_interval ENUM('MONTHLY', 'QUARTERLY', 'YEARLY') NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_service_types_name (name)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4;

CREATE TABLE task_templates (
    id INT NOT NULL AUTO_INCREMENT,
    service_type_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_template_service_version (service_type_id, version),
    CONSTRAINT fk_template_service
        FOREIGN KEY (service_type_id) REFERENCES service_types (id)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4;

CREATE TABLE task_template_items (
    id INT NOT NULL AUTO_INCREMENT,
    template_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    sequence_no INT NOT NULL,
    due_days_after_start INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_template_item_sequence (template_id, sequence_no),
    CONSTRAINT fk_template_item_template
        FOREIGN KEY (template_id) REFERENCES task_templates (id)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4;

CREATE TABLE engagements (
    id INT NOT NULL AUTO_INCREMENT,
    client_id INT NOT NULL,
    service_type_id INT NOT NULL,
    template_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    engagement_kind ENUM('ONE_TIME', 'RECURRING') NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    recurrence_period_key VARCHAR(20) NULL,
    status ENUM('ACTIVE', 'COMPLETED', 'CANCELLED')
        NOT NULL DEFAULT 'ACTIVE',
    created_by INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_engagement_recurring_period
        (client_id, service_type_id, recurrence_period_key),
    KEY idx_engagements_created_by (created_by),
    KEY idx_engagements_service_type (service_type_id),
    KEY idx_engagements_template (template_id),
    KEY idx_engagements_period (period_start, period_end),
    CONSTRAINT fk_engagement_client
        FOREIGN KEY (client_id) REFERENCES clients (id),
    CONSTRAINT fk_engagement_service
        FOREIGN KEY (service_type_id) REFERENCES service_types (id),
    CONSTRAINT fk_engagement_template
        FOREIGN KEY (template_id) REFERENCES task_templates (id),
    CONSTRAINT fk_engagement_creator
        FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4;

CREATE TABLE tasks (
    id INT NOT NULL AUTO_INCREMENT,
    engagement_id INT NOT NULL,
    template_item_id INT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    assigned_to INT NULL,
    created_by INT NOT NULL,
    due_date DATE NULL,
    status ENUM(
        'NOT_STARTED',
        'IN_PROGRESS',
        'WAITING_FOR_CLIENT',
        'READY_FOR_REVIEW',
        'CHANGES_REQUESTED',
        'COMPLETED'
    ) NOT NULL DEFAULT 'NOT_STARTED',
    review_comment TEXT NULL,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tasks_assignee_status (assigned_to, status),
    KEY idx_tasks_due_status (due_date, status),
    KEY idx_tasks_engagement (engagement_id),
    KEY idx_tasks_template_item (template_item_id),
    KEY idx_tasks_creator (created_by),
    CONSTRAINT fk_task_engagement
        FOREIGN KEY (engagement_id) REFERENCES engagements (id),
    CONSTRAINT fk_task_template_item
        FOREIGN KEY (template_item_id)
        REFERENCES task_template_items (id),
    CONSTRAINT fk_task_assignee
        FOREIGN KEY (assigned_to) REFERENCES users (id),
    CONSTRAINT fk_task_creator
        FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4;

CREATE TABLE task_history (
    id BIGINT NOT NULL AUTO_INCREMENT,
    task_id INT NOT NULL,
    actor_id INT NOT NULL,
    old_status ENUM(
        'NOT_STARTED',
        'IN_PROGRESS',
        'WAITING_FOR_CLIENT',
        'READY_FOR_REVIEW',
        'CHANGES_REQUESTED',
        'COMPLETED'
    ) NOT NULL,
    new_status ENUM(
        'NOT_STARTED',
        'IN_PROGRESS',
        'WAITING_FOR_CLIENT',
        'READY_FOR_REVIEW',
        'CHANGES_REQUESTED',
        'COMPLETED'
    ) NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_task_history_task_date (task_id, created_at),
    KEY idx_task_history_actor (actor_id),
    CONSTRAINT fk_history_task
        FOREIGN KEY (task_id) REFERENCES tasks (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_history_actor
        FOREIGN KEY (actor_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4;
