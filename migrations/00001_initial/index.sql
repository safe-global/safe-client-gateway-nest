DROP TABLE IF EXISTS accounts CASCADE;
CREATE table accounts
(
    id                             SERIAL PRIMARY KEY,
    chain_id                       int                   NOT NULL,
    email_address                  text                  NOT NULL,
    safe_address                   character varying(42) NOT NULL,
    signer                         character varying(42) NOT NULL,
    verified                       boolean               NOT NULL DEFAULT false,
    verification_code              text,
    verification_code_generated_on timestamp with time zone,
    verification_sent_on           timestamp with time zone,
    unsubscription_token           uuid                  NOT NULL,
    UNIQUE (chain_id, safe_address, signer)
);

DROP TABLE IF EXISTS notification_types CASCADE;
CREATE TABLE notification_types
(
    id   SERIAL PRIMARY KEY,
    key  TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
);

-- Add the default notification_type: account_recovery
INSERT INTO notification_types (key, name)
VALUES ('account_recovery', 'Account Recovery');

DROP TABLE IF EXISTS subscriptions CASCADE;
CREATE TABLE subscriptions
(
    account_id        INT,
    notification_type INT,
    FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
    FOREIGN KEY (notification_type) REFERENCES notification_types (id) ON DELETE CASCADE,
    UNIQUE (account_id, notification_type)
)
