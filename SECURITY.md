# Security and privacy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting ("Security" tab, "Report a vulnerability"). Do not open a public issue for security problems, and never include personal data in a report.

## How your data is handled

- Everything personal lives in the `me/` folder on your computer. It is ignored by git, and the pre-commit hook refuses commits that touch it.
- This project has no server, no account, and no telemetry. The maintainer never receives your data.
- Your profile, CV, and the job offers are read by the coding agent you choose (for example Claude Code). That means they are sent to that agent's model provider, under that provider's terms and your plan's settings (for example, whether your chats may be used for training). Check those settings before you start.
- Job sources receive only your search terms, never your name, email, or CV.
- Contact details (emails, phone numbers) found in job postings are removed before the posting is shown to the model.

## Do not fork publicly with your data

Forks of a public GitHub repository are public. Clone the repository, or use "Use this template" to create a **private** copy, and never push your `me/` folder anywhere.
