// The one place in the code that names the project.
// Renaming the project: change these values, then the README title,
// "name" in package.json, and the two variables at the top of install.ps1 and install.sh.

export const APP_NAME = "suitably-local-test";
export const APP_VERSION = "0.1.0";
export const REPO_URL = "https://github.com/javiergonzalvezort/suitably-local-test";

// Sent with every request to job sources, so site owners can see who is calling.
export const USER_AGENT = `${APP_NAME}/${APP_VERSION} (+${REPO_URL}; personal job search, run locally by one user)`;
