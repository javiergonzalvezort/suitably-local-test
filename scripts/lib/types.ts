// Shapes of the JSON files the scripts and the agent exchange.
// The skills in .agents/skills/ describe the same shapes in plain words.

export type SourceId = "himalayas" | "remoteok" | "arbeitnow" | "linkedin" | "pasted" | "example";

// One job offer, the same shape whatever the source.
export type Offer = {
  id: string; // "<source>:<id at the source>", stable between runs
  source: SourceId;
  sourceName: string; // shown next to the offer, as the source's terms require
  title: string;
  company: string;
  url: string; // the offer's page at the source (attribution link)
  applyUrl: string; // where the candidate applies, unchanged
  locations: string[]; // allowed candidate locations; empty means not stated
  tags: string[];
  seniority?: string;
  employmentType?: string;
  salary?: string;
  postedAt: string; // ISO date
  expiresAt?: string; // ISO date: the source's expiry, or the closing date a pasted offer states
  description: string; // plain text, contact details removed; empty when aiBlocked
  aiBlocked: boolean; // the site's robots.txt opts out of AI agents: never send its text to the model
};

export type Match = "yes" | "partial" | "no" | "unknown";

export type Requirement = {
  text: string; // the requirement, as the offer states it (short)
  kind: "must" | "nice";
  match: Match;
  evidence: string; // where in the profile it is shown, or why not; "" if unknown
};

// The agent's classification of one offer (written by the rank skill).
export type Evaluation = {
  offerId: string;
  eligibility: "pass" | "fail" | "unverified";
  language: "pass" | "flag" | "fail";
  location: "pass" | "fail" | "unknown";
  seniority: "below" | "fit" | "above" | "unknown";
  dealBreakers: string[]; // items from preferences.md that this offer breaks
  requirements: Requirement[];
  strengths: string[];
  gaps: string[];
  notes: string; // one or two sentences for the candidate
};

export type Verdict = "apply" | "maybe" | "skip";

export type ScoredOffer = {
  offer: Offer;
  evaluation: Evaluation;
  score: number; // 0 to 100
  verdict: Verdict;
  reasons: string[]; // why the score was capped or reduced
};

export type Contact = {
  email?: string;
  phone?: string;
  location?: string;
  links?: string[];
};

// A tailored CV (written by the tailor skill, rendered by templates/cv.typ).
export type Cv = {
  offerId: string;
  language: "en" | "es";
  name: string;
  headline: string;
  contact: Contact;
  summary: string;
  experience: {
    title: string;
    company: string;
    location?: string;
    start: string; // YYYY-MM
    end: string; // YYYY-MM or "present"
    bullets: string[];
  }[];
  education: { degree: string; institution: string; year: string; detail?: string }[];
  skills: { group: string; items: string[] }[];
  languages: { language: string; level: string }[];
};

// A tailored cover letter (rendered by templates/cover-letter.typ).
export type CoverLetter = {
  offerId: string;
  language: "en" | "es";
  name: string;
  contact: Contact;
  date: string;
  recipient: string; // company or team
  subject: string;
  greeting: string;
  paragraphs: string[];
  closing: string;
};

// Where an application stands. "prepared": documents written, not sent yet.
export type ApplicationStatus = "prepared" | "applied" | "interview" | "offer" | "rejected" | "withdrawn";

// One entry of applications/log.json (written by the tailor and interview-prep
// skills, turned into applications.xlsx by `npm run applications`).
export type Application = {
  offerId: string;
  company: string;
  role: string;
  location?: string;
  sourceName: string;
  url: string; // the offer's page
  folder: string; // relative to the workspace, e.g. "applications/acme-data-analyst"
  status: ApplicationStatus;
  preparedAt: string; // YYYY-MM-DD
  appliedAt?: string; // YYYY-MM-DD, once the user confirms they sent it
  offerSummary: string; // two lines on what the job is; the full text is in <folder>/offer.md
  keyPoints: string[]; // what the CV and cover letter claimed, to keep the story consistent
  declared: { label: string; value: string }[]; // what the user stated when applying (salary expectation, notice period...)
  nextStep?: string; // e.g. "Interview with the hiring manager on 2026-11-20"
  notes?: string;
};

// A link with what it is, for the company facts and the reading list.
export type SourceLink = { text: string; url?: string; date?: string };

// An interview guide (written by the interview-prep skill, rendered by
// templates/interview-prep.typ into a PDF).
export type InterviewPrep = {
  language: "en" | "es"; // the language the user writes in
  name: string; // the candidate, for the file name
  company: string;
  role: string;
  interview: { stage: string; date?: string; format?: string; with?: string };
  pitch: string; // 30 seconds, three or four sentences
  alreadySaid: string[]; // key points and declared items to stay consistent with
  companyFacts: SourceLink[]; // each fact with its source
  questions: {
    group: string; // "About the role", "About your gaps", "Motivation", "Practical"
    question: string;
    why: string; // why they ask it, one line
    answer: string[]; // outline in bullets, not a script
    story?: { title: string; situation: string; action: string; result: string }; // from stories.md
  }[];
  salary: string[];
  askThem: string[];
  read: SourceLink[]; // links to read, in priority order
  lookUpYourself: string[]; // what the user checks on their own (LinkedIn page, team roles...)
  onTheDay: string[];
};
