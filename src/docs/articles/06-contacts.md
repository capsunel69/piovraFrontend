# Contacts

**Route:** `/contacts`

## Purpose

- Store **display name**, **email**, and optional **description** for people you email often.
- The **AI chat snapshot** includes contacts so phrases like “email Vlad” can resolve to the right address before calling Gmail send.

## Gmail suggestions

- **Suggest from Gmail** loads recent **From / To / Cc** addresses from your mailbox (requires Google connected on Piovra with Gmail scope). Pick a row to fill the form.
- Duplicate emails (case-insensitive) are rejected by the API.

## API

- **`/v1/contacts`** CRUD and **`/v1/contacts/gmail-suggestions`** for the picker.
